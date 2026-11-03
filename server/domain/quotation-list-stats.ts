import { sql } from "drizzle-orm";

/** Totals cover the whole portfolio, independently of the currently loaded page. */
export function quotationListStatsQuery(fallbackFx: number) {
  return sql`WITH quoted AS (
    SELECT *, COALESCE(CASE WHEN exchange_rate_at_quote>0 THEN exchange_rate_at_quote::float8 END,
      CASE WHEN usd_exchange_rate>0 THEN usd_exchange_rate END, NULLIF(${fallbackFx}::float8,0)) AS fx
    FROM quotations WHERE archived_at IS NULL
  ), converted AS (
    SELECT *, CASE WHEN quotation_currency='USD' THEN total_amount*fx ELSE total_amount END AS ars,
      CASE WHEN quotation_currency='USD' THEN total_amount ELSE total_amount/NULLIF(fx,0) END AS usd FROM quoted
  ) SELECT count(*)::int total,
    count(*) FILTER (WHERE status='approved')::int approved,
    count(*) FILTER (WHERE status='pending')::int pending,
    count(*) FILTER (WHERE status='draft')::int draft,
    count(*) FILTER (WHERE status='rejected')::int rejected,
    count(*) FILTER (WHERE status='in-negotiation')::int "inNegotiation",
    count(*) FILTER (WHERE status IN ('sent','viewed','in-negotiation') AND expires_at<now())::int expired,
    COALESCE(sum(ars),0)::float8 "totalValueARS", COALESCE(sum(usd),0)::float8 "totalValueUSD",
    count(*) FILTER (WHERE fx IS NULL)::int "missingFx",
    (SELECT json_build_object('name',project_name,'ars',COALESCE(ars,0)) FROM converted ORDER BY COALESCE(ars,0) DESC,id LIMIT 1) AS "topValueContributor",
    COALESCE((SELECT json_object_agg(reason,n) FROM (SELECT split_part(loss_reason,' — ',1) reason,count(*)::int n
      FROM converted WHERE status='rejected' AND loss_reason IS NOT NULL AND loss_reason<>'' GROUP BY 1) reasons),'{}'::json) AS "lossReasons"
    FROM converted`;
}
