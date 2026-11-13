/** @deprecated Project followup is cumulative and must never generate monthly sales. */
export async function importRendimientoCliente(): Promise<never> {
  throw new Error("El seguimiento acumulado no se importa como ventas mensuales. Usá la conciliación mensual y la vista de proyectos.");
}
