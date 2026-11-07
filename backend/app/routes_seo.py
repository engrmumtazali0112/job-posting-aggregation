"""Dynamic sitemap for search engines.

GET /api/sitemap.xml lists the public pages, every published job and every company that has a published job.
The links point at the FRONTEND (settings.site_url), so set SITE_URL to the real site address in production.
vercel.json rewrites /sitemap.xml to this endpoint, which is the address robots.txt advertises.
"""
from datetime import datetime
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Company, Job

router = APIRouter(tags=["seo"])

MAX_URLS = 45000            # the sitemap protocol allows 50,000 per file
STATIC_PAGES = [("/", "daily", "1.0"), ("/jobs", "hourly", "0.9"), ("/companies", "daily", "0.7"), ("/employer", "monthly", "0.5"),
                ("/about", "monthly", "0.3"), ("/contact", "monthly", "0.3"), ("/privacy", "yearly", "0.2"), ("/terms", "yearly", "0.2")]


def _day(dt: datetime | None) -> str | None:
    return dt.strftime("%Y-%m-%d") if dt else None


def _url(base: str, path: str, lastmod: str | None = None, freq: str | None = None, priority: str | None = None) -> str:
    parts = [f"<loc>{escape(base + path)}</loc>"]
    if lastmod:
        parts.append(f"<lastmod>{lastmod}</lastmod>")
    if freq:
        parts.append(f"<changefreq>{freq}</changefreq>")
    if priority:
        parts.append(f"<priority>{priority}</priority>")
    return "<url>" + "".join(parts) + "</url>"


@router.get("/api/sitemap.xml")
def sitemap(db: Session = Depends(get_db)):
    base = settings.site_url.rstrip("/")
    urls = [_url(base, p, freq=f, priority=pr) for p, f, pr in STATIC_PAGES]
    jobs = db.execute(select(Job.id, Job.company_id, Job.created_at, Job.updated_at).where(Job.status == "published")
                      .order_by(Job.created_at.desc()).limit(MAX_URLS - 2000)).all()
    company_ids = set()
    for jid, cid, created, updated in jobs:
        urls.append(_url(base, f"/jobs/{jid}", _day(updated or created), "weekly", "0.8"))
        if cid:
            company_ids.add(cid)
    if company_ids:
        for (cid,) in db.execute(select(Company.id).where(Company.id.in_(company_ids)).order_by(Company.id).limit(2000)).all():
            urls.append(_url(base, f"/companies/{cid}", freq="weekly", priority="0.6"))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(urls) + "\n</urlset>\n")
    return Response(content=xml, media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})
