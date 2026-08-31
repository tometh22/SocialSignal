export const PERSONNEL_ROLE_LEVELS = [
  "1 Junior",
  "2 Semi Senior",
  "3 Senior",
  "4 Lead",
  "5 Lead de Leads",
] as const;

export const PERSONNEL_AREAS = [
  "Operaciones",
  "Marketing",
  "DataTech",
  "Cuenta",
] as const;

export type PersonnelRoleLevel = typeof PERSONNEL_ROLE_LEVELS[number];
export type PersonnelArea = typeof PERSONNEL_AREAS[number];

const normalized = (value: unknown) => String(value ?? "")
  .trim()
  .toLocaleLowerCase("es")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

/** Converts the labels used by the Master (and their common abbreviations)
 * into the five canonical seniority levels used throughout the product. */
export function normalizePersonnelRole(value: unknown): PersonnelRoleLevel | null {
  const role = normalized(value);
  if (!role) return null;
  if (/\b(5|05)\b/.test(role) || role.includes("lead de leads") || role.includes("head") || role.includes("director") || role.includes("ceo") || role.includes("coo")) return "5 Lead de Leads";
  if (/\b(4|04)\b/.test(role) || role.includes("lead")) return "4 Lead";
  if (/\b(2|02)\b/.test(role) || role.includes("semi senior") || role.includes("semisenior") || role.includes("semi sr") || /\bssr\b/.test(role)) return "2 Semi Senior";
  if (/\b(1|01)\b/.test(role) || role.includes("junior") || /\bjr\b/.test(role)) return "1 Junior";
  if (/\b(3|03)\b/.test(role) || role.includes("senior") || /\bsr\b/.test(role)) return "3 Senior";
  return null;
}

export function allowedSublevelsForRole(role: unknown): readonly string[] {
  return normalizePersonnelRole(role) === "4 Lead" ? ["A", "B", "C"] : ["A", "B"];
}

export function normalizePersonnelSublevel(value: unknown): "A" | "B" | "C" | null {
  const sublevel = normalized(value).toUpperCase();
  const match = sublevel.match(/(?:^|\s)(A|B|C)(?:$|\s)/);
  return match ? match[1] as "A" | "B" | "C" : null;
}

export function normalizePersonnelArea(value: unknown): PersonnelArea | null {
  const area = normalized(value);
  if (!area) return null;
  if (area.includes("operacion") || area === "ops") return "Operaciones";
  if (area.includes("marketing")) return "Marketing";
  if (area.includes("data") || area.includes("tech") || area.includes("tecnologia")) return "DataTech";
  if (area.includes("cuenta") || area.includes("account")) return "Cuenta";
  return null;
}

export function isValidPersonnelClassification(role: unknown, sublevel: unknown) {
  const canonicalRole = normalizePersonnelRole(role);
  const canonicalSublevel = normalizePersonnelSublevel(sublevel);
  return Boolean(canonicalRole && canonicalSublevel && allowedSublevelsForRole(canonicalRole).includes(canonicalSublevel));
}

/**
 * Deduce el área a partir del nombre de un rol cotizado. Los roles del catálogo
 * mezclan dos dimensiones: algunos codifican seniority ("Lead PM", "Analista
 * Senior") y otros la función ("Data Scientist", "Project Manager"). Sin esto,
 * cruzar candidatos sólo por nivel no hacía nada para la mitad del catálogo.
 *
 * El mapeo es deliberadamente conservador: términos ambiguos como "analista"
 * no se asignan, porque una corazonada errónea es peor que no ordenar.
 */
export function inferAreaFromRoleName(value: unknown): PersonnelArea | null {
  const role = normalized(value);
  if (!role) return null;
  if (/\b(data|datos|scientist|tech|tecnologia|developer|dev|ingenier|analytics)\b/.test(role)) return "DataTech";
  if (/\b(pm|project|proyecto|producer|operacion|operaciones|ops|delivery)\b/.test(role)) return "Operaciones";
  if (/\b(content|contenido|marketing|design|diseno|creative|creativo|redactor|copy)\b/.test(role)) return "Marketing";
  if (/\b(account|cuenta|cuentas|comercial|sales|ventas)\b/.test(role)) return "Cuenta";
  return null;
}

/**
 * Afinidad de una persona con el rol cotizado, de 0 a 3. El nivel pesa más que
 * el área porque es la dimensión que define la tarifa. Devuelve 0 cuando el rol
 * no permite inferir nada: en ese caso quien llama no debe ordenar ni filtrar.
 */
export function scoreCandidateForRole(
  roleName: unknown,
  person: { currentRole?: string | null; area?: string | null },
): number {
  const level = normalizePersonnelRole(roleName);
  const area = inferAreaFromRoleName(roleName);
  let score = 0;
  if (level && normalizePersonnelRole(person.currentRole) === level) score += 2;
  if (area && normalizePersonnelArea(person.area) === area) score += 1;
  return score;
}

/** Etiqueta de lo que se pudo inferir del rol, para explicar el agrupamiento. */
export function describeRoleAffinity(roleName: unknown): string | null {
  const level = normalizePersonnelRole(roleName);
  const area = inferAreaFromRoleName(roleName);
  if (level && area) return `${level} · ${area}`;
  return level ?? area ?? null;
}
