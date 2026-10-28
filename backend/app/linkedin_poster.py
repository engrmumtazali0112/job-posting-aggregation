"""LinkedIn company-page auto-poster.

post_job_to_linkedin(job) publishes one text post to the Page named in LINKEDIN_ORG_URN using LinkedIn's Posts API
(POST https://api.linkedin.com/rest/posts). It is called from scheduler.linkedin_job every 2 hours.

Needs (backend/.env or Render environment):
  LINKEDIN_ACCESS_TOKEN  OAuth token with the w_organization_social scope, from a member who is an ADMIN of the Page
  LINKEDIN_ORG_URN       urn:li:organization:<number>  (a bare number is accepted)
  LINKEDIN_API_VERSION   optional, YYYYMM sent as the Linkedin-Version header

The access token expires (about 60 days). When it does, LinkedIn answers 401 and this module raises a LinkedInError with
fatal=True, so the scheduler stops the run and logs a clear message instead of retrying for every job.
"""
import re

import httpx

from .config import settings
from .models import Job

POSTS_URL = "https://api.linkedin.com/rest/posts"
MAX_COMMENTARY = 3000        # LinkedIn's limit for the post text

# LinkedIn's "little text" format treats these characters as markup, so they are escaped with a backslash
# (otherwise a "#", "_", "(" ... in a job title can cut the post short or be rejected).
_RESERVED = re.compile(r"([\\|{}@\[\]()<>#*_~])")


class LinkedInError(Exception):
    """fatal=True: the problem affects every post (no credentials, expired token, no permission, rate limit, retired API version),
    so the caller should stop. fatal=False: only this job failed; the caller can go on with the next one."""
    def __init__(self, message: str, fatal: bool = False):
        super().__init__(message)
        self.fatal = fatal


def is_configured() -> bool:
    return bool(settings.linkedin_access_token and org_urn())


def org_urn() -> str:
    """Accepts '123456789' or 'urn:li:organization:123456789'; returns '' when no number is present."""
    raw = (settings.linkedin_org_urn or "").strip()
    m = re.search(r"(\d+)\s*$", raw)
    return f"urn:li:organization:{m.group(1)}" if m else ""


def _escape(text: str) -> str:
    return _RESERVED.sub(r"\\\1", text)


def build_text(job: Job) -> str:
    link = (job.apply_url or "").strip() or f"{settings.site_url.rstrip('/')}/jobs/{job.id}"     # employer jobs have no external link
    text = (f"🚀 New Job: {job.title} at {job.company_name}. "
            f"Location: {job.location or 'Not specified'}. Apply here: {link}")
    return _escape(text)[:MAX_COMMENTARY]


def post_job_to_linkedin(job: Job) -> str:
    """Publish one job. Returns the new post's URN (e.g. urn:li:share:123). Raises LinkedInError on failure."""
    if not is_configured():
        raise LinkedInError("LINKEDIN_ACCESS_TOKEN / LINKEDIN_ORG_URN are not set", fatal=True)
    headers = {
        "Authorization": f"Bearer {settings.linkedin_access_token}",
        "Linkedin-Version": settings.linkedin_api_version,      # YYYYMM, required on every call
        "X-Restli-Protocol-Version": "2.0.0",                   # required on every call
        "Content-Type": "application/json",
    }
    body = {
        "author": org_urn(),
        "commentary": build_text(job),
        "visibility": "PUBLIC",
        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    try:
        r = httpx.post(POSTS_URL, json=body, headers=headers, timeout=30)
    except httpx.HTTPError as exc:
        raise LinkedInError(f"could not reach LinkedIn ({type(exc).__name__})", fatal=True)
    if r.status_code in (200, 201):
        return r.headers.get("x-restli-id", "")                 # the post URN is returned in this header, the body is empty
    detail = r.text[:300]                                       # never includes the token
    print(f"[linkedin] HTTP {r.status_code}: {detail}")
    if r.status_code == 401:
        raise LinkedInError("LinkedIn rejected the access token (expired or revoked). Generate a new LINKEDIN_ACCESS_TOKEN.", fatal=True)
    if r.status_code == 403:
        raise LinkedInError("LinkedIn denied access: the token needs the w_organization_social scope and its member must be an "
                            "admin of the Page.", fatal=True)
    if r.status_code == 429:
        raise LinkedInError("LinkedIn rate limit reached. Will retry on the next run.", fatal=True)
    if r.status_code == 426:
        raise LinkedInError(f"LinkedIn API version {settings.linkedin_api_version} is no longer active. "
                            "Set LINKEDIN_API_VERSION to a recent YYYYMM.", fatal=True)
    raise LinkedInError(f"LinkedIn error {r.status_code}: {detail}")
