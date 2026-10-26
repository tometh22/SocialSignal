/** Paid leave changes availability, never the contractual monthly payment. */
export function contractualMonthlyHours(person: { contractType?: string | null; monthlyHours?: number | null }): number {
  const configured = Number(person.monthlyHours);
  return configured > 0 ? configured : person.contractType === "part-time" ? 120 : 160;
}

export function payableMonthlyHours(person: { contractType?: string | null; monthlyHours?: number | null }, actualHours: number, unpaidHours = 0, reason = ""): number {
  if (!Number.isFinite(actualHours) || actualHours < 0 || !Number.isFinite(unpaidHours) || unpaidHours < 0) throw new Error("Horas inválidas");
  if (person.contractType === "freelance") {
    if (unpaidHours) throw new Error("Freelance se liquida por horas trabajadas; no admite descuentos de licencia");
    return actualHours;
  }
  const base = contractualMonthlyHours(person);
  if (unpaidHours > base) throw new Error("El descuento supera las horas contractuales");
  if (unpaidHours > 0 && reason.trim().length < 5) throw new Error("Indicá el motivo de la licencia sin goce de sueldo");
  return Math.round((base - unpaidHours) * 100) / 100;
}
