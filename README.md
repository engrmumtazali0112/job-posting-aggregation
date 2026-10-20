# Job Posting and Aggregation Platform

A job website with two sources of jobs feeding one database:

1. **Automatic aggregation** – jobs are fetched on a schedule from external APIs and RSS feeds.
2. **Employer posting** – employers register, submit jobs, and an admin approves them.

Both sources are shown in one searchable feed with a source tag (**Aggregated** or **Employer**). Every published job will later be auto-shared to social media (see the roadmap).

- **Backend:** Python, FastAPI, SQLAlchemy, SQLite (PostgreSQL later)
- **Frontend:** React (Vite)
- **Auth:** JWT (bcrypt password hashing)
- **Scheduler:** APScheduler

---

## Table of Contents

1. [Current Status](#current-status)
2. [Project Structure](#project-structure)
3. [Getting Started (Windows)](#getting-started-windows)
4. [Configuration](#configuration)
5. [Database Tables](#database-tables)
6. [API Endpoints](#api-endpoints)
7. [How Jobs Get Into the Site](#how-jobs-get-into-the-site)
8. [Testing the Employer Flow](#testing-the-employer-flow)
9. [Roadmap](#roadmap)
10. [Known Notes and Limitations](#known-notes-and-limitations)
11. [Troubleshooting](#troubleshooting)

---

## Current Status

| Step | Feature | Status |
|---|---|---|
| 1 | Project skeleton: FastAPI backend, React frontend, unified `jobs` table, search and source filter | Done |
| 2 | Registration and login (JWT), roles, employer job submission, admin approval queue, deduplication | Done |
| 3 | Aggregation script (Arbeitnow API and RSS), 30-minute scheduler, manual admin trigger | Code added. Verify with `python -m app.ingest` |
| 4 | React screens: login, register, employer dashboard, Post Job form, admin approval page | Next |
| 5 | Social auto-share (Telegram and Facebook first) | Planned |
| 6 | More sources (Adzuna, Jooble), alerts, analytics, deployment | Planned |

---

## Project Structure

```
Project/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py            # settings loaded from .env
│   │   ├── database.py          # engine, session, Base
│   │   ├── models.py            # User, Company, JobSource, Job + make_hash()
│   │   ├── main.py              # FastAPI app, public job list, dev seed
│   │   ├── security.py          # password hashing, JWT, role checks
│   │   ├── routes_auth.py       # register, login, me
│   │   ├── routes_employer.py   # employer job submission
│   │   ├── routes_admin.py      # approve, reject, manual ingest
│   │   ├── create_admin.py      # CLI: create an admin user
│   │   ├── ingest.py            # fetch, normalize, dedupe, save jobs
│   │   └── scheduler.py         # runs ingest every 30 minutes
│   ├── .env                     # local secrets (not committed)
│   └── requirements.txt
├── frontend/
│   ├── src/App.jsx              # job board: search and source filter
│   └── vite.config.js           # proxies /api to the backend (port 8000)
└── README.md
```

---

## Getting Started (Windows)

Requirements: Python 3.11+, Node.js 18+, Git.

### 1. Backend

```powershell
cd D:\Project\backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create the first admin user (once):

```powershell
.\venv\Scripts\python.exe -m app.create_admin admin@mysite.com StrongPass123
```

Run the API:

```powershell
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

- API docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/api/health

### 2. Frontend (second terminal)

```powershell
cd D:\Project\frontend
npm install
npm run dev
```

Open http://localhost:5173. Set the filter to **All sources** to see every job.

---

## Configuration

`backend\.env` (never commit this file):

```
DATABASE_URL=sqlite:///./jobs.db
SECRET_KEY=change-me-to-a-long-random-string
REQUIRE_APPROVAL=true
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Database connection. Switch to PostgreSQL by changing this one line. |
| `SECRET_KEY` | Signs login tokens. Use a long random value. |
| `REQUIRE_APPROVAL` | `true`: employer jobs wait as `pending` until an admin approves. `false`: they publish immediately. |

---

## Database Tables

| Table | Key fields |
|---|---|
| `users` | id, email (unique), password_hash, role (`admin` / `employer` / `job_seeker`), is_verified, created_at |
| `companies` | id, user_id, name, website, domain_verified |
| `job_sources` | id, name, type (`api` / `rss` / `social`), endpoint, active |
| `jobs` | id, title, company_name, location, description, apply_url, **source_type** (`aggregated` / `employer`), source_id, company_id, **status** (`pending` / `published` / `rejected`), **dedupe_hash** (unique), created_at |

Tables are created automatically at startup.

---

## API Endpoints

Interactive docs: http://127.0.0.1:8000/docs

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| GET | `/api/jobs?q=&source=` | Public | Published jobs; search by title, company or location; `source` = `aggregated` or `employer` |
| POST | `/api/auth/register` | Public | Register as `job_seeker` or `employer` (employers must give `company_name`) |
| POST | `/api/auth/login` | Public | Returns a bearer token |
| GET | `/api/auth/me` | Logged in | Current user |
| POST | `/api/employer/jobs` | Employer | Submit a job (`pending` or `published`, per `REQUIRE_APPROVAL`) |
| GET | `/api/employer/jobs` | Employer | The employer's own jobs and their status |
| GET | `/api/admin/jobs?status=pending` | Admin | List jobs by status |
| POST | `/api/admin/jobs/{id}/approve` | Admin | Publish a job |
| POST | `/api/admin/jobs/{id}/reject` | Admin | Reject a job |
| POST | `/api/admin/ingest/run` | Admin | Run aggregation now |
| POST | `/api/dev/seed` | Dev only | Adds sample jobs (remove before launch) |

---

## How Jobs Get Into the Site

### Source 1: Automatic aggregation

```
Scheduler (every 30 min, and at startup)
   -> fetch from each active source (API or RSS)
   -> normalize to: title, company, location, description, apply_url
   -> dedupe_hash = sha256(lower(title | company | location))
   -> hash already exists?  skip
   -> otherwise save as source_type = "aggregated", status = "published"
```

Current sources (no API key required):

- **Arbeitnow**: public JSON job API
- **We Work Remotely**: RSS feed

Run it manually: `.\venv\Scripts\python.exe -m app.ingest`. Run it twice and the second run should add about 0 jobs.

### Source 2: Employer posting

```
Employer registers (company profile created)
   -> logs in, POST /api/employer/jobs
   -> saved as "pending"  (or "published" if REQUIRE_APPROVAL=false)
   -> admin approves  -> status "published", visible on the site
```

### Deduplication

Both sources use the same `make_hash()` function, so the same job from two places is stored once. Employers who submit a duplicate get `409`.

---

## Testing the Employer Flow

In http://127.0.0.1:8000/docs:

1. `POST /api/auth/register` with
   `{"email":"boss@acme.com","password":"Employer123","role":"employer","company_name":"Acme"}`
2. Click **Authorize** and log in as `boss@acme.com` / `Employer123`.
3. `POST /api/employer/jobs` with a title, a description of 20+ characters and a location. The status is `pending`.
4. Check http://localhost:5173. The job is not visible yet.
5. Log out, then authorize as `admin@mysite.com` / `StrongPass123`.
6. `GET /api/admin/jobs` shows the job. Run `POST /api/admin/jobs/{id}/approve`.
7. Refresh the React page. The job appears with the **Employer** tag.
8. Post the same job again. You get `409`.

---

## Roadmap

**Next**
- [ ] React screens: login, register, employer dashboard, Post Job form, admin approval page
- [ ] Job detail page and pagination

**Social auto-sharing** (every published job, from either source)
- [ ] Telegram channel (Bot API, easiest)
- [ ] Facebook Page (Graph API)
- [ ] X / Twitter (API v2, free tier is strictly limited)
- [ ] LinkedIn Company Page (needs developer app approval, can take weeks)
- [ ] Instagram Business (Meta Graph API, requires an image)

**Later**
- [ ] Adzuna and Jooble sources (free API keys)
- [ ] Email verification, CAPTCHA and company domain verification for employers
- [ ] Saved searches and email alerts
- [ ] Analytics dashboard
- [ ] SEO: server rendering, JobPosting schema, sitemap
- [ ] Move to PostgreSQL, separate worker process, deployment

---

## Known Notes and Limitations

- **Do not scrape LinkedIn or Indeed.** They prohibit it. Use official APIs, Adzuna, Jooble, Arbeitnow and RSS.
- Check each source's terms of use before launch, and keep the original `apply_url` so visitors are sent back to the source.
- The scheduler runs inside the web process for now. It will move to a separate worker so it does not run twice when scaling.
- `/api/dev/seed` creates fake sample jobs and should be removed.
- Employer verification (email, CAPTCHA, domain check) is not implemented yet. `is_verified` and `domain_verified` are placeholders.
- Passwords are limited to 72 characters (bcrypt limit).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ERR_CONNECTION_REFUSED` on port 8000 | The backend is not running. Start uvicorn. |
| `Could not import module "app.main"` | A file is missing in `backend\app`. Run `.\venv\Scripts\python.exe -c "import app.main"` to see the real error. |
| `No module named 'app.database'` | `database.py` is missing or misnamed (for example `.py.txt`). |
| Job board is empty | Set the filter to **All sources**; check that aggregation ran or an admin approved a job. |
| `UNIQUE constraint` when creating the admin | That email already exists. Use another email. |
| `venv\Scripts\activate` blocked | Skip activation and call `.\venv\Scripts\python.exe ...` directly. |
| Git shows `~$...docx` | Word lock file. Add `~$*` to `.gitignore`. |

---

## License

Not yet chosen. Add a LICENSE file before making the repository public.