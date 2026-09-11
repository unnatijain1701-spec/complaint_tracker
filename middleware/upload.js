const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');

// UPLOAD_DIR should point at the Railway persistent Volume mount in
// production (e.g. /data/uploads); defaults to a local folder for dev.
// Only the relative filename is stored in Postgres — see attachments.file_path.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, GIF, or WebP images are allowed'));
    }
    cb(null, true);
  },
});

module.exports = { upload, UPLOAD_DIR };
