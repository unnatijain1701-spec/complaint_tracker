-- Small team roster, not enterprise SSO — just enough to know who
-- logged/updated what. Seed real accounts with: npm run seed:user
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
