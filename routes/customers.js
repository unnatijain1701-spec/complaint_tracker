const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const db = require('../db');
const { requireAdmin } = require('../middleware/session');

const router = express.Router();

// Excel imports are parsed in memory and discarded — never written to disk.
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/customers — any authenticated user (needed for the dropdown on the log form).
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, name FROM customers ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers — add one customer (admin only).
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ errors: ['name is required'] });
    }
    const result = await db.query(
      'INSERT INTO customers (name) VALUES ($1) RETURNING id, name',
      [name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ errors: ['That customer already exists'] });
    }
    next(err);
  }
});

// POST /api/customers/import — bulk-add from an uploaded .xlsx (admin only).
// Reads column A of the first sheet; skips a header-like first cell
// ("Customer" / "Name") and blank rows; silently skips duplicates.
router.post('/import', requireAdmin, importUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return res.status(400).json({ error: 'No worksheet found in that file' });
    }

    const names = new Set();
    sheet.eachRow((row) => {
      const value = String(row.getCell(1).text || '').trim();
      if (value && !/^(customer|customer name|name)$/i.test(value)) {
        names.add(value);
      }
    });

    let added = 0;
    let skipped = 0;
    for (const name of names) {
      try {
        await db.query('INSERT INTO customers (name) VALUES ($1)', [name]);
        added++;
      } catch (err) {
        if (err.code === '23505') {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    res.json({ added, skipped, total: names.size });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/customers/:id — admin only.
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;