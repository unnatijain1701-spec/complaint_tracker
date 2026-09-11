-- Nullable in the DB (existing rows have none) — required going forward is
-- enforced at the application layer, same pattern as the other required
-- complaint fields.
ALTER TABLE complaints ADD COLUMN invoice_number TEXT;
