// Daily overdue-complaints digest. Intended to run as a Railway Cron Job
// (Settings -> Cron Schedule on this service) at 9am IST, i.e. "30 3 * * *"
// (UTC). Run manually with: npm run digest
require('dotenv').config();
const db = require('../db');
const { sendMail } = require('../lib/mailer');

async function run() {
  const result = await db.query(
    `SELECT * FROM complaints
     WHERE status IN ('Open', 'In Progress') AND sla_due_at < now()
     ORDER BY plant, sla_due_at`
  );

  if (result.rows.length === 0) {
    console.log('No overdue complaints — skipping digest email.');
    return;
  }

  const byPlant = {};
  for (const c of result.rows) {
    (byPlant[c.plant] = byPlant[c.plant] || []).push(c);
  }

  const lines = [`Overdue complaints as of ${new Date().toISOString()}:`, ''];
  for (const [plant, complaints] of Object.entries(byPlant)) {
    lines.push(`== ${plant} (${complaints.length}) ==`);
    for (const c of complaints) {
      lines.push(
        `#${c.id} ${c.customer_name} / ${c.sku} — ${c.priority_final}, due ${new Date(c.sla_due_at).toISOString()}, status: ${c.status}`
      );
    }
    lines.push('');
  }

  const { sent } = await sendMail({
    subject: `Daily overdue complaints digest — ${result.rows.length} overdue`,
    text: lines.join('\n'),
  });

  console.log(sent ? `Digest sent for ${result.rows.length} overdue complaints.` : 'Digest not sent (SMTP not configured).');
}

run()
  .catch((err) => {
    console.error('Failed to send overdue digest:', err);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
