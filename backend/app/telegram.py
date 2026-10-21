import httpx
from .config import settings
from .models import Job


def _text(job: Job) -> str:
    pay = ""
    if job.salary_min or job.salary_max:
        lo, hi = job.salary_min, job.salary_max
        pay = f"\n💰 Rs {lo:,} - {hi:,} / {job.salary_period}" if lo and hi else f"\n💰 Rs {(lo or hi):,} / {job.salary_period}"
    return (f"<b>{job.title}</b>\n🏢 {job.company_name}\n📍 {job.location or 'Not specified'}{pay}\n\n"
            f"{settings.site_url.rstrip('/')}/jobs/{job.id}")


def share_jobs(jobs: list[Job]) -> None:
    """Post newly published jobs to the Telegram channel. Silent no-op if not configured."""
    if not (settings.telegram_bot_token and settings.telegram_chat_id):
        return
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    for job in jobs:
        try:
            httpx.post(url, timeout=10, json={"chat_id": settings.telegram_chat_id, "text": _text(job),
                                               "parse_mode": "HTML", "disable_web_page_preview": False})
        except Exception as exc:
            print("[telegram] failed:", exc)
