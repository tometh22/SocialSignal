/**
 * Un período es "cerrado" cuando el mes ya terminó: su tipo de cambio dejó de
 * ser una proyección y pasa a ser un dato observado. Se evalúa en la zona
 * horaria de operación para que el 1° de septiembre agosto ya cuente como real.
 *
 * Vive en `shared` y sin dependencias para que la regla sea verificable sin
 * levantar la base.
 */
export function getBuenosAiresPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

export function isClosedPeriod(year: number, month: number, now = new Date()) {
  const { year: currentYear, month: currentMonth } = getBuenosAiresPeriod(now);
  return year * 100 + month < currentYear * 100 + currentMonth;
}
