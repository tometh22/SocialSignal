
-- Migration: Create normalized personnel historical costs table
-- This replaces the repetitive monthly cost columns with a proper normalized structure

CREATE TABLE personnel_historical_costs (
  id SERIAL PRIMARY KEY,
  personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2050),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  hourly_rate_ars NUMERIC(10,2) CHECK (hourly_rate_ars >= 0),
  monthly_salary_ars NUMERIC(12,2) CHECK (monthly_salary_ars >= 0),
  hourly_rate_usd NUMERIC(10,2) CHECK (hourly_rate_usd >= 0),
  monthly_salary_usd NUMERIC(12,2) CHECK (monthly_salary_usd >= 0),
  exchange_rate_id INTEGER REFERENCES exchange_rates(id),
  adjustment_reason TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  
  -- Ensure unique active record per personnel/year/month
  UNIQUE(personnel_id, year, month) WHERE is_active = true
);

-- Create indexes for better performance
CREATE INDEX idx_personnel_historical_costs_personnel_date 
ON personnel_historical_costs(personnel_id, year, month) WHERE is_active = true;

CREATE INDEX idx_personnel_historical_costs_year_month 
ON personnel_historical_costs(year, month) WHERE is_active = true;

-- Add constraint to ensure at least one cost value is provided
ALTER TABLE personnel_historical_costs 
ADD CONSTRAINT check_at_least_one_cost 
CHECK (
  hourly_rate_ars IS NOT NULL OR 
  monthly_salary_ars IS NOT NULL OR 
  hourly_rate_usd IS NOT NULL OR 
  monthly_salary_usd IS NOT NULL
);

-- Migrate existing data from personnel table to normalized structure
-- This will be done in a separate data migration script
