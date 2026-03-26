-- Migration: Add new columns and tables for operations module
-- Date: 2026-03-26

-- Add missing columns to active_projects
ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS selected_variant_id INTEGER REFERENCES quotation_variants(id);
ALTER TABLE active_projects ADD COLUMN IF NOT EXISTS project_category TEXT NOT NULL DEFAULT 'billable';

-- Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  date TIMESTAMP NOT NULL,
  name TEXT NOT NULL,
  is_national BOOLEAN NOT NULL DEFAULT TRUE,
  year INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create monthly_closings table
CREATE TABLE IF NOT EXISTS monthly_closings (
  id SERIAL PRIMARY KEY,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  actual_hours DOUBLE PRECISION NOT NULL,
  adjusted_hours DOUBLE PRECISION NOT NULL,
  hourly_rate DOUBLE PRECISION NOT NULL,
  total_cost DOUBLE PRECISION NOT NULL,
  notes TEXT,
  closed_by INTEGER REFERENCES users(id),
  closed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_person_month_closing UNIQUE(personnel_id, year, month)
);

-- Create estimated_rates table
CREATE TABLE IF NOT EXISTS estimated_rates (
  id SERIAL PRIMARY KEY,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  estimated_rate_ars DOUBLE PRECISION NOT NULL,
  adjustment_pct DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  CONSTRAINT unique_person_month_rate UNIQUE(personnel_id, year, month)
);

-- Create personnel_aliases table
CREATE TABLE IF NOT EXISTS personnel_aliases (
  id SERIAL PRIMARY KEY,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id),
  excel_name VARCHAR(255) NOT NULL UNIQUE,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
