const express = require('express');
const fs = require('fs');
const ExcelJS = require('exceljs');
const db = require('../db');
const { upload } = require('../middleware/upload');
const { PRIORITIES, getRecurrenceCount, computeSuggestedPriority, computeSlaDueAt } = require('../lib/priority');
const { sendImmediateAlertIfNeeded } = require('../lib/alerts');

const router = express.Router();

function uploadImages(req, res, next) {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ errors: [err.message] });
    }
    next();
  });
}

async function cleanupFiles(files) {
  await Promise.all(
    (files || []).map((f) => fs.promises.unlink(f.path).catch(() => {}))
  );
}

const PLANTS = ['Rai', 'Jaipur', 'Bangalore', 'Mumbai', 'Hyderabad', 'Other'];
const COMPLAINT_TYPES = [
  'Quality',
  'Quantity Shortfall',
  'Packaging',
  'Delivery Delay',
  'Wrong Item',
  'Spoilage',
  'Other',
];
const CHANNELS = ['Email', 'Call', 'WhatsApp', 'Portal', 'Other'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

// Shared by GET / (list) and GET /export so filtering stays identical
// between the on-screen table and the exported file.
function buildComplaintFilterQuery(query) {
  const { sku, customer, plant, status, priority, date_from, date_to, search } = query;
  const clauses = [];
  const params = [];

  if (sku) {
    params.push(`%${sku}%`);
    clauses.push(`sku ILIKE $${params.length}`);
  }
  if (customer) {
    params.push(`%${customer}%`);
    clauses.push(`customer_name ILIKE $${params.length}`);
  }
  if (plant) {
    params.push(plant);
    clauses.push(`plant = $${params.length}`);
  }
  if (status) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (priority) {
    params.push(priority);
    clauses.push(`priority_final = $${params.length}`);
  }
  if (date_from) {
    params.push(date_from);
    clauses.push(`date_received >= $${params.length}`);
  }
  if (date_to) {
    params.push(date_to);
    clauses.push(`date_received <= $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    clauses.push(`(customer_name ILIKE $${i} OR sku ILIKE $${i} OR description ILIKE $${i})`);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

function validateComplaintInput(body) {
  const errors = [];
  const required = ['date_received', 'customer_name', 'sku', 'plant', 'complaint_type', 'channel', 'description'];
  for (const field of required) {
    if (!body[field] || String(body[field]).trim() === '') {
      errors.push(`${field} is required`);
    }
  }
  if (body.plant && !PLANTS.includes(body.plant)) {
    errors.push(`plant must be one of: ${PLANTS.join(', ')}`);
  }
  if (body.complaint_type && !COMPLAINT_TYPES.includes(body.complaint_type)) {
    errors.push(`complaint_type must be one of: ${COMPLAINT_TYPES.join(', ')}`);
  }
  if (body.channel && !CHANNELS.includes(body.channel)) {
    errors.push(`channel must be one of: ${CHANNELS.join(', ')}`);
  }
  if (body.priority_final && !PRIORITIES.includes(body.priority_final)) {
    errors.push(`priority_final must be one of: ${PRIORITIES.join(', ')}`);
  }
  return errors;
}

// POST /api/complaints/preview — compute a live priority suggestion as the
// logger fills in the form, without persisting anything.
router.post('/preview', async (req, res, next) => {
  try {
    const { description, complaint_type, customer_name, sku } = req.body;
    const recurrenceCount = await getRecurrenceCount(customer_name, sku);
    const { priority, score, autoCritical } = computeSuggestedPriority({
      description,
      complaintType: complaint_type,
      recurrenceCount,
    });
    res.json({
      priority_suggested: priority,
      score,
      auto_critical: autoCritical,
      recurrence_count: recurrenceCount,
      sla_due_at: computeSlaDueAt(priority),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/complaints — log a new complaint, with up to 5 image
// attachments (field name "images"). Sends an immediate alert email for
// Critical/High priority. logged_by comes from the session, not the
// client, now that login exists.
router.post('/', uploadImages, async (req, res, next) => {
  try {
    const errors = validateComplaintInput(req.body);
    if (errors.length) {
      await cleanupFiles(req.files);
      return res.status(400).json({ errors });
    }

    const {
      date_received,
      customer_name,
      sku,
      plant,
      complaint_type,
      channel,
      description,
      assigned_to,
      priority_final,
    } = req.body;
    const logged_by = req.session.user.name;

    const recurrenceCount = await getRecurrenceCount(customer_name, sku);
    const { priority: prioritySuggested } = computeSuggestedPriority({
      description,
      complaintType: complaint_type,
      recurrenceCount,
    });
    const finalPriority = priority_final || prioritySuggested;
    const slaDueAt = computeSlaDueAt(finalPriority);

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const complaintResult = await client.query(
        `INSERT INTO complaints
          (date_received, customer_name, sku, plant, complaint_type, channel, description, assigned_to, logged_by,
           priority_suggested, priority_final, sla_due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          date_received, customer_name, sku, plant, complaint_type, channel, description,
          assigned_to || null, logged_by || null, prioritySuggested, finalPriority, slaDueAt,
        ]
      );
      const complaint = complaintResult.rows[0];

      const attachments = [];
      for (const file of req.files || []) {
        const attachmentResult = await client.query(
          `INSERT INTO attachments (complaint_id, file_path, original_filename)
           VALUES ($1, $2, $3) RETURNING *`,
          [complaint.id, file.filename, file.originalname]
        );
        attachments.push(attachmentResult.rows[0]);
      }

      await client.query('COMMIT');
      res.status(201).json({ ...complaint, attachments });
      sendImmediateAlertIfNeeded(complaint);
    } catch (err) {
      await client.query('ROLLBACK');
      await cleanupFiles(req.files);
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints — list with filters (sku, customer, plant, status,
// priority, date_from, date_to) plus a `search` param that does a
// case-insensitive match across customer name / SKU / description.
router.get('/', async (req, res, next) => {
  try {
    const { where, params } = buildComplaintFilterQuery(req.query);
    const result = await db.query(
      `SELECT * FROM complaints ${where} ORDER BY date_logged DESC LIMIT 500`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

const EXPORT_COLUMNS = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Date Received', key: 'date_received', width: 14 },
  { header: 'Date Logged', key: 'date_logged', width: 20 },
  { header: 'Customer', key: 'customer_name', width: 22 },
  { header: 'SKU', key: 'sku', width: 16 },
  { header: 'Plant', key: 'plant', width: 12 },
  { header: 'Complaint Type', key: 'complaint_type', width: 18 },
  { header: 'Channel', key: 'channel', width: 12 },
  { header: 'Description', key: 'description', width: 40 },
  { header: 'Priority (Suggested)', key: 'priority_suggested', width: 18 },
  { header: 'Priority (Final)', key: 'priority_final', width: 16 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Assigned To', key: 'assigned_to', width: 16 },
  { header: 'Logged By', key: 'logged_by', width: 16 },
  { header: 'SLA Due', key: 'sla_due_at', width: 20 },
  { header: 'Resolution Notes', key: 'resolution_notes', width: 30 },
  { header: 'Resolution Date', key: 'resolution_date', width: 20 },
  { header: 'Root Cause', key: 'root_cause', width: 20 },
];

// GET /api/complaints/export — same filters as the list endpoint, streamed
// back as an .xlsx workbook (leadership still wants Excel for now).
router.get('/export', async (req, res, next) => {
  try {
    const { where, params } = buildComplaintFilterQuery(req.query);
    const result = await db.query(
      `SELECT * FROM complaints ${where} ORDER BY date_logged DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Complaints');
    sheet.columns = EXPORT_COLUMNS;
    sheet.getRow(1).font = { bold: true };
    for (const row of result.rows) {
      sheet.addRow(row);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="complaints-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

const UPDATABLE_FIELDS = ['status', 'assigned_to', 'priority_final', 'resolution_notes', 'resolution_date', 'root_cause'];

// PATCH /api/complaints/:id — update status/assignment/resolution fields.
// Every changed field is written to audit_log in the same transaction.
router.patch('/:id', async (req, res, next) => {
  try {
    const errors = [];
    if (req.body.status && !STATUSES.includes(req.body.status)) {
      errors.push(`status must be one of: ${STATUSES.join(', ')}`);
    }
    if (req.body.priority_final && !PRIORITIES.includes(req.body.priority_final)) {
      errors.push(`priority_final must be one of: ${PRIORITIES.join(', ')}`);
    }
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const updates = {};
    for (const field of UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.status === 'Resolved' && !updates.resolution_date) {
      updates.resolution_date = new Date();
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ errors: ['No updatable fields provided'] });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query('SELECT * FROM complaints WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Complaint not found' });
      }
      const before = existing.rows[0];

      const setClauses = [];
      const params = [];
      for (const [field, value] of Object.entries(updates)) {
        params.push(value);
        setClauses.push(`${field} = $${params.length}`);
      }
      params.push(req.params.id);

      const result = await client.query(
        `UPDATE complaints SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      const after = result.rows[0];
      const changedBy = req.session.user.name;

      for (const field of Object.keys(updates)) {
        const oldValue = before[field] == null ? null : String(before[field]);
        const newValue = after[field] == null ? null : String(after[field]);
        if (oldValue === newValue) continue;
        await client.query(
          `INSERT INTO audit_log (complaint_id, changed_by, field_changed, old_value, new_value)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, changedBy, field, oldValue, newValue]
        );
      }

      await client.query('COMMIT');
      res.json(after);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id — single complaint with its attachments + audit trail.
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const attachments = await db.query(
      'SELECT * FROM attachments WHERE complaint_id = $1 ORDER BY uploaded_at',
      [req.params.id]
    );
    const auditLog = await db.query(
      'SELECT * FROM audit_log WHERE complaint_id = $1 ORDER BY changed_at DESC',
      [req.params.id]
    );
    res.json({ ...result.rows[0], attachments: attachments.rows, audit_log: auditLog.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
