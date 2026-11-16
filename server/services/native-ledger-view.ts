import { pool } from "../db";
import { addMonths } from "../../shared/finance-native";

/**
 * Por cobrar / Por pagar for a month that belongs to Mind: every Mind record still
 * open at the month end (issued that month or before, including opening balances),
 * with its balance as of that day. Same definition as native-month.ts.
 */
type Kind = "activo" | "pasivo";
const config = (kind: Kind) => kind === "activo"
  ? { table: "activo_entries", fk: "activo_entry_id", extra: `AND lower(translate(COALESCE(e.tipo_activo,''),'íÍ','iI')) NOT IN ('activo liquido','mediano plazo')` }
  : { table: "pasivo_entries", fk: "pasivo_entry_id", extra: "" };
const usd = `COALESCE(CASE WHEN e.currency='ARS' THEN e.gross_amount/NULLIF(e.cotizacion,0) ELSE e.gross_amount END, e.monto_total_usd, e.monto_usd, e.monto_ars/NULLIF(e.cotizacion,0), 0)`;

function baseQuery(kind: Kind) {
  const { table, fk, extra } = config(kind);
  return `WITH docs AS (
      SELECT e.*, ${usd}::float8 amount_usd,
        (${usd} - COALESCE((SELECT sum(a.amount_usd) FROM financial_document_applications a WHERE a.${fk}=e.id AND a.voided_at IS NULL AND a.applied_at < $2::date),0))::float8 balance_usd,
        COALESCE((SELECT sum(a.amount_usd) FROM financial_document_applications a WHERE a.${fk}=e.id AND a.voided_at IS NULL AND a.applied_at >= $3::date AND a.applied_at < $2::date),0)::float8 settled_in_month
      FROM ${table} e
      WHERE e.period_key <= $1 AND e.voided_at IS NULL AND COALESCE(e.source,'') <> 'excel' ${extra}
    )`;
}

export async function nativeLedgerSummary(kind: Kind, period: string) {
  const end = `${addMonths(period, 1)}-01`, start = `${period}-01`;
  const { rows: [row] } = await pool.query(`${baseQuery(kind)}
    SELECT COALESCE(sum(amount_usd) FILTER (WHERE period_key=$1 AND COALESCE(source,'') <> 'opening'),0)::float8 total,
      COALESCE(sum(settled_in_month),0)::float8 settled,
      COALESCE(sum(balance_usd) FILTER (WHERE balance_usd > 0.005),0)::float8 pending,
      COALESCE(sum(balance_usd) FILTER (WHERE balance_usd > 0.005 AND fecha_vencimiento < $2::date),0)::float8 overdue,
      count(*) FILTER (WHERE period_key=$1 OR balance_usd > 0.005)::int count
    FROM docs`, [period, end, start]);
  return row;
}

export async function nativeLedgerList(kind: Kind, period: string, options: { page: number; pageSize: number; estado?: string; subtipo?: string }) {
  const end = `${addMonths(period, 1)}-01`, start = `${period}-01`;
  const filters = [`(period_key=$1 OR balance_usd > 0.005)`];
  if (options.estado === "pendiente") filters.push("balance_usd > 0.005");
  if (options.estado === "vencido") filters.push("balance_usd > 0.005 AND fecha_vencimiento < $2::date");
  if (options.estado === "cobrado" || options.estado === "pagado") filters.push("balance_usd <= 0.005");
  const params: unknown[] = [period, end, start];
  if (options.subtipo && kind === "pasivo") { params.push(options.subtipo); filters.push(`subtipo_costo = $${params.length}`); }
  const where = filters.join(" AND ");
  const { rows } = await pool.query(`${baseQuery(kind)}
    SELECT *, count(*) OVER()::int total_count FROM docs WHERE ${where}
    ORDER BY (period_key = $1) DESC, fecha_vencimiento NULLS LAST, id DESC LIMIT ${options.pageSize} OFFSET ${(options.page - 1) * options.pageSize}`, params);
  const total = rows[0]?.total_count ?? 0;
  return {
    items: rows.map(row => ({
      id: row.id, periodKey: row.period_key, source: row.source, overrideManual: row.override_manual,
      concepto: row.concepto, clienteNombre: row.cliente_nombre, nroFactura: row.nro_factura,
      detalle: row.detalle, subtipoCosto: row.subtipo_costo, fechaEmision: row.fecha_emision, fechaVencimiento: row.fecha_vencimiento,
      vencido: row.balance_usd > 0.005 && row.fecha_vencimiento != null && new Date(row.fecha_vencimiento) < new Date(end),
      cobradoAlCierre: row.balance_usd <= 0.005, pagadoAlCierre: row.balance_usd <= 0.005,
      status: row.balance_usd <= 0.005 ? "PAID" : row.balance_usd < row.amount_usd - 0.005 ? "PARTIAL" : "PENDING",
      montoTotalUSD: row.amount_usd, outstandingUSD: Math.max(0, row.balance_usd), openingBalance: row.source === "opening",
      issuedBefore: row.period_key < period,
    })),
    pagination: { page: options.page, pageSize: options.pageSize, total, totalPages: Math.ceil(total / options.pageSize) },
  };
}
