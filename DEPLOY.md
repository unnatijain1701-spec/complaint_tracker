# Deploying to Railway

Two services in one Railway project, sharing one Postgres database:
1. **web** — the app itself (this repo, `npm start`)
2. **digest** — same repo, but runs `npm run digest` on a daily Cron Schedule

## 1. Create the project

1. New Project → Deploy from GitHub repo → pick this repo.
2. Add a Postgres database: **New → Database → PostgreSQL**. Railway
   auto-injects `DATABASE_URL` as a reference variable into services in
   the same project (via `${{Postgres.DATABASE_URL}}` — link it under
   the web service's Variables tab if it wasn't added automatically).

## 2. Web service — Volume

Complaint attachments need a persistent disk (`bytea`-in-Postgres was
the brief's fallback if this proves painful, but Volumes are
straightforward on Railway):

1. Web service → **Settings → Volumes → New Volume**.
2. Mount path: `/data`.
3. Set env var `UPLOAD_DIR=/data/uploads` (the app creates the
   subdirectory itself).

## 3. Web service — environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | from the Postgres reference variable |
| `UPLOAD_DIR` | `/data/uploads` |
| `SESSION_SECRET` | long random string — sessions live in Postgres (`connect-pg-simple`) but are only valid while this stays the same |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | whichever SMTP provider (Gmail app password, Resend, SendGrid, ...) — leave unset to disable email and just log instead |
| `ALERT_RECIPIENTS` | comma-separated addresses for Critical/High alerts + the daily digest |
| `NODE_ENV` | `production` (enables secure session cookies) |

`PORT` is injected by Railway automatically — the app already reads
`process.env.PORT`.

The start command (`railway.json`) runs `npm run migrate` before
`npm start` on every deploy, so new migrations apply automatically —
it's idempotent (tracked in `schema_migrations`), so re-running on a
deploy with no new migrations is a no-op.

## 4. First deploy: seed a login

Migrations create the `users` table but nothing seeds it automatically
(the brief calls for real team names/emails/passwords, not invented
ones). After the first deploy:

```bash
railway run npm run seed:user
```

Run it again any time to add another team member or reset a password.

## 5. Digest service (Cron Job)

1. In the same project: **New → Empty Service**, then connect it to
   this same GitHub repo (or duplicate the web service).
2. **Settings → Deploy → Custom Start Command**: `npm run digest`
3. **Settings → Cron Schedule**: `30 3 * * *` (UTC) = 9am IST.
4. Give it the same `DATABASE_URL`, `SMTP_*`, and `ALERT_RECIPIENTS`
   variables as the web service (link the same Postgres reference
   variable; copy the rest, or reference the web service's variables).
   It doesn't need `UPLOAD_DIR`, `SESSION_SECRET`, or a Volume.

Railway runs a Cron service's start command once per schedule tick and
lets it exit — `scripts/send_overdue_digest.js` already calls
`db.pool.end()` when done, so the process exits cleanly.
