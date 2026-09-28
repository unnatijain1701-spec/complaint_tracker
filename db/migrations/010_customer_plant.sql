ALTER TABLE customers ADD COLUMN plant TEXT;
UPDATE customers SET plant = 'Other' WHERE plant IS NULL;
ALTER TABLE customers ALTER COLUMN plant SET NOT NULL;

ALTER TABLE customers DROP CONSTRAINT customers_name_key;
ALTER TABLE customers ADD CONSTRAINT customers_name_plant_key UNIQUE (name, plant);