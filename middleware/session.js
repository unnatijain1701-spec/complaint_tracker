const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('../db');
const { pool } = db;

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set — using a random secret for this process only (sessions will not survive a restart).');
}

const sessionMiddleware = session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});

// Re-checks the session's user against the database on every request, so a
// removed user (or one whose admin status changed) loses access immediately
// instead of waiting out their cached session (up to 7 days).
async function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const result = await db.query('SELECT id, name, email, is_admin FROM users WHERE id = $1', [req.session.user.id]);
    if (result.rows.length === 0) {
      return req.session.destroy(() => res.status(401).json({ error: 'Not authenticated' }));
    }
    req.session.user = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!req.session.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

module.exports = { sessionMiddleware, requireAuth, requireAdmin };