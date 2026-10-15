-- Cumpleaños de personas que no son personal (sin costos, capacidad ni ausencias): sólo nombre y fecha.
CREATE TABLE IF NOT EXISTS birthday_entries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  birthday TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
