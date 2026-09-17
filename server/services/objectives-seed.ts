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
import { buildNameIndex, normalize, resolveOwner } from "./objective-owner-resolver";
import { RETIRED_OBJECTIVES } from "@shared/objectives-retirement";

const MONTH_NUMBERS: Record<string, number> = {
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

// numeric(14,2) vuelve de Postgres como "655000.00": comparar como texto
// marcaría un cambio en cada arranque.
function numericChanged(stored: string | null, next: string | null): boolean {
  if (stored == null || next == null) return stored !== next;
  return Number(stored) !== Number(next);
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
      targetKind: objective.targetKind,
      targetValue: objective.targetValue != null ? String(objective.targetValue) : null,
      targetUnit: objective.targetUnit,
      targetDate: objective.targetDate,
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
    .select({
      id: objectives.id,
      slug: objectives.slug,
      ownerPersonnelId: objectives.ownerPersonnelId,
      parentObjectiveId: objectives.parentObjectiveId,
      retiredAt: objectives.retiredAt,
      retiredReason: objectives.retiredReason,
      targetKind: objectives.targetKind,
      targetValue: objectives.targetValue,
      targetUnit: objectives.targetUnit,
      targetDate: objectives.targetDate,
    })
    .from(objectives)
    .where(eq(objectives.year, 2026));
  const objectivePlanBySlug = new Map(plan.objectives.map((objective) => [objective.slug, objective]));
  for (const row of objectiveRowsWithOwners) {
    const source = objectivePlanBySlug.get(row.slug);
    if (!source) continue;
    const updates: Record<string, unknown> = {};

    const ownerPersonnelId = resolveOwner(source.ownerName, personnelRows, personnelByName, unresolvedOwners);
    if (row.ownerPersonnelId !== ownerPersonnelId) updates.ownerPersonnelId = ownerPersonnelId;

    // La jerarquía y la lectura de la meta se derivan del plan, que es la
    // fuente. No son campos que se editen desde la pantalla, así que
    // reconciliarlos siempre no pisa ninguna decisión del usuario.
    const parentObjectiveId = source.parentSlug ? objectiveIdsBySlug.get(source.parentSlug) ?? null : null;
    if (row.parentObjectiveId !== parentObjectiveId) updates.parentObjectiveId = parentObjectiveId;

    if (row.targetKind !== source.targetKind) updates.targetKind = source.targetKind;
    const targetValue = source.targetValue != null ? String(source.targetValue) : null;
    if (numericChanged(row.targetValue, targetValue)) updates.targetValue = targetValue;
    if ((row.targetUnit ?? null) !== (source.targetUnit ?? null)) updates.targetUnit = source.targetUnit;
    if ((row.targetDate ?? null) !== (source.targetDate ?? null)) updates.targetDate = source.targetDate;

    // El retiro también se declara en el plan, así que se reconcilia igual que
    // el resto: sacar una entrada de RETIRED_OBJECTIVES la devuelve a la vida.
    const retirement = RETIRED_OBJECTIVES[row.slug] ?? null;
    if (retirement && row.retiredAt == null) {
      updates.retiredAt = new Date();
      updates.retiredReason = retirement.reason;
    } else if (!retirement && row.retiredAt != null) {
      updates.retiredAt = null;
      updates.retiredReason = null;
    } else if (retirement && row.retiredReason !== retirement.reason) {
      updates.retiredReason = retirement.reason;
    }

    if (Object.keys(updates).length) {
      await db.update(objectives)
        .set({ ...updates, updatedAt: new Date() } as typeof objectives.$inferInsert)
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

  const actionRows = await db.select({ id: objectiveActions.id, slug: objectiveActions.slug, accountableOwnerId: objectiveActions.accountableOwnerId, dependencyActionIds: objectiveActions.dependencyActionIds }).from(objectiveActions);
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

  // Actions seeded before the owner aliases were corrected kept an owner the
  // plan never names: "Tomás" fell through to the unrelated Tomas Facio and
  // "Santi" resolved to nobody at all. Repair exactly those rows. An action
  // already owned by somebody the plan does name is left untouched, so a
  // reassignment made from the UI is never reverted.
  const planOwnerIds = new Set<number>();
  const ownersForAction = new Map<string, Map<number, "accountable" | "support">>();
  for (const action of plan.actions) {
    const owners = new Map<number, "accountable" | "support">();
    const accountable = resolveOwner(action.accountableOwnerName, personnelRows, personnelByName, unresolvedOwners);
    if (accountable != null) owners.set(accountable, "accountable");
    for (const ownerName of action.supportingOwnerNames) {
      const support = resolveOwner(ownerName, personnelRows, personnelByName, unresolvedOwners);
      if (support != null && !owners.has(support)) owners.set(support, "support");
    }
    for (const personnelId of owners.keys()) planOwnerIds.add(personnelId);
    ownersForAction.set(action.slug, owners);
  }

  const actionRowById = new Map(actionRows.map((row) => [row.id, row]));
  const staleOwnerRows = await db
    .select({ id: objectiveActionOwners.id, actionId: objectiveActionOwners.actionId, personnelId: objectiveActionOwners.personnelId })
    .from(objectiveActionOwners);
  const repairedActionIds = new Set<number>();

  for (const action of plan.actions) {
    if (seededActionSlugs.has(action.slug)) continue;
    const actionId = actionIdsBySlug.get(action.slug);
    if (actionId == null) continue;
    const stored = actionRowById.get(actionId)?.accountableOwnerId ?? null;
    const [expected] = [...(ownersForAction.get(action.slug) ?? new Map()).entries()]
      .filter(([, role]) => role === "accountable")
      .map(([personnelId]) => personnelId);
    if (expected == null || stored === expected) continue;
    if (stored != null && planOwnerIds.has(stored)) continue;
    await db.update(objectiveActions)
      .set({ accountableOwnerId: expected, updatedAt: new Date() })
      .where(eq(objectiveActions.id, actionId));
    repairedActionIds.add(actionId);
  }

  const planActionIds = new Set(
    plan.actions.map((action) => actionIdsBySlug.get(action.slug)).filter((id): id is number => id != null),
  );
  for (const row of staleOwnerRows) {
    if (!planActionIds.has(row.actionId)) continue;
    if (planOwnerIds.has(row.personnelId)) continue;
    await db.delete(objectiveActionOwners).where(eq(objectiveActionOwners.id, row.id));
    repairedActionIds.add(row.actionId);
  }

  const repairedOwnerRows = plan.actions.flatMap((action) => {
    const actionId = actionIdsBySlug.get(action.slug);
    if (actionId == null || !repairedActionIds.has(actionId)) return [];
    return [...(ownersForAction.get(action.slug) ?? new Map()).entries()]
      .map(([personnelId, role]) => ({ actionId, personnelId, role }));
  });
  if (repairedOwnerRows.length) {
    await db.insert(objectiveActionOwners).values(repairedOwnerRows).onConflictDoNothing();
  }
  if (repairedActionIds.size) {
    console.log(`🎯 Objectives plan: repaired ownership on ${repairedActionIds.size} actions seeded with an unresolved owner.`);
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
