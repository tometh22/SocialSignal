// Ajuste programado de precio por IPC — sólo para cotizaciones en ARS (los
// clientes fuera de Argentina se cotizan en USD y no llevan esta cláusula:
// no tiene sentido indexarlos a la inflación local). El precio en dólares
// de esos clientes está cubierto, en cambio, por la alerta de margen
// (shared/utils/quotation-margin-drift.ts).
//
// El disparador es la cláusula que la receta ya define al cotizar
// (scopeSnapshot.priceAdjustment: "ipc_quarterly" | "annual_review") — nunca
// se agrega retroactivamente a una cotización que no la tenía desde el
// origen. El ajuste queda "pending_approval" hasta que alguien lo aprueba a
// mano; nada se le cobra al cliente ni se le avisa por email sin esa
// aprobación explícita.

export type AdjustmentCadence = "ipc_quarterly" | "annual_review";

export const CADENCE_MONTHS: Record<AdjustmentCadence, number> = {
  ipc_quarterly: 3,
  annual_review: 12,
};

export type MonthlyIpcValue = { year: number; month: number; monthlyPercentage: number };

// Nombre distinto (no "addMonths") a propósito: server/services/dates.ts ya
// tiene un addMonths(monthKey: string, delta: number): string que opera
// sobre strings "YYYY-MM", con una firma totalmente distinta. Mismo nombre,
// otro tipo, en dos módulos separados es una trampa para el autocompletado.

/** Primer día del mes N meses después de `from`. */
export function addCalendarMonths(from: Date, months: number): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1));
}

/**
 * Primer día del mes de `date`. Los ciclos de ajuste siempre se anclan a
 * inicio de mes (ver addCalendarMonths), así que la fecha real de aceptación
 * del contrato (que sí tiene un día del mes real) se recorta acá para que el
 * primer ciclo quede consistente con todos los siguientes — si no, se cuenta
 * de más o de menos el mes en que se firmó (ver historial de este archivo).
 */
export function clampToMonthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * Es hora del próximo ajuste si ya pasó (o es hoy) el fin del período de la
 * cadencia contratada, contado desde `sinceDate` (la fecha de aceptación del
 * contrato, o el fin del último ajuste ya resuelto — aplicado o rechazado).
 */
export function isDueForAdjustment(cadence: AdjustmentCadence, sinceDate: Date, now: Date): boolean {
  const dueDate = addCalendarMonths(sinceDate, CADENCE_MONTHS[cadence]);
  return now.getTime() >= dueDate.getTime();
}

/**
 * Combina la variación mensual del IPC en el período (interés compuesto, no
 * suma simple: dos meses de +2% acumulan +4.04%, no +4%). Devuelve null si
 * falta algún mes del período — el llamador debe esperar a que se sincronice
 * ese dato en vez de calcular con información parcial.
 */
export function calculateAccumulatedIpc(
  periodStart: Date,
  periodEnd: Date,
  monthlyValues: MonthlyIpcValue[],
): number | null {
  const byPeriod = new Map(monthlyValues.map((v) => [`${v.year}-${v.month}`, v.monthlyPercentage]));
  let compounded = 1;
  let cursor = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1));
  const end = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), 1));
  let monthsFound = 0;
  while (cursor.getTime() < end.getTime()) {
    const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth() + 1}`;
    const value = byPeriod.get(key);
    if (value == null) return null;
    compounded *= 1 + value / 100;
    monthsFound += 1;
    cursor = addCalendarMonths(cursor, 1);
  }
  if (monthsFound === 0) return null;
  return Number(((compounded - 1) * 100).toFixed(3));
}

export function calculateAdjustedPrice(previousTotal: number, accumulatedIpcPercentage: number): number {
  const adjusted = previousTotal * (1 + accumulatedIpcPercentage / 100);
  return Math.round((adjusted + Number.EPSILON) * 100) / 100;
}

export type PriceAdjustmentProposal = {
  cadence: AdjustmentCadence;
  periodStart: Date;
  periodEnd: Date;
  accumulatedIpcPercentage: number;
  previousTotalAmount: number;
  proposedTotalAmount: number;
};

/**
 * Arma la propuesta de ajuste si corresponde. Devuelve null si todavía no
 * está vencido, o si falta información del IPC para completar el período
 * (nunca calcula con datos parciales).
 */
export function buildPriceAdjustmentProposal(input: {
  cadence: AdjustmentCadence;
  sinceDate: Date;
  now: Date;
  previousTotalAmount: number;
  monthlyValues: MonthlyIpcValue[];
}): PriceAdjustmentProposal | null {
  if (!isDueForAdjustment(input.cadence, input.sinceDate, input.now)) return null;
  const periodStart = input.sinceDate;
  const periodEnd = addCalendarMonths(input.sinceDate, CADENCE_MONTHS[input.cadence]);
  const accumulatedIpcPercentage = calculateAccumulatedIpc(periodStart, periodEnd, input.monthlyValues);
  if (accumulatedIpcPercentage == null) return null;
  return {
    cadence: input.cadence,
    periodStart,
    periodEnd,
    accumulatedIpcPercentage,
    previousTotalAmount: input.previousTotalAmount,
    proposedTotalAmount: calculateAdjustedPrice(input.previousTotalAmount, accumulatedIpcPercentage),
  };
}
