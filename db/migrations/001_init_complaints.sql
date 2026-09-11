-- Core complaints table. Kept to plain columns (no complaint-only-shaped
-- constraints) so a later bulk-insert script from the legacy Excel trackers
-- can populate it the same way the manual-entry API does.

CREATE TABLE complaints (
  id SERIAL PRIMARY KEY,
  date_received DATE NOT NULL,
  date_logged TIMESTAMP NOT NULL DEFAULT now(),
  customer_name TEXT NOT NULL,
  sku TEXT NOT NULL,
  plant TEXT NOT NULL
    CHECK (plant IN ('Rai', 'Jaipur', 'Bangalore', 'Mumbai', 'Hyderabad', 'Other')),
  complaint_type TEXT NOT NULL
    CHECK (complaint_type IN ('Quality', 'Quantity Shortfall', 'Packaging', 'Delivery Delay', 'Wrong Item', 'Spoilage', 'Other')),
  channel TEXT NOT NULL
    CHECK (channel IN ('Email', 'Call', 'WhatsApp', 'Portal', 'Other')),
  description TEXT NOT NULL,
  priority_suggested TEXT
    CHECK (priority_suggested IN ('Critical', 'High', 'Medium', 'Low')),
  priority_final TEXT
    CHECK (priority_final IN ('Critical', 'High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'Open'
    CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  assigned_to TEXT,
  logged_by TEXT,
  sla_due_at TIMESTAMP,
  resolution_notes TEXT,
  resolution_date TIMESTAMP,
  root_cause TEXT
);

CREATE INDEX idx_complaints_sku ON complaints (sku);
CREATE INDEX idx_complaints_customer_name ON complaints (customer_name);
CREATE INDEX idx_complaints_date_received ON complaints (date_received);
CREATE INDEX idx_complaints_status ON complaints (status);
CREATE INDEX idx_complaints_plant ON complaints (plant);
-- Supports the priority engine's recurrence-bump lookup (same customer+SKU,
-- >=2 complaints in the last 30 days), added in a later phase.
CREATE INDEX idx_complaints_customer_sku ON complaints (customer_name, sku);
