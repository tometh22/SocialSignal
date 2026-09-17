// El plan 2026 nació como tres listas planas: 23 objetivos de empresa, 31 de
// área y 33 de persona, sin nada que dijera cuál sostiene a cuál. Sin ese
// vínculo la pantalla sólo puede mostrar 87 tarjetas del mismo peso, y no hay
// forma de priorizar. Acá vive la estructura que le falta al plan: de quién
// cuelga cada objetivo, y cómo se lee su meta (fecha de corte y, cuando el
// texto lo dice sin ambigüedad, el número a alcanzar).

/**
 * Objetivo padre de cada objetivo que no es raíz. Los 23 de empresa no
 * aparecen acá: son la raíz del árbol. Los de CEO y COO cuelgan directo de
 * empresa porque son responsabilidades transversales, no ejecución de un área.
 */
export const OBJECTIVE_PARENTS: Record<string, string> = {
  // Áreas → empresa
  "area-sales-ideal-accounts": "company-new-business-proposals",
  "area-sales-weekly-cadence": "company-new-business-proposals",
  "area-sales-vertical-sequences": "company-new-business-proposals",
  "area-sales-follow-up-lane": "company-2027-opportunities",
  "area-sales-response-time": "company-new-business-proposals",
  "area-sales-loss-reasons": "company-2027-opportunities",
  "area-sales-qualified-meetings": "company-new-business-proposals",
  "area-marketing-google-ads": "company-new-business-proposals",
  "area-marketing-newsletters": "company-new-business-proposals",
  "area-marketing-linkedin": "company-new-business-proposals",
  "area-marketing-vertical-pages": "company-new-business-proposals",
  "area-marketing-cases": "company-new-business-proposals",
  "area-marketing-frontier-content": "company-2027-opportunities",
  "area-marketing-qualified-leads": "company-new-business-proposals",
  "area-operations-kimberly-expansion": "company-kimberly-renewal-price",
  "area-operations-pedidosya-recurring": "company-new-recurring-signed",
  "area-operations-warner-sequence": "company-warner-mexico",
  "area-operations-coelsa-retention": "company-coelsa-retention",
  "area-operations-expansion-meetings": "company-expansion-fee",
  "area-operations-on-time-delivery": "company-on-time-delivery",
  "area-operations-licenses": "company-on-time-delivery",
  "area-operations-process": "company-on-time-delivery",
  "area-operations-cash-billing": "company-cash-runway",
  "area-product-triggers": "company-triggers-product",
  "area-product-radar-cuts": "company-own-products-baseline",
  "area-product-paid-diagnosis": "company-own-products-baseline",
  "area-product-alerts": "company-alert-subscriptions",
  "area-product-dashboard": "company-own-products-baseline",
  "area-product-agency-channel": "company-new-business-proposals",
  "area-product-mind-pilot": "company-own-products-baseline",
  "area-product-sme-2027": "company-2027-opportunities",

  // CEO y COO → empresa (responsabilidad transversal, no ejecución de un área)
  "person-tomas-annual-billing": "company-annual-revenue",
  "person-tomas-2027-pipeline": "company-2027-opportunities",
  "person-tomas-strategic-opportunities": "company-new-business-proposals",
  "person-tomas-product-pricing": "company-triggers-product",
  "person-tomas-radar-calls": "company-new-business-proposals",
  "person-tomas-discovery": "company-expansion-fee",
  "person-tomas-sales-focus": "company-annual-revenue",
  "person-tomas-no-build-focus": "company-own-products-baseline",
  "person-vicky-existing-account-closures": "company-expansion-fee",
  "person-vicky-coordination": "company-on-time-delivery",
  "person-vicky-cash-margin-billing": "company-cash-runway",
  "person-vicky-operational-quality": "company-on-time-delivery",
  "person-vicky-expansion-and-discovery": "company-expansion-fee",
  "person-vicky-team-feedback": "company-on-time-delivery",

  // Equipo → el objetivo de área que ejecutan
  "person-sil-target-list": "area-sales-ideal-accounts",
  "person-sil-prospecting-cadence": "area-sales-weekly-cadence",
  "person-sil-vertical-messaging": "area-sales-vertical-sequences",
  "person-sil-follow-up-and-response": "area-sales-follow-up-lane",
  "person-sil-meetings-and-losses": "area-sales-qualified-meetings",
  "person-santi-demand-channels": "area-marketing-google-ads",
  "person-santi-cases-and-frontier": "area-marketing-cases",
  "person-santi-qualified-leads": "area-marketing-qualified-leads",
  "person-santi-marketing-board-pack": "area-marketing-qualified-leads",
  "person-acha-license-audit": "area-operations-licenses",
  "person-acha-infrastructure-transition": "area-operations-licenses",
  "person-acha-radar-relaunch": "area-product-radar-cuts",
  "person-acha-process-improvement": "area-operations-process",
  "person-pau-warner-mexico-access": "area-operations-warner-sequence",
  "person-pms-daily-account-relations": "area-operations-on-time-delivery",
  "person-pms-expansion-detection": "area-operations-expansion-meetings",
  "person-pms-kimberly-value": "area-operations-kimberly-expansion",
  "person-pms-cases-references": "area-marketing-cases",
  "person-pms-no-price-negotiation": "area-operations-expansion-meetings",
};

/**
 * Cómo se mide un objetivo. Decide qué control muestra la pantalla y cómo se
 * ordena por prioridad.
 * - `metric`: hay un número que alcanzar antes de una fecha. Barra de avance.
 * - `milestone`: pasa o no pasa antes de una fecha. Hecho / no hecho.
 * - `continuous`: un estándar que se sostiene, sin línea de llegada. Se mide
 *   cumplimiento, no avance, y nunca "vence".
 */
export type ObjectiveTargetKind = "metric" | "milestone" | "continuous";

/** Objetivos que son un estándar sostenido, no algo que se termina. */
const CONTINUOUS_OBJECTIVES = new Set([
  "company-cash-runway",
  "company-proposal-margin",
  "company-on-time-delivery",
  "company-client-alerts",
  "area-sales-weekly-cadence",
  "area-sales-follow-up-lane",
  "area-sales-response-time",
  "area-marketing-linkedin",
  "area-operations-on-time-delivery",
  "area-operations-cash-billing",
  "person-vicky-coordination",
  "person-vicky-cash-margin-billing",
  "person-vicky-operational-quality",
  "person-sil-prospecting-cadence",
  "person-sil-follow-up-and-response",
  "person-santi-marketing-board-pack",
  "person-pms-daily-account-relations",
  "person-pms-cases-references",
  "person-pms-no-price-negotiation",
  // Tres conductas que estaban anotadas como objetivos con fecha. No son metas
  // que se alcanzan: son cosas que se sostienen, y se miden por cumplimiento.
  "person-tomas-annual-billing",
  "person-tomas-sales-focus",
  "person-tomas-no-build-focus",
]);

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

const EXPLICIT_DATE = new RegExp(
  `(\\d{1,2})\\s+de\\s+(${Object.keys(MONTHS).join("|")})`,
  "i",
);

// "durante el cuatrimestre", "al cierre del año", "septiembre–diciembre": el
// plan cierra el 31 de diciembre, así que ese es el corte.
const END_OF_PLAN = /cuatrimestre|cierre del a[nñ]o|septiembre\s*[–-]\s*diciembre|todo el a[nñ]o/i;

/**
 * Fecha de corte del objetivo. El plan la escribe dentro del texto de la meta
 * ("al 31 de diciembre"), donde no sirve para ordenar ni para avisar que algo
 * vence. Devuelve null para los objetivos continuos, que no vencen.
 */
export function parseTargetDate(target: string | null | undefined, year: number, slug?: string): string | null {
  if (!target) return null;
  if (slug && CONTINUOUS_OBJECTIVES.has(slug)) return null;
  const explicit = target.match(EXPLICIT_DATE);
  // "desde el 15 de septiembre" marca el arranque, no el vencimiento: tomarla
  // como corte adelantaría la fecha de algo que en realidad cierra más tarde.
  const isStartDate = explicit != null && /\b(desde|a partir de)\s+(?:el\s+)?$/i.test(target.slice(0, explicit.index));
  if (explicit && !isStartDate) {
    const day = Number(explicit[1]);
    const month = MONTHS[explicit[2].toLowerCase()];
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  if (END_OF_PLAN.test(target)) return `${year}-12-31`;
  return null;
}

// "USD 655K", "Al menos 15", "60 cuentas", "12 publicaciones", "100%". Sólo se
// toma el primer número cuando la frase empieza midiendo: si el texto arranca
// describiendo otra cosa, es más honesto no inventar una meta numérica.
const CONNECTORS = new Set([
  "de", "del", "en", "por", "para", "a", "al", "con", "y", "o", "u", "la", "el",
  "los", "las", "un", "una", "durante", "cada", "sin", "que", "mas", "más",
  "sobre", "entre", "hasta", "desde", "su", "sus", "lo",
]);

const AMOUNT = /^(?:al menos\s+|m[aá]ximo\s+|piso\s+|hasta\s+)?(USD|ARS|\$)?\s*(\d[\d.,]*)\s*(K|M|%)?\s*([a-zá-úñ][a-zá-úñ\s]{0,24})?/i;

export function parseTargetValue(
  target: string | null | undefined,
  slug?: string,
): { value: number; unit: string | null } | null {
  if (!target) return null;
  if (slug && CONTINUOUS_OBJECTIVES.has(slug)) return null;
  const m = target.match(AMOUNT);
  if (!m) return null;
  const raw = m[2].replace(/\./g, "").replace(",", ".");
  let value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const scale = m[3]?.toUpperCase();
  if (scale === "K") value *= 1_000;
  if (scale === "M") value *= 1_000_000;
  const currency = m[1]?.toUpperCase();
  let unit: string | null = currency === "$" ? "USD" : currency ?? (scale === "%" ? "%" : null);
  if (!unit) {
    // "4 de 5 cuentas", "8 en el cuatrimestre": la palabra que sigue al número
    // suele ser un conector, y guardarlo como unidad se lee como error.
    const word = m[4]?.trim().split(/\s+/)[0]?.toLowerCase() ?? null;
    unit = word && !CONNECTORS.has(word) ? word : null;
  }
  return { value, unit: unit || null };
}

export function targetKindFor(slug: string, target: string | null | undefined): ObjectiveTargetKind {
  if (CONTINUOUS_OBJECTIVES.has(slug)) return "continuous";
  return parseTargetValue(target, slug) ? "metric" : "milestone";
}
