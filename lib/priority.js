const db = require('../db');

// Placeholder keyword list per PROJECT_BRIEF.md §5's example set. The brief
// (§10) flags this as something to replace with real examples from past
// critical complaints — tune here once those are available.
const AUTO_CRITICAL_KEYWORDS = ['contamination', 'foreign object', 'illness', 'safety'];

// Relative severity by complaint type per §5 ("Spoilage/Quality > Wrong
// Item > Delivery Delay > Packaging"); Quantity Shortfall and Other are
// not specified there, so they're slotted in alongside their closest peers.
const TYPE_WEIGHTS = {
  Spoilage: 4,
  Quality: 4,
  'Wrong Item': 3,
  'Quantity Shortfall': 3,
  'Delivery Delay': 2,
  Packaging: 1,
  Other: 1,
};

const RECURRENCE_WINDOW_DAYS = 30;
const RECURRENCE_THRESHOLD = 2;
const RECURRENCE_BUMP = 2;

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

function scoreToPriority(score) {
  if (score >= 6) return 'Critical';
  if (score >= 4) return 'High';
  if (score >= 2) return 'Medium';
  return 'Low';
}

// Counts existing complaints for this customer+SKU logged in the last
// RECURRENCE_WINDOW_DAYS days, to drive the recurrence bump.
async function getRecurrenceCount(customerName, sku) {
  if (!customerName || !sku) return 0;
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM complaints
     WHERE customer_name = $1 AND sku = $2
       AND date_logged >= now() - interval '${RECURRENCE_WINDOW_DAYS} days'`,
    [customerName, sku]
  );
  return result.rows[0].count;
}

function computeSuggestedPriority({ description, complaintType, recurrenceCount }) {
  const desc = (description || '').toLowerCase();
  const autoCritical = AUTO_CRITICAL_KEYWORDS.some((k) => desc.includes(k));
  if (autoCritical) {
    return { priority: 'Critical', score: null, autoCritical: true };
  }

  const typeWeight = TYPE_WEIGHTS[complaintType] ?? 1;
  const recurrenceBump = recurrenceCount >= RECURRENCE_THRESHOLD ? RECURRENCE_BUMP : 0;
  const score = typeWeight + recurrenceBump;

  return { priority: scoreToPriority(score), score, autoCritical: false };
}

// Used only if the sla_settings table is empty or unreachable — the normal
// source of truth is the database, adjustable from the Settings page.
const DEFAULT_SLA_HOURS = { Critical: 8, High: 24, Medium: 72, Low: 168 };

// Returns the resolution deadline (in hours) configured per priority.
async function getSlaHours() {
  const hours = { ...DEFAULT_SLA_HOURS };
  const result = await db.query('SELECT priority, hours FROM sla_settings');
  for (const row of result.rows) {
    hours[row.priority] = row.hours;
  }
  return hours;
}

async function computeSlaDueAt(priority, baseDate = new Date()) {
  if (!PRIORITIES.includes(priority)) return null;
  const hours = await getSlaHours();
  return new Date(baseDate.getTime() + hours[priority] * 60 * 60 * 1000);
}

module.exports = {
  PRIORITIES,
  AUTO_CRITICAL_KEYWORDS,
  DEFAULT_SLA_HOURS,
  getRecurrenceCount,
  computeSuggestedPriority,
  getSlaHours,
  computeSlaDueAt,
};