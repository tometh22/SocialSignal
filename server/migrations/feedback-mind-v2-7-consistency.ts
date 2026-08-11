/** Runtime copy of migrations/0037_feedback_mind_v2_7_consistency.sql. */
export const feedbackMindV27ConsistencyMigrationSql = String.raw`
WITH team_totals AS (
  SELECT quotation_id, SUM(cost) AS team_cost
  FROM quotation_team_members
  WHERE variant_id IS NULL
  GROUP BY quotation_id
), mixed_usd_quotes AS (
  SELECT quotation.id, quotation.exchange_rate_at_quote::numeric AS fx
  FROM quotations quotation
  JOIN team_totals team ON team.quotation_id = quotation.id
  WHERE UPPER(COALESCE(quotation.quotation_currency, 'ARS')) = 'USD'
    AND quotation.exchange_rate_at_quote > 0
    AND team.team_cost > quotation.base_cost * 10
    AND ABS(team.team_cost - quotation.base_cost * quotation.exchange_rate_at_quote::numeric)
        <= GREATEST(1, ABS(quotation.base_cost * quotation.exchange_rate_at_quote::numeric) * 0.001)
)
UPDATE quotation_team_members member
SET rate = member.rate / mixed.fx,
    cost = member.cost / mixed.fx
FROM mixed_usd_quotes mixed
WHERE member.quotation_id = mixed.id
  AND member.variant_id IS NULL;

WITH global_fx AS (
  SELECT config_value::numeric AS rate
  FROM system_config
  WHERE config_key = 'usd_exchange_rate'
  LIMIT 1
), canonical_usd_facts AS (
  SELECT fact.id,
         historical.hourly_rate_usd::numeric AS hourly_rate_usd,
         COALESCE(month_fx.rate::numeric, global_fx.rate, fact.fx::numeric) AS fx
  FROM fact_labor_month fact
  JOIN personnel person ON person.id = fact.person_id
  JOIN LATERAL (
    SELECT cost.hourly_rate_usd
    FROM personnel_historical_costs cost
    WHERE cost.personnel_id = person.id
      AND cost.is_active = true
      AND cost.hourly_rate_usd > 0
      AND (cost.year * 100 + cost.month) <= REPLACE(fact.period_key, '-', '')::integer
    ORDER BY cost.year DESC, cost.month DESC
    LIMIT 1
  ) historical ON true
  LEFT JOIN exchange_rates month_fx
    ON month_fx.year = LEFT(fact.period_key, 4)::integer
   AND month_fx.month = RIGHT(fact.period_key, 2)::integer
   AND month_fx.is_active = true
  LEFT JOIN global_fx ON true
  WHERE UPPER(COALESCE(person.billing_currency, 'ARS')) = 'USD'
    AND NOT (COALESCE(fact.flags, '[]'::jsonb) @> '["source_app"]'::jsonb)
)
UPDATE fact_labor_month fact
SET hourly_rate_ars = ROUND(canonical.hourly_rate_usd * canonical.fx, 2),
    cost_ars = ROUND(fact.billing_hours::numeric * canonical.hourly_rate_usd * canonical.fx, 2),
    cost_usd = ROUND(fact.billing_hours::numeric * canonical.hourly_rate_usd, 2),
    fx = ROUND(canonical.fx, 4),
    flags = CASE
      WHEN (COALESCE(fact.flags, '[]'::jsonb) - 'rate_missing_zero_cost' - 'missing_fx')
           @> '["contractual_usd_rate_repaired"]'::jsonb
        THEN COALESCE(fact.flags, '[]'::jsonb) - 'rate_missing_zero_cost' - 'missing_fx'
      ELSE (COALESCE(fact.flags, '[]'::jsonb) - 'rate_missing_zero_cost' - 'missing_fx')
           || '["contractual_usd_rate_repaired"]'::jsonb
    END,
    loaded_at = NOW()
FROM canonical_usd_facts canonical
WHERE fact.id = canonical.id
  AND canonical.fx > 0
  AND (
    fact.hourly_rate_ars IS DISTINCT FROM ROUND(canonical.hourly_rate_usd * canonical.fx, 2)
    OR fact.cost_ars IS DISTINCT FROM ROUND(fact.billing_hours::numeric * canonical.hourly_rate_usd * canonical.fx, 2)
    OR fact.cost_usd IS DISTINCT FROM ROUND(fact.billing_hours::numeric * canonical.hourly_rate_usd, 2)
    OR fact.fx IS DISTINCT FROM ROUND(canonical.fx, 4)
    OR COALESCE(fact.flags, '[]'::jsonb) ?| ARRAY['rate_missing_zero_cost', 'missing_fx']
  );
`;
