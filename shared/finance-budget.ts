import { z } from "zod";

/**
 * Presupuesto nativo de Finanzas: costos estimados por mes y ventas estimadas.
 *
 * Reemplaza dos insumos del Máster a partir de 2027:
 *   · solapa "Costos estimados"                   → fact_estimated_cost_month (source_run_id = 'mind_budget')
 *   · filas no confirmadas de "Proyectos confirmados y estimados" → revenue_events (source_tab = 'mind_budget')
 *
 * Una sola fuente por mes (finance-period-source): los meses que todavía informa
 * el Máster son de solo lectura acá y nunca suman filas cargadas en Mind.
 */
export const BUDGET_SOURCE = "mind_budget";

export const budgetPeriodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Elegí un mes válido (AAAA-MM).");

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform(value => value ? value : null);
const finite = (message: string) => z.number({ invalid_type_error: message, required_error: message }).finite(message);

export const budgetCostModes = ["usd", "ars", "hours"] as const;
export type BudgetCostMode = typeof budgetCostModes[number];
export const BUDGET_COST_MODE_LABELS: Record<BudgetCostMode, string> = {
  usd: "Monto en USD",
  ars: "Monto en ARS con cotización",
  hours: "Horas × valor hora",
};

export const budgetCostInputSchema = z.object({
  period: budgetPeriodSchema,
  detalle: z.string({ required_error: "Indicá el detalle." }).trim().min(1, "Indicá el detalle.").max(255),
  subtipoCosto: z.string({ required_error: "Indicá el subtipo de costo." }).trim().min(1, "Indicá el subtipo de costo.").max(255),
  puesto: optionalText(255),
  billingYear: z.number().int().min(2000).max(2100).nullish(),
  mode: z.enum(budgetCostModes),
  amount: finite("Indicá el monto.").nullish(),
  hours: finite("Indicá la cantidad de horas o unidades.").nullish(),
  hourlyRate: finite("Indicá el valor hora.").nullish(),
  rateCurrency: z.enum(["USD", "ARS"]).nullish(),
  exchangeRate: finite("Indicá la cotización.").nullish(),
}).superRefine((input, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  const needsRate = input.mode === "ars" || (input.mode === "hours" && input.rateCurrency === "ARS");
  if (input.mode !== "hours" && (input.amount == null || input.amount === 0)) issue("amount", "Indicá un monto distinto de cero.");
  if (input.mode === "hours") {
    if (input.hours == null || input.hours <= 0) issue("hours", "Indicá una cantidad de horas o unidades mayor a cero.");
    if (input.hourlyRate == null || input.hourlyRate <= 0) issue("hourlyRate", "Indicá un valor hora mayor a cero.");
  }
  if (needsRate && (input.exchangeRate == null || input.exchangeRate <= 0)) issue("exchangeRate", "Indicá la cotización ARS/USD para pasar el monto a dólares.");
  if (input.exchangeRate != null && input.exchangeRate <= 0) issue("exchangeRate", "La cotización tiene que ser mayor a cero.");
});
export type BudgetCostInput = z.input<typeof budgetCostInputSchema>;

/** Columnas de fact_estimated_cost_month que se derivan del formulario. */
export type BudgetCostAmounts = {
  horasUnidades: number | null;
  valorHora: number | null;
  monedaOriginalArs: number | null;
  monedaOriginalUsd: number | null;
  cotizacion: number | null;
  montoTotalUsd: number;
};

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/** Monto Total USD con la misma lógica que la planilla: ARS ÷ cotización, USD directo, horas × valor hora. */
export function computeBudgetCostAmounts(input: z.output<typeof budgetCostInputSchema>): BudgetCostAmounts {
  const fx = input.exchangeRate ?? null;
  if (input.mode === "usd") {
    const usd = round(input.amount!, 4);
    return { horasUnidades: null, valorHora: null, monedaOriginalArs: null, monedaOriginalUsd: usd, cotizacion: fx, montoTotalUsd: usd };
  }
  if (input.mode === "ars") {
    const ars = round(input.amount!, 2);
    return { horasUnidades: null, valorHora: null, monedaOriginalArs: ars, monedaOriginalUsd: null, cotizacion: fx, montoTotalUsd: round(ars / fx!, 4) };
  }
  const hours = round(input.hours!, 2);
  const rate = round(input.hourlyRate!, 4);
  if (input.rateCurrency === "ARS") {
    const ars = round(hours * rate, 2);
    return { horasUnidades: hours, valorHora: rate, monedaOriginalArs: ars, monedaOriginalUsd: null, cotizacion: fx, montoTotalUsd: round(ars / fx!, 4) };
  }
  const usd = round(hours * rate, 4);
  return { horasUnidades: hours, valorHora: rate, monedaOriginalArs: null, monedaOriginalUsd: usd, cotizacion: fx, montoTotalUsd: usd };
}

/** El puesto sólo aplica a costos de Equipo o Board, igual que en la planilla. */
export const budgetCostUsesPuesto = (subtipo: string | null | undefined) => /equipo|board/i.test(subtipo ?? "");

export const budgetSaleInputSchema = z.object({
  period: budgetPeriodSchema,
  clientName: z.string({ required_error: "Indicá el cliente." }).trim().min(1, "Indicá el cliente.").max(180),
  projectName: optionalText(255),
  projectId: z.number().int().positive().nullish(),
  currency: z.enum(["USD", "ARS"]),
  amount: finite("Indicá el monto.").positive("Indicá un monto mayor a cero."),
  exchangeRate: finite("Indicá la cotización.").positive("La cotización tiene que ser mayor a cero.").nullish(),
  confirmed: z.boolean(),
  probability: finite("Indicá la probabilidad.").min(0, "La probabilidad va de 0 a 100.").max(100, "La probabilidad va de 0 a 100.").nullish(),
  note: optionalText(2000),
}).superRefine((input, ctx) => {
  if (input.currency === "ARS" && input.exchangeRate == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["exchangeRate"], message: "Indicá la cotización ARS/USD para pasar el monto a dólares." });
  if (!input.confirmed && input.probability == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["probability"], message: "Indicá la probabilidad de cierre de una venta no confirmada." });
});
export type BudgetSaleInput = z.input<typeof budgetSaleInputSchema>;

/** Columnas de revenue_events que se derivan del formulario de venta estimada. */
export function computeBudgetSaleAmounts(input: z.output<typeof budgetSaleInputSchema>) {
  const amountNative = round(input.amount, 2);
  const amountUsd = input.currency === "ARS" ? round(amountNative / input.exchangeRate!, 2) : amountNative;
  const probability = input.confirmed ? 100 : round(input.probability!, 2);
  return {
    amountUsd, amountNative, currency: input.currency, fxRate: input.currency === "ARS" ? input.exchangeRate! : input.exchangeRate ?? null,
    probability, confirmed: input.confirmed, status: input.confirmed ? "confirmed" : "pipeline",
    /** Lo que suma la Proyección: confirmada al 100 %, si no ponderada por probabilidad. */
    weightedUsd: round(amountUsd * probability / 100, 2),
  };
}

export type BudgetPeriodSource = "master" | "mind";
export type BudgetCloseStatus = string | null | undefined;

/**
 * Motivo por el que no se puede cargar presupuesto en el mes, o null si se puede.
 * Los meses que informa el Máster se corrigen en la planilla: la próxima
 * sincronización pisaría cualquier cambio y sumar ambas fuentes duplicaría.
 */
export function budgetEditBlock(period: string, source: BudgetPeriodSource, closeStatus: BudgetCloseStatus, kind: "cost" | "sale"): string | null {
  if (source === "master") {
    return kind === "cost"
      ? `${periodName(period)} se informa desde el Máster. Cargá los costos estimados en la solapa «Costos estimados» de la planilla; Mind los toma en la próxima sincronización.`
      : `${periodName(period)} se informa desde el Máster. Cargá las ventas estimadas en la solapa «Proyectos confirmados y estimados» de la planilla.`;
  }
  if (closeStatus === "CLOSED" || closeStatus === "IN_REVIEW") {
    return `${periodName(period)} está ${closeStatus === "CLOSED" ? "cerrado" : "en revisión"}. Reabrilo para cambiar su presupuesto.`;
  }
  return null;
}

/**
 * Qué filas de costos estimados cuentan para el mes (misma regla que
 * EFFECTIVE_ESTIMATED_COSTS_SQL en el servidor):
 *   · mes del Máster          → sólo las filas importadas del Máster
 *   · mes de Mind con filas   → sólo las filas cargadas en Mind
 *   · mes de Mind sin filas   → las filas que haya importado el Máster (referencia previa a la migración)
 */
export type BudgetCostBasis = "master" | "mind" | "master_fallback" | "empty";
export function budgetCostBasis(source: BudgetPeriodSource, nativeRows: number, masterRows: number): BudgetCostBasis {
  if (source === "master") return masterRows > 0 ? "master" : "empty";
  if (nativeRows > 0) return "mind";
  return masterRows > 0 ? "master_fallback" : "empty";
}

export function shiftBudgetPeriod(period: string, delta: number) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** "Pasado" o "Futuro" respecto del mes en curso, como la columna de la planilla. */
export const budgetPasadoFuturo = (period: string, currentPeriod: string) => period < currentPeriod ? "Pasado" : "Futuro";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function periodName(period: string) {
  const [year, month] = period.split("-").map(Number);
  const name = MONTHS[month - 1] ?? period;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

export type BudgetCostRow = {
  id: number; period: string; native: boolean; detalle: string | null; subtipoCosto: string | null; puesto: string | null;
  billingYear: number | null; horasUnidades: number | null; valorHora: number | null; monedaOriginalArs: number | null;
  monedaOriginalUsd: number | null; cotizacion: number | null; montoTotalUsd: number | null; pasadoFuturo: string | null;
};
export type BudgetSaleRow = {
  id: number; period: string; clientName: string; projectName: string | null; projectId: number | null; currency: string;
  amountNative: number | null; amountUsd: number; fxRate: number | null; confirmed: boolean; probability: number | null;
  weightedUsd: number; note: string | null;
};
export type BudgetMonth = {
  period: string;
  source: BudgetPeriodSource;
  closeStatus: string | null;
  editBlock: { cost: string | null; sale: string | null };
  costBasis: BudgetCostBasis;
  /** Filas que cuentan para el mes según costBasis. */
  costs: BudgetCostRow[];
  /** Filas guardadas que no cuentan este mes (por ejemplo, del Máster cuando ya hay presupuesto en Mind). */
  ignoredCostRows: number;
  costTotalUsd: number;
  sales: BudgetSaleRow[];
  salesTotalUsd: number;
  salesWeightedUsd: number;
  /** Ventas reales ya cargadas en Mind (Carga financiera) para avisar de un posible doble conteo. */
  invoicedUsd: number;
};

/** Arma los 12 meses del ejercicio a partir de las filas crudas. Sin efectos: se prueba en unidad. */
export function buildBudgetMonths(input: {
  year: number; masterPeriods: Iterable<string>; closeStatuses: Map<string, string>;
  costs: BudgetCostRow[]; sales: BudgetSaleRow[]; invoiced: Map<string, number>;
}): BudgetMonth[] {
  const master = new Set(input.masterPeriods);
  return Array.from({ length: 12 }, (_, index) => {
    const period = `${input.year}-${String(index + 1).padStart(2, "0")}`;
    const source: BudgetPeriodSource = master.has(period) ? "master" : "mind";
    const closeStatus = input.closeStatuses.get(period) ?? null;
    const monthCosts = input.costs.filter(row => row.period === period);
    const native = monthCosts.filter(row => row.native);
    const imported = monthCosts.filter(row => !row.native);
    const costBasis = budgetCostBasis(source, native.length, imported.length);
    const costs = costBasis === "mind" ? native : costBasis === "empty" ? [] : imported;
    // En un mes del Máster las ventas salen de la planilla: las de Mind no se muestran como si sumaran.
    const sales = source === "master" ? [] : input.sales.filter(row => row.period === period);
    const sum = (values: number[]) => round(values.reduce((total, value) => total + value, 0), 2);
    return {
      period, source, closeStatus,
      editBlock: { cost: budgetEditBlock(period, source, closeStatus, "cost"), sale: budgetEditBlock(period, source, closeStatus, "sale") },
      costBasis, costs, ignoredCostRows: monthCosts.length - costs.length,
      costTotalUsd: sum(costs.map(row => row.montoTotalUsd ?? 0)),
      sales, salesTotalUsd: sum(sales.map(row => row.amountUsd)), salesWeightedUsd: sum(sales.map(row => row.weightedUsd)),
      invoicedUsd: round(input.invoiced.get(period) ?? 0, 2),
    };
  });
}
