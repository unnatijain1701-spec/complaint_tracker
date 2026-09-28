const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const db = require('../db');
const { requireAdmin } = require('../middleware/session');
const { PLANTS } = require('../lib/plants');

const router = express.Router();

// Excel imports are parsed in memory and discarded — never written to disk.
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/customers — any authenticated user (needed for the dropdown on the log form).
// Optional ?plant= filter restricts the list to that plant.
router.get('/', async (req, res, next) => {
  try {
    const { plant } = req.query;
    const result = plant
      ? await db.query('SELECT id, name, plant FROM customers WHERE plant = $1 ORDER BY name', [plant])
      : await db.query('SELECT id, name, plant FROM customers ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers — add one customer (admin only).
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const plant = (req.body.plant || '').trim();
    const errors = [];
    if (!name) errors.push('name is required');
    if (!plant) errors.push('plant is required');
    else if (!PLANTS.includes(plant)) errors.push(`plant must be one of: ${PLANTS.join(', ')}`);
    if (errors.length) {
      return res.status(400).json({ errors });
    }
    const result = await db.query(
      'INSERT INTO customers (name, plant) VALUES ($1, $2) RETURNING id, name, plant',
      [name, plant]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ errors: ['That customer already exists for that plant'] });
    }
    next(err);
  }
});

// POST /api/customers/import — bulk-add from an uploaded .xlsx (admin only).
// Each sheet's name must match a plant (e.g. "Rai", "Jaipur") — every name
// found in column A of that sheet is imported tagged with that plant.
// Sheets whose name isn't a recognized plant are skipped and reported back.
// Within a sheet: skips a header-like first cell ("Customer" / "Name") and
// blank rows; silently skips duplicates.
router.post('/import', requireAdmin, importUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    if (workbook.worksheets.length === 0) {
      return res.status(400).json({ error: 'No worksheet found in that file' });
    }

    const unrecognizedSheets = [];
    const entries = new Map(); // `${plant}\u0000${name}` -> { name, plant }

    for (const sheet of workbook.worksheets) {
      const plant = PLANTS.find((p) => p.toLowerCase() === sheet.name.trim().toLowerCase());
      if (!plant) {
        unrecognizedSheets.push(sheet.name);
        continue;
      }
      sheet.eachRow((row) => {
        const value = String(row.getCell(1).text || '').trim();
        if (value && !/^(customer|customer name|name)$/i.test(value)) {
          entries.set(`${plant}\u0000${value}`, { name: value, plant });
        }
      });
    }

    let added = 0;
    let skipped = 0;
    for (const { name, plant } of entries.values()) {
      try {
        await db.query('INSERT INTO customers (name, plant) VALUES ($1, $2)', [name, plant]);
        added++;
      } catch (err) {
        if (err.code === '23505') {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    res.json({ added, skipped, total: entries.size, unrecognizedSheets });
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