// Keep formula logic side-effect free for unit tests.
const pool = {
  query: async (queryText: string, values?: unknown[]) => {
    const { pool: databasePool } = await import("../db");
    return databasePool.query(queryText, values);
  },
};

import { monthRange } from "./dates";
import type { RevenueBasis } from "./revenue-basis";

/**
 * INTELIGENCIA FINANCIERA
 *
 * Tres cosas que el dashboard no tenía y que fueron el centro del análisis del
 * 2026-08-20:
 *
 *  1. BENEFICIO NETO. Todo el tablero vivía en EBIT, que por definición del
 *     propio MAESTRO excluye impuestos USA, IVA, IIBB e intereses de Oxean.
 *     Es decir: la métrica que se presentaba borraba el costo del endeudamiento
 *     que se estaba por tomar. El resultado neto del ejercicio no estaba en
 *     ninguna pantalla.
 *
 *  2. EL PUENTE. "El problema es venta o es gasto" se contestaba a ojo, y se
 *     contestaba mal. Descomponer la variación del EBIT entre ingreso y costo
 *     lo vuelve una cuenta, no una opinión.
 *
 *  3. YTD LIMPIO. Una reversión de provisión de 18.000 explicaba el 24% del
 *     resultado del año. Sin registro de partidas no recurrentes, un año malo
 *     y uno bueno se ven iguales.
 */

export interface ResultLine {
  devengadoUsd: number;
  facturacionUsd: number;
  cobranzaUsd: number;
  directosUsd: number;
  overheadUsd: number;
  provisionesUsd: number;
  /** Devengado − Directos − Overhead. Excluye impuestos e intereses. */
  ebitUsd: number;
  /** EBIT − Provisiones. Es el resultado del ejercicio. */
  beneficioNetoUsd: number;
  margenEbitPct: number;
  margenNetoPct: number;
}

export function buildResultLine(input: {
  devengado: number;
  facturacion: number;
  cobranza: number;
  directos: number;
  overhead: number;
  provisiones: number;
}): ResultLine {
  const ebit = input.devengado - input.directos - input.overhead;
  const neto = ebit - input.provisiones;
  return {
    devengadoUsd: input.devengado,
    facturacionUsd: input.facturacion,
    cobranzaUsd: input.cobranza,
    directosUsd: input.directos,
    overheadUsd: input.overhead,
    provisionesUsd: input.provisiones,
    ebitUsd: ebit,
    beneficioNetoUsd: neto,
    margenEbitPct: input.devengado > 0 ? (ebit / input.devengado) * 100 : 0,
    margenNetoPct: input.devengado > 0 ? (neto / input.devengado) * 100 : 0,
  };
}

// ─── El puente ───────────────────────────────────────────────────────────────

export interface BridgeEffect {
  label: string;
  /** Contribución a la variación del EBIT. Positivo mejora, negativo empeora. */
  amountUsd: number;
  /** Peso de este efecto sobre el total de movimiento absoluto. */
  sharePct: number;
}

export interface EbitBridge {
  fromLabel: string;
  toLabel: string;
  fromEbitUsd: number;
  toEbitUsd: number;
  deltaUsd: number;
  effects: BridgeEffect[];
  /** El efecto de mayor peso, que es la respuesta a "¿es venta o es gasto?". */
  dominantDriver: string;
  dominantSharePct: number;
}

/**
 * Descompone la variación del EBIT entre dos períodos.
 *
 * Con las cifras reales de Epical (2025 → 2026): ingreso −20.829, costo +130.085.
 * El costo explica el 86% del deterioro. Antes de tener esto, la conclusión que
 * se llevó el CEO fue la contraria.
 */
export function buildEbitBridge(
  from: { label: string; devengado: number; directos: number; overhead: number },
  to: { label: string; devengado: number; directos: number; overhead: number },
): EbitBridge {
  const fromEbit = from.devengado - from.directos - from.overhead;
  const toEbit = to.devengado - to.directos - to.overhead;

  const effects: BridgeEffect[] = [
    { label: 'Ingreso', amountUsd: to.devengado - from.devengado, sharePct: 0 },
    { label: 'Costo directo', amountUsd: -(to.directos - from.directos), sharePct: 0 },
    { label: 'Overhead', amountUsd: -(to.overhead - from.overhead), sharePct: 0 },
  ];

  const totalMovement = effects.reduce((a, e) => a + Math.abs(e.amountUsd), 0);
  for (const e of effects) {
    e.sharePct = totalMovement > 0 ? (Math.abs(e.amountUsd) / totalMovement) * 100 : 0;
  }

  const dominant = [...effects].sort((a, b) => Math.abs(b.amountUsd) - Math.abs(a.amountUsd))[0];

  return {
    fromLabel: from.label,
    toLabel: to.label,
    fromEbitUsd: fromEbit,
    toEbitUsd: toEbit,
    deltaUsd: toEbit - fromEbit,
    effects,
    dominantDriver: dominant.label,
    dominantSharePct: dominant.sharePct,
  };
}

// ─── Partidas no recurrentes ─────────────────────────────────────────────────

export interface OneOff {
  periodKey: string;
  concept: string;
  amountUsd: number;
  affects: 'revenue' | 'cost' | 'both';
}

export interface CleanedResult {
  reportedUsd: number;
  oneOffsUsd: number;
  cleanUsd: number;
  items: OneOff[];
}

/**
 * Resta del resultado reportado las partidas marcadas como no recurrentes.
 *
 * Convención de signo: `amountUsd` es el efecto de la partida SOBRE el resultado.
 * Una reversión de provisión que sumó 18.000 al resultado se carga como +18.000
 * y el resultado limpio queda 18.000 más abajo.
 */
export function applyOneOffs(reportedUsd: number, items: OneOff[]): CleanedResult {
  const oneOffs = items.reduce((a, i) => a + i.amountUsd, 0);
  return {
    reportedUsd,
    oneOffsUsd: oneOffs,
    cleanUsd: reportedUsd - oneOffs,
    items,
  };
}

// ─── Cobertura hacia adelante ────────────────────────────────────────────────

export interface CoverageMonth {
  periodKey: string;
  revenueUsd: number;
  costUsd: number;
  gapUsd: number;
  /** Cobertura del costo con ingreso cargado. 1 = empata. */
  coverageRatio: number;
}

/**
 * Ingreso cargado contra costo proyectado, mes a mes.
 *
 * Es la respuesta directa a la pregunta que el board hizo y que quedó sin
 * contestar: "cómo quedan gastos vs ventas los próximos meses". Con las cifras
 * reales de sep-dic 2026 daba −9.004 por mes, no break-even.
 */
export function buildCoverage(
  months: Array<{ periodKey: string; revenueUsd: number; costUsd: number }>,
): { months: CoverageMonth[]; totalGapUsd: number; avgMonthlyGapUsd: number } {
  const rows: CoverageMonth[] = months.map((m) => ({
    periodKey: m.periodKey,
    revenueUsd: m.revenueUsd,
    costUsd: m.costUsd,
    gapUsd: m.revenueUsd - m.costUsd,
    coverageRatio: m.costUsd > 0 ? m.revenueUsd / m.costUsd : 0,
  }));
  const totalGap = rows.reduce((a, r) => a + r.gapUsd, 0);
  return {
    months: rows,
    totalGapUsd: totalGap,
    avgMonthlyGapUsd: rows.length > 0 ? totalGap / rows.length : 0,
  };
}

// ─── Composición para el dashboard ───────────────────────────────────────────

export interface YearSnapshot {
  year: number;
  basis: Record<RevenueBasis, number>;
  result: ResultLine;
  cleanNet: CleanedResult;
  /** Facturado dentro del año cuya entrega cae fuera. Resultado adelantado. */
  deferredOutOfRangeUsd: number;
}

async function getCosts(periodKeys: string[]) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(direct_usd), 0)::float AS directos,
            COALESCE(SUM(indirect_usd), 0)::float AS overhead,
            COALESCE(SUM(provisions_usd), 0)::float AS provisiones
       FROM fact_cost_month
      WHERE period_key = ANY($1::text[])`,
    [periodKeys],
  );
  return {
    directos: Number(rows[0]?.directos) || 0,
    overhead: Number(rows[0]?.overhead) || 0,
    provisiones: Number(rows[0]?.provisiones) || 0,
  };
}

async function getOneOffs(periodKeys: string[]): Promise<OneOff[]> {
  const { rows } = await pool.query(
    `SELECT period_key, concept, amount_usd::float AS amount, affects
       FROM one_off_items
      WHERE period_key = ANY($1::text[])`,
    [periodKeys],
  );
  return rows.map((r: any) => ({
    periodKey: r.period_key,
    concept: r.concept,
    amountUsd: Number(r.amount) || 0,
    affects: r.affects,
  }));
}

export async function getYearSnapshot(year: number): Promise<YearSnapshot> {
  const periods = monthRange(`${year}-01`, `${year}-12`);
  const { getRevenueBasisTotals } = await import('./revenue-basis');

  const [totals, costs, oneOffs] = await Promise.all([
    getRevenueBasisTotals(periods),
    getCosts(periods),
    getOneOffs(periods),
  ]);

  const result = buildResultLine({
    devengado: totals.devengado,
    facturacion: totals.facturacion,
    cobranza: totals.cobranza,
    ...costs,
  });

  return {
    year,
    basis: {
      facturacion: totals.facturacion,
      devengado: totals.devengado,
      cobranza: totals.cobranza,
    },
    result,
    cleanNet: applyOneOffs(result.beneficioNetoUsd, oneOffs),
    deferredOutOfRangeUsd: totals.deferredOutOfRange,
  };
}

export interface FinancialIntelligencePayload {
  current: YearSnapshot;
  previous: YearSnapshot;
  bridge: EbitBridge;
  findings: Awaited<ReturnType<typeof import('./data-quality').runAllDetectors>>;
}

/**
 * Payload único del dashboard. Devuelve siempre las tres bases, el neto, el
 * puente contra el año anterior y los hallazgos abiertos. Nunca un solo número.
 */
export async function getFinancialIntelligence(year: number): Promise<FinancialIntelligencePayload> {
  const [current, previous] = await Promise.all([
    getYearSnapshot(year),
    getYearSnapshot(year - 1),
  ]);

  const { runAllDetectors } = await import('./data-quality');
  const findings = await runAllDetectors({ year, persist: true });

  return {
    current,
    previous,
    bridge: buildEbitBridge(
      {
        label: String(previous.year),
        devengado: previous.result.devengadoUsd,
        directos: previous.result.directosUsd,
        overhead: previous.result.overheadUsd,
      },
      {
        label: String(current.year),
        devengado: current.result.devengadoUsd,
        directos: current.result.directosUsd,
        overhead: current.result.overheadUsd,
      },
    ),
    findings,
  };
}
