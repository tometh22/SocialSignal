// Keep pure logic side-effect free for unit tests (mismo patrón que kpi-formulas).
const pool = {
  query: async (queryText: string, values?: unknown[]) => {
    const { pool: databasePool } = await import("../db");
    return databasePool.query(queryText, values);
  },
};

/**
 * INGRESO RECURRENTE Y RENDIMIENTO POR CLIENTE
 *
 * Fuente: financial_sot, que sale de la solapa "Rendimiento Cliente" del Excel
 * MAESTRO. Es la única que tiene facturación Y costo por proyecto.
 *
 * Definiciones verificadas contra el reporte de Looker sobre la misma planilla
 * (jul-2026): MRR 45.081,72 exacto, 47,55% de fee exacto, Warner ARR 420.420
 * exacto.
 *
 *   MRR = suma de facturación de proyectos con Tipo = "Fee" del mes
 *   ARR = MRR x 12
 *
 * Ojo: financial_sot sólo contiene meses con Pasado/Futuro = "Real", así que
 * esto mide recurrencia EJECUTADA. No hay proyección de ARR hacia adelante.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ClienteRecurrente {
  clientName: string;
  mrr: number;
  arr: number;
  /** Participación en el MRR del mes. Warner llegó a 77,7%. */
  sharePct: number;
}

export interface RecurringRevenue {
  periodKey: string;
  mrr: number;
  arr: number;
  revenueTotal: number;
  /** Qué parte de la facturación del mes es recurrente. */
  feeSharePct: number;
  clientesFee: number;
  porCliente: ClienteRecurrente[];
  /** Índice Herfindahl del MRR: 1 = un solo cliente. */
  hhi: number;
  serie: Array<{ periodKey: string; mrr: number; arr: number }>;
}

export async function getRecurringRevenue(periodKey: string): Promise<RecurringRevenue> {
  const { rows: porCliente } = await pool.query(
    `SELECT client_name, SUM(revenue_usd)::float AS mrr
       FROM financial_sot
      WHERE month_key = $1 AND project_type ILIKE 'fee'
      GROUP BY client_name
      ORDER BY 2 DESC`,
    [periodKey],
  );

  const { rows: totales } = await pool.query(
    `SELECT COALESCE(SUM(revenue_usd) FILTER (WHERE project_type ILIKE 'fee'), 0)::float AS mrr,
            COALESCE(SUM(revenue_usd), 0)::float AS revenue_total
       FROM financial_sot
      WHERE month_key = $1`,
    [periodKey],
  );

  // Serie histórica: MRR mes a mes para ver si la base recurrente crece o se
  // erosiona. Es la pregunta que un solo mes no puede responder.
  const { rows: serieRows } = await pool.query(
    `SELECT month_key, SUM(revenue_usd)::float AS mrr
       FROM financial_sot
      WHERE project_type ILIKE 'fee'
      GROUP BY month_key
      ORDER BY month_key`,
  );

  const mrr = round2(Number(totales[0]?.mrr) || 0);
  const revenueTotal = round2(Number(totales[0]?.revenue_total) || 0);

  const clientes: ClienteRecurrente[] = porCliente.map((r: any) => {
    const clienteMrr = round2(Number(r.mrr) || 0);
    return {
      clientName: r.client_name,
      mrr: clienteMrr,
      arr: round2(clienteMrr * 12),
      sharePct: mrr > 0 ? round2((clienteMrr / mrr) * 100) : 0,
    };
  });

  return {
    periodKey,
    mrr,
    arr: round2(mrr * 12),
    revenueTotal,
    feeSharePct: revenueTotal > 0 ? round2((mrr / revenueTotal) * 100) : 0,
    clientesFee: clientes.length,
    porCliente: clientes,
    hhi: mrr > 0 ? round2(clientes.reduce((a, c) => a + (c.mrr / mrr) ** 2, 0)) : 0,
    serie: serieRows.map((r: any) => ({
      periodKey: r.month_key,
      mrr: round2(Number(r.mrr) || 0),
      arr: round2((Number(r.mrr) || 0) * 12),
    })),
  };
}

// ─── Rendimiento por cliente y proyecto ─────────────────────────────────────

export interface RendimientoFila {
  clientName: string;
  projectName: string;
  projectType: string | null;
  facturacion: number;
  costos: number;
  utilidad: number;
  margenPct: number;
  /** Facturación / Costos directos. Sin costo cargado queda en null. */
  markup: number | null;
}

/**
 * Rendimiento por proyecto de un período.
 *
 * Verificado contra el reporte de Looker (jul-2026): Warner Fee Marketing
 * 29.230 de facturación, 6.402,73 de costo, 78,1% de margen, markup 4,57.
 */
export async function getRendimiento(periodKey: string): Promise<RendimientoFila[]> {
  const { rows } = await pool.query(
    `SELECT client_name, project_name, project_type,
            COALESCE(SUM(revenue_usd), 0)::float AS facturacion,
            COALESCE(SUM(cost_usd), 0)::float AS costos
       FROM financial_sot
      WHERE month_key = $1
      GROUP BY client_name, project_name, project_type
      ORDER BY 4 DESC`,
    [periodKey],
  );

  return rows.map((r: any) => {
    const facturacion = round2(Number(r.facturacion) || 0);
    const costos = round2(Number(r.costos) || 0);
    const utilidad = round2(facturacion - costos);
    return {
      clientName: r.client_name,
      projectName: r.project_name,
      projectType: r.project_type,
      facturacion,
      costos,
      utilidad,
      margenPct: facturacion > 0 ? round2((utilidad / facturacion) * 100) : 0,
      // Un markup sin costo cargado sería infinito, no excelente.
      markup: costos > 0 ? round2(facturacion / costos) : null,
    };
  });
}

/** Períodos con datos en financial_sot, del más reciente al más viejo. */
export async function getPeriodosDisponibles(): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT month_key FROM financial_sot ORDER BY month_key DESC`,
  );
  return rows.map((r: any) => r.month_key);
}

export const __testing = { round2 };
