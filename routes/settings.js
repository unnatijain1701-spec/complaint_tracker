const express = require('express');
const db = require('../db');
const { PRIORITIES, getSlaHours } = require('../lib/priority');
const { requireAdmin } = require('../middleware/session');

const router = express.Router();

// GET /api/settings/sla — current resolution-deadline hours per priority.
// Any authenticated user can view this (it's informational, like the SLA
// badge itself); only admins can change it.
router.get('/sla', async (req, res, next) => {
  try {
    const hours = await getSlaHours();
    res.json(hours);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/sla — update the resolution-deadline hours (admin only).
router.put('/sla', requireAdmin, async (req, res, next) => {
  try {
    const errors = [];
    const updates = {};
    for (const priority of PRIORITIES) {
      const hours = Number(req.body[priority]);
      if (!Number.isInteger(hours) || hours < 1) {
        errors.push(`${priority} must be a whole number of hours, at least 1`);
        continue;
      }
      updates[priority] = hours;
    }
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    for (const [priority, hours] of Object.entries(updates)) {
      await db.query(
        `INSERT INTO sla_settings (priority, hours) VALUES ($1, $2)
         ON CONFLICT (priority) DO UPDATE SET hours = EXCLUDED.hours`,
        [priority, hours]
      );
    }

    res.json(updates);
  } catch (err) {
    next(err);
  }
});

module.exports = router;