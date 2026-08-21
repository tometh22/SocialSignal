// Keep allocation logic side-effect free for unit tests. Database access is
// loaded only when a data fetcher actually runs (mismo patrón que kpi-formulas.ts).
const pool = {
  query: async (queryText: string, values?: unknown[]) => {
    const { pool: databasePool } = await import("../db");
    return databasePool.query(queryText, values);
  },
};

import { addMonths, monthRange, monthSpan } from "./dates";

/**
 * TRES BASES DE INGRESO
 *
 * El Excel MAESTRO guarda un único número de ingreso por proyecto/mes. Ese número
 * es FACTURACIÓN (sale de "Proyectos confirmados y estimados", clave = Mes Facturación)
 * pero se lee como resultado del período. De ahí nace toda la ambigüedad entre
 * "el año cierra en 641k" y "el año cierra en 581k": son la misma venta de Warner
 * (90k, entregada de sep-2026 a ago-2027) leída con dos criterios distintos.
 *
 * Este módulo no elige. Deriva las tres bases del mismo hecho:
 *
 *   FACTURACIÓN  cuándo se emite la factura      -> caja futura, IVA, cuentas por cobrar
 *   DEVENGADO    cuándo se entrega el servicio   -> resultado del período (IFRS 15 / ASC 606)
 *   COBRANZA     cuándo entra la plata           -> caja real
 *
 * Nunca mostrar una sola. La diferencia entre ellas ES la información.
 */

export type RevenueBasis = 'facturacion' | 'devengado' | 'cobranza';

export const REVENUE_BASIS_LABELS: Record<RevenueBasis, string> = {
  facturacion: 'Facturación',
  devengado: 'Devengado',
  cobranza: 'Cobranza',
};

export const REVENUE_BASIS_DESCRIPTIONS: Record<RevenueBasis, string> = {
  facturacion: 'Mes de emisión de la factura. Es el criterio histórico del Excel MAESTRO.',
  devengado: 'Mes en que se entrega el servicio. Es el criterio contable para el resultado del período.',
  cobranza: 'Mes en que entra el dinero. Cobro real si existe, esperado si no.',
};

export interface RevenueEventInput {
  id?: number;
  clientName: string;
  projectName?: string | null;
  projectId?: number | null;
  amountUsd: number;
  invoicePeriod: string;
  deliveryStart?: string | null;
  deliveryEnd?: string | null;
  deliveryCurve?: 'invoice' | 'linear' | 'input_method' | null;
  collectionPeriodExpected?: string | null;
  collectionPeriodActual?: string | null;
  paymentTermsDays?: number | null;
  confirmed?: boolean;
  probability?: number | null;
  status?: string | null;
  isEstimate?: boolean;
}

export interface PeriodAllocation {
  periodKey: string;
  amountUsd: number;
}

/**
 * Reparte un monto entre períodos según pesos relativos, sin perder ni inventar
 * centavos: la última cuota absorbe el remanente del redondeo.
 */
function distribute(amountUsd: number, periods: string[], weights: number[]): PeriodAllocation[] {
  if (periods.length === 0) return [];
  if (periods.length === 1) return [{ periodKey: periods[0], amountUsd: round2(amountUsd) }];

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  // Sin pesos utilizables, repartir en partes iguales.
  const effective = totalWeight > 0 ? weights : periods.map(() => 1);
  const effectiveTotal = totalWeight > 0 ? totalWeight : periods.length;

  const out: PeriodAllocation[] = [];
  let assigned = 0;
  for (let i = 0; i < periods.length - 1; i++) {
    const slice = round2((amountUsd * effective[i]) / effectiveTotal);
    assigned += slice;
    out.push({ periodKey: periods[i], amountUsd: slice });
  }
  out.push({ periodKey: periods[periods.length - 1], amountUsd: round2(amountUsd - assigned) });
  return out;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Período de cobranza de un evento, en orden de preferencia:
 * cobro real > cobro esperado > facturación + términos de pago > facturación.
 *
 * Los términos se convierten a meses redondeando hacia arriba, porque una factura
 * a 90 días emitida el 15 del mes entra el mes 4, no el mes 3. Esto es exactamente
 * lo que pasó con Warner INVOICE 642 (emitida 15/9/2025, cobrada 7/1/2026).
 */
export function resolveCollectionPeriod(event: RevenueEventInput): string {
  if (event.collectionPeriodActual) return event.collectionPeriodActual;
  if (event.collectionPeriodExpected) return event.collectionPeriodExpected;
  if (event.paymentTermsDays && event.paymentTermsDays > 0) {
    return addMonths(event.invoicePeriod, Math.ceil(event.paymentTermsDays / 30));
  }
  return event.invoicePeriod;
}

/**
 * Reparte un evento de ingreso sobre los períodos que le corresponden según la base.
 *
 * `hourWeights` sólo se usa con deliveryCurve = 'input_method': es el mapa
 * periodKey -> horas reales (fact_labor_month.asana_hours) del proyecto. Si no
 * hay horas cargadas se degrada a reparto lineal, que es la aproximación de
 * gestión razonable, nunca a "todo en el mes de factura".
 */
export function allocateEvent(
  event: RevenueEventInput,
  basis: RevenueBasis,
  hourWeights?: Map<string, number>,
): PeriodAllocation[] {
  const amount = Number(event.amountUsd) || 0;

  if (basis === 'facturacion') {
    return [{ periodKey: event.invoicePeriod, amountUsd: round2(amount) }];
  }

  if (basis === 'cobranza') {
    return [{ periodKey: resolveCollectionPeriod(event), amountUsd: round2(amount) }];
  }

  // DEVENGADO
  const curve = event.deliveryCurve ?? 'invoice';

  // Sin ventana de entrega declarada el devengado colapsa al mes de factura.
  // Es el comportamiento histórico y garantiza que migrar no cambie ningún número
  // hasta que Operaciones cargue las fechas de entrega.
  if (curve === 'invoice' || !event.deliveryStart) {
    return [{ periodKey: event.invoicePeriod, amountUsd: round2(amount) }];
  }

  const end = event.deliveryEnd ?? event.deliveryStart;
  const periods = monthRange(event.deliveryStart, end);
  if (periods.length === 0) {
    return [{ periodKey: event.invoicePeriod, amountUsd: round2(amount) }];
  }

  if (curve === 'input_method' && hourWeights && hourWeights.size > 0) {
    const weights = periods.map((p) => hourWeights.get(p) ?? 0);
    if (weights.some((w) => w > 0)) {
      return distribute(amount, periods, weights);
    }
  }

  return distribute(amount, periods, periods.map(() => 1));
}

export interface RevenueBasisOptions {
  /** Incluir oportunidades no confirmadas (Confirmado = No). Default: false. */
  includePipeline?: boolean;
  /** Ponderar los montos no confirmados por su probabilidad de cierre. Default: false. */
  weightByProbability?: boolean;
  /** Filtrar a un cliente concreto. */
  clientName?: string;
}

export interface RevenueByPeriod {
  periodKey: string;
  facturacion: number;
  devengado: number;
  cobranza: number;
}

async function loadEvents(opts: RevenueBasisOptions = {}): Promise<RevenueEventInput[]> {
  const conditions: string[] = [`status <> 'cancelled'`];
  const values: unknown[] = [];

  if (!opts.includePipeline) {
    conditions.push('confirmed = true');
  }
  if (opts.clientName) {
    values.push(opts.clientName);
    conditions.push(`client_name = $${values.length}`);
  }

  const { rows } = await pool.query(
    `SELECT id, client_name, project_name, project_id, amount_usd, invoice_period,
            delivery_start, delivery_end, delivery_curve, collection_period_expected,
            collection_period_actual, payment_terms_days, confirmed, probability,
            status, is_estimate
       FROM revenue_events
      WHERE ${conditions.join(' AND ')}`,
    values,
  );

  return rows.map((r: any) => ({
    id: r.id,
    clientName: r.client_name,
    projectName: r.project_name,
    projectId: r.project_id,
    amountUsd: Number(r.amount_usd) || 0,
    invoicePeriod: r.invoice_period,
    deliveryStart: r.delivery_start,
    deliveryEnd: r.delivery_end,
    deliveryCurve: r.delivery_curve,
    collectionPeriodExpected: r.collection_period_expected,
    collectionPeriodActual: r.collection_period_actual,
    paymentTermsDays: r.payment_terms_days,
    confirmed: r.confirmed,
    probability: r.probability === null ? null : Number(r.probability),
    status: r.status,
    isEstimate: r.is_estimate,
  }));
}

/**
 * Horas reales por proyecto/período, para el devengado por método de input.
 * Sólo se consultan los proyectos que efectivamente lo necesitan.
 */
async function loadHourWeights(projectIds: number[]): Promise<Map<number, Map<string, number>>> {
  const out = new Map<number, Map<string, number>>();
  if (projectIds.length === 0) return out;

  const { rows } = await pool.query(
    `SELECT project_id, period_key, SUM(COALESCE(asana_hours, 0)) AS hours
       FROM fact_labor_month
      WHERE project_id = ANY($1::int[])
      GROUP BY project_id, period_key`,
    [projectIds],
  );

  for (const row of rows) {
    const projectId = Number(row.project_id);
    if (!out.has(projectId)) out.set(projectId, new Map());
    out.get(projectId)!.set(row.period_key, Number(row.hours) || 0);
  }
  return out;
}

/**
 * Devuelve las tres bases por período. Ésta es la función que debe alimentar
 * cualquier encabezado del dashboard: nunca una sola base.
 */
export async function getRevenueByBasis(
  periodKeys: string[],
  opts: RevenueBasisOptions = {},
): Promise<RevenueByPeriod[]> {
  const events = await loadEvents(opts);

  const needsHours = events
    .filter((e) => e.deliveryCurve === 'input_method' && e.projectId)
    .map((e) => e.projectId as number);
  const hourWeights = await loadHourWeights(Array.from(new Set(needsHours)));

  const wanted = new Set(periodKeys);
  const acc = new Map<string, RevenueByPeriod>();
  for (const periodKey of periodKeys) {
    acc.set(periodKey, { periodKey, facturacion: 0, devengado: 0, cobranza: 0 });
  }

  for (const event of events) {
    const factor = opts.weightByProbability && !event.confirmed
      ? (event.probability ?? 0) / 100
      : 1;
    if (factor === 0) continue;

    const weights = event.projectId ? hourWeights.get(event.projectId) : undefined;

    for (const basis of ['facturacion', 'devengado', 'cobranza'] as RevenueBasis[]) {
      for (const slice of allocateEvent(event, basis, weights)) {
        if (!wanted.has(slice.periodKey)) continue;
        acc.get(slice.periodKey)![basis] += slice.amountUsd * factor;
      }
    }
  }

  return periodKeys.map((periodKey) => {
    const row = acc.get(periodKey)!;
    return {
      periodKey,
      facturacion: round2(row.facturacion),
      devengado: round2(row.devengado),
      cobranza: round2(row.cobranza),
    };
  });
}

export interface RevenueBasisTotals {
  periods: string[];
  facturacion: number;
  devengado: number;
  cobranza: number;
  /** Facturado en el rango cuya entrega cae fuera de él. Es el "resultado adelantado". */
  deferredOutOfRange: number;
}

/**
 * Totales de las tres bases más el monto que se factura dentro del rango pero se
 * entrega afuera. Ese último número es el que responde "¿cuánto del resultado de
 * este año es trabajo del año que viene?".
 */
export async function getRevenueBasisTotals(
  periodKeys: string[],
  opts: RevenueBasisOptions = {},
): Promise<RevenueBasisTotals> {
  const rows = await getRevenueByBasis(periodKeys, opts);
  const wanted = new Set(periodKeys);

  const events = await loadEvents(opts);
  const needsHours = events
    .filter((e) => e.deliveryCurve === 'input_method' && e.projectId)
    .map((e) => e.projectId as number);
  const hourWeights = await loadHourWeights(Array.from(new Set(needsHours)));

  let deferred = 0;
  for (const event of events) {
    if (!wanted.has(event.invoicePeriod)) continue;
    const weights = event.projectId ? hourWeights.get(event.projectId) : undefined;
    for (const slice of allocateEvent(event, 'devengado', weights)) {
      if (!wanted.has(slice.periodKey)) deferred += slice.amountUsd;
    }
  }

  return {
    periods: periodKeys,
    facturacion: round2(rows.reduce((a, r) => a + r.facturacion, 0)),
    devengado: round2(rows.reduce((a, r) => a + r.devengado, 0)),
    cobranza: round2(rows.reduce((a, r) => a + r.cobranza, 0)),
    deferredOutOfRange: round2(deferred),
  };
}

export const __testing = { distribute, round2 };
