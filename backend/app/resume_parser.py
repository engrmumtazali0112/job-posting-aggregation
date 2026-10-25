"""Resume reader used by the employer Candidates page.

(Named resume_parser.py and kept next to services.py: a `services/` folder would clash with services.py.)

read_resume(url) -> (text, state)
  * our own uploads are read from disk; http(s) links to a PDF are downloaded (size and time limited,
    private / local addresses are refused)
  * PDF text comes from pypdf, with pdfplumber as a fallback; images use OCR only if pytesseract is installed
  * state: ok | none | link | image | scanned | missing | unreadable
Results are remembered in memory per file, so the same resume is not parsed on every request.
"""
import ipaddress
import socket
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

from . import storage

MAX_DOWNLOAD = 5 * 1024 * 1024
MIN_CHARS = 30
_cache: dict[tuple, tuple[str, str]] = {}


def _pdf_text(data: bytes) -> tuple[str, bool]:
    """Returns (text, reliable). reliable=False when no PDF library worked, so the caller should not remember '' ."""
    text, reliable = "", False
    try:
        from pypdf import PdfReader
        text = "\n".join((pg.extract_text() or "") for pg in PdfReader(BytesIO(data)).pages[:20])
        reliable = True
    except Exception as exc:
        print("[resume] pypdf failed:", repr(exc))
    if len(text.strip()) < MIN_CHARS:                     # fallback for PDFs pypdf cannot read well
        try:
            import pdfplumber
            with pdfplumber.open(BytesIO(data)) as pdf:
                alt = "\n".join((pg.extract_text() or "") for pg in pdf.pages[:20])
            if len(alt.strip()) > len(text.strip()):
                text = alt
            reliable = True
        except Exception as exc:
            print("[resume] pdfplumber failed:", repr(exc))
    return text.strip()[:storage.MAX_TEXT], reliable


def _safe_public_host(host: str) -> bool:
    try:
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
        return True
    except Exception:
        return False


def _download(url: str) -> bytes | None:
    u = urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname or not _safe_public_host(u.hostname):
        return None
    try:
        import requests
        with requests.get(url, timeout=8, stream=True, allow_redirects=False) as r:
            if r.status_code != 200:
                return None
            data = b""
            for chunk in r.iter_content(65536):
                data += chunk
                if len(data) > MAX_DOWNLOAD:
                    return None
            return data
    except Exception as exc:
        print("[resume] download failed:", repr(exc))
        return None


def read_resume(url: str | None) -> tuple[str, str]:
    if not url:
        return "", "none"
    local = storage.local_path(url)
    if local:
        st = local.stat()
        key = (str(local), st.st_size, st.st_mtime_ns)
        if key in _cache:
            return _cache[key]
        if local.suffix.lower() == ".pdf":
            text, reliable = _pdf_text(local.read_bytes())
            state = "ok" if len(text) >= MIN_CHARS else ("scanned" if reliable else "unreadable")
        else:
            text = storage._ocr(local).strip()[:storage.MAX_TEXT]
            state = "ok" if len(text) >= MIN_CHARS else "image"
        res = (text if state == "ok" else "", state)
        if state != "unreadable":
            _cache[key] = res
        return res
    if storage.URL_PREFIX in url:                         # one of our links, but the file is gone
        return "", "missing"
    key = ("url", url)
    if key in _cache:
        return _cache[key]
    data = _download(url)
    if not data or not data.startswith(b"%PDF-"):
        return "", "link"                                  # a web page or a file we cannot read
    text, reliable = _pdf_text(data)
    res = (text, "ok") if len(text) >= MIN_CHARS else ("", "scanned")
    if reliable:
        _cache[key] = res
    return res
