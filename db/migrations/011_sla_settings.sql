CREATE TABLE sla_settings (
  priority TEXT PRIMARY KEY,
  hours INTEGER NOT NULL
);

-- Critical was previously "end of the same day" (0-24h depending on when it
-- was logged); converted here to a flat, stricter 8-hour default since the
-- settings page needs a fixed number to start from. Admins can change it
-- immediately from Settings.
INSERT INTO sla_settings (priority, hours) VALUES
  ('Critical', 8),
  ('High', 24),
  ('Medium', 72),
  ('Low', 168);