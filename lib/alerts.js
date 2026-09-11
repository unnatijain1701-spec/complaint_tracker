const { sendMail } = require('./mailer');

const IMMEDIATE_ALERT_PRIORITIES = new Set(['Critical', 'High']);

function complaintSummaryText(c) {
  return [
    `Complaint #${c.id}`,
    `Customer: ${c.customer_name}`,
    `SKU: ${c.sku}`,
    `Plant: ${c.plant}`,
    `Type: ${c.complaint_type}`,
    `Channel: ${c.channel}`,
    `Priority: ${c.priority_final}`,
    `SLA due: ${c.sla_due_at ? new Date(c.sla_due_at).toISOString() : 'n/a'}`,
    `Logged by: ${c.logged_by || 'n/a'}`,
    '',
    `Description: ${c.description}`,
  ].join('\n');
}

// Fire-and-forget: errors are logged, never thrown, so a mail failure
// never fails the complaint-logging request that triggered it.
async function sendImmediateAlertIfNeeded(complaint) {
  if (!IMMEDIATE_ALERT_PRIORITIES.has(complaint.priority_final)) return;
  try {
    await sendMail({
      subject: `[${complaint.priority_final}] New complaint #${complaint.id} — ${complaint.customer_name} / ${complaint.sku}`,
      text: complaintSummaryText(complaint),
    });
  } catch (err) {
    console.error('Failed to send immediate alert email:', err);
  }
}

module.exports = { sendImmediateAlertIfNeeded, complaintSummaryText };
