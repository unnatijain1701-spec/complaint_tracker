CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_complaint_id ON attachments (complaint_id);
