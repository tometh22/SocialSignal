import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  clients,
  objectiveAccounts,
  objectiveActionOwners,
  objectiveActions,
  objectives,
  personnel,
} from "@shared/schema";
import { OBJECTIVE_PLAN_2026 } from "@shared/objectives-plan-2026";

const MONTH_NUMBERS: Record<string, number> = {
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

// The strategy uses short names while the canonical personnel table contains
// the full names from the Master. Keep this mapping explicit so a new person
// with a similar name cannot silently receive someone else's actions.
const OWNER_ALIASES: Record<string, string[]> = {
  // Keys are normalized before lookup; keeping this unaccented prevents the
  // fallback from mistaking Tomás Criado for the unrelated Tomas Facio.
  tomas: ["Tomi Criado", "Tomas Criado", "Tomi C"],
  vicky: ["Vicky Puricelli", "Vicky P"],
  acha: ["Victoria Achabal"],
  santi: ["Santi Berisso"],
  sil: ["Sil Vera"],
  pau: ["Paula Setrini"],
};

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildNameIndex(rows: Array<{ id: number; name: string }>): Map<string, number> {
  const index = new Map<string, number>();
  for (const row of rows) {
    const key = normalize(row.name);
    if (!index.has(key)) index.set(key, row.id);
  }
  return index;
}

function resolveOwner(
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

function resolveClientId(accountName: string, clientRows: Array<{ id: number; name: string }>): number | null {
  const normalizedAccount = normalize(accountName);
  const exact = clientRows.find((client) => normalize(client.name) === normalizedAccount);
  if (exact) return exact.id;
  const partial = clientRows.filter((client) => {
    const normalizedClient = normalize(client.name);
    return normalizedClient.includes(normalizedAccount) || normalizedAccount.includes(normalizedClient);
  });
  return partial.length === 1 ? partial[0].id : null;
}

export async function ensureObjectivesPlanSeed(): Promise<void> {
  const plan = OBJECTIVE_PLAN_2026;
  const [personnelRows, clientRows, existingObjectives, existingAccounts, existingActions] = await Promise.all([
    db.select({ id: personnel.id, name: personnel.name }).from(personnel),
    db.select({ id: clients.id, name: clients.name }).from(clients),
    db.select({ id: objectives.id, slug: objectives.slug, year: objectives.year, ownerPersonnelId: objectives.ownerPersonnelId }).from(objectives).where(eq(objectives.year, 2026)),
    db.select({ id: objectiveAccounts.id, name: objectiveAccounts.name, clientId: objectiveAccounts.clientId }).from(objectiveAccounts),
    db.select({ id: objectiveActions.id, slug: objectiveActions.slug, dependencyActionIds: objectiveActions.dependencyActionIds }).from(objectiveActions),
  ]);

  const personnelByName = buildNameIndex(personnelRows);
  const unresolvedOwners = new Set<string>();
  const objectiveBySlug = new Map(existingObjectives.map((row) => [row.slug, row.id]));
  const accountByName = new Map(existingAccounts.map((row) => [normalize(row.name), row]));
  const actionBySlug = new Map(existingActions.map((row) => [row.slug, row]));

  const objectivesToInsert = plan.objectives
    .filter((objective) => !objectiveBySlug.has(objective.slug))
    .map((objective) => ({
      level: objective.level,
      slug: objective.slug,
      year: 2026,
      areaKey: objective.areaKey,
      title: objective.title,
      metric: objective.metric,
      target: objective.target,
      currentValue: null,
      progressPercent: objective.progressPercent,
      status: objective.status,
      ownerPersonnelId: resolveOwner(objective.ownerName, personnelRows, personnelByName, unresolvedOwners),
    }));
  if (objectivesToInsert.length) {
    await db.insert(objectives).values(objectivesToInsert).onConflictDoNothing();
  }

  const objectiveRows = await db.select({ id: objectives.id, slug: objectives.slug }).from(objectives).where(eq(objectives.year, 2026));
  const objectiveIdsBySlug = new Map(objectiveRows.map((row) => [row.slug, row.id]));

  // The plan is the source of truth for strategic ownership. Reconcile rows
  // created by earlier seeds as well as newly inserted rows, otherwise a
  // corrected owner in the source would never reach an existing production
  // record.
  const objectiveRowsWithOwners = await db
    .select({ id: objectives.id, slug: objectives.slug, ownerPersonnelId: objectives.ownerPersonnelId })
    .from(objectives)
    .where(eq(objectives.year, 2026));
  const objectivePlanBySlug = new Map(plan.objectives.map((objective) => [objective.slug, objective]));
  for (const row of objectiveRowsWithOwners) {
    const source = objectivePlanBySlug.get(row.slug);
    if (!source) continue;
    const ownerPersonnelId = resolveOwner(source.ownerName, personnelRows, personnelByName, unresolvedOwners);
    if (row.ownerPersonnelId !== ownerPersonnelId) {
      await db.update(objectives)
        .set({ ownerPersonnelId, updatedAt: new Date() })
        .where(eq(objectives.id, row.id));
    }
  }

  const accountsToInsert = plan.accounts
    .filter((account) => !accountByName.has(normalize(account.name)))
    .map((account) => ({
      name: account.name,
      clientId: resolveClientId(account.name, clientRows),
    }));
  if (accountsToInsert.length) {
    await db.insert(objectiveAccounts).values(accountsToInsert).onConflictDoNothing();
  }

  const accountRows = await db.select({ id: objectiveAccounts.id, name: objectiveAccounts.name, clientId: objectiveAccounts.clientId }).from(objectiveAccounts);
  const accountIdsBySlug = new Map<string, number>();
  for (const account of plan.accounts) {
    const row = accountRows.find((candidate) => normalize(candidate.name) === normalize(account.name));
    if (row) accountIdsBySlug.set(account.slug, row.id);
  }

  const actionsToInsert = plan.actions
    .filter((action) => !actionBySlug.has(action.slug))
    .map((action) => ({
      slug: action.slug,
      objectiveId: action.objectiveSlug ? objectiveIdsBySlug.get(action.objectiveSlug) ?? null : null,
      accountId: action.accountSlug ? accountIdsBySlug.get(action.accountSlug) ?? null : null,
      title: action.title,
      description: action.description ?? null,
      month: MONTH_NUMBERS[action.month] ?? null,
      weekLabel: action.weekLabel,
      weekStart: action.weekStart,
      dueDate: action.dueDate,
      focus: action.focus,
      status: action.status,
      accountableOwnerId: resolveOwner(action.accountableOwnerName, personnelRows, personnelByName, unresolvedOwners),
      evidence: null,
      dependencyActionIds: [],
      sortOrder: action.sortOrder,
    }));
  if (actionsToInsert.length) {
    await db.insert(objectiveActions).values(actionsToInsert).onConflictDoNothing();
  }
  const seededActionSlugs = new Set(actionsToInsert.map((action) => action.slug));

  const actionRows = await db.select({ id: objectiveActions.id, slug: objectiveActions.slug, dependencyActionIds: objectiveActions.dependencyActionIds }).from(objectiveActions);
  const actionIdsBySlug = new Map(actionRows.map((row) => [row.slug, row.id]));

  const ownerRows = plan.actions.flatMap((action) => {
    // Never re-apply the source owners to an action that already exists: a
    // user may have intentionally changed or removed a supporting owner.
    if (!seededActionSlugs.has(action.slug)) return [];
    const actionId = actionIdsBySlug.get(action.slug);
    if (!actionId) return [];
    const owners = new Map<number, "accountable" | "support">();
    const accountable = resolveOwner(action.accountableOwnerName, personnelRows, personnelByName, unresolvedOwners);
    if (accountable != null) owners.set(accountable, "accountable");
    for (const ownerName of action.supportingOwnerNames) {
      const support = resolveOwner(ownerName, personnelRows, personnelByName, unresolvedOwners);
      if (support != null && !owners.has(support)) owners.set(support, "support");
    }
    return [...owners.entries()].map(([personnelId, role]) => ({ actionId, personnelId, role }));
  });
  if (ownerRows.length) {
    await db.insert(objectiveActionOwners).values(ownerRows).onConflictDoNothing();
  }

  // Resolve dependencies only after every action has an ID. Existing actions
  // are left untouched once they contain a dependency list, preserving edits.
  for (const action of plan.actions) {
    if (!action.dependencySlugs.length) continue;
    if (!seededActionSlugs.has(action.slug)) continue;
    const row = actionRows.find((candidate) => candidate.slug === action.slug);
    if (!row || (row.dependencyActionIds?.length ?? 0) > 0) continue;
    const dependencyIds = action.dependencySlugs
      .map((slug) => actionIdsBySlug.get(slug))
      .filter((id): id is number => id != null);
    if (dependencyIds.length) {
      await db.update(objectiveActions)
        .set({ dependencyActionIds: dependencyIds, updatedAt: new Date() })
        .where(eq(objectiveActions.id, row.id));
    }
  }

  if (unresolvedOwners.size) {
    console.warn(`⚠️  Objectives plan owners not found in personnel: ${[...unresolvedOwners].sort().join(", ")}`);
  }
  console.log(`🎯 Objectives plan ready: ${objectiveRows.length} objectives, ${accountRows.length} accounts, ${actionRows.length} actions (${actionsToInsert.length} new).`);
}
