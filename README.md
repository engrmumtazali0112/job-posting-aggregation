# JobBoard – Job Posting and Aggregation Platform

A job site for Pakistan with three kinds of users (job seekers, employers, admins) and two sources of jobs feeding one database:

1. **Automatic aggregation** – jobs are fetched on a schedule from Arbeitnow, We Work Remotely and Jooble.
2. **Employer posting** – employers register, post jobs, and (optionally) an admin approves them.

On top of the job feed there are Glassdoor-style company pages (reviews, salaries), a job seeker panel, an employer dashboard with a candidate pipeline, in-app messaging, notifications and an admin console.

- **Backend:** Python, FastAPI, SQLAlchemy 2, APScheduler
- **Database:** SQLite for local work, PostgreSQL (Neon) in production via `psycopg`
- **Frontend:** React 18 + Vite, React Router
- **Auth:** JWT bearer tokens, bcrypt, optional Google sign-in

---

## Table of Contents

1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Getting Started (Windows)](#getting-started-windows)
4. [Configuration](#configuration)
5. [Roles and Permissions](#roles-and-permissions)
6. [Frontend Routes](#frontend-routes)
7. [Database Tables](#database-tables)
8. [API Endpoints](#api-endpoints)
9. [How Jobs Get Into the Site](#how-jobs-get-into-the-site)
10. [Migrations](#migrations)
11. [Roadmap](#roadmap)
12. [Known Notes and Limitations](#known-notes-and-limitations)
13. [Troubleshooting](#troubleshooting)

---

## Features

**Public**
- Home page with hero search, latest jobs, top companies, trending searches and admin-curated success stories
- Job search with filters: keyword, location, source, job type, workplace (in person / remote / hybrid), category (private / government / contract / NGO)
- Job detail page, company search, company profile with open jobs, reviews and salary reports

**Job seeker** (`/my`)
- Dashboard with profile completion and application stats. Every card and "next step" is a link: a step opens the matching part of the profile (phone and location, job titles, summary, skills ...), and the stat cards open My applications with the right filter
- My applications (search, status filter, sortable columns, column chooser)
- Saved jobs, full profile (summary, skills, experience, education, languages, certifications, resume)
- Resume upload (PDF, PNG or JPG, max 5 MB) or a link; the resume is attached automatically when applying. Text PDFs are read so employers can see how well the resume matches each job (the page tells you when a resume cannot be read)
- Apply page with the employer's screening questions (`/jobs/:id/apply`); jobs with questions show an "Answer questions & apply" button
- Messages page with a job details panel next to the chat: company (rating, link), location, job type, salary, workplace, your application status and a link to the full job description
- Company page: snapshot, rating breakdown, reviews with a write-a-review form, salaries and open jobs
- Messages and notifications, shown inside the same sidebar layout as the rest of the panel
- Can review companies (one review per company)

**Employer** (`/employer/dashboard`)
- Dashboard with job and candidate counts
- Post / edit / pause / resume / close / reopen / delete jobs
- Candidate pipeline: `new → reviewing → shortlisted → contacting → interviewing → hired / rejected`; the candidate is notified on each change
- **Application questions:** add up to 10 questions when posting or editing a job (quick buttons for Bachelor's degree, current salary, expected salary, notice period, years of experience, or your own: Yes/No, number, multiple choice, written answer; required or optional; a preferred Yes/No answer). Answers appear on the candidate card, marked ✓ or ✗ against your preferred answer
- **Smart screening for busy jobs:** every applicant gets a skill-match score from their **resume** against the job post. The list is ranked best match first, top matches are highlighted, and each card shows matched and missing skills. One click to **Shortlist**, **Reject** (notifies the applicant) or **Skip** (hides the application, nobody is notified, can be restored). Select several for bulk actions, or use **Shortlist top matches**
- Every dashboard card is a link to the page it counts (for example Interviewing opens Candidates filtered to interviewing)
- Messages with candidates, company profile (name, website, description, logo)
- Public landing page at `/employer`

**Admin** (`/admin`)
- Stats (every card opens the matching list), approve / reject / edit / delete jobs (single and bulk)
- Manage users (activate, deactivate, verify), verify companies
- Turn aggregation sources on or off, run aggregation now, switch "require approval" on or off

**Automation**
- Scheduler runs aggregation every 30 minutes
- Aggregated jobs older than `STALE_JOB_DAYS` are closed automatically
- Optional Telegram sharing of new jobs
- Every aggregated job gets an unclaimed company page that an employer can later own

---

## Project Structure

```
Project/
├── backend/
│   ├── app/
│   │   ├── config.py              # settings loaded from .env
│   │   ├── database.py            # engine (SQLite or PostgreSQL), session, Base
│   │   ├── models.py              # all tables + make_hash()
│   │   ├── schemas.py             # Pydantic request/response models
│   │   ├── security.py            # password hashing, JWT, current_user, require_role
│   │   ├── matching.py            # skill matching: job post vs the applicant's resume text
│   │   ├── storage.py             # resume file storage (local disk now; swap for S3/R2 later)
│   │   ├── services.py            # shared helpers (approval setting, job fields, notify, unclaimed companies)
│   │   ├── main.py                # FastAPI app, CORS, public job list and detail
│   │   ├── routes_auth.py         # register, login, me
│   │   ├── routes_google_auth.py  # Google sign-in
│   │   ├── routes_employer.py     # employer jobs, candidates, company profile
│   │   ├── routes_seeker.py       # seeker dashboard, profile, applications, saved jobs
│   │   ├── routes_company.py      # company search, profile, reviews, salaries
│   │   ├── routes_admin.py        # admin console
│   │   ├── routes_messages.py     # messages between employer and applicant
│   │   ├── routes_notifications.py# notifications and navbar counts
│   │   ├── routes_home.py         # home page data (+ admin success stories)
│   │   ├── ingest.py              # fetch, normalize, dedupe, save, expire jobs
│   │   ├── scheduler.py           # runs ingest every 30 minutes
│   │   ├── telegram.py            # optional channel sharing
│   │   ├── migrate.py             # adds new columns to an existing database
│   │   └── create_admin.py        # CLI: create an admin user
│   ├── .env                       # local secrets (never commit)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.jsx               # entry; loads index.css, home.css, panel.css
│   │   ├── App.jsx                # navbar, footer, route table, Protected, RoleShell
│   │   ├── auth.jsx               # AuthProvider, useAuth, badge counts
│   │   ├── api.js                 # fetch helper, token storage, shared constants
│   │   ├── pages/                 # Home, Jobs, JobDetail, Company, CompanySearch, Auth,
│   │   │                          # Employer, Seeker, Admin, Inbox (Messages, Notifications)
│   │   └── components/            # PanelLayout, JobForm, JobCard, JobSplit, SearchPill,
│   │                              # HomeSections, Icon, ui
│   └── vite.config.js             # proxies /api to the backend (port 8000)
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

Create the first admin (once):

```powershell
.\venv\Scripts\python.exe -m app.create_admin admin@example.com StrongPass123
```

Run the API (tables are created at startup):

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

Open http://localhost:5173.

### 3. First data

Log in as admin → **Sources & settings** → **Run aggregation now**, or run `.\venv\Scripts\python.exe -m app.ingest`.

---

## Configuration

`backend\.env` (never commit):

```
DATABASE_URL=sqlite:///./jobs.db
SECRET_KEY=change-me-to-a-long-random-string
REQUIRE_APPROVAL=true
CORS_ORIGINS=http://localhost:5173
JOOBLE_API_KEY=
STALE_JOB_DAYS=30
TELEGRAM_SHARE_AGGREGATED=false
UPLOAD_DIR=uploads
MAX_UPLOAD_MB=5
PUBLIC_BASE_URL=
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite for local use. For Neon/PostgreSQL paste the connection string; `postgres://` and `postgresql://` are rewritten to `postgresql+psycopg://` automatically. |
| `SECRET_KEY` | Signs login tokens. Use a long random value. |
| `REQUIRE_APPROVAL` | Default for new installs. Once an admin changes it in **Sources & settings** the saved value in `app_settings` wins. |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins. |
| `JOOBLE_API_KEY` | Required for the Jooble source (free key from jooble.org). |
| `STALE_JOB_DAYS` | Aggregated jobs older than this are closed. |
| `UPLOAD_DIR` | Folder for uploaded resumes (`uploads/resumes/`). Add it to `.gitignore`. On Render/Railway it is wiped on each deploy unless you attach a volume. |
| `MAX_UPLOAD_MB` | Largest resume file accepted. |
| `PUBLIC_BASE_URL` | Leave empty in development (same origin through the Vite proxy). Set to the API's public URL (for example `https://api.mysite.com`) when frontend and API are on different domains, so resume links work for employers. |
| `TELEGRAM_SHARE_AGGREGATED` | Also share (up to 5 per source per run) aggregated jobs. Employer jobs are always shared when they go live. |

`frontend\.env` (optional): `VITE_GOOGLE_CLIENT_ID=...` shows the Google button on login and job seeker sign-up.

---

## Roles and Permissions

| Role | Can do | Backend guard |
|---|---|---|
| `job_seeker` | Own dashboard, applications, saved jobs, profile, messages, notifications, company reviews | `require_role("job_seeker")` |
| `employer` | Own jobs, candidates, company profile, messages, notifications | `require_role("employer")` |
| `admin` | Everything under `/api/admin` | `require_role("admin")` |

Rules for `require_role` in `security.py`:
- Compare **only** `user.role` (and block deactivated users with `is_active`).
- Do **not** require `is_verified`. That flag is a badge set by an admin, not a login gate. New users start with `is_verified = False`.

On the frontend, `Protected` in `App.jsx` checks the role before a panel opens. Messages and notifications use `RoleShell`, which wraps the page in the employer or job seeker layout so the sidebar never disappears.

---

## Frontend Routes

| Path | Who | Page |
|---|---|---|
| `/`, `/jobs`, `/jobs/:id`, `/companies`, `/companies/:id` | Everyone | Public pages |
| `/login`, `/register` | Everyone | Sign in, role chooser, sign-up |
| `/employer` | Everyone | Employer landing page |
| `/employer/dashboard` (`post`, `jobs`, `jobs/:id/edit`, `candidates`, `company`) | Employer | Employer panel |
| `/my` (`applications`, `saved`, `profile`) | Job seeker | Job seeker panel |
| `/admin` (`jobs`, `jobs/:id/edit`, `users`, `companies`, `settings`) | Admin | Admin panel |
| `/messages`, `/notifications` | Employer, job seeker | Rendered inside the user's own sidebar layout |

---

## Database Tables

| Table | Purpose |
|---|---|
| `users` | email (unique), password_hash, full_name, role, is_verified, is_active, auth_provider |
| `companies` | user_id (**NULL = unclaimed**, auto-created from aggregated jobs), name, website, description, logo_url, domain_verified |
| `job_sources` | name, type (`api` / `rss` / `jooble`), endpoint, active |
| `jobs` | questions (screening questions, JSON), title, company_name, company_id, location, workplace_type, job_type, job_category, openings, hiring_timeline, salary range / period / currency, description, apply_url, source_type (`aggregated` / `employer`), source_id, status (`pending` / `published` / `paused` / `closed` / `rejected`), **dedupe_hash** (unique) |
| `applications` | job_id, user_id, status (`new`, `reviewing`, `shortlisted`, `contacting`, `interviewing`, `rejected`, `hired`), cover_letter, resume_url, resume_text (text read from the resume), answers (answers to the job's questions), archived (seeker's own archive), skipped (employer hid it) (unique per job + user) |
| `saved_jobs` | job_id, user_id (unique per pair) |
| `company_reviews` | company_id, user_id, rating 1–5, title, pros, cons |
| `salary_reports` | company_id, job_title, base_salary, currency, period |
| `seeker_profiles` | resume_text, phone, location, visibility, resume, desired titles / types / pay, summary, skills, experience, education, languages, certifications |
| `notifications` | user_id, text, link, is_read |
| `messages` | application_id, sender_id, body, is_read |
| `success_stories` | home page testimonials added by an admin |
| `app_settings` | key/value settings such as `require_approval` |

---

## API Endpoints

Interactive docs with every route: http://127.0.0.1:8000/docs

**Public**

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/jobs` | Published jobs. Filters: `q`, `location`, `source`, `job_type`, `workplace`, `category`, `limit` (max 50), `offset`. Total in `X-Total-Count` header |
| GET | `/api/jobs/{id}` | One published job |
| GET | `/api/companies` | Company search with average rating, review count, open jobs |
| GET | `/api/companies/{id}` | Company profile and active jobs |
| GET | `/api/companies/{id}/reviews`, `/salaries` | Reviews and salary reports |

**Auth**

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register as `job_seeker` or `employer` (employers need `company_name`) |
| POST | `/api/auth/login` | Form login, returns bearer token and role |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/google` | Google sign-in |

**Job seeker** (`/api/seeker/*`, role `job_seeker`)

| Method | Path | Description |
|---|---|---|
| GET / PUT | `/profile` | Read or replace the whole profile (summary, skills, experience, education, languages, certifications ...) |
| POST | `/resume` | Upload a resume as multipart field `file`. PDF, PNG, JPG only, checked by content, max 5 MB |
| DELETE | `/resume` | Remove the resume |
| GET | `/dashboard`, `/applications`, `/summary` | Stats and application list |
| POST | `/jobs/{id}/apply` | Apply to an employer job. Body `{cover_letter?, answers?}`; required questions must be answered (422 otherwise). Uses the profile resume if none is sent |
| GET / POST / DELETE | `/saved`, `/saved/{id}` | Saved jobs |

**Files** – `GET /api/files/resumes/{name}` serves uploaded resumes. Names are random and unguessable; there is no login check yet (see Known Notes).

**Messages and notifications** (`/api/messages/*`, `/api/notifications/*`, any logged-in user) – one conversation per application. `GET /api/messages/{application_id}` returns the messages plus `job` (title, location, type, salary...), `company` (name, rating...) and, for employers, `applicant` (contact details, resume match). See `/docs`.

**Employer** (`/api/employer/*`, role `employer`)

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Job and candidate counts |
| POST / PUT | `/jobs`, `/jobs/{id}` | Body may include `questions` (up to 10). Leave `questions` out of an edit to keep the existing ones |
| POST / GET | `/jobs` | Create / list own jobs |
| GET / PUT / DELETE | `/jobs/{id}` | Read, edit, delete |
| POST | `/jobs/{id}/status` | `pause`, `resume`, `close`, `reopen` |
| GET | `/candidates` | Applicants with skill-match score, matched / missing skills and tab counts. Filters `job_id`, `status`, `q`, `skipped`, `min_match`; `sort=match` (default) or `newest` |
| PATCH | `/candidates/{id}` | Body `{status?, skipped?}`. Changing status notifies the applicant; skipping does not |
| POST | `/candidates/bulk` | Body `{ids, action}` with action `shortlist`, `reject`, `skip` or `restore`. Only your own applications are touched |
| GET / PUT | `/company` | Company profile |

**Company reviews** – `POST /api/companies/{id}/reviews` (job seekers only, one per company).

**Admin** (`/api/admin/*`, role `admin`)

| Method | Path | Description |
|---|---|---|
| GET | `/stats` | Totals for users, jobs, applications, companies |
| GET / PUT / DELETE | `/jobs`, `/jobs/{id}` | List, edit, delete |
| POST | `/jobs/{id}/approve`, `/reject`, `/jobs/bulk` | Moderation |
| GET / PATCH | `/users`, `/users/{id}` | Activate, deactivate, verify |
| GET / PATCH | `/companies`, `/companies/{id}` | Verify domain |
| GET / PATCH | `/sources`, `/sources/{id}` | Turn sources on or off |
| GET / PUT | `/settings` | `require_approval` |
| POST | `/ingest/run` | Run aggregation now |

---

## How Jobs Get Into the Site

### Source 1: Aggregation

```
Scheduler (every 30 min, and at startup)
   -> for each active source (Arbeitnow API, We Work Remotely RSS, Jooble)
   -> normalize: title, company, location, description, apply_url
   -> dedupe_hash = sha256(lower(title | company | location))
   -> hash exists?  skip
   -> else save as source_type="aggregated", status="published"
         + find/create an unclaimed company page
   -> close aggregated jobs older than STALE_JOB_DAYS
```

Jooble searches Pakistan-wide plus Islamabad, Rawalpindi, Lahore and Karachi. Run manually with `python -m app.ingest`; a second run should add about 0 jobs.

### Source 2: Employer posting

```
Employer registers (company created) -> POST /api/employer/jobs
   -> "pending" if approval is required, otherwise "published"
   -> admin approves -> "published" (+ Telegram share)
   -> editing a live job sends it back to "pending" when approval is required
```

---

## Skill matching

`app/matching.py` scores each applicant's **resume** against the job they applied to. The profile is not used: only text written in the uploaded resume counts.

1. When a resume is uploaded its text is read (PDF with `pypdf`) and stored; the text is copied to each application.
2. Known skills (about 150, with spelling variants such as `React.js` = `react`) are found in the job title and description, and in the resume.
3. Score = share of the job's skills that appear in the resume (max 90), plus up to 10 points when the job title's words also appear in the resume.
4. 70% and up is a **top match**, 45% and up is a **good match**.
5. A resume that cannot be read is **not scored** (it shows "No readable resume" and the reason) instead of getting 0%: an image (PNG/JPG) without OCR, a scanned PDF, a link to another site, or no resume at all. Candidates are told on their profile and apply pages to upload a text-based PDF.
6. Optional OCR for PNG/JPG resumes: install the Tesseract program, then `pip install pytesseract pillow`. Nothing else needs to change.

It is rule based, with no external AI service and no cost. To use an LLM later, replace `match_score()` and keep its return shape. Add new skills to `SKILLS` in the same file.

---

## Migrations

There is no Alembic. The API now adds missing columns by itself every time it starts (`add_missing_columns()` in `migrate.py`), so a fresh `git pull` and restart is enough. You can still run the full migration by hand:

```powershell
.\venv\Scripts\python.exe -m app.migrate --dry-run   # preview
.\venv\Scripts\python.exe -m app.migrate             # apply
```

It creates missing tables (and adds `applications.skipped` after the screening update), adds missing columns (with scalar defaults), makes `companies.user_id` nullable on PostgreSQL, and links old aggregated jobs to company pages.

---

## Roadmap

- [ ] Social auto-share beyond Telegram (Facebook Page, X, LinkedIn, Instagram)
- [ ] Email verification, CAPTCHA, company domain verification
- [ ] Saved searches and email alerts
- [ ] Employer claim flow for unclaimed company pages
- [ ] Salary report submission form
- [ ] Analytics dashboard
- [ ] SEO: server rendering, JobPosting schema, sitemap
- [ ] Separate scheduler worker, Alembic, deployment

---

## Known Notes and Limitations

- **Do not scrape LinkedIn or Indeed.** Use official APIs and feeds, and keep `apply_url` so visitors go back to the source.
- The scheduler runs inside the web process; move it to a worker before running more than one instance.
- `is_verified` and `domain_verified` are admin-set badges, not access gates.
- **Resume files are stored on local disk and are reachable by anyone who has the random link** (employers get it in Candidates). Before launch move them to a private bucket with signed URLs by changing only `storage.py`.
- Open one account per browser profile (or per tab if the token is kept in `sessionStorage`): tabs share `localStorage`, so logging in as a second user changes the token the other tabs send.
- Passwords are limited to 72 characters (bcrypt).
- PNG/JPG resumes can be stored but are only matched when OCR is installed (see Skill matching). PDF is recommended.
- Application questions are shown on the job page through an "Answer questions & apply" button and the `/jobs/:id/apply` page. The apply button inside the job list's split view still applies without answers; for a job that has required questions the server refuses it and explains why.
- `hero.mp4` in `frontend/public` is optional; the hero falls back to a gradient.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "You do not have permission" for employers or job seekers, admin works | Several accounts are logged in in the same browser; they share one token. Log out, or use a separate browser profile / Incognito per account. |
| Profile "Add your phone number" step shows no phone field | Fixed: the step now opens the Edit profile form (`/my/profile?focus=basics`). |
| "Cannot reach the server" when saving the profile | Fixed: `ProfileIn` in `schemas.py` now includes summary, skills, experience, education, languages and certifications. Restart uvicorn after updating. |
| "Cannot reach the server" on the employer dashboard or My applications, with `no such column` / `does not exist` in the uvicorn log | The database is missing a new column. Restart uvicorn (columns are added at startup), or run `python -m app.migrate`. |
| "No readable resume" on a candidate | The resume is an image, a scanned PDF or a link. Ask for a text-based PDF. Make sure `pypdf` is installed (`pip install pypdf`). |
| Resume upload says "not a valid PDF" | The file content does not match its extension. Re-export the file instead of renaming it. |
| An employer job is missing from search | Check the location box. A job in Islamabad does not match location "Remote" unless its workplace type is Remote. |
| Messages page has no sidebar | Use the updated `App.jsx` (`RoleShell`) and `Seeker.jsx`. |
| `ERR_CONNECTION_REFUSED` on port 8000 | Backend not running. Start uvicorn. |
| `Could not import module "app.main"` | Run `.\venv\Scripts\python.exe -c "import app.main"` to see the real error. |
| `column ... does not exist` after an update | Run `python -m app.migrate`. |
| Jooble shows an error in the ingest report | Set `JOOBLE_API_KEY` in `.env`. |
| Job board is empty | Run aggregation, or approve employer jobs in the admin panel. |
| `UNIQUE constraint` when creating the admin | That email already exists. |
| `venv\Scripts\activate` blocked | Call `.\venv\Scripts\python.exe ...` directly. |

---

## License

Not yet chosen. Add a LICENSE file before making the repository public.