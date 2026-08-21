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
  provisiones: number;
  total: number;
  /** Overhead sobre el costo operativo. Alto significa estructura pesada. */
  overheadPct: number;
}

export interface EquipoMes {
  periodKey: string;
  horasObjetivo: number;
  horasAsana: number;
  horasFacturacion: number;
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
}

/** Conceptos que son compensación de socios u honorarios de la holding. */
const BOARD_Y_HOLDING = ['Tomi Criado', 'Vicky Puricelli', 'Honorarios Oxean'];

export async function getCostBreakdown(year: number): Promise<CostBreakdown> {
  const [conceptosRes, mensualRes, equipoRes] = await Promise.all([
    pool.query(
      `SELECT detalle AS concepto, SUM(monto_total_usd)::float AS monto
         FROM fact_estimated_cost_month
        WHERE month_key LIKE $1 AND detalle IS NOT NULL AND monto_total_usd IS NOT NULL
        GROUP BY detalle
        HAVING SUM(monto_total_usd) <> 0
        ORDER BY 2 DESC`,
      [`${year}%`],
    ),
    pool.query(
      `SELECT period_key,
              COALESCE(direct_usd, 0)::float AS directo,
              COALESCE(indirect_usd, 0)::float AS indirecto,
              COALESCE(provisions_usd, 0)::float AS provisiones
         FROM fact_cost_month
        WHERE period_key LIKE $1
        ORDER BY period_key`,
      [`${year}%`],
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

  const conceptos = conceptosRes.rows.map((r: any) => ({
    concepto: r.concepto as string,
    montoUsd: round2(Number(r.monto) || 0),
    sharePct: 0,
  }));
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
    mensual: mensualRes.rows.map((r: any) => {
      const directo = round2(Number(r.directo) || 0);
      const indirecto = round2(Number(r.indirecto) || 0);
      const provisiones = round2(Number(r.provisiones) || 0);
      const operativo = directo + indirecto;
      return {
        periodKey: r.period_key,
        directo,
        indirecto,
        provisiones,
        total: round2(operativo + provisiones),
        overheadPct: operativo > 0 ? round2((indirecto / operativo) * 100) : 0,
      };
    }),
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
