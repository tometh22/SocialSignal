// Keep thresholds and pure logic side-effect free for unit tests.
const pool = {
  query: async (queryText: string, values?: unknown[]) => {
    const { pool: databasePool } = await import("../db");
    return databasePool.query(queryText, values);
  },
};

import { addMonths, getCurrentMonthKey, monthRange, monthSpan } from "./dates";

/**
 * DETECTORES DE CALIDAD DE DATO
 *
 * Cada detector nace de algo que se perdió en el análisis del 2026-08-20 y que
 * nadie vio hasta revisar la planilla a mano. La regla de diseño es que un
 * detector no opina sobre el negocio: sólo señala que un número no puede
 * leerse como parece.
 */

export type Severity = 'info' | 'warning' | 'critical';

export interface Finding {
  detector: string;
  severity: Severity;
  periodKey?: string | null;
  entity?: string | null;
  title: string;
  detail?: string;
  expectedValue?: number | null;
  actualValue?: number | null;
  delta?: number | null;
  sourceRef?: string | null;
}

export const THRESHOLDS = {
  /** Divergencia relativa entre facturación y devengado que amerita alerta. */
  basisDivergenceWarn: 0.05,
  basisDivergenceCritical: 0.15,
  /** Participación de un solo cliente en el ingreso proyectado. */
  concentrationWarn: 0.5,
  concentrationCritical: 0.65,
  /**
   * Meses de facturación cargada hacia adelante por debajo de los cuales se alerta.
   * 12 es el piso razonable para una agencia con contratos anuales: al 2026-08 el
   * horizonte cargado llegaba a 2027-05, o sea 9 meses, y nadie lo había notado.
   */
  coverageMonthsWarn: 12,
  coverageMonthsCritical: 6,
  /** Desvío de cobranza real vs términos contractuales, en días. */
  dsoDriftWarnDays: 15,
  dsoDriftCriticalDays: 30,
  /** Participación de un concepto de costo sobre la facturación. */
  costConcentrationWarn: 0.15,
  /** Monto mínimo para que valga la pena reportar un hallazgo. */
  materialityUsd: 1000,
};

/**
 * Algunas tablas que shared/schema.ts declara no existen en todos los entornos
 * (fact_estimated_cost_month, por ejemplo, no está en producción). Un detector
 * que consulta una tabla ausente no debe tumbar toda la corrida: se saltea.
 */
async function tableExists(name: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT to_regclass($1) IS NOT NULL AS existe`, [`public.${name}`]);
  return rows[0]?.existe === true;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function usd(n: number): string {
  return `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Divergencia entre bases
//
// Caso: la venta de Warner de 90k facturada en sep-2026 y entregada hasta
// ago-2027 hace que 2026 valga 641k por facturación y 581k por devengado.
// Reportar una sola de las dos, sin decir cuál, fue el origen de toda la
// confusión con el board.
// ─────────────────────────────────────────────────────────────────────────────
export function detectBasisDivergence(
  year: number,
  facturacion: number,
  devengado: number,
): Finding[] {
  const delta = facturacion - devengado;
  if (Math.abs(delta) < THRESHOLDS.materialityUsd || facturacion === 0) return [];

  const ratio = Math.abs(delta) / Math.abs(facturacion);
  if (ratio < THRESHOLDS.basisDivergenceWarn) return [];

  const adelantado = delta > 0;
  return [{
    detector: 'basis_divergence',
    severity: ratio >= THRESHOLDS.basisDivergenceCritical ? 'critical' : 'warning',
    entity: String(year),
    title: `${year}: facturación y devengado difieren ${pct(ratio)}`,
    detail: adelantado
      ? `Se facturan ${usd(delta)} más de lo que se entrega dentro del año. Ese monto es resultado de ejercicios futuros. No presentar una sola base sin etiquetarla.`
      : `Se entregan ${usd(-delta)} más de lo que se factura dentro del año. Hay trabajo ejecutado pendiente de facturar.`,
    expectedValue: devengado,
    actualValue: facturacion,
    delta,
  }];
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Concentración de ingresos
//
// Caso: Warner explica el 74% de la facturación proyectada sep-dic 2026 y su
// contrato de fee vence en may-2027. Estaba en los datos y nadie lo miraba.
// ─────────────────────────────────────────────────────────────────────────────
export function detectRevenueConcentration(
  byClient: Array<{ clientName: string; amountUsd: number }>,
  scopeLabel: string,
): Finding[] {
  const total = byClient.reduce((a, c) => a + c.amountUsd, 0);
  if (total <= 0) return [];

  const top = [...byClient].sort((a, b) => b.amountUsd - a.amountUsd)[0];
  const share = top.amountUsd / total;
  if (share < THRESHOLDS.concentrationWarn) return [];

  // Índice Herfindahl: 1 = un solo cliente, 0 = infinitos clientes iguales.
  const hhi = byClient.reduce((a, c) => a + (c.amountUsd / total) ** 2, 0);

  return [{
    detector: 'revenue_concentration',
    severity: share >= THRESHOLDS.concentrationCritical ? 'critical' : 'warning',
    entity: top.clientName,
    title: `${top.clientName} concentra ${pct(share)} de la facturación (${scopeLabel})`,
    detail: `HHI ${hhi.toFixed(2)} sobre ${byClient.length} clientes. Verificar fecha de vencimiento del contrato y estado de la renovación.`,
    actualValue: top.amountUsd,
    expectedValue: total,
    delta: share,
  }];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Acantilado de facturación
//
// Caso: en toda la solapa de ventas había cinco filas de 2027 (Warner, ene a
// may) y nada después. El horizonte cargado se acababa y no había alerta.
// ─────────────────────────────────────────────────────────────────────────────
export function detectForwardCoverageCliff(
  lastLoadedPeriod: string | null,
  currentPeriod: string,
): Finding[] {
  if (!lastLoadedPeriod) {
    return [{
      detector: 'forward_coverage_cliff',
      severity: 'critical',
      periodKey: currentPeriod,
      title: 'No hay facturación cargada hacia adelante',
      detail: 'La proyección no tiene ni un período futuro con ingreso confirmado.',
      actualValue: 0,
    }];
  }

  // monthSpan es inclusive de ambos extremos; el mes en curso no cuenta como cobertura.
  const months = monthSpan(currentPeriod, lastLoadedPeriod) - 1;
  if (months >= THRESHOLDS.coverageMonthsWarn) return [];

  return [{
    detector: 'forward_coverage_cliff',
    severity: months <= THRESHOLDS.coverageMonthsCritical ? 'critical' : 'warning',
    periodKey: lastLoadedPeriod,
    title: `La facturación cargada se corta en ${lastLoadedPeriod} (${months} meses de horizonte)`,
    detail: `Después de ${lastLoadedPeriod} no hay ingreso cargado. Si es real, es un acantilado; si es que falta cargar, la proyección del período está subestimada.`,
    actualValue: months,
    expectedValue: THRESHOLDS.coverageMonthsWarn,
  }];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Líneas en cero en la proyección
//
// Caso: "Impuestos USA" y "Provisiones" figuran en 0,00 en los cinco meses
// estimados mientras la tabla fiscal sigue devengando mes a mes. El cero es
// por omisión, no por cálculo, y mejora artificialmente el resultado.
// ─────────────────────────────────────────────────────────────────────────────
export function detectZeroedProjectionLines(
  concepts: Array<{ concept: string; actualAvgUsd: number; projectedTotalUsd: number; projectedMonths: number }>,
): Finding[] {
  return concepts
    .filter((c) =>
      c.projectedMonths > 0 &&
      Math.abs(c.projectedTotalUsd) < 0.01 &&
      Math.abs(c.actualAvgUsd) >= THRESHOLDS.materialityUsd)
    .map((c) => ({
      detector: 'zeroed_projection_line',
      severity: 'warning' as Severity,
      entity: c.concept,
      title: `"${c.concept}" está en cero en la proyección pero promedia ${usd(c.actualAvgUsd)}/mes en los meses reales`,
      detail: `El resultado proyectado está mejorado en aproximadamente ${usd(c.actualAvgUsd * c.projectedMonths)} por una línea que no se cargó.`,
      expectedValue: c.actualAvgUsd * c.projectedMonths,
      actualValue: c.projectedTotalUsd,
      delta: c.actualAvgUsd * c.projectedMonths,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Reversión de provisión
//
// Caso: la provisión de bonos de dic-2025 (18.000) se revirtió como ingreso en
// ene-2026 e infla el 24% del resultado neto del año, sin que el pago real
// aparezca en ningún mes.
// ─────────────────────────────────────────────────────────────────────────────
export function detectProvisionReversals(
  series: Array<{ periodKey: string; provisionsUsd: number }>,
): Finding[] {
  const out: Finding[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    // Cargo positivo seguido de reversión de magnitud comparable.
    if (prev.provisionsUsd < THRESHOLDS.materialityUsd) continue;
    if (curr.provisionsUsd > -THRESHOLDS.materialityUsd) continue;
    if (Math.abs(curr.provisionsUsd) < prev.provisionsUsd * 0.8) continue;

    out.push({
      detector: 'provision_reversal',
      severity: 'warning',
      periodKey: curr.periodKey,
      title: `Reversión de provisión en ${curr.periodKey} por ${usd(Math.abs(curr.provisionsUsd))}`,
      detail: `Se cargó en ${prev.periodKey} y se revirtió en ${curr.periodKey}. El resultado de ${curr.periodKey} está inflado por una partida del ejercicio anterior. Verificar dónde impactó el pago real y registrarla en one_off_items.`,
      expectedValue: prev.provisionsUsd,
      actualValue: curr.provisionsUsd,
      delta: Math.abs(curr.provisionsUsd),
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Desvío de cobranza vs términos contractuales
//
// Caso: Warner tiene 90 días contractuales y cobra a ~115. Peor: las facturas
// que vencen en diciembre entran en enero, cruzando el ejercicio.
// ─────────────────────────────────────────────────────────────────────────────
export function detectDsoDrift(
  clients: Array<{ clientName: string; contractualDays: number; observedDays: number; sampleSize: number }>,
): Finding[] {
  return clients
    .filter((c) => c.sampleSize >= 2 && c.observedDays - c.contractualDays >= THRESHOLDS.dsoDriftWarnDays)
    .map((c) => {
      const drift = c.observedDays - c.contractualDays;
      return {
        detector: 'dso_drift',
        severity: (drift >= THRESHOLDS.dsoDriftCriticalDays ? 'critical' : 'warning') as Severity,
        entity: c.clientName,
        title: `${c.clientName} cobra a ${Math.round(c.observedDays)} días contra ${c.contractualDays} contractuales`,
        detail: `Desvío de ${Math.round(drift)} días sobre ${c.sampleSize} facturas. Usar el plazo observado, no el contractual, para proyectar caja.`,
        expectedValue: c.contractualDays,
        actualValue: c.observedDays,
        delta: drift,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Pipeline vacío
//
// Caso: las 111 filas de la solapa de ventas decían "Confirmado = Sí" y ninguna
// decía "No". La proyección asumía cero negocio nuevo por cinco meses y nadie
// lo había notado, porque el sistema no distingue "no hay" de "no se cargó".
// ─────────────────────────────────────────────────────────────────────────────
export function detectEmptyPipeline(
  confirmedCount: number,
  pipelineCount: number,
): Finding[] {
  if (pipelineCount > 0 || confirmedCount === 0) return [];
  return [{
    detector: 'empty_pipeline',
    severity: 'warning',
    title: 'No hay ninguna oportunidad sin confirmar cargada',
    detail: `Hay ${confirmedCount} ingresos confirmados y cero en pipeline. La proyección asume que no se cierra nada nuevo. Si el pipeline existe pero vive fuera del sistema, la proyección está estructuralmente subestimada.`,
    actualValue: 0,
    expectedValue: null,
  }];
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Concentración de costos
//
// Caso: Board + Oxean suman 152.622 en 2026, el 27,7% de la facturación, contra
// un EBIT negativo. Es la línea más grande de la empresa y no aparecía en ningún
// tablero.
// ─────────────────────────────────────────────────────────────────────────────
export function detectCostConcentration(
  concepts: Array<{ concept: string; amountUsd: number }>,
  revenueUsd: number,
): Finding[] {
  if (revenueUsd <= 0) return [];
  return concepts
    .filter((c) => c.amountUsd / revenueUsd >= THRESHOLDS.costConcentrationWarn)
    .sort((a, b) => b.amountUsd - a.amountUsd)
    .map((c) => ({
      detector: 'cost_concentration',
      severity: 'info' as Severity,
      entity: c.concept,
      title: `"${c.concept}" representa ${pct(c.amountUsd / revenueUsd)} de la facturación`,
      detail: `${usd(c.amountUsd)} sobre ${usd(revenueUsd)} facturados.`,
      actualValue: c.amountUsd,
      expectedValue: revenueUsd,
      delta: c.amountUsd / revenueUsd,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestación
// ─────────────────────────────────────────────────────────────────────────────

export interface RunDetectorsOptions {
  year?: number;
  currentPeriod?: string;
  persist?: boolean;
}

export async function runAllDetectors(opts: RunDetectorsOptions = {}): Promise<Finding[]> {
  const currentPeriod = opts.currentPeriod ?? getCurrentMonthKey();
  const year = opts.year ?? Number(currentPeriod.slice(0, 4));
  const yearPeriods = monthRange(`${year}-01`, `${year}-12`);
  const findings: Finding[] = [];

  // Sin eventos cargados no hay nada que decir sobre los ingresos. Es el estado
  // normal entre el deploy y la primera corrida del backfill: emitir alertas
  // acá sería ruido, no señal, y "no hay datos" no es un hallazgo de negocio.
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM revenue_events WHERE status <> 'cancelled'`,
  );
  const hasRevenueData = (Number(countRows[0]?.total) || 0) > 0;

  const { getRevenueBasisTotals } = await import('./revenue-basis');

  // 1. Divergencia entre bases del ejercicio.
  const totals = await getRevenueBasisTotals(yearPeriods);
  if (hasRevenueData) {
    findings.push(...detectBasisDivergence(year, totals.facturacion, totals.devengado));
  }

  // 2. Concentración sobre lo que queda del ejercicio.
  const forwardPeriods = monthRange(currentPeriod, `${year}-12`);
  if (hasRevenueData && forwardPeriods.length > 0) {
    const { rows } = await pool.query(
      `SELECT client_name, SUM(amount_usd)::float AS amount
         FROM revenue_events
        WHERE confirmed = true AND status <> 'cancelled'
          AND invoice_period = ANY($1::text[])
        GROUP BY client_name`,
      [forwardPeriods],
    );
    findings.push(...detectRevenueConcentration(
      rows.map((r: any) => ({ clientName: r.client_name, amountUsd: Number(r.amount) || 0 })),
      `${currentPeriod} a ${year}-12`,
    ));
  }

  // 3. Acantilado.
  if (hasRevenueData) {
    const { rows: cliffRows } = await pool.query(
      `SELECT MAX(invoice_period) AS last_period
         FROM revenue_events
        WHERE confirmed = true AND status <> 'cancelled'`,
    );
    findings.push(...detectForwardCoverageCliff(cliffRows[0]?.last_period ?? null, currentPeriod));
  }

  // 4. Líneas en cero en la proyección de costos.
  const hasEstimatedCosts = await tableExists('fact_estimated_cost_month');
  if (hasEstimatedCosts) {
  const { rows: conceptRows } = await pool.query(
    `WITH reales AS (
        SELECT detalle AS concept, AVG(monto_total_usd)::float AS avg_usd
          FROM fact_estimated_cost_month
         WHERE month_key < $1 AND month_key >= $2 AND detalle IS NOT NULL
         GROUP BY detalle
     ), proyectados AS (
        SELECT detalle AS concept,
               COALESCE(SUM(monto_total_usd), 0)::float AS total_usd,
               COUNT(DISTINCT month_key)::int AS months
          FROM fact_estimated_cost_month
         WHERE month_key >= $1 AND detalle IS NOT NULL
         GROUP BY detalle
     )
     SELECT r.concept, r.avg_usd, COALESCE(p.total_usd, 0) AS total_usd, COALESCE(p.months, 0) AS months
       FROM reales r LEFT JOIN proyectados p ON p.concept = r.concept`,
    [currentPeriod, addMonths(currentPeriod, -6)],
  );
  findings.push(...detectZeroedProjectionLines(conceptRows.map((r: any) => ({
    concept: r.concept,
    actualAvgUsd: Number(r.avg_usd) || 0,
    projectedTotalUsd: Number(r.total_usd) || 0,
    projectedMonths: Number(r.months) || 0,
  }))));
  }

  // 5. Reversiones de provisión del ejercicio.
  const { rows: provRows } = await pool.query(
    `SELECT period_key, provisions_usd::float AS provisions
       FROM fact_cost_month
      WHERE period_key = ANY($1::text[])
      ORDER BY period_key`,
    [monthRange(`${year - 1}-01`, `${year}-12`)],
  );
  findings.push(...detectProvisionReversals(provRows.map((r: any) => ({
    periodKey: r.period_key,
    provisionsUsd: Number(r.provisions) || 0,
  }))));

  // 6. Desvío de cobranza. Sólo facturas efectivamente cobradas.
  const { rows: dsoRows } = await pool.query(
    `SELECT e.client_name,
            COALESCE(t.contractual_days, e.payment_terms_days) AS contractual_days,
            AVG(
              (EXTRACT(YEAR FROM to_date(e.collection_period_actual, 'YYYY-MM')) * 12
               + EXTRACT(MONTH FROM to_date(e.collection_period_actual, 'YYYY-MM')))
              - (EXTRACT(YEAR FROM to_date(e.invoice_period, 'YYYY-MM')) * 12
               + EXTRACT(MONTH FROM to_date(e.invoice_period, 'YYYY-MM')))
            )::float * 30 AS observed_days,
            COUNT(*)::int AS sample_size
       FROM revenue_events e
       LEFT JOIN client_payment_terms t ON t.client_name = e.client_name
      WHERE e.collection_period_actual IS NOT NULL
        AND COALESCE(t.contractual_days, e.payment_terms_days) IS NOT NULL
      GROUP BY e.client_name, COALESCE(t.contractual_days, e.payment_terms_days)`,
  );
  findings.push(...detectDsoDrift(dsoRows.map((r: any) => ({
    clientName: r.client_name,
    contractualDays: Number(r.contractual_days) || 0,
    observedDays: Number(r.observed_days) || 0,
    sampleSize: Number(r.sample_size) || 0,
  }))));

  // 7. Pipeline.
  const { rows: pipeRows } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE confirmed = true)::int AS confirmed_count,
            COUNT(*) FILTER (WHERE confirmed = false)::int AS pipeline_count
       FROM revenue_events
      WHERE status <> 'cancelled'`,
  );
  findings.push(...detectEmptyPipeline(
    Number(pipeRows[0]?.confirmed_count) || 0,
    Number(pipeRows[0]?.pipeline_count) || 0,
  ));

  // 8. Concentración de costos sobre la facturación del ejercicio.
  if (hasEstimatedCosts && hasRevenueData) {
    const { rows: costRows } = await pool.query(
      `SELECT detalle AS concept, SUM(monto_total_usd)::float AS amount
         FROM fact_estimated_cost_month
        WHERE month_key = ANY($1::text[]) AND detalle IS NOT NULL
        GROUP BY detalle`,
      [yearPeriods],
    );
    findings.push(...detectCostConcentration(
      costRows.map((r: any) => ({ concept: r.concept, amountUsd: Number(r.amount) || 0 })),
      totals.facturacion,
    ));
  }

  if (opts.persist !== false) {
    await persistFindings(findings);
  }
  return findings;
}

/**
 * Upsert por fingerprint (detector + período + entidad). Un hallazgo que persiste
 * entre corridas actualiza last_seen_at en vez de duplicarse, y los que dejaron
 * de aparecer se marcan resueltos.
 */
export async function persistFindings(findings: Finding[]): Promise<void> {
  const seen: string[] = [];

  for (const f of findings) {
    await pool.query(
      `INSERT INTO data_quality_findings
         (detector, severity, period_key, entity, title, detail,
          expected_value, actual_value, delta, source_ref, status, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open', now())
       ON CONFLICT (detector, COALESCE(period_key, ''), COALESCE(entity, ''))
       DO UPDATE SET
         severity = EXCLUDED.severity,
         title = EXCLUDED.title,
         detail = EXCLUDED.detail,
         expected_value = EXCLUDED.expected_value,
         actual_value = EXCLUDED.actual_value,
         delta = EXCLUDED.delta,
         last_seen_at = now(),
         status = CASE
           WHEN data_quality_findings.status = 'resolved' THEN 'open'
           ELSE data_quality_findings.status
         END`,
      [f.detector, f.severity, f.periodKey ?? null, f.entity ?? null, f.title,
       f.detail ?? null, f.expectedValue ?? null, f.actualValue ?? null,
       f.delta ?? null, f.sourceRef ?? null],
    );
    seen.push(`${f.detector}|${f.periodKey ?? ''}|${f.entity ?? ''}`);
  }

  await pool.query(
    `UPDATE data_quality_findings
        SET status = 'resolved', resolved_at = now()
      WHERE status = 'open'
        AND (detector || '|' || COALESCE(period_key, '') || '|' || COALESCE(entity, '')) <> ALL($1::text[])`,
    [seen.length > 0 ? seen : ['']],
  );
}
