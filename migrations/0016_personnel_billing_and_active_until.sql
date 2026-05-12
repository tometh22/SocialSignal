-- Add billing currency, USD billing fraction, and active-until fields to personnel

ALTER TABLE personnel
  ADD COLUMN IF NOT EXISTS billing_currency text NOT NULL DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS usd_billing_fraction double precision DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_until text;
