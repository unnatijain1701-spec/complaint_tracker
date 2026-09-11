CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT now(),
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT
);

CREATE INDEX idx_audit_log_complaint_id ON audit_log (complaint_id);
