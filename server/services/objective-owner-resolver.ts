// Name resolution for the 2026 objectives plan. Kept free of database imports
// so the mapping that decides who owns an objective can be tested directly.

// The strategy uses short names while the canonical personnel table contains
// the full names from the Master. Keep this mapping explicit so a new person
// with a similar name cannot silently receive someone else's actions.
export const OWNER_ALIASES: Record<string, string[]> = {
  // Keys are normalized before lookup; keeping this unaccented prevents the
  // fallback from mistaking Tomás Criado for the unrelated Tomas Facio.
  tomas: ["Tomi Criado", "Tomas Criado", "Tomi C"],
  vicky: ["Vicky Puricelli", "Vicky P"],
  acha: ["Victoria Achabal"],
  santi: ["Santiago Berisso", "Santi Berisso"],
  sil: ["Sil Vera"],
  pau: ["Paula Setrini"],
};

export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildNameIndex(rows: Array<{ id: number; name: string }>): Map<string, number> {
  const index = new Map<string, number>();
  for (const row of rows) {
    const key = normalize(row.name);
    if (!index.has(key)) index.set(key, row.id);
  }
  return index;
}

export function resolveOwner(
  shortName: string,
  personnelRows: Array<{ id: number; name: string }>,
  personnelByName: Map<string, number>,
  unresolved: Set<string>,
): number | null {
  if (shortName === "PMs") return null;
  const candidates = [shortName, ...(OWNER_ALIASES[normalize(shortName)] ?? [])];
  for (const candidate of candidates) {
    const id = personnelByName.get(normalize(candidate));
    if (id != null) return id;
  }

  // A conservative last resort for names such as "Santi" when the canonical
  // table only has the surname-expanded form. Never pick from two matches.
  const short = normalize(shortName);
  const matches = personnelRows.filter((person) => normalize(person.name).split(" ")[0] === short);
  if (matches.length === 1) return matches[0].id;

  unresolved.add(shortName);
  return null;
}
