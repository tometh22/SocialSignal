import { Router, type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "./db";
import { requirePermission } from "./middleware/requirePermission";
import {
  clients,
  objectiveAccounts,
  objectiveActionEvents,
  objectiveActionOwners,
  objectiveActions,
  objectives,
  personnel,
  users,
  OBJECTIVE_ACTION_OWNER_ROLES,
  OBJECTIVE_ACTION_STATUSES,
} from "@shared/schema";

type RequireAuth = (req: Request, res: Response, next: NextFunction) => unknown;

const objectiveOwner = alias(personnel, "objective_owner_personnel");
const actionAccountableOwner = alias(personnel, "action_accountable_owner");
const eventActor = alias(users, "objective_event_actor");

const idSchema = z.coerce.number().int().positive();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD").nullable().optional();
const actionStatusSchema = z
  .enum([...OBJECTIVE_ACTION_STATUSES, "pending"] as const)
  .transform((status) => status === "pending" ? "planned" : status);
const actionOwnerSchema = z.object({
  personnelId: idSchema,
  role: z.enum(OBJECTIVE_ACTION_OWNER_ROLES),
});
const actionSlugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug inválido");

const actionFieldsSchema = z.object({
  objectiveId: idSchema.nullable().optional(),
  accountId: idSchema.nullable().optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(10000).nullable().optional(),
  month: z.number().int().min(1).max(12).nullable().optional(),
  weekLabel: z.string().trim().max(80).nullable().optional(),
  weekStart: dateSchema,
  dueDate: dateSchema,
  focus: z.string().trim().max(120).nullable().optional(),
  status: actionStatusSchema.optional(),
  accountableOwnerId: idSchema.nullable().optional(),
  // Name is accepted for the existing Status UI; IDs remain the canonical API form.
  accountableOwner: z.union([idSchema, z.string().trim().min(1).max(255)]).nullable().optional(),
  evidence: z.string().max(20000).nullable().optional(),
  dependencyActionIds: z.array(idSchema).max(200).optional(),
  sortOrder: z.number().int().min(-100000).max(100000).optional(),
  owners: z.array(actionOwnerSchema).max(20).optional(),
});

const createActionSchema = actionFieldsSchema.extend({
  slug: actionSlugSchema.optional(),
});

const patchActionSchema = actionFieldsSchema.extend({
  note: z.string().max(5000).nullable().optional(),
}).partial();

const patchObjectiveSchema = z.object({
  areaKey: z.string().trim().max(80).nullable().optional(),
  title: z.string().trim().min(1).max(255).optional(),
  metric: z.string().max(10000).nullable().optional(),
  target: z.union([z.string().trim(), z.number().transform(String)]).nullable().optional(),
  currentValue: z.union([z.string().trim(), z.number().transform(String)]).nullable().optional(),
  progressPercent: z.number().min(0).max(100).nullable().optional(),
  status: z.string().trim().min(1).max(30).optional(),
  ownerPersonnelId: idSchema.nullable().optional(),
}).strict();

function parseId(value: string, label: string): number {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${label} inválido`);
  return parsed.data;
}

function uniqueIds(values: number[]): number[] {
  return [...new Set(values)];
}

function slugifyActionTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 145);
  return `${slug || "accion"}-${randomUUID().slice(0, 8)}`;
}

function normalizeOwners(
  owners: Array<{ personnelId: number; role: "accountable" | "support" }> | undefined,
  accountableOwnerId: number | null | undefined,
) {
  const supplied = owners ?? [];
  const accountable = supplied.filter((owner) => owner.role === "accountable");
  if (accountable.length > 1) {
    throw new Error("Una acción no puede tener más de un accountable owner");
  }
  if (
    accountableOwnerId != null &&
    accountable[0] &&
    accountable[0].personnelId !== accountableOwnerId
  ) {
    throw new Error("accountableOwnerId debe coincidir con el owner de rol accountable");
  }

  const directAccountable = accountableOwnerId ?? accountable[0]?.personnelId ?? null;
  const result = new Map<string, { personnelId: number; role: "accountable" | "support" }>();
  for (const owner of supplied) result.set(`${owner.personnelId}:${owner.role}`, owner);
  if (directAccountable != null) {
    result.set(`${directAccountable}:accountable`, {
      personnelId: directAccountable,
      role: "accountable",
    });
  }
  return { accountableOwnerId: directAccountable, owners: [...result.values()] };
}

async function assertReferences(
  values: {
    objectiveId?: number | null;
    accountId?: number | null;
    personnelIds?: number[];
    dependencyActionIds?: number[];
  },
  executor: any = db,
) {
  if (values.objectiveId != null) {
    const rows = await executor.select({ id: objectives.id }).from(objectives).where(eq(objectives.id, values.objectiveId)).limit(1);
    if (!rows.length) throw new Error("El objetivo indicado no existe");
  }
  if (values.accountId != null) {
    const rows = await executor.select({ id: objectiveAccounts.id }).from(objectiveAccounts).where(eq(objectiveAccounts.id, values.accountId)).limit(1);
    if (!rows.length) throw new Error("La cuenta indicada no existe");
  }
  const personnelIds = uniqueIds(values.personnelIds ?? []);
  if (personnelIds.length) {
    const rows = await executor.select({ id: personnel.id }).from(personnel).where(inArray(personnel.id, personnelIds));
    if (rows.length !== personnelIds.length) throw new Error("Uno o más owners no existen");
  }
  const dependencyIds = uniqueIds(values.dependencyActionIds ?? []);
  if (dependencyIds.length) {
    const rows = await executor.select({ id: objectiveActions.id }).from(objectiveActions).where(inArray(objectiveActions.id, dependencyIds));
    if (rows.length !== dependencyIds.length) throw new Error("Una o más acciones dependientes no existen");
  }
}

async function resolvePersonnelReference(value: number | string | null | undefined, executor: any = db): Promise<number | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const asId = idSchema.safeParse(value);
  if (asId.success) return asId.data;
  const ownerName = String(value);
  const rows = await executor
    .select({ id: personnel.id })
    .from(personnel)
    .where(eq(personnel.name, ownerName))
    .limit(2);
  if (rows.length === 0) throw new Error("El owner indicado no existe");
  if (rows.length > 1) throw new Error("El nombre del owner no es único; usá accountableOwnerId");
  return rows[0].id;
}

function currentWeekStart(actions: Array<{ weekStart: string | null; dueDate: string | null }>): string {
  const today = new Date().toISOString().slice(0, 10);
  const planWeeks = actions
    .map((action) => ({
      weekStart: action.weekStart ? String(action.weekStart).slice(0, 10) : null,
      dueDate: action.dueDate ? String(action.dueDate).slice(0, 10) : null,
    }))
    .filter((action) => action.weekStart && action.weekStart <= today && (!action.dueDate || action.dueDate >= today))
    .map((action) => action.weekStart as string)
    .sort();
  if (planWeeks.length) return planWeeks[planWeeks.length - 1];

  // Keep a useful fallback outside the seeded plan (e.g. before September).
  const fallbackDate = new Date();
  const day = fallbackDate.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  fallbackDate.setUTCDate(fallbackDate.getUTCDate() - daysSinceMonday);
  return fallbackDate.toISOString().slice(0, 10);
}

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Datos inválidos", errors: error.flatten() });
  }
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("no existe") ||
    message.includes("inválido") ||
    message.includes("owner") ||
    message.includes("dependientes")
  ) {
    return res.status(400).json({ message });
  }
  console.error(fallback, error);
  return res.status(500).json({ message: fallback });
}

export function createObjectivesRouter(requireAuth: RequireAuth): Router {
  const router = Router();

  // Objectives are part of Status. Keep both checks at the router boundary so
  // every present and future endpoint under /api/objectives is protected.
  router.use(requireAuth, requirePermission("status"));

  router.get("/objectives", async (req: Request, res: Response) => {
    try {
      const yearResult = z.coerce.number().int().min(2000).max(2100).default(2026).safeParse(req.query.year);
      if (!yearResult.success) return res.status(400).json({ message: "year debe ser un año válido" });
      const year = yearResult.data;

      const [objectiveRows, actionRows, accountRows, ownerRows] = await Promise.all([
        db.select({
          id: objectives.id,
          level: objectives.level,
          slug: objectives.slug,
          year: objectives.year,
          areaKey: objectives.areaKey,
          title: objectives.title,
          metric: objectives.metric,
          target: objectives.target,
          targetKind: objectives.targetKind,
          targetValue: objectives.targetValue,
          targetUnit: objectives.targetUnit,
          targetDate: objectives.targetDate,
          currentValue: objectives.currentValue,
          progressPercent: objectives.progressPercent,
          status: objectives.status,
          ownerPersonnelId: objectives.ownerPersonnelId,
          ownerName: objectiveOwner.name,
          parentObjectiveId: objectives.parentObjectiveId,
          createdAt: objectives.createdAt,
          updatedAt: objectives.updatedAt,
        })
          .from(objectives)
          .leftJoin(objectiveOwner, eq(objectives.ownerPersonnelId, objectiveOwner.id))
          .where(eq(objectives.year, year))
          .orderBy(asc(objectives.level), asc(objectives.id)),
        db.select({
          id: objectiveActions.id,
          slug: objectiveActions.slug,
          objectiveId: objectiveActions.objectiveId,
          objectiveTitle: objectives.title,
          objectiveSlug: objectives.slug,
          accountId: objectiveActions.accountId,
          accountName: objectiveAccounts.name,
          clientId: objectiveAccounts.clientId,
          clientName: clients.name,
          title: objectiveActions.title,
          description: objectiveActions.description,
          month: objectiveActions.month,
          weekLabel: objectiveActions.weekLabel,
          weekStart: objectiveActions.weekStart,
          dueDate: objectiveActions.dueDate,
          focus: objectiveActions.focus,
          status: objectiveActions.status,
          accountableOwnerId: objectiveActions.accountableOwnerId,
          accountableOwnerName: actionAccountableOwner.name,
          evidence: objectiveActions.evidence,
          dependencyActionIds: objectiveActions.dependencyActionIds,
          sortOrder: objectiveActions.sortOrder,
          createdAt: objectiveActions.createdAt,
          updatedAt: objectiveActions.updatedAt,
        })
          .from(objectiveActions)
          .leftJoin(objectives, eq(objectiveActions.objectiveId, objectives.id))
          .leftJoin(objectiveAccounts, eq(objectiveActions.accountId, objectiveAccounts.id))
          .leftJoin(clients, eq(objectiveAccounts.clientId, clients.id))
          .leftJoin(actionAccountableOwner, eq(objectiveActions.accountableOwnerId, actionAccountableOwner.id))
          .where(or(eq(objectives.year, year), isNull(objectiveActions.objectiveId)))
          .orderBy(asc(objectiveActions.month), asc(objectiveActions.weekStart), asc(objectiveActions.sortOrder), asc(objectiveActions.id)),
        db.select({
          id: objectiveAccounts.id,
          name: objectiveAccounts.name,
          clientId: objectiveAccounts.clientId,
          clientName: clients.name,
          createdAt: objectiveAccounts.createdAt,
          updatedAt: objectiveAccounts.updatedAt,
        })
          .from(objectiveAccounts)
          .leftJoin(clients, eq(objectiveAccounts.clientId, clients.id))
          .orderBy(asc(objectiveAccounts.name)),
        db.select({
          id: personnel.id,
          name: personnel.name,
          email: personnel.email,
          area: personnel.area,
          currentRole: personnel.currentRole,
          activeUntil: personnel.activeUntil,
        })
          .from(personnel)
          .orderBy(asc(personnel.name)),
      ]);

      const actionIds = actionRows.map((row) => row.id);
      const [ownerRowsByAction, eventRows] = await Promise.all([
        actionIds.length
          ? db.select({
              actionId: objectiveActionOwners.actionId,
              personnelId: objectiveActionOwners.personnelId,
              role: objectiveActionOwners.role,
              personnelName: personnel.name,
              personnelEmail: personnel.email,
            })
              .from(objectiveActionOwners)
              .innerJoin(personnel, eq(objectiveActionOwners.personnelId, personnel.id))
              .where(inArray(objectiveActionOwners.actionId, actionIds))
              .orderBy(asc(objectiveActionOwners.actionId), asc(personnel.name))
          : [],
        actionIds.length
          ? db.select({
              id: objectiveActionEvents.id,
              actionId: objectiveActionEvents.actionId,
              userId: objectiveActionEvents.userId,
              userName: eventActor.firstName,
              userLastName: eventActor.lastName,
              fromStatus: objectiveActionEvents.fromStatus,
              toStatus: objectiveActionEvents.toStatus,
              note: objectiveActionEvents.note,
              createdAt: objectiveActionEvents.createdAt,
            })
              .from(objectiveActionEvents)
              .innerJoin(eventActor, eq(objectiveActionEvents.userId, eventActor.id))
              .where(inArray(objectiveActionEvents.actionId, actionIds))
              .orderBy(desc(objectiveActionEvents.createdAt))
          : [],
      ]);

      const ownersByAction = new Map<number, typeof ownerRowsByAction>();
      for (const row of ownerRowsByAction) {
        const current = ownersByAction.get(row.actionId) ?? [];
        current.push(row);
        ownersByAction.set(row.actionId, current);
      }
      const eventsByAction = new Map<number, typeof eventRows>();
      for (const row of eventRows) {
        const current = eventsByAction.get(row.actionId) ?? [];
        current.push(row);
        eventsByAction.set(row.actionId, current);
      }

      const responseObjectives = objectiveRows.map(({ ownerName, ...objective }) => ({
        ...objective,
        owner: objective.ownerPersonnelId ? { id: objective.ownerPersonnelId, name: ownerName } : null,
      }));
      const responseActions = actionRows.map((row) => {
        const owners = ownersByAction.get(row.id) ?? [];
        const accountableOwner = row.accountableOwnerId
          ? { id: row.accountableOwnerId, name: row.accountableOwnerName }
          : null;
        return {
        ...row,
        accountableOwner,
        supportingOwners: owners.filter((owner) => owner.role === "support").map((owner) => ({
          id: owner.personnelId,
          name: owner.personnelName,
          email: owner.personnelEmail,
        })),
        owners,
        events: (eventsByAction.get(row.id) ?? []).map((event) => ({
          ...event,
          userName: [event.userName, event.userLastName].filter(Boolean).join(" "),
        })),
        };
      });

      const actionStatusCounts = Object.fromEntries(OBJECTIVE_ACTION_STATUSES.map((status) => [
        status,
        responseActions.filter((action) => action.status === status).length,
      ]));
      const doneActions = Number(actionStatusCounts.done ?? 0);
      const summary = {
        year,
        objectiveCount: responseObjectives.length,
        actionCount: responseActions.length,
        completedActionCount: doneActions,
        totalObjectives: responseObjectives.length,
        totalActions: responseActions.length,
        completedActions: doneActions,
        atRiskObjectives: responseObjectives.filter((objective) => ["blocked", "at_risk"].includes(objective.status)).length,
        currentWeekStart: currentWeekStart(actionRows),
        completionPercent: responseActions.length ? Math.round((doneActions / responseActions.length) * 100) : 0,
        actionStatusCounts,
        objectiveLevelCounts: Object.fromEntries(
          ["company", "area", "person"].map((level) => [level, responseObjectives.filter((objective) => objective.level === level).length]),
        ),
      };

      res.json({
        objectives: responseObjectives,
        actions: responseActions,
        accounts: accountRows,
        owners: ownerRows,
        summary,
      });
    } catch (error) {
      handleError(res, error, "No se pudieron cargar los objetivos");
    }
  });

  router.post("/objectives/actions", async (req: Request, res: Response) => {
    try {
      const input = createActionSchema.parse(req.body);
      const nameOrIdOwner = await resolvePersonnelReference(input.accountableOwner, db);
      if (input.accountableOwnerId != null && nameOrIdOwner != null && input.accountableOwnerId !== nameOrIdOwner) {
        throw new Error("accountableOwner y accountableOwnerId deben referir al mismo owner");
      }
      const normalized = normalizeOwners(input.owners, input.accountableOwnerId ?? nameOrIdOwner);
      const personnelIds = normalized.owners.map((owner) => owner.personnelId);

      const created = await db.transaction(async (tx) => {
        await assertReferences({
          objectiveId: input.objectiveId,
          accountId: input.accountId,
          personnelIds,
          dependencyActionIds: input.dependencyActionIds,
        }, tx);
        const [action] = await tx.insert(objectiveActions).values({
          slug: input.slug ?? slugifyActionTitle(input.title),
          objectiveId: input.objectiveId ?? null,
          accountId: input.accountId ?? null,
          title: input.title,
          description: input.description ?? null,
          month: input.month ?? null,
          weekLabel: input.weekLabel ?? null,
          weekStart: input.weekStart ?? null,
          dueDate: input.dueDate ?? null,
          focus: input.focus ?? null,
          status: input.status ?? "planned",
          accountableOwnerId: normalized.accountableOwnerId,
          evidence: input.evidence ?? null,
          dependencyActionIds: uniqueIds(input.dependencyActionIds ?? []),
          sortOrder: input.sortOrder ?? 0,
        }).returning();

        if (normalized.owners.length) {
          await tx.insert(objectiveActionOwners).values(
            normalized.owners.map((owner) => ({
              actionId: action.id,
              personnelId: owner.personnelId,
              role: owner.role,
            })),
          );
        }
        return { action, owners: normalized.owners };
      });

      res.status(201).json(created);
    } catch (error) {
      handleError(res, error, "No se pudo crear la acción");
    }
  });

  router.patch("/objectives/actions/:id", async (req: Request, res: Response) => {
    try {
      const actionId = parseId(req.params.id, "id");
      const input = patchActionSchema.parse(req.body);
      const [existing] = await db.select().from(objectiveActions).where(eq(objectiveActions.id, actionId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Acción no encontrada" });

      const hasOwners = Object.prototype.hasOwnProperty.call(input, "owners");
      const nameOrIdOwner = await resolvePersonnelReference(input.accountableOwner, db);
      if (input.accountableOwnerId != null && nameOrIdOwner != null && input.accountableOwnerId !== nameOrIdOwner) {
        throw new Error("accountableOwner y accountableOwnerId deben referir al mismo owner");
      }
      const normalized = hasOwners
        ? normalizeOwners(input.owners, input.accountableOwnerId ?? nameOrIdOwner ?? existing.accountableOwnerId)
        : {
            accountableOwnerId: input.accountableOwnerId ?? nameOrIdOwner ?? existing.accountableOwnerId,
            owners: [],
          };
      const personnelIds = normalized.owners.map((owner) => owner.personnelId);
      const dependencyActionIds = input.dependencyActionIds ?? (existing.dependencyActionIds as number[]);

      const updated = await db.transaction(async (tx) => {
        await assertReferences({
          objectiveId: input.objectiveId ?? existing.objectiveId,
          accountId: input.accountId ?? existing.accountId,
          personnelIds,
          dependencyActionIds,
        }, tx);

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        const fields = [
          "objectiveId", "accountId", "title", "description", "month", "weekLabel", "weekStart",
          "dueDate", "focus", "status", "accountableOwnerId", "evidence", "dependencyActionIds", "sortOrder",
        ] as const;
        for (const field of fields) {
          if (Object.prototype.hasOwnProperty.call(input, field)) {
            const value = input[field];
            updates[field] = field === "dependencyActionIds" ? uniqueIds(value as number[]) : value;
          }
        }
        if (Object.prototype.hasOwnProperty.call(input, "accountableOwner")) {
          updates.accountableOwnerId = normalized.accountableOwnerId;
        }
        if (hasOwners) updates.accountableOwnerId = normalized.accountableOwnerId;

        const [action] = await tx.update(objectiveActions)
          .set(updates as typeof objectiveActions.$inferInsert)
          .where(eq(objectiveActions.id, actionId))
          .returning();

        if (hasOwners) {
          await tx.delete(objectiveActionOwners).where(eq(objectiveActionOwners.actionId, actionId));
          if (normalized.owners.length) {
            await tx.insert(objectiveActionOwners).values(
              normalized.owners.map((owner) => ({
                actionId,
                personnelId: owner.personnelId,
                role: owner.role,
              })),
            );
          }
        }

        if (input.status && input.status !== existing.status) {
          await tx.insert(objectiveActionEvents).values({
            actionId,
            userId: req.user!.id,
            fromStatus: existing.status,
            toStatus: input.status,
            note: input.note ?? null,
          });
        }

        return { action, owners: hasOwners ? normalized.owners : undefined };
      });

      res.json(updated);
    } catch (error) {
      handleError(res, error, "No se pudo actualizar la acción");
    }
  });

  // Cargar avance de a uno, con el objetivo escondido detrás de tres clics, no
  // lo hace nadie: por eso los 87 objetivos estaban sin medir. Este endpoint
  // recibe la tanda entera y la aplica en una transacción.
  const bulkProgressSchema = z.object({
    updates: z.array(z.object({
      id: idSchema,
      currentValue: z.string().trim().max(120).nullable().optional(),
      progressPercent: z.number().min(0).max(100).nullable().optional(),
    })).min(1).max(500),
  });

  router.patch("/objectives/progress", async (req: Request, res: Response) => {
    try {
      const { updates } = bulkProgressSchema.parse(req.body);
      const ids = [...new Set(updates.map((update) => update.id))];
      const existing = await db.select({ id: objectives.id }).from(objectives).where(inArray(objectives.id, ids));
      const known = new Set(existing.map((row) => row.id));
      const missing = ids.filter((id) => !known.has(id));
      if (missing.length) {
        return res.status(404).json({ message: `No se encontraron estos objetivos: ${missing.join(", ")}` });
      }

      const saved = await db.transaction(async (tx) => {
        let count = 0;
        for (const update of updates) {
          const patch: Record<string, unknown> = { updatedAt: new Date() };
          if (Object.prototype.hasOwnProperty.call(update, "currentValue")) patch.currentValue = update.currentValue ?? null;
          if (Object.prototype.hasOwnProperty.call(update, "progressPercent")) patch.progressPercent = update.progressPercent ?? null;
          if (Object.keys(patch).length === 1) continue;
          await tx.update(objectives).set(patch as typeof objectives.$inferInsert).where(eq(objectives.id, update.id));
          count += 1;
        }
        return count;
      });

      res.json({ updated: saved });
    } catch (error) {
      handleError(res, error, "No se pudo guardar el avance");
    }
  });

  router.patch("/objectives/:id", async (req: Request, res: Response) => {
    try {
      const objectiveId = parseId(req.params.id, "id");
      const input = patchObjectiveSchema.parse(req.body);
      const [existing] = await db.select().from(objectives).where(eq(objectives.id, objectiveId)).limit(1);
      if (!existing) return res.status(404).json({ message: "Objetivo no encontrado" });

      if (input.ownerPersonnelId != null) {
        const owner = await db.select({ id: personnel.id }).from(personnel).where(eq(personnel.id, input.ownerPersonnelId)).limit(1);
        if (!owner.length) return res.status(400).json({ message: "El owner del objetivo no existe" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      for (const field of ["areaKey", "title", "metric", "target", "currentValue", "progressPercent", "status", "ownerPersonnelId"] as const) {
        if (Object.prototype.hasOwnProperty.call(input, field)) updates[field] = input[field];
      }
      const [objective] = await db.update(objectives)
        .set(updates as typeof objectives.$inferInsert)
        .where(eq(objectives.id, objectiveId))
        .returning();

      res.json({ objective });
    } catch (error) {
      handleError(res, error, "No se pudo actualizar el objetivo");
    }
  });

  return router;
}
