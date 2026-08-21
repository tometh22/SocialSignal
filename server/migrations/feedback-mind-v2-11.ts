/** Runtime copy of migrations/0049_feedback_mind_v2_11.sql. */
export const feedbackMindV211MigrationSql = String.raw`
ALTER TABLE personnel
  ADD COLUMN IF NOT EXISTS area text;

UPDATE personnel
SET current_role = CASE
  WHEN lower(coalesce(current_role, '')) ~ '(^|[^0-9])(5|05)([^0-9]|$)|(lead de leads|head|director|ceo|coo)' THEN '5 Lead de Leads'
  WHEN lower(coalesce(current_role, '')) ~ '(^|[^0-9])(4|04)([^0-9]|$)|lead' THEN '4 Lead'
  WHEN lower(coalesce(current_role, '')) ~ '(^|[^0-9])(2|02)([^0-9]|$)|(semi[ -]?senior|ssr)' THEN '2 Semi Senior'
  WHEN lower(coalesce(current_role, '')) ~ '(^|[^0-9])(1|01)([^0-9]|$)|(^|[^a-z])(junior|jr)([^a-z]|$)' THEN '1 Junior'
  WHEN lower(coalesce(current_role, '')) ~ '(^|[^0-9])(3|03)([^0-9]|$)|(^|[^a-z])(senior|sr)([^a-z]|$)' THEN '3 Senior'
  WHEN lower(coalesce(legacy_role, '')) ~ '(lead de leads|head|director|ceo|coo)' THEN '5 Lead de Leads'
  WHEN lower(coalesce(legacy_role, '')) ~ 'lead' THEN '4 Lead'
  WHEN lower(coalesce(legacy_role, '')) ~ '(semi[ -]?senior|ssr)' THEN '2 Semi Senior'
  WHEN lower(coalesce(legacy_role, '')) ~ '(^|[^a-z])(junior|jr)([^a-z]|$)' THEN '1 Junior'
  WHEN lower(coalesce(legacy_role, '')) ~ '(^|[^a-z])(senior|sr)([^a-z]|$)' THEN '3 Senior'
  ELSE NULL
END;

UPDATE personnel
SET sublevel = CASE upper(btrim(coalesce(sublevel, '')))
  WHEN 'A' THEN 'A'
  WHEN 'B' THEN 'B'
  WHEN 'C' THEN CASE WHEN current_role = '4 Lead' THEN 'C' ELSE NULL END
  ELSE NULL
END;

UPDATE exchange_rates forecast
SET is_active = FALSE,
    updated_at = NOW(),
    notes = concat_ws(' · ', NULLIF(forecast.notes, ''), 'Reemplazado por tipo de cambio real')
WHERE forecast.is_active = TRUE
  AND forecast.rate_type = 'estimated'
  AND EXISTS (
    SELECT 1
    FROM exchange_rates actual
    WHERE actual.year = forecast.year
      AND actual.month = forecast.month
      AND actual.is_active = TRUE
      AND actual.rate_type <> 'estimated'
  );
`;
