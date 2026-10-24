"""File storage for resumes.

TEMPORARY: files are saved on local disk (settings.upload_dir) and served by FastAPI at /api/files/...
When you move to Railway / AWS S3 / Cloudflare R2, only this file has to change: keep the two
functions save_resume() and delete_file() and make them upload to the bucket and return its URL.
(On Render/Railway the disk is wiped on every deploy unless you attach a volume.)
"""
import re
import secrets
from pathlib import Path
from fastapi import HTTPException, UploadFile
from .config import settings

UPLOAD_ROOT = Path(settings.upload_dir)
RESUME_DIR = UPLOAD_ROOT / "resumes"
RESUME_DIR.mkdir(parents=True, exist_ok=True)

URL_PREFIX = "/api/files/resumes/"
MAX_BYTES = settings.max_upload_mb * 1024 * 1024
# extension -> the first bytes a real file of that type starts with
SIGNATURES = {".pdf": (b"%PDF-",), ".png": (b"\x89PNG\r\n\x1a\n",), ".jpg": (b"\xff\xd8\xff",), ".jpeg": (b"\xff\xd8\xff",)}


def save_resume(file: UploadFile) -> tuple[str, str]:
    """Validate and store an uploaded resume. Returns (url, display_name)."""
    original = Path(file.filename or "").name
    ext = Path(original).suffix.lower()
    if ext not in SIGNATURES:
        raise HTTPException(400, "Only PDF, PNG and JPG files are allowed")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"File is too large. Maximum size is {settings.max_upload_mb} MB")
    if not data:
        raise HTTPException(400, "The file is empty")
    if not data.startswith(SIGNATURES[ext]):          # extension must match the real content
        raise HTTPException(400, f"This file is not a valid {ext.lstrip('.').upper()}")
    name = secrets.token_urlsafe(18) + (".jpg" if ext == ".jpeg" else ext)   # random, unguessable
    (RESUME_DIR / name).write_bytes(data)
    display = re.sub(r"[^\w .()\-]", "", original)[:200] or "resume" + ext
    return settings.public_base_url.rstrip("/") + URL_PREFIX + name, display


def delete_file(url: str | None) -> None:
    """Delete a stored resume by its URL. Ignores external links and anything that is not ours."""
    if not url or URL_PREFIX not in url:
        return
    name = Path(url.split(URL_PREFIX, 1)[1]).name        # .name blocks path traversal
    try:
        (RESUME_DIR / name).unlink(missing_ok=True)
    except OSError:
        pass