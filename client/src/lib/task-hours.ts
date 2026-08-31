/**
 * Parseo y formato de horas de tarea, compartido por el detalle de la tarea y
 * la carga rápida desde la fila. Vive acá para que ambos acepten exactamente la
 * misma notación: antes la carga rápida sólo leía horas decimales y redondeaba
 * a cuartos en silencio, así que no había forma de cargar minutos.
 *
 * Acepta: `2` · `2.5` · `2,5` · `2h` · `1h30` · `1h30m` · `1:30` · `45m` · `45min`
 */
export function parseHoursInput(value: string): number | null {
  const normalized = value.trim().toLowerCase().replace(",", ".");
  if (!normalized) return null;

  const hoursAndMinutes = normalized.match(/^(\d+)h(\d+)m?$/);
  if (hoursAndMinutes) return Number(hoursAndMinutes[1]) + Number(hoursAndMinutes[2]) / 60;

  const hoursOnly = normalized.match(/^(\d+(?:\.\d+)?)h$/);
  if (hoursOnly) return Number(hoursOnly[1]);

  const clock = normalized.match(/^(\d+):(\d+)$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60;

  const minutesOnly = normalized.match(/^(\d+)m(?:in)?$/);
  if (minutesOnly) return Number(minutesOnly[1]) / 60;

  const decimal = Number(normalized);
  return Number.isFinite(decimal) ? decimal : null;
}

/** Redondea al minuto: preserva 2:15 → 2.25 sin inventar precisión falsa. */
export function roundToMinute(hours: number) {
  return Math.round(hours * 60) / 60;
}

export function formatHours(hours: number) {
  return `${(Math.round(hours * 100) / 100).toFixed(2)} h`;
}
