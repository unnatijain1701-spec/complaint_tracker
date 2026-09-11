# Urban Harvest Complaint Tracker

Internal operational tool for logging and tracking customer complaints.
Plain HTML/CSS/JS frontend, Node/Express API, PostgreSQL — no build step.

Being built in phases per `PROJECT_BRIEF.md`. All 8 phases from the
brief's build order are done: schema/migrations, complaint logging +
listing + status/resolution updates, image attachments, the
priority-suggestion engine + SLA due dates, email alerts, a Chart.js
dashboard, full filters + search, Excel export, login, an audit trail,
Railway deployment config, and the legacy-import stub. Per §9 of the
brief, the legacy import (`scripts/import_legacy_excel.js`) is
deliberately a structural stub — no real column-mapping logic — until
a sample of the actual legacy export is available.

See [`DEPLOY.md`](./DEPLOY.md) for Railway setup (Postgres, Volume,
env vars, the Cron Job digest service).

The auto-Critical keyword list (`lib/priority.js`) is currently just the
example set from the brief (`contamination`, `foreign object`, `illness`,
`safety`) — swap in real examples from past critical complaints when
available.

## Setup

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL
npm run migrate        # applies db/migrations/*.sql in order
npm start               # http://localhost:3000
```

Set `UPLOAD_DIR` to where images should be written. On Railway this should
be the mount path of a persistent Volume (e.g. `/data/uploads`); locally it
defaults to `./data/uploads`.

### Login

Not enterprise SSO — a small team roster (name, email, bcrypt hash) in
the `users` table. Add real accounts interactively (run it in a real
terminal, not piped — it prompts for name/email/password):

```bash
npm run seed:user
```

Set `SESSION_SECRET` to a long random string in `.env`; sessions are
stored in Postgres (`connect-pg-simple`, auto-creates its `session`
table) so they survive a restart as long as the secret stays the same.
Every page redirects to `login.html` if not authenticated, and every
`/api/*` route (except `/api/login`, `/api/session`, `/api/health`)
requires a session.

### Email alerts

Uses generic SMTP (via `nodemailer`) so it works with a Gmail app
password, Resend, SendGrid, or anything else's SMTP relay — set
`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` in `.env` for
whichever you use. Leave them unset and the app logs instead of sending
(nothing crashes). `ALERT_RECIPIENTS` is a required, comma-separated list
with no default — fill it in before relying on alerts.

- Immediate: a Critical/High complaint fires an alert email on submit.
- Daily digest: `npm run digest` (`scripts/send_overdue_digest.js`) emails
  every Open/In Progress complaint past its `sla_due_at`, grouped by
  plant. Meant to run as a Railway Cron Job (Settings → Cron Schedule) —
  suggested schedule `30 3 * * *` UTC (9am IST).
- In-app: `complaints.html` highlights overdue rows.

## Structure

- `server.js` — Express app, serves `public/` and mounts `/api/*`
- `db/index.js` — Postgres connection pool
- `db/migrate.js` — tiny migration runner (tracks applied files in `schema_migrations`)
- `db/migrations/` — numbered, ordered SQL migrations
- `middleware/upload.js` — multer config (disk storage, image-only, 8MB/5-file limits)
- `lib/priority.js` — priority-suggestion engine + SLA due-date calculation
- `lib/mailer.js` — generic SMTP transport wrapper
- `lib/alerts.js` — immediate Critical/High alert email
- `scripts/send_overdue_digest.js` — daily overdue digest (Railway Cron Job target)
- `scripts/seed_user.js` — interactive CLI to add/update a team login
- `scripts/import_legacy_excel.js` — legacy-import stub (§9 — not implemented yet, see the file's header comment)
- `middleware/session.js` — express-session (Postgres-backed) + `requireAuth`
- `routes/auth.js` — login/logout/session endpoints
- `routes/complaints.js` — complaint + attachment endpoints, filters/search, Excel export
- `routes/dashboard.js` — aggregate endpoints for the dashboard charts
- `public/` — static pages (`login.html`, `log.html`, `complaints.html`, `complaint-detail.html`, `dashboard.html`) and their JS/CSS

## API

All routes below except `/api/login`, `/api/session`, `/api/health`
require an authenticated session.

- `POST /api/login`, `POST /api/logout`, `GET /api/session`
- `POST /api/complaints/preview` — compute the suggested priority for
  in-progress form fields (`description`, `complaint_type`,
  `customer_name`, `sku`), without persisting
- `POST /api/complaints` — log a complaint (multipart/form-data; optional
  `images` field up to 5 files; optional `priority_final` to override
  the suggested priority)
- `GET /api/complaints` — list, with optional `sku`, `customer`, `plant`,
  `status`, `priority`, `date_from`, `date_to`, `search` (customer/SKU/
  description) query params
- `GET /api/complaints/export` — same filters, streamed back as `.xlsx`
- `PATCH /api/complaints/:id` — update `status`, `priority_final`,
  `assigned_to`, `resolution_notes`, `resolution_date`, `root_cause`
  (auto-fills `resolution_date` when status is set to Resolved)
- `GET /api/complaints/:id` — fetch one, including its `attachments` and `audit_log`
- `GET /uploads/<file_path>` — serves an uploaded image (auth required)
- `GET /api/dashboard/summary` — total/open/in-progress/resolved/overdue
  counts + average resolution time
- `GET /api/dashboard/by-sku`, `/by-plant`, `/status` — grouped counts
- `GET /api/dashboard/trend` — daily complaint counts, last 30 days
