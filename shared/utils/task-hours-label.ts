/** Display decimal hours with minute precision without exposing floating point noise. */
export function formatTaskHoursLabel(hours: number): string {
  const minutes = Math.max(0, Math.round(Number.isFinite(hours) ? hours * 60 : 0));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!m) return `${h}h`;
  return h ? `${h}h ${m}m` : `${m}m`;
}
