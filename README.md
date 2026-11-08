<div align="center">

# 💼 JobBoard – AI-Powered Job Platform

### *From scraped listing to shared story: every job gets an AI-written article, a LinkedIn post and a one-tap WhatsApp apply.*

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Neon](https://img.shields.io/badge/Neon_Postgres-00E599?style=for-the-badge&logoColor=black)
![Groq](https://img.shields.io/badge/Groq_AI-F55036?style=for-the-badge&logoColor=white)
![LinkedIn](https://img.shields.io/badge/LinkedIn_Auto--Poster-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)
![WhatsApp](https://img.shields.io/badge/WhatsApp_Apply-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)

[Why JobBoard](#-why-jobboard) · [Pipeline](#-how-the-pipeline-works) · [Features](#-key-features) · [Tech Stack](#-tech-stack) · [Run Locally](#-getting-started-windows) · [Configuration](#-configuration-and-environment-variables) · [API](#-api-endpoints) · [Contact](#-contact)

</div>

---

## 🎯 Why JobBoard?

A job site for Pakistan with three kinds of users (job seekers, employers, admins) and several sources of jobs feeding one database. Most job boards are a plain list of links. JobBoard is built to stand out:

- 🧠 **AI-written articles**: every job gets a readable markdown article (role overview, interview prep) written by Groq, so pages rank better and help candidates prepare.
- 📱 **WhatsApp direct apply**: candidates message the employer in one tap, with a pre-filled message. No forms, no waiting.
- 🔗 **LinkedIn auto-share**: new jobs are posted to LinkedIn automatically, so employers get reach without extra work.
- 🎯 **Real match and ATS scoring**: candidates are scored from their resume against the job, and employers see the best matches first.
- 🔄 **Multi-source aggregation**: Arbeitnow, We Work Remotely and Jooble feed the board next to jobs posted by employers and jobs parsed from pasted text by an AI job parser.
- 🏢 **Glassdoor-style company pages** with reviews and salaries, in-app messaging, notifications and a full admin console.

---

## 🔭 How the Pipeline Works

```text
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                         JOBBOARD  AUTOMATION  PIPELINE                       │
 └──────────────────────────────────────────────────────────────────────────────┘

  STEP 1                  STEP 2                 STEP 3                 STEP 4
  ───────                 ───────                ───────                ───────
  📡 [Scraper]  ───────►  🗄️ [Neon DB]  ──────►  🧠 [Groq AI]  ──────►  📝 [Article]
  Arbeitnow, WWR,         dedupe + save          write markdown         ai_article +
  Jooble, employer        the Job row            article                ai_image_url
  posts, AI parser                                                          │
  (OpenRouter)                                                              │ saved back
                                                                            ▼
  STEP 7                  STEP 6                 STEP 5                 🗄️ [Neon DB]
  ───────                 ───────                ───────                    │
  📱 [WhatsApp Apply] ◄── 🌐 [Frontend]  ◄─────  🔗 [LinkedIn Post]  ◄──────┘
  one-tap message to      job page shows         auto-share the job,
  the employer            article + apply        social_posted = true
```

| # | Stage | What happens | Where it lives |
|---|-------|--------------|----------------|
| 1 | 📡 **Fetch** | Jobs are pulled every 30 minutes from Arbeitnow, We Work Remotely and Jooble, posted by employers, or parsed from pasted text by the AI job parser | `ingest.py`, `scheduler.py`, admin routes |
| 2 | 🗄️ **Store** | Each job is de-duplicated with a hash and saved to Neon PostgreSQL | `jobs` table |
| 3 | 🧠 **Generate** | Groq writes a markdown article for the job | `groq_article_generator.py`, `job_pipeline.py` |
| 4 | 📝 **Save** | The article and an optional validated image link are stored on the job | `ai_article`, `ai_image_url` |
| 5 | 🔗 **Share** | The job is posted to LinkedIn and flagged as shared | `linkedin_poster.py`, `social_posted` |
| 6 | 🌐 **Display** | The React frontend shows the article above the job details | job detail page |
| 7 | 📱 **Apply** | Candidates tap "Apply via WhatsApp", which uses the job's contact phone or the company number | `allow_whatsapp_apply`, `contact_phone` |

---

## ✨ Key Features

### 🏢 Employer Features (`/employer/dashboard`)

| Feature | Description |
|---------|-------------|
| 📱 **WhatsApp Direct Apply** | A per-job toggle (`allow_whatsapp_apply`) shows a green "Apply via WhatsApp" button that opens a chat with a pre-filled message. The job's `contact_phone` is preferred over the company's WhatsApp number. |
| 📊 **Candidate Pipeline** | `new → reviewing → shortlisted → contacting → interviewing → hired / rejected`. The candidate is notified on each change. |
| 🎯 **Real Match Scoring** | Every applicant gets a skill-match score from their **resume** against the job post. The list is ranked best match first, top matches are highlighted, and each card shows matched and missing skills. |
| ❓ **Screening Questions** | Add up to 10 questions per job (quick buttons for degree, current / expected salary, notice period, years of experience, or your own: Yes/No, number, multiple choice, written answer; required or optional; a preferred Yes/No answer). Answers show on the candidate card, marked ✓ or ✗ against your preferred answer. |
| ⚡ **Smart Screening** | One click to **Shortlist**, **Reject** (notifies the applicant) or **Skip** (hides the application, nobody is notified, can be restored). Select several for bulk actions, or use **Shortlist top matches**. |
| 🧾 **Job Management** | Post, edit, pause, resume, close, reopen and delete jobs. Every dashboard card links to the page it counts. |
| 💬 **Messages and Company Profile** | Message candidates, and manage the company name, website, description, logo and WhatsApp number. Public landing page at `/employer`. |

### 👤 Job Seeker Features (`/my`)

| Feature | Description |
|---------|-------------|
| 📄 **ATS Resume Builder and Scoring** | Upload a resume (PDF, PNG or JPG, max 5 MB) or a link. Text PDFs are read so employers can see how well the resume matches each job, and the page tells you when a resume cannot be read. |
| 🔔 **7 Multi-Alerts** | Save up to seven job alerts and get notified when matching jobs appear. |
| 📝 **Markdown Articles (Interview Prep)** | Every job page shows the AI-written article above the job details. |
| 📊 **Dashboard** | Profile completion and application stats. Every card and "next step" is a link that opens the matching part of the profile or the filtered applications list. |
| 📨 **Applications** | Search, status filter, sortable columns and a column chooser. The apply page (`/jobs/:id/apply`) shows the employer's screening questions. |
| 💾 **Saved Jobs and Profile** | Summary, skills, experience, education, languages and certifications. |
| 💬 **Messages and Notifications** | A job details panel sits next to the chat: company, location, type, salary, workplace, your application status and a link to the full description. |
| ⭐ **Company Reviews** | Company snapshot, rating breakdown, reviews (one per company), salaries and open jobs. |

### 🛠️ Admin Features (`/admin`)

| Feature | Description |
|---------|-------------|
| 🧩 **AI Job Parser (OpenRouter)** | Paste raw job text and get structured job rows, including the contact phone used by the WhatsApp button. |
| ✍️ **Groq Article Generator** | Writes the markdown article (and a validated image link, if one is found) for jobs. |
| 🔗 **LinkedIn Auto-Poster** | Shares new jobs to LinkedIn automatically and records `social_posted`. |
| 🔄 **Source Management** | Turn aggregation sources on or off, run aggregation now, and switch "require approval" on or off. |
| ✅ **Moderation** | Approve, reject, edit and delete jobs (single and bulk), manage users (activate, deactivate, verify) and verify companies. Every stats card opens the matching list. |

### 🌐 Public Site and Automation

- Home page with hero search, latest jobs, top companies, trending searches and admin-curated success stories.
- Job search with filters: keyword, location, source, job type, workplace (in person / remote / hybrid) and category (private / government / contract / NGO).
- Job detail page, company search, and company profiles with open jobs, reviews and salary reports.
- The scheduler runs aggregation every 30 minutes, and aggregated jobs older than `STALE_JOB_DAYS` are closed automatically.
- Optional Telegram sharing of new jobs.
- Every aggregated job gets an unclaimed company page that an employer can later own.

---

## 🧰 Tech Stack

| Layer | Technologies |
|-------|--------------|
| 🎨 **Frontend** | React, Vite, React Router |
| ⚙️ **Backend** | Python, FastAPI, SQLAlchemy 2, APScheduler, Uvicorn |
| 🗄️ **Database** | Neon (serverless PostgreSQL) in production via `psycopg`, SQLite for local work |
| 🧠 **AI and Automation** | Groq (article generation), OpenRouter (job text parsing), LinkedIn API (auto-posting), Telegram sharing, WhatsApp click-to-chat |
| 🔐 **Auth** | JWT bearer tokens, bcrypt, optional Google sign-in |
| ☁️ **Hosting** | Vercel (frontend), Render (backend) |

---

## 📁 Project Structure

```
job-posting-aggregation/
├── backend/
│   ├── app/
│   │   ├── config.py                  # settings loaded from .env
│   │   ├── database.py                # engine (SQLite or PostgreSQL), session, Base
│   │   ├── models.py                  # all tables + make_hash()
│   │   ├── schemas.py                 # Pydantic request/response models
│   │   ├── security.py                # password hashing, JWT, current_user, require_role
│   │   ├── matching.py                # skill matching: job post vs the applicant's resume text
│   │   ├── storage.py                 # resume file storage (local disk now; swap for S3/R2 later)
│   │   ├── services.py                # shared helpers (approval setting, job fields, notify, unclaimed companies)
│   │   ├── main.py                    # FastAPI app, CORS, public job list and detail
│   │   ├── routes_auth.py             # register, login, me
│   │   ├── routes_google_auth.py      # Google sign-in
│   │   ├── routes_employer.py         # employer jobs, candidates, company profile
│   │   ├── routes_seeker.py           # seeker dashboard, profile, applications, saved jobs
│   │   ├── routes_company.py          # company search, profile, reviews, salaries
│   │   ├── routes_admin.py            # admin console, ingest and AI parse endpoints
│   │   ├── routes_messages.py         # messages between employer and applicant
│   │   ├── routes_notifications.py    # notifications and navbar counts
│   │   ├── routes_home.py             # home page data (+ admin success stories)
│   │   ├── routes_seo.py              # SEO routes
│   │   ├── ingest.py                  # fetch, normalize, dedupe, save, expire jobs
│   │   ├── scheduler.py               # runs ingest every 30 minutes
│   │   ├── ai_service.py              # shared Groq client and error handling
│   │   ├── groq_article_generator.py  # Groq: writes the markdown article for a job
│   │   ├── job_pipeline.py            # ties fetch, article and social share together
│   │   ├── openrouter_jobs.py         # AI job parser (OpenRouter): pasted text -> job rows
│   │   ├── linkedin_poster.py         # posts jobs to LinkedIn
│   │   ├── social.py                  # social sharing helpers
│   │   ├── telegram.py                # optional channel sharing
│   │   ├── migrate.py                 # adds new columns to an existing database
│   │   └── create_admin.py            # CLI: create an admin user
│   ├── .env                           # local secrets (never commit)
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── main.jsx                   # entry; loads index.css, home.css, panel.css
│   │   ├── App.jsx                    # navbar, footer, route table, Protected, RoleShell
│   │   ├── auth.jsx                   # AuthProvider, useAuth, badge counts
│   │   ├── api.js                     # fetch helper, token storage, shared constants
│   │   ├── pages/                     # Home, Jobs, JobDetail (+ JobArticle styles), Company, CompanySearch,
│   │   │                              # Auth, Employer, Seeker, Admin, Inbox (Messages, Notifications)
│   │   └── components/                # PanelLayout, JobForm, JobCard, JobSplit, JobPane, SearchPill,
│   │                                  # HomeSections, Icon, ui
│   └── vite.config.js                 # proxies /api to the backend (port 8000)
├── docs/
└── README.md
```

---

## 🚀 Getting Started (Windows)

Requirements: Python 3.11+, Node.js 18+, Git, and a Neon (or any PostgreSQL) database URL for production-like runs. SQLite works for local development.

### 1️⃣ Backend

From the repository root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env      # then fill in your keys (see Configuration)
```

Create the first admin (once):

```powershell
.\venv\Scripts\python.exe -m app.create_admin admin@example.com StrongPass123
```

### 2️⃣ Database migration

```powershell
.\venv\Scripts\python.exe -m app.migrate
```

### 3️⃣ Start the API

```powershell
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

- API docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/api/health

### 4️⃣ Frontend (second terminal)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Requests to `/api` are proxied to the backend.

### 5️⃣ First data

Log in as admin → **Sources & settings** → **Run aggregation now**, or run `.\venv\Scripts\python.exe -m app.ingest`.

---

## 🔑 Configuration and Environment Variables

Create `backend/.env`. **Never commit this file.**

```env
# Database (SQLite for local work, Neon PostgreSQL in production)
DATABASE_URL=sqlite:///./jobs.db
# DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Core
SECRET_KEY=change-me-to-a-long-random-string
REQUIRE_APPROVAL=true
CORS_ORIGINS=http://localhost:5173
STALE_JOB_DAYS=30

# AI
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# LinkedIn auto-poster
LINKEDIN_ACCESS_TOKEN=your_linkedin_access_token

# Job sources and sharing
JOOBLE_API_KEY=
TELEGRAM_SHARE_AGGREGATED=false

# Resume uploads
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
| `STALE_JOB_DAYS` | Aggregated jobs older than this are closed. |
| `GROQ_API_KEY` | Groq key used to write the AI article for each job. |
| `OPENROUTER_API_KEY` | OpenRouter key used by the AI job parser (`/api/admin/ingest/ai-parse`). |
| `LINKEDIN_ACCESS_TOKEN` | Token used by the LinkedIn auto-poster. |
| `JOOBLE_API_KEY` | Required for the Jooble source (free key from jooble.org). |
| `TELEGRAM_SHARE_AGGREGATED` | Also share (up to 5 per source per run) aggregated jobs. Employer jobs are always shared when they go live. |
| `UPLOAD_DIR` | Folder for uploaded resumes (`uploads/resumes/`). Add it to `.gitignore`. On Render it is wiped on each deploy unless you attach a volume. |
| `MAX_UPLOAD_MB` | Largest resume file accepted. |
| `PUBLIC_BASE_URL` | Leave empty in development (same origin through the Vite proxy). Set to the API's public URL when frontend and API are on different domains, so resume links work for employers. |

`frontend/.env` (optional): `VITE_GOOGLE_CLIENT_ID=...` shows the Google button on login and job seeker sign-up.

---

## 🔐 Roles and Permissions

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

## 🧭 Frontend Routes

| Path | Who | Page |
|---|---|---|
| `/`, `/jobs`, `/jobs/:id`, `/companies`, `/companies/:id` | Everyone | Public pages (the job page shows the AI article and the WhatsApp button) |
| `/login`, `/register` | Everyone | Sign in, role chooser, sign-up |
| `/employer` | Everyone | Employer landing page |
| `/employer/dashboard` (`post`, `jobs`, `jobs/:id/edit`, `candidates`, `company`) | Employer | Employer panel |
| `/my` (`applications`, `saved`, `profile`) | Job seeker | Job seeker panel |
| `/jobs/:id/apply` | Job seeker | Apply page with screening questions |
| `/admin` (`jobs`, `jobs/:id/edit`, `users`, `companies`, `settings`) | Admin | Admin panel |
| `/messages`, `/notifications` | Employer, job seeker | Rendered inside the user's own sidebar layout |

---

## 🗄️ Database Tables

| Table | Purpose |
|---|---|
| `users` | email (unique), password_hash, full_name, role, is_verified, is_active, auth_provider |
| `companies` | user_id (**NULL = unclaimed**, auto-created from aggregated jobs), name, website, description, logo_url, whatsapp_number, domain_verified |
| `job_sources` | name, type (`api` / `rss` / `jooble`), endpoint, active |
| `jobs` | title, company_name, company_id, location, workplace_type, job_type, job_category, openings, hiring_timeline, salary range / period / currency, description, apply_url, source_type (`aggregated` / `employer`), source_id, status (`pending` / `published` / `paused` / `closed` / `rejected`), questions (screening questions, JSON), **allow_whatsapp_apply**, **contact_phone** (digits only, with country code), **ai_article** (markdown), **ai_image_url**, **social_posted**, **dedupe_hash** (unique), updated_at |
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

## 📡 API Endpoints

Interactive docs with every route: http://127.0.0.1:8000/docs

**Public**

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/jobs` | Published jobs. Filters: `q`, `location`, `source`, `job_type`, `workplace`, `category`, `limit` (max 50), `offset`. Total in `X-Total-Count` header |
| GET | `/api/jobs/{id}` | One published job (includes the AI article and the WhatsApp number when set) |
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
| GET / PUT | `/profile` | Read or replace the whole profile |
| POST | `/resume` | Upload a resume as multipart field `file`. PDF, PNG, JPG only, checked by content, max 5 MB |
| DELETE | `/resume` | Remove the resume |
| GET | `/dashboard`, `/applications`, `/summary` | Stats and application list |
| POST | `/jobs/{id}/apply` | Apply to an employer job. Body `{cover_letter?, answers?}`; required questions must be answered (422 otherwise). Uses the profile resume if none is sent |
| GET / POST / DELETE | `/saved`, `/saved/{id}` | Saved jobs |

**Files**: `GET /api/files/resumes/{name}` serves uploaded resumes. Names are random and unguessable; there is no login check yet (see Known Notes).

**Messages and notifications** (`/api/messages/*`, `/api/notifications/*`, any logged-in user): one conversation per application. `GET /api/messages/{application_id}` returns the messages plus `job`, `company` and, for employers, `applicant` (contact details, resume match).

**Employer** (`/api/employer/*`, role `employer`)

| Method | Path | Description |
|---|---|---|
| GET | `/dashboard` | Job and candidate counts |
| POST / GET | `/jobs` | Create / list own jobs. Body may include `questions` (up to 10), `allow_whatsapp_apply` and `contact_phone` |
| GET / PUT / DELETE | `/jobs/{id}` | Read, edit, delete. Leave `questions` out of an edit to keep the existing ones |
| POST | `/jobs/{id}/status` | `pause`, `resume`, `close`, `reopen` |
| GET | `/candidates` | Applicants with skill-match score, matched / missing skills and tab counts. Filters `job_id`, `status`, `q`, `skipped`, `min_match`; `sort=match` (default) or `newest` |
| PATCH | `/candidates/{id}` | Body `{status?, skipped?}`. Changing status notifies the applicant; skipping does not |
| POST | `/candidates/bulk` | Body `{ids, action}` with action `shortlist`, `reject`, `skip` or `restore`. Only your own applications are touched |
| GET / PUT | `/company` | Company profile (including the WhatsApp number) |

**Company reviews**: `POST /api/companies/{id}/reviews` (job seekers only, one per company).

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
| POST | `/ingest/ai-parse` | Paste raw job text; the OpenRouter AI parser creates job rows (the old `/ingest/grok` path is kept as a hidden alias) |

---

## 🔄 How Jobs Get Into the Site

### Source 1: Aggregation

```
Scheduler (every 30 min, and at startup)
   -> for each active source (Arbeitnow API, We Work Remotely RSS, Jooble)
   -> normalize: title, company, location, description, apply_url
   -> dedupe_hash = sha256(lower(title | company | location))
   -> hash exists?  skip
   -> else save as source_type="aggregated", status="published"
         + find/create an unclaimed company page
         + Groq article, then LinkedIn / Telegram share (see below)
   -> close aggregated jobs older than STALE_JOB_DAYS
```

Jooble searches Pakistan-wide plus Islamabad, Rawalpindi, Lahore and Karachi. Run manually with `python -m app.ingest`; a second run should add about 0 jobs.

### Source 2: Employer posting

```
Employer registers (company created) -> POST /api/employer/jobs
   -> "pending" if approval is required, otherwise "published"
   -> admin approves -> "published" (+ social share)
   -> editing a live job sends it back to "pending" when approval is required
```

### Source 3: AI job parser

An admin pastes raw job text into the parser (`POST /api/admin/ingest/ai-parse`). OpenRouter turns it into structured job rows and extracts the contact phone number, which later powers the WhatsApp button.

### After a job is saved: article, share, apply

1. **Groq article**: `groq_article_generator.py` writes a markdown article and `job_pipeline.py` saves it in `ai_article` (with a validated https image link in `ai_image_url` when one is found). The job page shows it above the job details.
2. **LinkedIn / Telegram share**: `linkedin_poster.py` posts the job, and `social_posted` is set once at least one network accepted the post.
3. **WhatsApp apply**: when `allow_whatsapp_apply` is on, the job page shows the green button. It opens WhatsApp with a pre-filled message to `contact_phone`, or to the company's `whatsapp_number` when the job has no phone.

---

## 🎯 Skill Matching and ATS Scoring

`app/matching.py` scores each applicant's **resume** against the job they applied to. The profile is not used: only text written in the uploaded resume counts.

1. When a resume is uploaded its text is read (PDF with `pypdf`) and stored; the text is copied to each application.
2. Known skills (about 150, with spelling variants such as `React.js` = `react`) are found in the job title and description, and in the resume.
3. Score = share of the job's skills that appear in the resume (max 90), plus up to 10 points when the job title's words also appear in the resume.
4. 70% and up is a **top match**, 45% and up is a **good match**.
5. A resume that cannot be read is **not scored** (it shows "No readable resume" and the reason) instead of getting 0%: an image (PNG/JPG) without OCR, a scanned PDF, a link to another site, or no resume at all. Candidates are told on their profile and apply pages to upload a text-based PDF.
6. Optional OCR for PNG/JPG resumes: install the Tesseract program, then `pip install pytesseract pillow`. Nothing else needs to change.

It is rule based, with no external AI service and no cost. To use an LLM later, replace `match_score()` and keep its return shape. Add new skills to `SKILLS` in the same file.

---

## 🧱 Migrations

There is no Alembic. The API adds missing columns by itself every time it starts (`add_missing_columns()` in `migrate.py`), so a fresh `git pull` and restart is enough. You can still run the full migration by hand:

```powershell
.\venv\Scripts\python.exe -m app.migrate --dry-run   # preview
.\venv\Scripts\python.exe -m app.migrate             # apply
```

It creates missing tables, adds missing columns (with scalar defaults), makes `companies.user_id` nullable on PostgreSQL, and links old aggregated jobs to company pages.

---

## 🗺️ Roadmap

- [ ] Social auto-share on more networks (Facebook Page, X, Instagram)
- [ ] Email verification, CAPTCHA, company domain verification
- [ ] Employer claim flow for unclaimed company pages
- [ ] Salary report submission form
- [ ] Analytics dashboard
- [ ] SEO: server rendering, JobPosting schema, sitemap
- [ ] Separate scheduler worker, Alembic, deployment hardening

---

## ⚠️ Known Notes and Limitations

- **Do not scrape LinkedIn or Indeed.** Use official APIs and feeds, and keep `apply_url` so visitors go back to the source.
- The scheduler runs inside the web process; move it to a worker before running more than one instance.
- `is_verified` and `domain_verified` are admin-set badges, not access gates.
- **Resume files are stored on local disk and are reachable by anyone who has the random link** (employers get it in Candidates). Before launch move them to a private bucket with signed URLs by changing only `storage.py`.
- Open one account per browser profile: tabs share `localStorage`, so logging in as a second user changes the token the other tabs send.
- Passwords are limited to 72 characters (bcrypt).
- PNG/JPG resumes can be stored but are only matched when OCR is installed (see Skill Matching). PDF is recommended.
- The apply button inside the job list's split view still applies without answers; for a job that has required questions the server refuses it and explains why.
- AI articles and LinkedIn posts need valid `GROQ_API_KEY` and `LINKEDIN_ACCESS_TOKEN` values; without them those steps are skipped or fail while the rest of the pipeline keeps working.
- `hero.mp4` in `frontend/public` is optional; the hero falls back to a gradient.

---

## 🧯 Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'groq'` | Install into the backend venv: `.\venv\Scripts\python.exe -m pip install -r requirements.txt` (the package must be listed in `requirements.txt`). |
| `SyntaxError: invalid decimal literal` pointing at `<<<<<<<`, `=======` or `>>>>>>>` | A Git merge left conflict markers in a file. Delete the marker lines, keep the code you want, and check with `.\venv\Scripts\python.exe -m compileall app`. |
| "You do not have permission" for employers or job seekers, admin works | Several accounts are logged in in the same browser; they share one token. Log out, or use a separate browser profile / Incognito per account. |
| "Cannot reach the server" on the dashboard or My applications, with `no such column` / `does not exist` in the uvicorn log | The database is missing a new column. Restart uvicorn (columns are added at startup), or run `python -m app.migrate`. |
| `ECONNREFUSED 127.0.0.1:8000` in the Vite terminal, or "server is starting up" on login | The backend is not running. Start uvicorn. |
| "No readable resume" on a candidate | The resume is an image, a scanned PDF or a link. Ask for a text-based PDF and make sure `pypdf` is installed. |
| Resume upload says "not a valid PDF" | The file content does not match its extension. Re-export the file instead of renaming it. |
| An employer job is missing from search | Check the location box. A job in Islamabad does not match location "Remote" unless its workplace type is Remote. |
| Messages page has no sidebar | Use the updated `App.jsx` (`RoleShell`) and `Seeker.jsx`. |
| `Could not import module "app.main"` | Run `.\venv\Scripts\python.exe -c "import app.main"` to see the real error. |
| Jooble shows an error in the ingest report | Set `JOOBLE_API_KEY` in `.env`. |
| Job board is empty | Run aggregation, or approve employer jobs in the admin panel. |
| `UNIQUE constraint` when creating the admin | That email already exists. |
| `venv\Scripts\activate` blocked | Call `.\venv\Scripts\python.exe ...` directly. |

---

## 📞 Contact

Questions, feedback or collaboration: **fizrahr1@gmail.com**

---

## 📄 License

Not yet chosen. Add a LICENSE file before making the repository public.

<div align="center">

⭐ If you find this project useful, give it a star.

</div>