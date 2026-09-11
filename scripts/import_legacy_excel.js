// STUB — no real import logic yet. See PROJECT_BRIEF.md §9.
//
// The old Excel trackers this is meant to migrate from aren't available
// yet, and their column layout is unknown, so this intentionally does
// NOT guess column names or build a mapping UI. When a sample file shows
// up, fill in COLUMN_MAP below and this should mostly work as-is —
// the complaints table (db/migrations/001_init_complaints.sql) uses
// plain free-text customer_name/sku columns specifically so a bulk
// insert like this doesn't need any schema changes.
//
// Usage (once implemented): node scripts/import_legacy_excel.js <path-to-file.xlsx>
require('dotenv').config();
const ExcelJS = require('exceljs');
const db = require('../db');
const { getRecurrenceCount, computeSuggestedPriority, computeSlaDueAt } = require('../lib/priority');

// TODO: fill in once a real sample file is available. Maps this script's
// internal field names to the actual column headers in the legacy sheet.
// Example shape (DO NOT trust these header names — placeholders only):
//
// const COLUMN_MAP = {
//   date_received: 'Date Received',
//   customer_name: 'Customer',
//   sku: 'SKU / Item Code',
//   plant: 'Plant',
//   complaint_type: 'Complaint Type',
//   channel: 'Source',
//   description: 'Details',
//   status: 'Status',
//   assigned_to: 'Owner',
//   resolution_notes: 'Resolution',
//   root_cause: 'Root Cause',
// };
const COLUMN_MAP = null;

// TODO: legacy plant/complaint_type/channel/status values almost certainly
// won't match this app's exact enum values (db/migrations/001_init_complaints.sql)
// one-to-one — fill in translation tables here once real data is seen,
// e.g. { 'Bangalore Plant': 'Bangalore', 'B'lore': 'Bangalore', ... }.

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/import_legacy_excel.js <path-to-file.xlsx>');
    process.exitCode = 1;
    return;
  }

  if (!COLUMN_MAP) {
    console.error(
      'COLUMN_MAP is not filled in yet — this script is a structural stub only (see PROJECT_BRIEF.md §9). ' +
      'Get a sample of the real legacy export, fill in COLUMN_MAP and the value-translation tables above, then re-run.'
    );
    process.exitCode = 1;
    return;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  // TODO: for each data row —
  //   1. Read cells via COLUMN_MAP, translate legacy enum values.
  //   2. Validate required fields (see validateComplaintInput in
  //      routes/complaints.js — keep the two in sync).
  //   3. Compute priority_suggested via computeSuggestedPriority (pass
  //      getRecurrenceCount so historical recurrence bumps are consistent
  //      with rows already inserted earlier in the same import run) and
  //      priority_final (probably just = priority_suggested for a bulk
  //      historical import, unless the legacy sheet already has a
  //      priority/severity column to preserve instead).
  //   4. Compute sla_due_at via computeSlaDueAt — decide whether this
  //      should be based on the original date_received/date_logged or
  //      skipped entirely for already-closed historical rows.
  //   5. Insert into complaints. Do this in batches inside a transaction,
  //      not one-row-at-a-time autocommit, for a sheet of any real size.
  //
  // Deliberately not implemented — see the header comment.
  console.error('Row-by-row import logic is not implemented — see the TODOs above.');
  process.exitCode = 1;
}

run()
  .catch((err) => {
    console.error('Import failed:', err);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
