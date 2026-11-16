import type { ScenarioCost, ScenarioMonth } from "../../shared/financial-scenario";

// Keep pure logic side-effect free for unit tests.
const pool = {
  query: async (queryText: string, values?: unknown[]) => {
    const { pool: databasePool } = await import("../db");
    return databasePool.query(queryText, values);
  },
};

/**
 * DESGLOSE DE COSTOS
 *
 * Cubre tres páginas del reporte de Looker sobre el Excel MAESTRO:
 *   · Costos YTD y Estimados      → fact_estimated_cost_month (solapa "Costos estimados")
 *   · Costos Directos e Indirectos → fact_cost_month
 *   · Costos Equipo                → fact_labor_month
 *
 * Verificado contra Looker (2026): Tomi Criado 54.267,46 · Honorarios Oxean
 * 54.045,32 · Vicky Puricelli 44.310,06 · Tarjeta USA 43.900 · Youscan 35.446,70.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ConceptoCosto {
  concepto: string;
  montoUsd: number;
  sharePct: number;
}

export interface CostoMensual {
  periodKey: string;
  directo: number;
  indirecto: number;
  /** Meses informados con la solapa "Costos estimados" del Máster (todavía sin costos reales). */
  estimado: number;
  provisiones: number;
  total: number;
  /** Overhead sobre el costo operativo; null en meses que sólo tienen estimados. */
  overheadPct: number | null;
}

export interface EquipoMes {
  periodKey: string;
  horasObjetivo: number;
  horasAsana: number;
  horasFacturacion: number;
  /** Valuación operativa de horas × tarifa histórica (no costo contable). */
  costoUsd: number;
  /** Costo por hora efectivamente trabajada. */
  valorHora: number | null;
}

export interface CostBreakdown {
  year: number;
  /** Ranking de conceptos del año, del más caro al más barato. */
  conceptos: ConceptoCosto[];
  totalConceptos: number;
  /**
   * Compensación de board y holding. Se expone aparte porque es la línea más
   * grande de la empresa y quedaba diluida en el ranking: 152.622 en 2026, el
   * 27,7% de la facturación.
   */
  boardYHolding: { conceptos: string[]; montoUsd: number; sharePct: number };
  mensual: CostoMensual[];
  equipo: EquipoMes[];
  /** Meses cuyo detalle no explica todo el costo del Resumen del Máster. */
  avisos: string[];
}


export const SIN_DETALLE = 'Sin detalle en el Máster';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/**
 * Months reported by the Master use the same cost rows as its Resumen Ejecutivo
 * (buildMasterScenario): operating and EBIT costs add up to Ventas − EBIT. When a
 * month's detail does not explain the whole Resumen cost, the gap is shown as its
 * own concept instead of disappearing, so totals always equal the Resumen.
 */
export function masterCostSummary(months: ScenarioMonth[], costs: ScenarioCost[]) {
  const concepts = new Map<string, number>();
  const mensual: CostoMensual[] = [];
  const avisos: string[] = [];
  for (const month of months) {
    const monthCosts = costs.filter((cost) => cost.periodKey === month.periodKey);
    let directo = 0, indirecto = 0, estimado = 0, provisiones = 0;
    for (const cost of monthCosts) {
      const value = cost.amountUsd ?? 0;
      if (cost.impact === 'net') {
        if (normalize(cost.concept) === 'provision pasivo') provisiones += value;
        continue;
      }
      concepts.set(cost.concept, (concepts.get(cost.concept) ?? 0) + value);
      if (cost.source === 'estimate') estimado += value;
      else if (normalize(cost.costType ?? '') === 'directo') directo += value;
      else indirecto += value;
    }
    const gap = round2(month.costUsd - (directo + indirecto + estimado));
    if (Math.abs(gap) >= 0.01) {
      concepts.set(SIN_DETALLE, (concepts.get(SIN_DETALLE) ?? 0) + gap);
      if (estimado && !directo && !indirecto) estimado += gap; else indirecto += gap;
      avisos.push(`${month.periodKey}: el detalle del Máster no explica USD ${gap.toFixed(2)} del costo del Resumen.`);
    }
    const operativo = directo + indirecto;
    mensual.push({
      periodKey: month.periodKey, directo: round2(directo), indirecto: round2(indirecto), estimado: round2(estimado),
      provisiones: round2(provisiones), total: round2(operativo + estimado + provisiones),
      overheadPct: operativo > 0 ? round2((indirecto / operativo) * 100) : null,
    });
  }
  return { concepts, mensual, avisos };
}

/** Conceptos que son compensación de socios u honorarios de la holding. */
const BOARD_Y_HOLDING = ['Tomi Criado', 'Vicky Puricelli', 'Honorarios Oxean'];

export async function getCostBreakdown(year: number): Promise<CostBreakdown> {
  // One source per month (finance-period-source): Master months come from the
  // Master rows behind its Resumen; only months that belong to Mind use Mind facts.
  const { getMasterSourcedPeriods, EFFECTIVE_ESTIMATED_COSTS_SQL } = await import("./finance-period-source");
  const masterPeriods = (await getMasterSourcedPeriods()).filter((period) => period.startsWith(`${year}-`));
  let master: ReturnType<typeof masterCostSummary> | null = null;
  if (masterPeriods.length) {
    const { getMasterScenarioSnapshot, buildMasterScenario } = await import("./financial-master-scenario");
    const scenario = buildMasterScenario(await getMasterScenarioSnapshot(), masterPeriods);
    master = masterCostSummary(scenario.months, scenario.costs);
  }
  const [conceptosRes, mensualRes, equipoRes] = await Promise.all([
    pool.query(
      `WITH cutover AS (
         SELECT description AS period_key FROM system_config WHERE config_key='app_mode_cutover_date' AND description IS NOT NULL
       ), native_periods AS (
         SELECT DISTINCT period_key FROM pasivo_entries WHERE source <> 'excel'
         UNION
         SELECT DISTINCT invoice_period FROM revenue_events WHERE source_tab='mind_intake'
         UNION
         SELECT DISTINCT period FROM personal_monthly_invoices
       ), modeled_team AS (
         SELECT f.period_key,f.person_id,COALESCE(p.name,'Equipo sin asignar') AS concepto,
                COALESCE(SUM(f.cost_usd),0)::numeric AS modeled_usd
           FROM fact_labor_month f
           LEFT JOIN personnel p ON p.id=f.person_id
          WHERE f.period_key LIKE $1 AND f.period_key <> ALL($2::text[])
            AND EXISTS (SELECT 1 FROM native_periods n WHERE n.period_key=f.period_key)
          GROUP BY f.period_key,f.person_id,p.name
       )
       SELECT concepto, SUM(monto)::float AS monto
         FROM (
           SELECT detalle AS concepto, monto_total_usd::numeric AS monto
             FROM (${EFFECTIVE_ESTIMATED_COSTS_SQL}) fact_estimated_cost_month
            WHERE month_key LIKE $1 AND month_key <> ALL($2::text[]) AND detalle IS NOT NULL AND monto_total_usd IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM native_periods n WHERE n.period_key=month_key)
              AND (NOT EXISTS (SELECT 1 FROM cutover) OR month_key < (SELECT period_key FROM cutover))
           UNION ALL
           SELECT COALESCE(vendor_name, detalle, subtipo_costo, 'Sin clasificar') AS concepto,
                  COALESCE(CASE WHEN currency='ARS' THEN net_amount/NULLIF(cotizacion,0) ELSE net_amount END,monto_total_usd,monto_usd,monto_ars/NULLIF(cotizacion,0),0)::numeric AS monto
             FROM pasivo_entries
            WHERE period_key LIKE $1 AND period_key <> ALL($2::text[]) AND voided_at IS NULL AND source <> 'excel'
              AND COALESCE(cost_treatment,'direct') NOT IN ('balance_only','tax')
              AND lower(translate(COALESCE(subtipo_costo,''),'ÁÉÍÓÚáéíóú','AEIOUaeiou')) NOT IN ('iva','iibb','impuestos usa','intereses oxean')
           UNION ALL
           SELECT modeled.concepto,modeled.modeled_usd::numeric AS monto
             FROM modeled_team modeled
         ) native_and_historical
        GROUP BY concepto
        HAVING SUM(monto) <> 0
        ORDER BY 2 DESC`,
      [`${year}%`, masterPeriods],
    ),
    pool.query(
      `SELECT period_key,
              COALESCE(direct_usd, 0)::float AS directo,
              COALESCE(indirect_usd, 0)::float AS indirecto,
              COALESCE(provisions_usd, 0)::float AS provisiones
         FROM fact_cost_month
        WHERE period_key LIKE $1 AND period_key <> ALL($2::text[])
        ORDER BY period_key`,
      [`${year}%`, masterPeriods],
    ),
    pool.query(
      `SELECT period_key,
              COALESCE(SUM(target_hours), 0)::float AS objetivo,
              COALESCE(SUM(asana_hours), 0)::float AS asana,
              COALESCE(SUM(billing_hours), 0)::float AS facturacion,
              COALESCE(SUM(cost_usd), 0)::float AS costo
         FROM fact_labor_month
        WHERE period_key LIKE $1
        GROUP BY period_key
        ORDER BY period_key`,
      [`${year}%`],
    ),
  ]);

  const conceptTotals = new Map<string, number>(master?.concepts ?? []);
  for (const r of conceptosRes.rows as any[]) conceptTotals.set(r.concepto, (conceptTotals.get(r.concepto) ?? 0) + (Number(r.monto) || 0));
  const conceptos = [...conceptTotals]
    .map(([concepto, monto]) => ({ concepto, montoUsd: round2(monto), sharePct: 0 }))
    .filter((c) => c.montoUsd !== 0)
    .sort((x, y) => y.montoUsd - x.montoUsd);
  const totalConceptos = round2(conceptos.reduce((a, c) => a + c.montoUsd, 0));
  for (const c of conceptos) {
    c.sharePct = totalConceptos > 0 ? round2((c.montoUsd / totalConceptos) * 100) : 0;
  }

  const board = conceptos.filter((c) => BOARD_Y_HOLDING.includes(c.concepto));
  const boardMonto = round2(board.reduce((a, c) => a + c.montoUsd, 0));

  return {
    year,
    conceptos,
    totalConceptos,
    boardYHolding: {
      conceptos: board.map((c) => c.concepto),
      montoUsd: boardMonto,
      sharePct: totalConceptos > 0 ? round2((boardMonto / totalConceptos) * 100) : 0,
    },
    avisos: master?.avisos ?? [],
    mensual: [...(master?.mensual ?? []), ...mensualRes.rows.map((r: any) => {
      const directo = round2(Number(r.directo) || 0);
      const indirecto = round2(Number(r.indirecto) || 0);
      const provisiones = round2(Number(r.provisiones) || 0);
      const operativo = directo + indirecto;
      return {
        periodKey: r.period_key,
        directo,
        indirecto,
        provisiones,
        estimado: 0,
        total: round2(operativo + provisiones),
        overheadPct: operativo > 0 ? round2((indirecto / operativo) * 100) : 0,
      };
    })].sort((x, y) => x.periodKey.localeCompare(y.periodKey)),
    equipo: equipoRes.rows.map((r: any) => {
      const asana = round2(Number(r.asana) || 0);
      const costo = round2(Number(r.costo) || 0);
      return {
        periodKey: r.period_key,
        horasObjetivo: round2(Number(r.objetivo) || 0),
        horasAsana: asana,
        horasFacturacion: round2(Number(r.facturacion) || 0),
        costoUsd: costo,
        // Sin horas cargadas no hay valor hora; dividir por cero daría infinito.
        valorHora: asana > 0 ? round2(costo / asana) : null,
      };
    }),
  };
}

export const __testing = { round2, BOARD_Y_HOLDING };
