const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('../db');

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

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

module.exports = { sessionMiddleware, requireAuth };
