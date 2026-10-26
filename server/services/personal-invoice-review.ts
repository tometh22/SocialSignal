import { sql } from "drizzle-orm";

// Invoice timestamps use timestamp without time zone and Drizzle interprets them
// as UTC. The raw review query must return the same instant for stale-edit checks.
export function personalInvoiceReviewQuery(period: string | null) {
  return sql`
        SELECT i.*,
               to_char(i.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at,
               u.email, CONCAT_WS(' ', u.first_name, u.last_name) AS user_name,
               p.name AS personnel_name,
               settlement.total_invoice_usd AS settlement_total_invoice_usd,
               settlement.final_invoice_ars AS settlement_final_invoice_ars,
               settlement.total_ars AS settlement_total_ars,
               settlement.billing_currency_snapshot AS settlement_billing_currency,
               settlement.bonus_usd AS settlement_bonus_usd,
               settlement.extras_ars AS settlement_extras_ars,
               settlement.invoice_fx AS settlement_invoice_fx,
               settlement.received_fx AS settlement_received_fx
        FROM personal_monthly_invoices i
        LEFT JOIN users u ON u.id = i.user_id
        LEFT JOIN personnel p ON p.id = i.personnel_id
        LEFT JOIN personnel_monthly_settlements settlement ON settlement.id = i.settlement_id
        WHERE ${period ? sql`i.period = ${period}` : sql`TRUE`}
        ORDER BY i.period DESC, i.uploaded_at DESC
      `;
}
