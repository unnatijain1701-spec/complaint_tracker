require('dotenv').config();
const express = require('express');
const path = require('path');

const complaintsRouter = require('./routes/complaints');
const dashboardRouter = require('./routes/dashboard');
const authRouter = require('./routes/auth');
const { UPLOAD_DIR } = require('./middleware/upload');
const { sessionMiddleware, requireAuth } = require('./middleware/session');

const app = express();

// Railway (and most PaaS platforms) terminate HTTPS at a proxy and forward
// plain HTTP internally. Without this, Express thinks every request is
// insecure, and express-session silently refuses to send the Secure cookie.
app.set('trust proxy', 1);

app.use(express.json());
app.use(sessionMiddleware);

app.get('/', (req, res) => {
  res.redirect(req.session.user ? '/complaints.html' : '/login.html');
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', requireAuth, express.static(UPLOAD_DIR));

app.use('/api', authRouter);
app.use('/api/complaints', requireAuth, complaintsRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Complaint tracker listening on port ${PORT}`);
});