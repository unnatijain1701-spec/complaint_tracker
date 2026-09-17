-- Add "Temperature Issue" to the allowed complaint_type values. The
-- original CHECK constraint was unnamed, so we look it up dynamically
-- instead of assuming Postgres's auto-generated name.
DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT con.conname INTO existing_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'complaints' AND att.attname = 'complaint_type' AND con.contype = 'c';

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE complaints DROP CONSTRAINT %I', existing_constraint);
  END IF;
END $$;

ALTER TABLE complaints ADD CONSTRAINT complaints_complaint_type_check
  CHECK (complaint_type IN ('Quality', 'Quantity Shortfall', 'Packaging', 'Delivery Delay', 'Wrong Item', 'Spoilage', 'Temperature Issue', 'Other'));