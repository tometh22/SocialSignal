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
 * Nombre canónico de un rol del cotizador. Vicky lo pidió con la numeración de
 * la escala ("04 Lead A"), y el área lo desambigua: sin ella, un "04 Lead A" de
 * Operaciones y uno de DataTech serían el mismo rol y las recetas no podrían
 * repartir horas por función.
 */
export function formatCanonicalRoleName(
  role: unknown,
  sublevel: unknown,
  area: unknown,
): string | null {
  const level = normalizePersonnelRole(role);
  if (!level) return null;
  // "3 Senior" -> "03 Senior", que es como lo escribe el equipo.
  const padded = level.replace(/^(\d)\s/, (_, digit) => `0${digit} `);
  const canonicalSublevel = normalizePersonnelSublevel(sublevel);
  const canonicalArea = normalizePersonnelArea(area);
  return [padded, canonicalSublevel, canonicalArea ? `· ${canonicalArea}` : null]
    .filter(Boolean)
    .join(" ");
}

/** Un rol es canónico cuando tiene nivel; sin él es del catálogo viejo. */
export function isCanonicalRoleClassification(role: {
  roleLevel?: string | null;
  sublevel?: string | null;
  area?: string | null;
}) {
  return Boolean(normalizePersonnelRole(role.roleLevel));
}

/**
 * Una persona encaja en un rol canónico cuando coincide en las dimensiones que
 * el rol define. El rol puede no fijar subnivel o área; en ese caso esa
 * dimensión no restringe.
 */
export function personMatchesRole(
  role: { roleLevel?: string | null; sublevel?: string | null; area?: string | null },
  person: { currentRole?: string | null; sublevel?: string | null; area?: string | null },
) {
  const level = normalizePersonnelRole(role.roleLevel);
  if (!level) return false;
  if (normalizePersonnelRole(person.currentRole) !== level) return false;

  const roleSublevel = normalizePersonnelSublevel(role.sublevel);
  if (roleSublevel && normalizePersonnelSublevel(person.sublevel) !== roleSublevel) return false;

  const roleArea = normalizePersonnelArea(role.area);
  if (roleArea && normalizePersonnelArea(person.area) !== roleArea) return false;

  return true;
}

/**
 * Las recetas reparten horas por función ("8h de PM, 24h de analista"), pero el
 * catálogo de roles pasó a ser la escala de Personal. Este mapa es el puente:
 * traduce cada función de receta al área y al nivel típico que la ejecuta.
 *
 * Los niveles son un punto de partida editable, no una regla de negocio
 * cerrada: al aplicar una receta el equipo queda propuesto y se ajusta a mano.
 */
export const BLUEPRINT_ROLE_PROFILES: Record<string, { area: PersonnelArea; level: PersonnelRoleLevel }> = {
  director: { area: "Cuenta", level: "5 Lead de Leads" },
  pm: { area: "Operaciones", level: "4 Lead" },
  analyst: { area: "Operaciones", level: "3 Senior" },
  data: { area: "DataTech", level: "3 Senior" },
  tech: { area: "DataTech", level: "3 Senior" },
  design: { area: "Marketing", level: "2 Semi Senior" },
};

/**
 * Rol canónico para una función de receta. Prefiere la coincidencia exacta de
 * área y nivel; si no existe, cualquiera del área; y como último recurso deja
 * que quien llama use su propio criterio.
 */
export function resolveCanonicalRoleForBlueprintKey<T extends { roleLevel?: string | null; area?: string | null; isActive?: boolean }>(
  roleKey: string,
  roles: T[],
): T | undefined {
  const profile = BLUEPRINT_ROLE_PROFILES[roleKey];
  if (!profile) return undefined;
  const usable = roles.filter((role) => role.isActive !== false && normalizePersonnelRole(role.roleLevel));
  const sameArea = usable.filter((role) => normalizePersonnelArea(role.area) === profile.area);
  return sameArea.find((role) => normalizePersonnelRole(role.roleLevel) === profile.level) ?? sameArea[0];
}
