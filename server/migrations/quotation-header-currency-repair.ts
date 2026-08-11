/** Runtime copy of migrations/0039_quotation_header_currency_repair.sql. */
export const quotationHeaderCurrencyRepairMigrationSql = String.raw`
WITH team_totals AS (
  SELECT quotation_id, SUM(cost)::numeric AS team_cost
  FROM quotation_team_members
  WHERE variant_id IS NULL
  GROUP BY quotation_id
), candidates AS (
  SELECT quotation.id,
         ROUND(team.team_cost / quotation.base_cost::numeric) AS inferred_fx
  FROM quotations quotation
  JOIN team_totals team ON team.quotation_id = quotation.id
  WHERE quotation.status = 'draft'
    AND UPPER(COALESCE(quotation.quotation_currency, 'ARS')) = 'ARS'
    AND quotation.base_cost > 0
    AND team.team_cost / quotation.base_cost::numeric BETWEEN 100 AND 10000
    AND ABS(
      team.team_cost - quotation.base_cost::numeric
      * ROUND(team.team_cost / quotation.base_cost::numeric)
    ) <= GREATEST(10, ABS(team.team_cost) * 0.00001)
    AND NOT EXISTS (SELECT 1 FROM active_projects project WHERE project.quotation_id = quotation.id)
    AND NOT EXISTS (SELECT 1 FROM quotation_variants variant WHERE variant.quotation_id = quotation.id)
    AND NOT EXISTS (SELECT 1 FROM negotiation_history history WHERE history.quotation_id = quotation.id)
)
UPDATE quotations quotation
SET base_cost = ROUND((quotation.base_cost::numeric * candidates.inferred_fx), 2),
    complexity_adjustment = ROUND((quotation.complexity_adjustment::numeric * candidates.inferred_fx), 2),
    markup_amount = ROUND((quotation.markup_amount::numeric * candidates.inferred_fx), 2),
    total_amount = ROUND((quotation.total_amount::numeric * candidates.inferred_fx), 2),
    updated_at = NOW()
FROM candidates
WHERE quotation.id = candidates.id;
`;
