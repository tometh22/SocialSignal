export type RoleRateSource = { defaultRate?: number | null; defaultRateUsd?: number | null };
export type RateCurrency = "ARS" | "USD";

const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Tarifa/hora de un rol (sin persona) EN la moneda de la cotización. `defaultRate` está en pesos y
 * `defaultRateUsd` en dólares; los roles canónicos nuevos nacen con `defaultRateUsd` en 0/null. En
 * vez de caer a la tarifa en pesos (que quedaba guardada como dólares), se convierte con el tipo de
 * cambio de la cotización. Devuelve 0 si no hay forma de resolverla.
 */
export function resolveRoleRate(role: RoleRateSource | null | undefined, currency: RateCurrency, exchangeRate: number): number {
  const ars = positive(role?.defaultRate);
  const usd = positive(role?.defaultRateUsd);
  const fx = positive(exchangeRate);
  if (currency === "USD") {
    if (usd > 0) return usd;
    return ars > 0 && fx > 0 ? Math.round((ars / fx) * 100) / 100 : 0;
  }
  if (ars > 0) return ars;
  return usd > 0 && fx > 0 ? Math.round(usd * fx * 100) / 100 : 0;
}

/**
 * Miembros sin persona de una cotización en USD cuya tarifa es, en la práctica, la tarifa en PESOS del rol:
 * coincide con `defaultRate` (±1%) y es al menos 3 veces el valor USD plausible del rol. Esa combinación
 * no se da por casualidad (inflaba un total a USD 4,4 millones); una tarifa USD legítima nunca la cumple.
 */
export function findArsRatesInUsdQuotation<M extends { roleId?: number | null; personnelId?: number | null; rate: number }>(
  input: { currency: RateCurrency; exchangeRate: number; members: M[]; roles: Map<number, RoleRateSource> },
): Array<{ index: number; roleId: number; rate: number; expectedUsdRate: number }> {
  if (input.currency !== "USD") return [];
  const found: Array<{ index: number; roleId: number; rate: number; expectedUsdRate: number }> = [];
  input.members.forEach((member, index) => {
    if (member.personnelId || !member.roleId) return;
    const role = input.roles.get(member.roleId);
    const ars = positive(role?.defaultRate);
    if (!role || ars <= 0) return;
    const expectedUsdRate = resolveRoleRate(role, "USD", input.exchangeRate);
    const rate = Number(member.rate);
    if (expectedUsdRate > 0 && Math.abs(rate - ars) / ars <= 0.01 && rate >= expectedUsdRate * 3) {
      found.push({ index, roleId: member.roleId, rate, expectedUsdRate });
    }
  });
  return found;
}
