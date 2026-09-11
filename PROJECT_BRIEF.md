# Urban Harvest Complaint Tracker — Build Brief

This document is the spec. Paste it to Claude Code as-is (or save it as
`PROJECT_BRIEF.md` in an empty project folder and tell Claude Code:
"Read PROJECT_BRIEF.md and build this, starting with Phase 1").

---

## 1. Context

Organicut Fresh Pvt. Ltd. (Urban Harvest) has a customer complaint process
run entirely on Excel + a Microsoft Forms export. A previous Streamlit tool
required re-uploading the raw export every single session — no persistence.
That approach is being replaced.

This is now an **operational logging tool**, not a reporting dashboard: the
sales ops team logs each complaint as it comes in, the system tracks it
through resolution, and it never needs a file re-uploaded to see past data.

## 2. Goal

Build a small internal web app where:
- Sales ops logs a complaint (SKU, customer, date, description, channel)
  and can attach images (e.g. screenshots of the complaint email)
- The system suggests a priority (Critical/High/Medium/Low), which the
  person logging it can override
- High-priority complaints trigger an immediate email alert; overdue
  open complaints trigger a daily digest email
- Everyone can filter/search by SKU, customer, date range, priority,
  plant, and status, and see a summary dashboard
- All data persists permanently — no re-uploads, ever

## 3. Recommended stack (change only if you have a good reason — flag it if so)

No Streamlit — plain HTML/CSS/JS frontend with a Node/Express API, the
same pattern as the MPK calculator tool (also on Railway + Postgres).
Reuse that stack rather than introducing a second framework.

- **Frontend:** Static HTML/CSS/vanilla JS pages, served by the Express
  app. No build step, no framework overhead.
- **Backend:** Node.js + Express REST API
- **Database:** PostgreSQL (Railway's managed Postgres add-on)
- **Image storage:** files written to a Railway persistent Volume mounted
  into the app (e.g. `/data/uploads`); store only the relative file path
  in Postgres, not the binary, unless volumes prove painful to wire up —
  in that case fall back to storing images as bytea in Postgres
- **Auth:** `express-session` + `bcrypt`, with a small team roster table
  (name, email, hashed password) seeded on setup — not enterprise SSO,
  just enough to know who logged/updated what
- **Email alerts:** `nodemailer` for immediate sends; a separate small
  script triggered by Railway's native Cron Job feature (Settings →
  Cron Schedule on that service) for the daily overdue digest
- **Charts:** Chart.js on the dashboard page (loaded from a CDN,
  no build tooling needed)
- **Deployment target:** Railway (Hobby plan), started via the
  `package.json` `start` script (e.g. `node server.js`)

Note: Railway's Hobby plan doesn't idle-sleep a running service the way
Streamlit Community Cloud's free tier does, so either stack would have
stayed up — but plain HTML/JS is still the right call here since it
mirrors the stack you already have live and CEO-approved for MPK.

## 4. Data model

**complaints**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| date_received | date | when the complaint actually came in |
| date_logged | timestamp, default now() | when entered into the system |
| customer_name | text | free text for now (no master customer list yet) |
| sku | text | free text for now (no master SKU list yet) |
| plant | text | one of: Rai, Jaipur, Bangalore, Mumbai, Hyderabad, Other |
| complaint_type | text | Quality, Quantity Shortfall, Packaging, Delivery Delay, Wrong Item, Spoilage, Other |
| channel | text | Email, Call, WhatsApp, Portal, Other |
| description | text | free text |
| priority_suggested | text | Critical/High/Medium/Low, set by the rule engine |
| priority_final | text | Critical/High/Medium/Low, editable by the logger |
| status | text | Open, In Progress, Resolved, Closed — default Open |
| assigned_to | text | who owns resolving it |
| logged_by | text | from the logged-in user |
| sla_due_at | timestamp | computed from priority_final at creation (see §5) |
| resolution_notes | text | nullable |
| resolution_date | timestamp | nullable |
| root_cause | text | nullable, filled at resolution |

**attachments**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| complaint_id | FK → complaints.id | |
| file_path | text | relative path on the volume |
| original_filename | text | |
| uploaded_at | timestamp | |

**audit_log**
| column | type | notes |
|---|---|---|
| id | serial PK | |
| complaint_id | FK → complaints.id | |
| changed_by | text | |
| changed_at | timestamp | |
| field_changed | text | e.g. "status" |
| old_value | text | |
| new_value | text | |

## 5. Priority engine

Compute `priority_suggested` from a simple weighted rule set (implement as
one function so it's easy to tune later):

- **Auto-Critical** if the description contains any of a small keyword
  list you define (e.g. contamination, foreign object, illness, safety) —
  case-insensitive substring match
- **+weight** for complaint_type severity: Spoilage/Quality > Wrong Item >
  Delivery Delay > Packaging
- **+weight** if the same customer + SKU combination has ≥2 complaints
  logged in the last 30 days (recurrence bump)
- Map the resulting score to Critical / High / Medium / Low bands

SLA due dates from `priority_final`: Critical = same day (end of day),
High = 24 hours, Medium = 3 days, Low = 7 days. Store both the suggested
and final priority so the mapping can be reviewed and retuned later —
don't discard the suggestion once overridden.

## 6. Alerts

- **On submit:** if `priority_final` is Critical or High, send an
  immediate email (recipient list from an env var, comma-separated;
  ask me for the actual addresses — don't invent them)
- **Daily digest (Cron job, e.g. 9am IST):** one email listing every
  Open/In Progress complaint past its `sla_due_at`, grouped by plant
- **In-app:** dashboard highlights overdue rows

## 7. Pages / UI

Static HTML pages, each talking to the Express API via `fetch()`:

1. **`log.html`** — the complaint form (§4 fields), image upload, calls
   a preview endpoint as fields are filled to show the suggested
   priority live, lets the user override it before submitting
2. **`complaints.html`** — filterable/sortable table (SKU, customer,
   date range, priority, plant, status) fed by `GET /api/complaints`
   with query params; click a row to open a detail view with
   attachments, audit trail, and a place to update status/add
   resolution notes
3. **`dashboard.html`** — complaints by SKU, by plant, trend over time,
   open vs resolved, average resolution time, count overdue — via
   Chart.js, fed by a few aggregate `GET /api/dashboard/*` endpoints
4. **`login.html`** — posts credentials to `POST /api/login`, sets a
   session cookie; all other pages redirect here if not authenticated

## 8. Also build

- Full-text search across customer name / SKU / description
- Export current filtered view to Excel (leadership still wants Excel
  for now)
- Audit trail entries written automatically on every status/field change

## 9. Explicitly NOT in this phase — scaffold for it, don't build it yet

**Bulk import from the old Excel trackers.** The exact files aren't
available yet. Do this:
- Design the `complaints` table so a bulk-insert script would be simple
  to write later (i.e. don't paint yourself into a schema that only
  works for one-row-at-a-time manual entry)
- Stub a `scripts/import_legacy_excel.js` (or a one-off Python script —
  this migration utility doesn't need to match the app's runtime) with
  a clear comment describing the expected shape (columns TBD) but no
  real logic yet
- Do not guess at column names or build a mapping UI — ask me for a
  sample file when it's time

## 10. Things to ask me, not assume

- Actual email addresses/distribution list for alerts
- SMTP provider — I'll need to set up either a Gmail app password or a
  free account with something like Resend/SendGrid; ask which I've set
  up before wiring `nodemailer`
- The exact keyword list for auto-Critical detection (I'll give you real
  examples of past critical complaints if I have them)
- Whether "customer" should eventually be a dropdown from a master list
  (I don't have one yet — free text is fine for now)

## 11. Build order

1. Scaffold repo, Postgres schema + migrations, basic CRUD (log +
   list complaints, no priority/alerts/images yet)
2. Image upload + attachments table + volume wiring
3. Priority engine (§5) + SLA due date calculation
4. Email alerts (§6) — immediate send first, cron digest second
5. Dashboard + filters + search + Excel export
6. Login (§7.4) + audit trail
7. Railway deployment config (`package.json` start script / `railway.json`,
   env vars for DATABASE_URL, SMTP creds, alert recipients, volume mount)
8. Import script stub (§9) — structure only

Work through these in order and pause for review after each phase rather
than building everything then showing it all at once.
