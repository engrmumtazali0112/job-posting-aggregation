"""Real Match: a job match score based on PROOF, not only on what the candidate typed.

(Lives in app/real_match.py, not app/services/: a services/ package would shadow your existing services.py.)

real_match score (0-100) = 30% resume + 40% GitHub + 30% links
  resume (30%) : the job's skills found in the written resume / profile (matching.match_score)
  GitHub (40%) : the job's skills found in the candidate's OWN public repos (language, topics, name, description).
                 A skill seen in 3+ weighted repos counts fully; repos not pushed for 2 years count half; forks are ignored.
  links  (30%) : 25% a well-formed LinkedIn profile link (format only: LinkedIn cannot be read without its restricted API)
                 + 25% a portfolio site that loads and has readable text, + up to 50% for the job's skills it mentions.
A candidate without GitHub or portfolio gets 0 for those parts, so the score stays low until there is proof.

Network results are cached in memory (GitHub / pages: 6 hours, failures: 10 minutes). Set GITHUB_TOKEN to raise
GitHub's unauthenticated limit of 60 requests per hour. Portfolio pages are fetched with the same private-address
protection as resume downloads (no localhost / internal IPs, redirects re-checked, 1 MB cap).
"""
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests

from .config import settings
from .matching import find_skills, label, match_score
from .resume_parser import _safe_public_host

W_RESUME, W_GITHUB, W_LINKS = 0.30, 0.40, 0.30
OK_TTL, FAIL_TTL = 6 * 3600, 600
MAX_PAGE = 1024 * 1024
UA = "JobBoard-RealMatch/1.0 (candidate skill verification)"

# GitHub's "primary language" -> the canonical skill names used in matching.SKILLS
LANG_SKILL = {
    "python": "python", "javascript": "javascript", "typescript": "typescript", "java": "java", "c++": "c++", "c#": "c#",
    "go": "golang", "rust": "rust", "kotlin": "kotlin", "swift": "swift", "dart": "dart", "php": "php", "ruby": "ruby",
    "html": "html", "css": "css", "scss": "css", "shell": "bash", "dockerfile": "docker", "hcl": "terraform", "vue": "vue",
    "svelte": "svelte", "solidity": "solidity", "tsql": "sql", "plpgsql": "postgresql",
}

_cache: dict[str, tuple[float, dict]] = {}
_lock = threading.Lock()


def _cached(key: str, fn) -> dict:
    now = time.time()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] > now:
            return hit[1]
    data = fn()
    ttl = OK_TTL if data.get("state") in ("ok", "not_found", "blocked", "empty") else FAIL_TTL
    with _lock:
        _cache[key] = (now + ttl, data)
    return data


# ---------------- GitHub ----------------
def github_username(url: str | None) -> str | None:
    if not url:
        return None
    u = urlparse(url if "//" in url else "https://" + url)
    if (u.hostname or "").lower() not in ("github.com", "www.github.com"):
        return None
    parts = [x for x in u.path.split("/") if x]
    if not parts or not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})", parts[0]):
        return None
    return parts[0]


def _spaced(text: str) -> str:
    return re.sub(r"[-_/]", " ", text)


def _fetch_github(username: str) -> dict:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": UA}
    if settings.github_token:
        headers["Authorization"] = "Bearer " + settings.github_token
    try:
        r = requests.get(f"https://api.github.com/users/{username}/repos",
                         params={"per_page": 100, "sort": "pushed"}, headers=headers, timeout=6)
        if r.status_code == 404:
            return {"state": "not_found", "username": username}
        if r.status_code in (403, 429):
            return {"state": "rate_limited", "username": username}
        if r.status_code != 200:
            return {"state": "unreachable", "username": username}
        repos = r.json()
    except Exception as exc:
        print("[real_match] github failed:", repr(exc))
        return {"state": "unreachable", "username": username}

    now = datetime.now(timezone.utc)
    weights: dict[str, float] = {}
    langs: dict[str, float] = {}
    own = active = 0
    for repo in repos if isinstance(repos, list) else []:
        if repo.get("fork"):                                   # someone else's code
            continue
        own += 1
        try:
            age = (now - datetime.fromisoformat((repo.get("pushed_at") or "").replace("Z", "+00:00"))).days
        except Exception:
            age = 9999
        recent = age <= 730
        active += 1 if recent else 0
        w = 1.0 if recent else 0.5
        lang = repo.get("language") or ""
        found = set()
        if LANG_SKILL.get(lang.lower()):
            found.add(LANG_SKILL[lang.lower()])
        if lang:
            langs[lang] = langs.get(lang, 0) + w
        text = " ".join([repo.get("name") or "", repo.get("description") or "", " ".join(repo.get("topics") or [])])
        found |= find_skills(text) | find_skills(_spaced(text))
        for s in found:
            weights[s] = weights.get(s, 0) + w
    top = [k for k, _ in sorted(langs.items(), key=lambda kv: -kv[1])[:3]]
    return {"state": "ok", "username": username, "repos": own, "active_repos": active, "weights": weights, "languages": top}


def github_profile(url: str | None) -> dict:
    if not url:
        return {"state": "none"}
    name = github_username(url)
    if not name:
        return {"state": "invalid"}
    return _cached("gh:" + name.lower(), lambda: _fetch_github(name))


# ---------------- portfolio ----------------
class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript", "svg"):
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "svg") and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def _fetch_page(url: str) -> dict:
    cur = url
    for _ in range(4):                                         # follow a few redirects, re-checking every host
        u = urlparse(cur)
        if u.scheme not in ("http", "https") or not u.hostname or not _safe_public_host(u.hostname):
            return {"state": "blocked"}
        try:
            with requests.get(cur, timeout=6, stream=True, allow_redirects=False, headers={"User-Agent": UA}) as r:
                if r.status_code in (301, 302, 303, 307, 308):
                    cur = urljoin(cur, r.headers.get("Location", ""))
                    continue
                ctype = r.headers.get("Content-Type", "").lower()
                if r.status_code != 200 or ("html" not in ctype and "text" not in ctype):
                    return {"state": "unreachable"}
                data = b""
                for chunk in r.iter_content(65536):
                    data += chunk
                    if len(data) > MAX_PAGE:
                        break
        except Exception as exc:
            print("[real_match] page failed:", repr(exc))
            return {"state": "unreachable"}
        parser = _Text()
        try:
            parser.feed(data.decode("utf-8", errors="replace"))
        except Exception:
            pass
        text = " ".join(parser.parts)
        words = len(text.split())
        if words < 30:                                         # JavaScript-only sites have no readable text
            return {"state": "empty", "words": words}
        return {"state": "ok", "words": words, "skills": sorted(find_skills(text) | find_skills(_spaced(text)))}
    return {"state": "unreachable"}


def portfolio_page(url: str | None) -> dict:
    if not url:
        return {"state": "none"}
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return _cached("web:" + url, lambda: _fetch_page(url))


def linkedin_ok(url: str | None) -> bool:
    return bool(re.search(r"linkedin\.com/in/[\w\-%]{3,}", url or "", re.I))


# ---------------- scoring ----------------
def _safe(fn, arg) -> None:
    try:
        fn(arg)
    except Exception as exc:
        print("[real_match] prefetch failed:", repr(exc))


def prefetch(pairs: list[tuple[str | None, str | None]]) -> None:
    """Warm the caches for many candidates at once (parallel), so the scoring loop does not wait on each one."""
    jobs = [(github_profile, u) for u in {g for g, _ in pairs if g}] + [(portfolio_page, w) for w in {w for _, w in pairs if w}]
    if jobs:
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(lambda j: _safe(j[0], j[1]), jobs))


def real_match(job_title: str, job_description: str, written_text: str | None, github_url: str | None = None,
               linkedin_url: str | None = None, portfolio_url: str | None = None) -> dict:
    job_terms = find_skills(f"{job_title}\n{job_description}")

    resume = match_score(job_title, job_description, written_text)
    resume_part = resume["score"] / 100 if resume["scored"] else 0.0

    gh = github_profile(github_url)
    gh_part, gh_verified = 0.0, []
    if gh.get("state") == "ok" and gh.get("repos"):
        if job_terms:
            strengths = {t: min(1.0, gh["weights"].get(t, 0) / 3) for t in job_terms}
            gh_part = sum(strengths.values()) / len(job_terms)
            gh_verified = [t for t, s in strengths.items() if s > 0]
        else:                                                  # job names no known skill: reward real, recent activity only
            gh_part = min(1.0, gh.get("active_repos", 0) / 5) * 0.5

    page = portfolio_page(portfolio_url)
    li = linkedin_ok(linkedin_url)
    links_part, site_verified = 0.25 if li else 0.0, []
    if page.get("state") == "ok":
        links_part += 0.25
        if job_terms:
            site_verified = [t for t in job_terms if t in page.get("skills", [])]
            links_part += 0.5 * len(site_verified) / len(job_terms)
        else:
            links_part += 0.25

    score = int(round(100 * (W_RESUME * resume_part + W_GITHUB * gh_part + W_LINKS * min(1.0, links_part))))
    return {
        "score": score,
        "level": "top" if score >= 70 else "good" if score >= 45 else "low",
        "resume_part": int(round(resume_part * 100)),
        "github_part": int(round(gh_part * 100)),
        "links_part": int(round(min(1.0, links_part) * 100)),
        "github_verified": sorted(label(t) for t in gh_verified),
        "portfolio_verified": sorted(label(t) for t in site_verified),
        "github": {"state": gh.get("state", "none"), "username": gh.get("username"), "repos": gh.get("repos", 0),
                   "languages": gh.get("languages", [])},
        "portfolio_state": page.get("state", "none"),
        "linkedin_ok": li,
        "has_proof": bool((gh.get("state") == "ok" and gh.get("repos")) or page.get("state") == "ok"),
    }
