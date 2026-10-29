import { sql } from "drizzle-orm";

// The classification key includes area: callers must retain it in their DTOs.
export const roleRateAveragesQuery = sql`
      WITH latest_rates AS (
        SELECT DISTINCT ON (cost.personnel_id)
          cost.personnel_id,
          cost.hourly_rate_ars,
          cost.hourly_rate_usd,
          COALESCE(rate_by_id.rate, rate_by_period.rate) AS exchange_rate
        FROM personnel_historical_costs cost
        LEFT JOIN exchange_rates rate_by_id
          ON rate_by_id.id = cost.exchange_rate_id
        LEFT JOIN LATERAL (
          SELECT candidate.rate
          FROM exchange_rates candidate
          WHERE candidate.year = cost.year
            AND candidate.month = cost.month
            AND candidate.is_active = TRUE
          ORDER BY
            CASE WHEN candidate.rate_type = 'estimated' THEN 1 ELSE 0 END,
            candidate.specific_date DESC NULLS LAST,
            candidate.updated_at DESC
          LIMIT 1
        ) rate_by_period ON TRUE
        WHERE cost.is_active = TRUE
          AND (cost.year * 100 + cost.month) <= (
            EXTRACT(YEAR FROM CURRENT_DATE)::int * 100 + EXTRACT(MONTH FROM CURRENT_DATE)::int
          )
        ORDER BY cost.personnel_id, cost.year DESC, cost.month DESC, cost.updated_at DESC
      )
      , classification_averages AS (
        SELECT
          COALESCE(NULLIF(TRIM(p.current_role), ''), NULLIF(TRIM(r.name), ''), 'Sin rol') AS role_name,
          COALESCE(NULLIF(TRIM(p.sublevel), ''), 'Sin subnivel') AS sublevel,
          COALESCE(NULLIF(TRIM(p.area), ''), 'Sin área') AS area,
          AVG(NULLIF(latest.hourly_rate_ars, 0)) AS average_rate_ars,
          AVG(NULLIF(COALESCE(
            NULLIF(latest.hourly_rate_usd, 0),
            latest.hourly_rate_ars / NULLIF(latest.exchange_rate, 0)
          ), 0)) AS average_rate_usd,
          COUNT(*)::int AS personnel_count
        FROM personnel p
        LEFT JOIN roles r ON r.id = p.role_id
        LEFT JOIN latest_rates latest ON latest.personnel_id = p.id
        -- Los freelance cobran por encima de la escala fija: incluirlos corre el
        -- promedio del nivel hacia arriba y deja de representar al equipo.
        WHERE p.include_in_real_costs = TRUE
          AND COALESCE(p.contract_type, '') <> 'freelance'
          AND (p.active_until IS NULL OR p.active_until >= CURRENT_DATE::text)
        GROUP BY 1, 2, 3
      ), role_classifications AS (
        SELECT DISTINCT
          p.role_id,
          COALESCE(NULLIF(TRIM(p.current_role), ''), NULLIF(TRIM(r.name), ''), 'Sin rol') AS role_name,
          COALESCE(NULLIF(TRIM(p.sublevel), ''), 'Sin subnivel') AS sublevel,
          COALESCE(NULLIF(TRIM(p.area), ''), 'Sin área') AS area
        FROM personnel p
        LEFT JOIN roles r ON r.id = p.role_id
        WHERE p.include_in_real_costs = TRUE
          AND COALESCE(p.contract_type, '') <> 'freelance'
          AND (p.active_until IS NULL OR p.active_until >= CURRENT_DATE::text)
      )
      SELECT
        classification.role_id,
        average.role_name,
        average.sublevel,
        average.area,
        average.average_rate_ars,
        average.average_rate_usd,
        average.personnel_count
      FROM role_classifications classification
      INNER JOIN classification_averages average
        ON average.role_name = classification.role_name
        AND average.sublevel = classification.sublevel
        AND average.area = classification.area
      ORDER BY average.role_name, average.sublevel
    `;
