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
  if (/\b(5|05)\b/.test(role) || role.includes("lead de leads") || role.includes("head") || role.includes("director")) return "5 Lead de Leads";
  if (/\b(4|04)\b/.test(role) || role.includes("lead")) return "4 Lead";
  if (/\b(2|02)\b/.test(role) || role.includes("semi senior") || role.includes("semisenior") || /\bssr\b/.test(role)) return "2 Semi Senior";
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
