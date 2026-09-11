const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/dashboard/summary — headline counts + average resolution time.
router.get('/summary', async (req, res, next) => {
  try {
    const counts = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'Closed')::int AS closed,
        COUNT(*) FILTER (WHERE status IN ('Open', 'In Progress') AND sla_due_at < now())::int AS overdue
      FROM complaints
    `);

    const avgResolution = await db.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (resolution_date - date_logged)) / 3600)::float AS avg_hours
      FROM complaints
      WHERE resolution_date IS NOT NULL
    `);

    res.json({
      ...counts.rows[0],
      avg_resolution_hours: avgResolution.rows[0].avg_hours,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/by-sku — top 10 SKUs by complaint count.
router.get('/by-sku', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT sku, COUNT(*)::int AS count
      FROM complaints
      GROUP BY sku
      ORDER BY count DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/by-plant — complaint count per plant.
router.get('/by-plant', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT plant, COUNT(*)::int AS count
      FROM complaints
      GROUP BY plant
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/trend — daily complaint counts for the last 30 days.
router.get('/trend', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date, COUNT(c.id)::int AS count
      FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
      LEFT JOIN complaints c ON c.date_received = d.day
      GROUP BY d.day
      ORDER BY d.day
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/status — complaint count by status (open vs resolved, etc.)
router.get('/status', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT status, COUNT(*)::int AS count
      FROM complaints
      GROUP BY status
      ORDER BY status
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
