const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

// GET /api/users — list the team roster (admin only).
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/users — create a new team login (admin only).
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, is_admin } = req.body;
    const errors = [];
    if (!name || !name.trim()) errors.push('name is required');
    if (!email || !email.trim()) errors.push('email is required');
    if (!password || password.length < 8) errors.push('password must be at least 8 characters');
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, is_admin, created_at`,
      [name.trim(), email.trim().toLowerCase(), passwordHash, !!is_admin]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ errors: ['A user with that email already exists'] });
    }
    next(err);
  }
});

// DELETE /api/users/:id — remove a team login (admin only). Can't delete your own account.
router.delete('/:id', async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.session.user.id) {
      return res.status(400).json({ error: "You can't delete your own account while logged in as it" });
    }
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;