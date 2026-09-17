// El plan tiene tres ejes distintos —qué sostiene a qué, cuándo vence, quién
// lo lleva— y el árbol de parentesco solo representa el primero. Aplastarlos
// en uno hace que "cuánto cuelga" funcione como peso: Sales y Marketing pesan
// 23 por ser tácticos, mientras Kimberly pesa 2 y es media facturación.
//
// Esta capa separa los ejes. No toca OBJECTIVE_PARENTS: se apoya encima.

export const FRONTS = {
  "front-close": "Cerrar lo que está abierto",
  "front-new": "Nuevos negocios",
  "front-retain": "Renovar y retener",
  "front-products": "Productos propios",
  "front-ops-cash": "Operación y caja",
} as const;

export type FrontId = keyof typeof FRONTS;

/** Orden de lectura: primero lo que se cierra, al final lo que sostiene. */
export const FRONT_ORDER: FrontId[] = [
  "front-close",
  "front-new",
  "front-retain",
  "front-products",
  "front-ops-cash",
];

/**
 * El norte del plan: facturación mensual nueva, recurrente y firmada, al menos
 * USD 10.000 por mes. No es una raíz más — se muestra arriba de los frentes.
 */
export const NORTH_STAR = "company-new-recurring-signed";

/**
 * "Al menos un fee mensual nuevo firmado y facturando" no es un frente aparte:
 * es la primera expresión concreta del norte, así que se lee junto a él.
 */
export const NORTH_STAR_SUPPORT = ["company-new-monthly-fee"];

export const COMPANY_FRONT: Record<string, FrontId> = {
  "company-expansion-fee": "front-close",
  "company-warner-mexico": "front-close",
  "company-uber-reputational": "front-close",

  "company-new-business-proposals": "front-new",
  "company-bcra-decision": "front-new",
  "company-2027-opportunities": "front-new",

  "company-kimberly-renewal-price": "front-retain",
  "company-coelsa-retention": "front-retain",
  "company-second-interlocutor": "front-retain",

  "company-triggers-product": "front-products",
  "company-alert-subscriptions": "front-products",
  "company-own-products-baseline": "front-products",

  "company-on-time-delivery": "front-ops-cash",
  "company-cash-runway": "front-ops-cash",
  "company-proposal-margin": "front-ops-cash",
  "company-client-alerts": "front-ops-cash",
  "company-annual-revenue": "front-ops-cash",
};

/**
 * Nodo visible entre un objetivo de empresa y sus objetivos de área. Sin esto
 * "Nuevos negocios" muestra 23 hijos de golpe; con esto muestra dos nodos que
 * se abren. El agrupamiento ya existía en los slugs, pero no como nodo.
 */
export const AREA_GROUPS: Array<{ prefix: string; label: string }> = [
  { prefix: "area-sales-", label: "Sales (Sil)" },
  { prefix: "area-marketing-", label: "Marketing (Santi)" },
  { prefix: "area-operations-", label: "Operaciones (Vicky)" },
  { prefix: "area-product-", label: "Producto (Tomás)" },
];

export function areaGroupOf(slug: string | null | undefined): { id: string; label: string } | null {
  if (!slug) return null;
  const group = AREA_GROUPS.find((candidate) => slug.startsWith(candidate.prefix));
  return group ? { id: group.prefix, label: group.label } : null;
}

/**
 * Los cuatro objetivos de mes son puntos de control en el tiempo, no cosas que
 * sostengan a otras. Salen del árbol y se vuelven marcadores de la línea.
 */
export const MONTH_CHECKPOINT_SLUGS = [
  "company-month-sep-open-mesas",
  "company-month-oct-advance",
  "company-month-nov-close",
  "company-month-dec-renew",
];

export const CHECKPOINTS: Array<{ date: string; label: string; hard: boolean }> = [
  { date: "2026-10-06", label: "Punto de control duro", hard: true },
  { date: "2026-11-03", label: "Punto de control de cierre", hard: true },
];

export type Tier = "innegociable" | "soporte";

/**
 * La prioridad se declara, no se cuenta. Cada objetivo de mes ya enumera en su
 * propia meta qué es innegociable ese mes; esto es esa lista traducida a slugs.
 *
 * Septiembre: "Warner, Kimberly y PedidosYa abiertos; BID con fecha de
 * decisión; triggers con precio". "BID" no tiene objetivo propio en el plan:
 * vive como candidata dentro de la expansión con fee, así que apunta ahí.
 */
export const MONTHLY_NON_NEGOTIABLES: Record<number, string[]> = {
  9: [
    "company-warner-mexico",
    "company-kimberly-renewal-price",
    "area-operations-pedidosya-recurring",
    "company-expansion-fee",
    "company-triggers-product",
  ],
  10: [
    "company-kimberly-renewal-price",
    "area-operations-pedidosya-recurring",
    "company-warner-mexico",
    "company-uber-reputational",
    "area-marketing-frontier-content",
  ],
  11: [
    "company-expansion-fee",
    "company-bcra-decision",
    "company-2027-opportunities",
  ],
  12: [
    "company-kimberly-renewal-price",
    "company-new-recurring-signed",
    "company-annual-revenue",
    "company-2027-opportunities",
  ],
};

/** Mes del plan que corresponde a una fecha; fuera de sept–dic no hay mes. */
export function planMonthOf(today: string): number | null {
  const month = Number(today.slice(5, 7));
  return month >= 9 && month <= 12 ? month : null;
}

export function tierFor(slug: string | null | undefined, today: string): Tier {
  if (!slug) return "soporte";
  const month = planMonthOf(today);
  if (month == null) return "soporte";
  return MONTHLY_NON_NEGOTIABLES[month]?.includes(slug) ? "innegociable" : "soporte";
}

export function frontOf(slug: string | null | undefined): FrontId | null {
  return slug ? COMPANY_FRONT[slug] ?? null : null;
}

/**
 * Qué es cada entrada del plan. Las 87 se guardaron todas como "objetivo", y
 * llamarlas así a todas es lo que vuelve ilegible la pantalla: el plan real
 * son 15 objetivos de empresa y 60 acciones semanales. Lo demás es cómo se
 * opera, cuándo se controla, o la misma cosa repetida un nivel más abajo.
 *
 * - `objetivo`: lo que la empresa se compromete a lograr. Son 15.
 * - `bajada`: el mismo objetivo expresado a nivel área o persona. No es un
 *   objetivo aparte: es quién lo ejecuta. Son 49.
 * - `estandar`: algo que se sostiene, sin línea de llegada. Son 19.
 * - `checkpoint`: un punto de control en el calendario. Son 4.
 */
export type PlanRole = "objetivo" | "bajada" | "estandar" | "checkpoint";

export function planRoleOf(
  slug: string | null | undefined,
  level: string | null | undefined,
  targetKind: string | null | undefined,
): PlanRole {
  if (slug && MONTH_CHECKPOINT_SLUGS.includes(slug)) return "checkpoint";
  if (targetKind === "continuous") return "estandar";
  return level === "company" ? "objetivo" : "bajada";
}
