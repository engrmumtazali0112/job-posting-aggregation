"""Auto-share newly published jobs to LinkedIn, X (Twitter) and Facebook.

Each post_to_* function returns True only when the network accepted the post. With no credentials it does nothing and returns False,
so the app runs fine before any account is linked. SOCIAL_DRY_RUN=true logs what would be sent instead of sending it.

The post text is built from the job's own title, company, location and link, NOT from the AI article, so nothing the AI (or a scraped
page) wrote is published on your accounts unreviewed.
Tokens are never printed. Each network call has a timeout and a failure never stops ingestion.
"""
import requests
from sqlalchemy.orm import Session

from .config import settings
from .models import Job

TIMEOUT = 15
TWEET_LIMIT = 280
URL_COST = 23                         # X counts every link as 23 characters


def job_url(job: Job) -> str:
    return f"{settings.site_url.rstrip('/')}/jobs/{job.id}"


def _where(job: Job) -> str:
    return f" – {job.location}" if job.location else ""


def post_text(job: Job) -> str:
    """Text for LinkedIn and Facebook (the link is sent separately)."""
    return f"New job: {job.title} at {job.company_name}{_where(job)}\nRead the full guide and apply on JobBoard.\n#jobs #hiring #Pakistan"


def tweet_text(job: Job) -> str:
    tail = "\n#jobs #hiring #Pakistan"
    head = f"New job: {job.title} at {job.company_name}{_where(job)}"
    room = TWEET_LIMIT - URL_COST - len(tail) - 2
    if len(head) > room:
        head = head[: room - 1].rstrip() + "…"
    return f"{head}\n{job_url(job)}{tail}"


def _dry(name: str, payload) -> bool:
    print(f"[social:{name}:dry-run]", payload)
    return False                       # nothing was really posted


def _send(name: str, url: str, **kwargs) -> bool:
    try:
        r = requests.post(url, timeout=TIMEOUT, **kwargs)
        if 200 <= r.status_code < 300:
            return True
        print(f"[social:{name}] rejected with HTTP {r.status_code}: {r.text[:200]}")
    except requests.RequestException as exc:
        print(f"[social:{name}] failed: {type(exc).__name__}")
    return False


def linkedin_author() -> str:
    """Who the post is published as: the Company Page (LINKEDIN_COMPANY_ID) unless LINKEDIN_AUTHOR_URN is set."""
    cid = (settings.linkedin_company_id or "").strip()
    return settings.linkedin_author_urn or (f"urn:li:organization:{cid}" if cid.isdigit() else "")


def post_to_linkedin(job: Job) -> bool:
    """POST https://api.linkedin.com/v2/ugcPosts  (UGC Posts API), authored by the Company Page urn:li:organization:<id>.
    Needs a token with w_organization_social from a Page admin; LinkedIn answers 201 Created with the post id in the x-restli-id header."""
    author = linkedin_author()
    if not (settings.linkedin_access_token and author):
        return False
    payload = {
        "author": author, "lifecycleState": "PUBLISHED",
        "specificContent": {"com.linkedin.ugc.ShareContent": {
            "shareCommentary": {"text": post_text(job)}, "shareMediaCategory": "ARTICLE",
            "media": [{"status": "READY", "originalUrl": job_url(job), "title": {"text": job.title[:200]}}]}},
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }
    if settings.social_dry_run:
        return _dry("linkedin", payload)
    return _send("linkedin", "https://api.linkedin.com/v2/ugcPosts", json=payload,
                 headers={"Authorization": f"Bearer {settings.linkedin_access_token}", "X-Restli-Protocol-Version": "2.0.0"})


def post_to_twitter(job: Job) -> bool:
    token = settings.twitter_bearer_token or settings.twitter_access_token
    if not token:
        return False
    payload = {"text": tweet_text(job)}
    if settings.social_dry_run:
        return _dry("twitter", payload)
    return _send("twitter", "https://api.twitter.com/2/tweets", json=payload,
                 headers={"Authorization": f"Bearer {token}"})


def post_to_facebook(job: Job) -> bool:
    if not (settings.facebook_page_id and settings.facebook_page_token):
        return False
    data = {"message": post_text(job), "link": job_url(job), "access_token": settings.facebook_page_token}   # token in the body, not the URL
    if settings.social_dry_run:
        return _dry("facebook", {k: v for k, v in data.items() if k != "access_token"})
    return _send("facebook", f"https://graph.facebook.com/v19.0/{settings.facebook_page_id}/feed", data=data)


POSTERS = (post_to_linkedin, post_to_twitter, post_to_facebook)


def share_jobs(db: Session, jobs: list[Job]) -> int:
    """Share up to SOCIAL_MAX_PER_RUN jobs on every linked network. A job is flagged social_posted once ANY network accepted it.
    Returns how many jobs were flagged. Safe to call with nothing configured."""
    if not jobs or not any((settings.linkedin_access_token and linkedin_author(), settings.twitter_bearer_token, settings.twitter_access_token, settings.facebook_page_token,
                            settings.social_dry_run)):
        return 0
    shared = 0
    for job in jobs[: settings.social_max_per_run]:
        if job.social_posted:
            continue
        results = []
        for poster in POSTERS:
            try:
                results.append(poster(job))
            except Exception as exc:                    # one network must never break the others or the ingest
                print(f"[social] {poster.__name__} error:", type(exc).__name__)
        if any(results):
            job.social_posted = True
            db.commit()
            shared += 1
    return shared
