# Update notes

## Deploy order
1. Copy the files over your repo. `frontend/src/api.js` and `auth.jsx` were missing from the upload, so I rewrote them. Diff them against yours; keep your own API base URL if it differs.
2. Add to requirements.txt if missing: `google-auth`, `requests`.
3. Backend: `python -m app.migrate --dry-run`, then `python -m app.migrate`.
   It adds new columns/tables, drops NOT NULL on `companies.user_id` (Postgres), and links existing aggregated jobs to new unclaimed company pages.
   On local SQLite, delete `jobs.db` instead (SQLite cannot drop NOT NULL).
4. Set the new env vars (see `backend/.env.example`). `ENVIRONMENT=production` makes the app refuse to boot with the default SECRET_KEY.
5. Push backend to GitHub (Render), then `vercel --prod` for the frontend.

## Backend
- Unclaimed company pages are auto-created for aggregated jobs; `JobPublic` now includes `company_id` (company links on job cards never worked before).
- `GET /api/companies?q=` search with rating, review count and open jobs. Company detail returns proper `JobPublic` objects.
- `routes_google_auth.py`: `POST /api/auth/google` (new Google users are job seekers). Registered in `main.py`.
- Applying is blocked for aggregated jobs (use the external link).
- Seeker profile (phone, city, visibility, resume link, job titles/types, min pay, relocation, availability), `GET /seeker/summary` for tab counts, archive/unarchive applications. Seeker queries use joins (no N+1).
- Notifications (`/api/notifications`, `/counts`, `/read`) are created on apply, status changes, job approval/rejection and new messages.
- Messages (`/api/messages/threads`, `/{application_id}`) between a candidate and the employer, per application.
- Telegram auto-share for employer jobs when they go live (`telegram.py`); aggregated sharing is opt-in and capped at 5 per source per run.
- Aggregated jobs older than `STALE_JOB_DAYS` are closed after each ingest.
- `/api/jobs` now returns `X-Total-Count`. `RUN_SCHEDULER=false` disables the scheduler on extra workers.

## Frontend
- Indeed-style peach/navy theme (`index.css`), role-aware navbar with saved/messages/notification badges and an account menu that closes on outside click.
- Home and Jobs: pill search + two-pane list/detail layout (list only on phones).
- My jobs with Saved / Applied / Interviews / Archived tabs and counts; Update status menu.
- Profile with Resume and Preferences tabs. Notifications and Messages pages.
- Google button on Login/Register (needs `VITE_GOOGLE_CLIENT_ID`).
- `Employer.jsx` was empty in the upload; rebuilt: landing page with FAQ and image placeholders, dashboard, post/edit job, my jobs, candidates, company profile.
- JobPosting JSON-LD is injected for the job on screen. Only crawlers that run JavaScript see it; for stronger SEO later, consider prerendering.
- Company search page is wired to the API (the old page linked to a route that did not exist).

## Not done yet
- Email alerts (needs a SendGrid/Mailgun key and a saved-search table).
- Resume file upload (profile uses a link for now).
- Claiming an existing unclaimed company when an employer registers with the same name.
- Rate limiting on login/register.
