-- Cotizador: persistencia completa del alcance comercial.

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS project_duration TEXT,
  ADD COLUMN IF NOT EXISTS deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_deliverable_cost DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Legacy rows stored tools in USD and platform in ARS regardless of the quote
-- currency. Normalize both columns to quotation_currency, like every other
-- monetary header field. manual_price keeps its explicit native currency.
UPDATE quotations
SET tools_cost = tools_cost * exchange_rate_at_quote::double precision
WHERE quotation_currency = 'ARS'
  AND COALESCE(tools_cost, 0) <> 0
  AND COALESCE(exchange_rate_at_quote::double precision, 0) > 0
  AND base_cost >= 0
  AND total_amount >= 0
  AND (status = 'draft' OR total_amount > 0)
  AND quotation_currency IN ('ARS', 'USD')
  AND COALESCE(platform_cost, 0) >= 0
  AND COALESCE(tools_cost, 0) >= 0
  AND COALESCE(additional_deliverable_cost, 0) >= 0
  AND COALESCE(discount_percentage, 0) >= 0
  AND COALESCE(discount_percentage, 0) < 100
  AND tools_cost * exchange_rate_at_quote::double precision >= 0;

UPDATE quotations
SET platform_cost = platform_cost / exchange_rate_at_quote::double precision
WHERE quotation_currency = 'USD'
  AND COALESCE(platform_cost, 0) <> 0
  AND COALESCE(exchange_rate_at_quote::double precision, 0) > 0
  AND base_cost >= 0
  AND total_amount >= 0
  AND (status = 'draft' OR total_amount > 0)
  AND quotation_currency IN ('ARS', 'USD')
  AND COALESCE(platform_cost, 0) >= 0
  AND COALESCE(tools_cost, 0) >= 0
  AND COALESCE(additional_deliverable_cost, 0) >= 0
  AND COALESCE(discount_percentage, 0) >= 0
  AND COALESCE(discount_percentage, 0) < 100
  AND platform_cost / exchange_rate_at_quote::double precision >= 0;

DO $$ BEGIN
  ALTER TABLE quotations ADD CONSTRAINT quotations_nonnegative_money_check CHECK (
    base_cost >= 0
    AND total_amount >= 0
    AND (status = 'draft' OR total_amount > 0)
    AND quotation_currency IN ('ARS', 'USD')
    AND COALESCE(platform_cost, 0) >= 0
    AND COALESCE(tools_cost, 0) >= 0
    AND COALESCE(additional_deliverable_cost, 0) >= 0
    AND COALESCE(discount_percentage, 0) >= 0
    AND COALESCE(discount_percentage, 0) < 100
  ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE quotation_team_members ADD CONSTRAINT quotation_team_nonnegative_check CHECK (
    hours >= 0 AND rate >= 0 AND cost >= 0 AND ABS(cost - hours * rate) <= 0.02
  ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE quotation_variants ADD CONSTRAINT quotation_variant_positive_total_check
    CHECK (base_cost >= 0 AND total_amount > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- is_selected means the scenario accepted by the client, not merely a variant
-- included in the proposal. Repair legacy multiple selections deterministically.
WITH ranked AS (
  SELECT variant.id,
    ROW_NUMBER() OVER (
      PARTITION BY variant.quotation_id
      ORDER BY
        (ABS(variant.total_amount - quotation.total_amount) <= 0.02) DESC,
        variant.variant_order,
        variant.id
    ) AS position
  FROM quotation_variants variant
  JOIN quotations quotation ON quotation.id = variant.quotation_id
  WHERE variant.is_selected = TRUE
)
UPDATE quotation_variants variant
SET is_selected = FALSE
FROM ranked
WHERE variant.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS quotation_variants_one_selected_idx
  ON quotation_variants(quotation_id)
  WHERE is_selected = TRUE;

CREATE INDEX IF NOT EXISTS quotation_team_base_lookup_idx
  ON quotation_team_members(quotation_id)
  WHERE variant_id IS NULL;

CREATE INDEX IF NOT EXISTS quotation_team_variant_lookup_idx
  ON quotation_team_members(variant_id)
  WHERE variant_id IS NOT NULL;
