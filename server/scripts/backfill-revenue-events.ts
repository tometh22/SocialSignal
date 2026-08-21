import { pool } from "../db";

/**
 * Backfill de revenue_events desde google_sheets_sales.
 *
 * Es idempotente: la clave (source_tab, source_row_id) evita duplicados y las
 * corridas sucesivas actualizan montos y estado.
 *
 * IMPORTANTE — neutralidad: todas las filas se cargan con delivery_curve
 * 'invoice', o sea devengado == facturación. Migrar NO cambia ningún número
 * del dashboard actual. El devengado real aparece recién cuando Operaciones
 * carga las fechas de entrega en la planilla y se corre
 * `applyDeliveryWindow()` sobre los proyectos que correspondan.
 *
 *   npx tsx server/scripts/backfill-revenue-events.ts
 */

/** Términos contractuales conocidos, de la columna "Condición de pago". */
const KNOWN_PAYMENT_TERMS: Array<{ client: string; days: number; note: string }> = [
  { client: 'Warner', days: 90, note: 'Cobranza observada ~115 días; las facturas que vencen en diciembre entran en enero.' },
  { client: 'Kimberly Clark', days: 120, note: '' },
  { client: 'Coelsa', days: 30, note: '' },
  { client: 'Detroit', days: 0, note: 'Efectivo, no requiere factura.' },
];

export interface BackfillResult {
  inserted: number;
  updated: number;
  skipped: number;
  paymentTermsSeeded: number;
}

export async function backfillRevenueEvents(): Promise<BackfillResult> {
  const result: BackfillResult = { inserted: 0, updated: 0, skipped: 0, paymentTermsSeeded: 0 };

  for (const term of KNOWN_PAYMENT_TERMS) {
    await pool.query(
      `INSERT INTO client_payment_terms (client_name, contractual_days, note)
       VALUES ($1, $2, NULLIF($3, ''))
       ON CONFLICT (client_name) DO UPDATE
         SET contractual_days = EXCLUDED.contractual_days,
             note = COALESCE(EXCLUDED.note, client_payment_terms.note),
             updated_at = now()`,
      [term.client, term.days, term.note],
    );
    result.paymentTermsSeeded++;
  }

  const { rows } = await pool.query(
    `SELECT s.month_key, s.client_name, s.project_name, s.project_id,
            s.amount_usd, s.amount_local, s.currency, s.fx_applied,
            s.confirmed, s.status, s.unique_key,
            t.contractual_days
       FROM google_sheets_sales s
       LEFT JOIN client_payment_terms t ON t.client_name = s.client_name
      WHERE s.month_key IS NOT NULL
        AND s.amount_usd IS NOT NULL`,
  );

  for (const row of rows) {
    const amountUsd = Number(row.amount_usd);
    if (!Number.isFinite(amountUsd) || amountUsd === 0) {
      result.skipped++;
      continue;
    }

    // 'cobrado' en el origen significa que la plata entró; se registra como
    // cobranza real en el mismo mes salvo que haya un dato mejor.
    const collected = String(row.status ?? '').toLowerCase() === 'cobrado';
    const confirmed = String(row.confirmed ?? 'SI').toUpperCase() === 'SI';

    const upsert = await pool.query(
      `INSERT INTO revenue_events
         (project_id, client_name, project_name, amount_usd, amount_native, currency,
          fx_rate, invoice_period, delivery_curve, collection_period_actual,
          payment_terms_days, confirmed, status, source_tab, source_row_id)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'USD'),$7,$8,'invoice',$9,$10,$11,$12,
               'google_sheets_sales',$13)
       ON CONFLICT (source_tab, source_row_id) DO UPDATE
         SET amount_usd = EXCLUDED.amount_usd,
             amount_native = EXCLUDED.amount_native,
             fx_rate = EXCLUDED.fx_rate,
             invoice_period = EXCLUDED.invoice_period,
             collection_period_actual = EXCLUDED.collection_period_actual,
             payment_terms_days = EXCLUDED.payment_terms_days,
             confirmed = EXCLUDED.confirmed,
             status = EXCLUDED.status,
             updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [
        row.project_id ?? null,
        row.client_name,
        row.project_name ?? null,
        amountUsd,
        row.amount_local ?? null,
        row.currency ?? null,
        row.fx_applied ?? null,
        row.month_key,
        collected ? row.month_key : null,
        row.contractual_days ?? null,
        confirmed,
        confirmed ? (collected ? 'collected' : 'confirmed') : 'pipeline',
        row.unique_key,
      ],
    );

    if (upsert.rows[0]?.inserted) result.inserted++;
    else result.updated++;
  }

  return result;
}

/**
 * Declara la ventana de entrega de un proyecto. Es el paso que convierte al
 * devengado en un número distinto de la facturación.
 *
 * Ejemplo — la venta que originó todo:
 *   applyDeliveryWindow('Warner', 'Fee Insights', '2026-09', '2027-08', 'linear')
 *   => 30.000 devengan en 2026 y 60.000 en 2027.
 */
export async function applyDeliveryWindow(
  clientName: string,
  projectNameLike: string,
  deliveryStart: string,
  deliveryEnd: string,
  curve: 'linear' | 'input_method' = 'linear',
): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE revenue_events
        SET delivery_start = $3, delivery_end = $4, delivery_curve = $5, updated_at = now()
      WHERE client_name = $1
        AND project_name ILIKE '%' || $2 || '%'
        AND status <> 'cancelled'`,
    [clientName, projectNameLike, deliveryStart, deliveryEnd, curve],
  );
  return rowCount ?? 0;
}

const isDirectRun = process.argv[1]?.includes('backfill-revenue-events');
if (isDirectRun) {
  backfillRevenueEvents()
    .then((r) => {
      console.log(`✅ revenue_events: ${r.inserted} insertados, ${r.updated} actualizados, ${r.skipped} salteados`);
      console.log(`✅ client_payment_terms: ${r.paymentTermsSeeded} clientes`);
      console.log('\nℹ️  Todas las filas quedaron con delivery_curve = invoice.');
      console.log('   El devengado es idéntico a la facturación hasta que se carguen');
      console.log('   las ventanas de entrega con applyDeliveryWindow().');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Backfill falló:', err);
      process.exit(1);
    });
}
