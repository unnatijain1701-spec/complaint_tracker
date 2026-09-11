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

// Returns the UTC instant corresponding to 23:59:59.999 IST on baseDate's
// IST calendar day, without depending on the server process's local TZ.
function endOfDayIST(baseDate) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const shifted = new Date(baseDate.getTime() + IST_OFFSET_MS);
  const endOfShiftedDay = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    23, 59, 59, 999
  );
  return new Date(endOfShiftedDay - IST_OFFSET_MS);
}

function computeSlaDueAt(priority, baseDate = new Date()) {
  switch (priority) {
    case 'Critical':
      return endOfDayIST(baseDate);
    case 'High':
      return new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
    case 'Medium':
      return new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    case 'Low':
      return new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

module.exports = {
  PRIORITIES,
  AUTO_CRITICAL_KEYWORDS,
  getRecurrenceCount,
  computeSuggestedPriority,
  computeSlaDueAt,
};
