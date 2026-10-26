/**
 * Historical effort query used by the quotation wizard and the service catalog.
 * Kept as plain SQL so the one-to-one ledger deduplication and grouping sets can
 * be exercised against an isolated PostgreSQL fixture.
 */
export const QUOTATION_EFFORT_BENCHMARKS_SQL = `
  WITH logged_hours AS (
    SELECT project_id, SUM(hours)::double precision AS actual_hours
    FROM (
      SELECT
        project_id,
        hours,
        source_order,
        ROW_NUMBER() OVER (
          PARTITION BY project_id, personnel_id, entry_day, normalized_hours, normalized_description, source_order
          ORDER BY entry_id
        ) AS source_occurrence,
        COUNT(*) FILTER (WHERE source_order = 0) OVER (
          PARTITION BY project_id, personnel_id, entry_day, normalized_hours, normalized_description
        ) AS legacy_count
      FROM (
        SELECT
          project_id,
          personnel_id,
          entry_id,
          hours,
          source_order,
          entry_date::date AS entry_day,
          ROUND(hours::numeric, 4) AS normalized_hours,
          LOWER(BTRIM(COALESCE(description, ''))) AS normalized_description
        FROM (
          SELECT legacy.project_id, legacy.personnel_id, legacy.id AS entry_id,
            legacy.date AS entry_date, legacy.hours, legacy.description, 0 AS source_order
          FROM time_entries legacy
          UNION ALL
          SELECT task.project_id, entry.personnel_id, entry.id AS entry_id,
            entry.date AS entry_date, entry.hours, entry.description, 1 AS source_order
          FROM task_time_entries entry
          INNER JOIN tasks task ON task.id = entry.task_id
        ) raw_entries
      ) fingerprinted_entries
    ) indexed_entries
    WHERE source_order = 0 OR source_occurrence > legacy_count
    GROUP BY project_id
  ), completed_projects AS (
    SELECT
      project.id AS project_id,
      quote.service_blueprint_id,
      blueprint.slug AS service_blueprint_slug,
      CASE
        WHEN quote.project_type IN ('fee-mensual', 'always-on', 'credit-pack') THEN 'fee-mensual'
        WHEN quote.project_type = 'monitoring' THEN 'monitoring'
        WHEN quote.project_type = 'demo' THEN 'demo'
        ELSE 'on-demand'
      END AS project_type,
      COALESCE(
        NULLIF(quote.scope_snapshot->>'durationMonths', '')::numeric,
        NULLIF(blueprint.definition->>'durationMonths', '')::numeric,
        NULLIF(substring(COALESCE(quote.project_duration, '') FROM '([0-9]+[.]?[0-9]*)'), '')::numeric,
        1::numeric
      ) AS duration_months,
      hours.actual_hours
    FROM active_projects project
    INNER JOIN quotations quote ON quote.id = project.quotation_id
    LEFT JOIN service_blueprints blueprint ON blueprint.id = quote.service_blueprint_id
    INNER JOIN logged_hours hours ON hours.project_id = project.id
    WHERE hours.actual_hours > 0
      AND project.status NOT IN ('cancelled', 'voided')
      AND (
        project.closed_at IS NOT NULL
        OR project.is_finished = true
        OR project.status IN ('completed', 'delivered', 'invoiced')
        OR project.workflow_stage = 'finalizado'
      )
  )
  SELECT
    service_blueprint_id,
    service_blueprint_slug,
    project_type,
    duration_months,
    COUNT(*)::integer AS sample_size,
    AVG(actual_hours)::double precision AS average_actual_hours,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY actual_hours)::double precision AS median_actual_hours
  FROM completed_projects
  GROUP BY GROUPING SETS (
    (service_blueprint_id, service_blueprint_slug, project_type, duration_months),
    (service_blueprint_slug, project_type, duration_months),
    (project_type, duration_months)
  )
  HAVING GROUPING(service_blueprint_slug) = 1 OR service_blueprint_slug IS NOT NULL
  ORDER BY project_type, service_blueprint_id NULLS LAST
`;
