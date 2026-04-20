import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "./db";
import { storage } from "./storage";
import {
  reviewRooms,
  reviewRoomMembers,
  projectStatusReviews,
  projectReviewNotes,
  weeklyStatusItems,
  statusChangeLog,
  statusUpdateEntries,
  activeProjects,
  clients,
  quotations,
  users,
  insertReviewRoomSchema,
} from "@shared/schema";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireRoomMember } from "./middleware/requireRoomMember";

type RequireAuth = (req: Request, res: Response, next: NextFunction) => any;

async function resolveAuthorId(req: Request): Promise<number | null> {
  let userId: number | null = (req.session as any)?.userId ?? req.user?.id ?? null;
  if (userId) return userId;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Session ')) {
    const tokenId = authHeader.slice(8).trim();
    if (tokenId) {
      userId = await new Promise<number | null>((resolve) => {
        storage.sessionStore.get(tokenId, (err: any, data: any) => {
          resolve(err || !data ? null : data.userId ?? null);
        });
      });
    }
  }
  return userId;
}

const VALID_HEALTH = ['verde', 'amarillo', 'rojo'] as const;
const VALID_LEVEL = ['alto', 'medio', 'bajo'] as const;
const VALID_DECISION = ['ninguna', 'priorizacion', 'recursos', 'reprecio', 'salida'] as const;

export function createReviewRoomsRouter(requireAuth: RequireAuth): Router {
  const router = Router();

  // ═══════════════════════════════════════════════════════════════════════════
  // Room CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/reviews — rooms the current user belongs to
  router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const rows = await db
        .select({
          id: reviewRooms.id,
          name: reviewRooms.name,
          description: reviewRooms.description,
          colorIndex: reviewRooms.colorIndex,
          emoji: reviewRooms.emoji,
          privacy: reviewRooms.privacy,
          createdBy: reviewRooms.createdBy,
          archivedAt: reviewRooms.archivedAt,
          createdAt: reviewRooms.createdAt,
          updatedAt: reviewRooms.updatedAt,
          myRole: reviewRoomMembers.role,
          lastVisitedAt: reviewRoomMembers.lastVisitedAt,
          memberCount: sql<number>`(SELECT COUNT(*)::int FROM ${reviewRoomMembers} rm WHERE rm.room_id = ${reviewRooms.id})`,
          pendingCount: sql<number>`(
            COALESCE((SELECT COUNT(*)::int FROM ${projectStatusReviews} WHERE room_id = ${reviewRooms.id} AND decision_needed <> 'ninguna'), 0)
            + COALESCE((SELECT COUNT(*)::int FROM ${weeklyStatusItems} WHERE room_id = ${reviewRooms.id} AND decision_needed <> 'ninguna'), 0)
          )`,
          lastActivityAt: sql<string | null>`GREATEST(
            ${reviewRooms.updatedAt},
            COALESCE((SELECT MAX(updated_at) FROM ${projectStatusReviews} WHERE room_id = ${reviewRooms.id}), ${reviewRooms.createdAt}),
            COALESCE((SELECT MAX(updated_at) FROM ${weeklyStatusItems}    WHERE room_id = ${reviewRooms.id}), ${reviewRooms.createdAt}),
            COALESCE((SELECT MAX(created_at) FROM ${projectReviewNotes}   WHERE room_id = ${reviewRooms.id}), ${reviewRooms.createdAt})
          )`,
        })
        .from(reviewRooms)
        .innerJoin(reviewRoomMembers, and(
          eq(reviewRoomMembers.roomId, reviewRooms.id),
          eq(reviewRoomMembers.userId, userId),
        ))
        .where(isNull(reviewRooms.archivedAt))
        .orderBy(
          desc(sql`COALESCE(${reviewRoomMembers.lastVisitedAt}, ${reviewRooms.createdAt})`),
        );

      res.setHeader('Cache-Control', 'no-store');
      res.json(rows);
    } catch (error) {
      console.error('GET /api/reviews error:', error);
      res.status(500).json({ message: "Error al obtener salas" });
    }
  });

  // POST /api/reviews — create room
  router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = insertReviewRoomSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Datos inválidos", details: parsed.error.issues });
      }
      const memberIds: number[] = Array.isArray(req.body?.memberIds)
        ? req.body.memberIds.filter((n: any) => Number.isFinite(n) && n !== req.user!.id)
        : [];

      const userId = req.user!.id;
      const [room] = await db.insert(reviewRooms).values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        colorIndex: parsed.data.colorIndex ?? 0,
        emoji: parsed.data.emoji ?? null,
        privacy: 'members',
        createdBy: userId,
      }).returning();

      await db.insert(reviewRoomMembers).values({
        roomId: room.id,
        userId,
        role: 'owner',
        addedBy: userId,
      });

      if (memberIds.length > 0) {
        await db.insert(reviewRoomMembers).values(
          memberIds.map((mid: number) => ({
            roomId: room.id,
            userId: mid,
            role: 'editor' as const,
            addedBy: userId,
          })),
        ).onConflictDoNothing();
      }

      res.status(201).json(room);
    } catch (error: any) {
      console.error(`POST /api/reviews error (userId=${req.user?.id}, body=${JSON.stringify(req.body)}):`, error);
      const msg = error?.message?.includes('unique') ? 'Ya existe una sala con ese nombre' :
                  error?.message?.includes('violates') ? `Error de BD: ${error.message}` :
                  'Error al crear sala';
      res.status(500).json({ message: msg });
    }
  });

  // GET /api/reviews/:roomId — room detail with members
  router.get('/:roomId', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const [room] = await db.select().from(reviewRooms).where(eq(reviewRooms.id, roomId));
      const members = await db
        .select({
          userId: reviewRoomMembers.userId,
          role: reviewRoomMembers.role,
          addedAt: reviewRoomMembers.addedAt,
          lastVisitedAt: reviewRoomMembers.lastVisitedAt,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          avatar: users.avatar,
        })
        .from(reviewRoomMembers)
        .leftJoin(users, eq(users.id, reviewRoomMembers.userId))
        .where(eq(reviewRoomMembers.roomId, roomId))
        .orderBy(asc(users.firstName));

      res.json({ ...room, members, myRole: req.roomMember!.role });
    } catch (error) {
      console.error('GET /api/reviews/:roomId error:', error);
      res.status(500).json({ message: "Error al obtener sala" });
    }
  });

  // PATCH /api/reviews/:roomId — edit (owner only)
  router.patch('/:roomId', requireAuth, requireRoomMember('owner'), async (req: Request, res: Response) => {
    try {
      const { name, description, colorIndex, emoji } = req.body ?? {};
      const update: Record<string, any> = { updatedAt: new Date() };
      if (typeof name === 'string' && name.trim()) update.name = name.trim();
      if (description !== undefined) update.description = typeof description === 'string' ? description.trim() : null;
      if (Number.isFinite(colorIndex)) update.colorIndex = colorIndex;
      if (emoji !== undefined) update.emoji = typeof emoji === 'string' ? emoji.trim() || null : null;

      const [row] = await db.update(reviewRooms).set(update).where(eq(reviewRooms.id, req.roomMember!.roomId)).returning();
      res.json(row);
    } catch (error) {
      console.error('PATCH /api/reviews/:roomId error:', error);
      res.status(500).json({ message: "Error al actualizar sala" });
    }
  });

  // DELETE /api/reviews/:roomId — soft delete
  router.delete('/:roomId', requireAuth, requireRoomMember('owner'), async (req: Request, res: Response) => {
    try {
      await db.update(reviewRooms).set({ archivedAt: new Date() }).where(eq(reviewRooms.id, req.roomMember!.roomId));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Error al archivar sala" });
    }
  });

  // POST /api/reviews/:roomId/visit — mark visited
  router.post('/:roomId/visit', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      await db
        .update(reviewRoomMembers)
        .set({ lastVisitedAt: new Date() })
        .where(and(
          eq(reviewRoomMembers.roomId, req.roomMember!.roomId),
          eq(reviewRoomMembers.userId, req.user!.id),
        ));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Error al marcar visita" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Member management
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/:roomId/members', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const members = await db
        .select({
          userId: reviewRoomMembers.userId,
          role: reviewRoomMembers.role,
          addedAt: reviewRoomMembers.addedAt,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          avatar: users.avatar,
        })
        .from(reviewRoomMembers)
        .leftJoin(users, eq(users.id, reviewRoomMembers.userId))
        .where(eq(reviewRoomMembers.roomId, req.roomMember!.roomId))
        .orderBy(asc(users.firstName));
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener miembros" });
    }
  });

  router.post('/:roomId/members', requireAuth, requireRoomMember('owner'), async (req: Request, res: Response) => {
    try {
      const { userId, role } = req.body ?? {};
      const uid = parseInt(userId, 10);
      if (!Number.isFinite(uid)) return res.status(400).json({ message: "userId inválido" });
      const normalizedRole = role === 'owner' ? 'owner' : 'editor';

      await db.insert(reviewRoomMembers).values({
        roomId: req.roomMember!.roomId,
        userId: uid,
        role: normalizedRole,
        addedBy: req.user!.id,
      }).onConflictDoUpdate({
        target: [reviewRoomMembers.roomId, reviewRoomMembers.userId],
        set: { role: normalizedRole },
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error('POST /members error:', error);
      res.status(500).json({ message: "Error al agregar miembro" });
    }
  });

  router.patch('/:roomId/members/:userId', requireAuth, requireRoomMember('owner'), async (req: Request, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId, 10);
      const { role } = req.body ?? {};
      const normalizedRole = role === 'owner' ? 'owner' : 'editor';
      await db.update(reviewRoomMembers)
        .set({ role: normalizedRole })
        .where(and(eq(reviewRoomMembers.roomId, req.roomMember!.roomId), eq(reviewRoomMembers.userId, targetId)));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar miembro" });
    }
  });

  router.delete('/:roomId/members/:userId', requireAuth, requireRoomMember('owner'), async (req: Request, res: Response) => {
    try {
      const targetId = parseInt(req.params.userId, 10);
      const roomId = req.roomMember!.roomId;

      // Refuse to remove the last owner
      const owners = await db.select({ userId: reviewRoomMembers.userId })
        .from(reviewRoomMembers)
        .where(and(eq(reviewRoomMembers.roomId, roomId), eq(reviewRoomMembers.role, 'owner')));
      if (owners.length <= 1 && owners.some(o => o.userId === targetId)) {
        return res.status(400).json({ message: "No podés quitar al último owner de la sala" });
      }

      await db.delete(reviewRoomMembers)
        .where(and(eq(reviewRoomMembers.roomId, roomId), eq(reviewRoomMembers.userId, targetId)));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Error al quitar miembro" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Board: items (projects + custom)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/reviews/:roomId/items — project rows in the room
  router.get('/:roomId/items', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const includeHidden = req.query.includeHidden === 'true';

      const rows = await db
        .select({
          projectId: activeProjects.id,
          status: activeProjects.status,
          quotationId: activeProjects.quotationId,
          clientId: activeProjects.clientId,
          clientName: clients.name,
          quotationName: quotations.projectName,
          trackingFrequency: activeProjects.trackingFrequency,
          startDate: activeProjects.startDate,
          expectedEndDate: activeProjects.expectedEndDate,
          reviewId: projectStatusReviews.id,
          healthStatus: projectStatusReviews.healthStatus,
          marginStatus: projectStatusReviews.marginStatus,
          teamStrain: projectStatusReviews.teamStrain,
          mainRisk: projectStatusReviews.mainRisk,
          currentAction: projectStatusReviews.currentAction,
          nextMilestone: projectStatusReviews.nextMilestone,
          nextMilestoneDate: projectStatusReviews.nextMilestoneDate,
          deadline: projectStatusReviews.deadline,
          ownerId: projectStatusReviews.ownerId,
          decisionNeeded: projectStatusReviews.decisionNeeded,
          hiddenFromWeekly: projectStatusReviews.hiddenFromWeekly,
          reviewUpdatedAt: projectStatusReviews.updatedAt,
          reviewUpdatedBy: projectStatusReviews.updatedBy,
          noteCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${projectReviewNotes} WHERE ${projectReviewNotes.projectId} = ${activeProjects.id} AND ${projectReviewNotes.roomId} = ${roomId}), 0)`,
          ownerName: sql<string | null>`(SELECT ${users.firstName} || ' ' || ${users.lastName} FROM ${users} WHERE ${users.id} = ${projectStatusReviews.ownerId})`,
          reviewUpdatedByName: sql<string | null>`(SELECT ${users.firstName} || ' ' || ${users.lastName} FROM ${users} WHERE ${users.id} = ${projectStatusReviews.updatedBy})`,
        })
        .from(projectStatusReviews)
        .innerJoin(activeProjects, eq(activeProjects.id, projectStatusReviews.projectId))
        .leftJoin(clients, eq(clients.id, activeProjects.clientId))
        .leftJoin(quotations, eq(quotations.id, activeProjects.quotationId))
        .where(and(
          eq(projectStatusReviews.roomId, roomId),
          ...(includeHidden ? [] : [sql`(${projectStatusReviews.hiddenFromWeekly} IS NOT TRUE)`]),
        ))
        .orderBy(asc(clients.name));

      res.setHeader('Cache-Control', 'no-store');
      res.json(rows);
    } catch (error) {
      console.error('GET /items error:', error);
      res.status(500).json({ message: "Error al obtener ítems" });
    }
  });

  // GET /api/reviews/:roomId/available-projects — active projects NOT yet in this room
  router.get('/:roomId/available-projects', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const rows = await db
        .select({
          projectId: activeProjects.id,
          clientName: clients.name,
          quotationName: quotations.projectName,
        })
        .from(activeProjects)
        .leftJoin(clients, eq(clients.id, activeProjects.clientId))
        .leftJoin(quotations, eq(quotations.id, activeProjects.quotationId))
        .where(and(
          eq(activeProjects.status, 'active'),
          eq(activeProjects.isFinished, false),
          sql`NOT EXISTS (SELECT 1 FROM ${projectStatusReviews} WHERE ${projectStatusReviews.projectId} = ${activeProjects.id} AND ${projectStatusReviews.roomId} = ${roomId})`,
        ))
        .orderBy(asc(clients.name));
      res.setHeader('Cache-Control', 'no-store');
      res.json(rows);
    } catch (error) {
      console.error('GET /available-projects error:', error);
      res.status(500).json({ message: "Error al obtener proyectos disponibles" });
    }
  });

  // POST /api/reviews/:roomId/items/project — add a project to the room
  router.post('/:roomId/items/project', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const projectId = parseInt(req.body?.projectId, 10);
      if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId inválido" });

      const [existing] = await db.select({ id: projectStatusReviews.id })
        .from(projectStatusReviews)
        .where(and(eq(projectStatusReviews.roomId, roomId), eq(projectStatusReviews.projectId, projectId)));
      if (existing) return res.status(200).json({ id: existing.id, alreadyExists: true });

      const [row] = await db.insert(projectStatusReviews)
        .values({ roomId, projectId, updatedBy: req.user!.id })
        .returning();
      res.status(201).json(row);
    } catch (error) {
      console.error('POST /items/project error:', error);
      res.status(500).json({ message: "Error al agregar proyecto" });
    }
  });

  // PATCH /api/reviews/:roomId/items/project/:projectId — upsert project status
  router.patch('/:roomId/items/project/:projectId', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const projectId = parseInt(req.params.projectId, 10);
      if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId inválido" });

      const { healthStatus, marginStatus, teamStrain, mainRisk, currentAction, nextMilestone, nextMilestoneDate, deadline, ownerId, decisionNeeded, hiddenFromWeekly } = req.body ?? {};

      if (healthStatus !== undefined && !VALID_HEALTH.includes(healthStatus)) return res.status(400).json({ message: "healthStatus inválido" });
      if (marginStatus !== undefined && !VALID_LEVEL.includes(marginStatus)) return res.status(400).json({ message: "marginStatus inválido" });
      if (teamStrain !== undefined && !VALID_LEVEL.includes(teamStrain)) return res.status(400).json({ message: "teamStrain inválido" });
      if (decisionNeeded !== undefined && !VALID_DECISION.includes(decisionNeeded)) return res.status(400).json({ message: "decisionNeeded inválido" });

      const userId = req.user!.id;
      const update: Record<string, any> = { updatedAt: new Date(), updatedBy: userId };
      if (healthStatus !== undefined) update.healthStatus = healthStatus;
      if (marginStatus !== undefined) update.marginStatus = marginStatus;
      if (teamStrain !== undefined) update.teamStrain = teamStrain;
      if (mainRisk !== undefined) update.mainRisk = mainRisk;
      if (currentAction !== undefined) update.currentAction = currentAction;
      if (nextMilestone !== undefined) update.nextMilestone = nextMilestone;
      if (nextMilestoneDate !== undefined) update.nextMilestoneDate = nextMilestoneDate ? new Date(nextMilestoneDate) : null;
      if (deadline !== undefined) update.deadline = deadline ? new Date(deadline) : null;
      if (ownerId !== undefined) update.ownerId = ownerId || null;
      if (decisionNeeded !== undefined) update.decisionNeeded = decisionNeeded;
      if (hiddenFromWeekly !== undefined) update.hiddenFromWeekly = hiddenFromWeekly;

      const [existing] = await db.select().from(projectStatusReviews)
        .where(and(eq(projectStatusReviews.roomId, roomId), eq(projectStatusReviews.projectId, projectId)));

      const trackFields = ['healthStatus', 'marginStatus', 'teamStrain', 'mainRisk', 'currentAction', 'nextMilestone', 'deadline', 'ownerId', 'decisionNeeded'] as const;
      const changeLogs: { fieldName: string; oldValue: string | null; newValue: string | null }[] = [];
      if (existing) {
        for (const field of trackFields) {
          if (update[field] !== undefined) {
            const oldVal = (existing as any)[field];
            const newVal = update[field];
            const oldStr = oldVal != null ? String(oldVal) : null;
            const newStr = newVal != null ? String(newVal) : null;
            if (oldStr !== newStr) changeLogs.push({ fieldName: field, oldValue: oldStr, newValue: newStr });
          }
        }
      }

      let result: any;
      if (existing) {
        [result] = await db.update(projectStatusReviews).set(update)
          .where(and(eq(projectStatusReviews.roomId, roomId), eq(projectStatusReviews.projectId, projectId)))
          .returning();
      } else {
        [result] = await db.insert(projectStatusReviews).values({ roomId, projectId, ...update }).returning();
      }

      if (changeLogs.length > 0) {
        db.insert(statusChangeLog)
          .values(changeLogs.map(cl => ({ roomId, projectId, userId, ...cl })))
          .catch((err: any) => console.error('statusChangeLog insert error:', err));
      }

      res.json(result);
    } catch (error) {
      console.error('PATCH /items/project/:projectId error:', error);
      res.status(500).json({ message: "Error al actualizar status" });
    }
  });

  // DELETE /api/reviews/:roomId/items/project/:projectId — hide project from this room
  router.delete('/:roomId/items/project/:projectId', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const projectId = parseInt(req.params.projectId, 10);
      const [existing] = await db.select({ id: projectStatusReviews.id }).from(projectStatusReviews)
        .where(and(eq(projectStatusReviews.roomId, roomId), eq(projectStatusReviews.projectId, projectId)));
      if (existing) {
        await db.update(projectStatusReviews)
          .set({ hiddenFromWeekly: true, updatedAt: new Date() })
          .where(and(eq(projectStatusReviews.roomId, roomId), eq(projectStatusReviews.projectId, projectId)));
      } else {
        await db.insert(projectStatusReviews).values({ roomId, projectId, hiddenFromWeekly: true });
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Error al quitar proyecto" });
    }
  });

  // GET /api/reviews/:roomId/assignable-users — members of the room (for owner picker)
  router.get('/:roomId/assignable-users', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const scope = req.query.scope === 'all' ? 'all' : 'members';
      if (scope === 'all') {
        const rows = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
          .from(users).orderBy(asc(users.firstName));
        res.json(rows.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email })));
        return;
      }
      const rows = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
        .from(reviewRoomMembers)
        .leftJoin(users, eq(users.id, reviewRoomMembers.userId))
        .where(eq(reviewRoomMembers.roomId, req.roomMember!.roomId))
        .orderBy(asc(users.firstName));
      res.json(rows.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email })));
    } catch (error) {
      res.status(500).json({ message: "Error al obtener usuarios" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Custom items (temas no-proyecto)
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/:roomId/items/custom', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const includeHidden = req.query.includeHidden === 'true';
      const items = await db.select({
        id: weeklyStatusItems.id,
        title: weeklyStatusItems.title,
        subtitle: weeklyStatusItems.subtitle,
        healthStatus: weeklyStatusItems.healthStatus,
        marginStatus: weeklyStatusItems.marginStatus,
        teamStrain: weeklyStatusItems.teamStrain,
        mainRisk: weeklyStatusItems.mainRisk,
        currentAction: weeklyStatusItems.currentAction,
        nextMilestone: weeklyStatusItems.nextMilestone,
        deadline: weeklyStatusItems.deadline,
        ownerId: weeklyStatusItems.ownerId,
        ownerName: sql<string | null>`(SELECT ${users.firstName} || ' ' || ${users.lastName} FROM ${users} WHERE ${users.id} = ${weeklyStatusItems.ownerId})`,
        decisionNeeded: weeklyStatusItems.decisionNeeded,
        hiddenFromWeekly: weeklyStatusItems.hiddenFromWeekly,
        updatedAt: weeklyStatusItems.updatedAt,
        updatedBy: weeklyStatusItems.updatedBy,
        updatedByName: sql<string | null>`(SELECT ${users.firstName} || ' ' || ${users.lastName} FROM ${users} WHERE ${users.id} = ${weeklyStatusItems.updatedBy})`,
        noteCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${projectReviewNotes} WHERE ${projectReviewNotes.weeklyStatusItemId} = ${weeklyStatusItems.id}), 0)`,
      }).from(weeklyStatusItems)
        .where(and(
          eq(weeklyStatusItems.roomId, roomId),
          ...(includeHidden ? [] : [sql`(${weeklyStatusItems.hiddenFromWeekly} IS NOT TRUE)`]),
        ))
        .orderBy(desc(weeklyStatusItems.createdAt));

      res.setHeader('Cache-Control', 'no-store');
      res.json(items);
    } catch (error) {
      console.error('GET /items/custom error:', error);
      res.status(500).json({ message: "Error al obtener ítems" });
    }
  });

  router.post('/:roomId/items/custom', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const { title, subtitle } = req.body ?? {};
      if (!title?.trim()) return res.status(400).json({ message: "El título es requerido" });
      const [item] = await db.insert(weeklyStatusItems)
        .values({ roomId: req.roomMember!.roomId, title: title.trim(), subtitle: subtitle?.trim() || null, updatedBy: req.user!.id })
        .returning();
      res.status(201).json(item);
    } catch (error) {
      console.error('POST /items/custom error:', error);
      res.status(500).json({ message: "Error al crear ítem" });
    }
  });

  router.patch('/:roomId/items/custom/:id', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });

      const { title, subtitle, healthStatus, marginStatus, teamStrain, mainRisk, currentAction, nextMilestone, deadline, ownerId, decisionNeeded, hiddenFromWeekly } = req.body ?? {};
      if (healthStatus !== undefined && !VALID_HEALTH.includes(healthStatus)) return res.status(400).json({ message: "healthStatus inválido" });
      if (marginStatus !== undefined && !VALID_LEVEL.includes(marginStatus)) return res.status(400).json({ message: "marginStatus inválido" });
      if (teamStrain !== undefined && !VALID_LEVEL.includes(teamStrain)) return res.status(400).json({ message: "teamStrain inválido" });
      if (decisionNeeded !== undefined && !VALID_DECISION.includes(decisionNeeded)) return res.status(400).json({ message: "decisionNeeded inválido" });

      const userId = req.user!.id;
      const update: Record<string, any> = { updatedAt: new Date(), updatedBy: userId };
      if (title !== undefined) update.title = title;
      if (subtitle !== undefined) update.subtitle = subtitle;
      if (healthStatus !== undefined) update.healthStatus = healthStatus;
      if (marginStatus !== undefined) update.marginStatus = marginStatus;
      if (teamStrain !== undefined) update.teamStrain = teamStrain;
      if (mainRisk !== undefined) update.mainRisk = mainRisk;
      if (currentAction !== undefined) update.currentAction = currentAction;
      if (nextMilestone !== undefined) update.nextMilestone = nextMilestone;
      if (deadline !== undefined) update.deadline = deadline ? new Date(deadline) : null;
      if (ownerId !== undefined) update.ownerId = ownerId || null;
      if (decisionNeeded !== undefined) update.decisionNeeded = decisionNeeded;
      if (hiddenFromWeekly !== undefined) update.hiddenFromWeekly = hiddenFromWeekly;

      const [current] = await db.select().from(weeklyStatusItems)
        .where(and(eq(weeklyStatusItems.id, id), eq(weeklyStatusItems.roomId, roomId)));
      if (!current) return res.status(404).json({ message: "Ítem no encontrado" });

      const trackFields = ['healthStatus', 'marginStatus', 'teamStrain', 'mainRisk', 'currentAction', 'nextMilestone', 'deadline', 'ownerId', 'decisionNeeded'] as const;
      const changeLogs: { fieldName: string; oldValue: string | null; newValue: string | null }[] = [];
      for (const field of trackFields) {
        if (update[field] !== undefined) {
          const oldVal = (current as any)[field];
          const newVal = update[field];
          const oldStr = oldVal != null ? String(oldVal) : null;
          const newStr = newVal != null ? String(newVal) : null;
          if (oldStr !== newStr) changeLogs.push({ fieldName: field, oldValue: oldStr, newValue: newStr });
        }
      }

      const [item] = await db.update(weeklyStatusItems).set(update)
        .where(and(eq(weeklyStatusItems.id, id), eq(weeklyStatusItems.roomId, roomId)))
        .returning();

      if (changeLogs.length > 0) {
        db.insert(statusChangeLog)
          .values(changeLogs.map(cl => ({ roomId, weeklyStatusItemId: id, userId, ...cl })))
          .catch((err: any) => console.error('statusChangeLog insert error (custom):', err));
      }

      res.json(item);
    } catch (error) {
      console.error('PATCH /items/custom/:id error:', error);
      res.status(500).json({ message: "Error al actualizar ítem" });
    }
  });

  router.delete('/:roomId/items/custom/:id', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const id = parseInt(req.params.id, 10);
      await db.delete(weeklyStatusItems)
        .where(and(eq(weeklyStatusItems.id, id), eq(weeklyStatusItems.roomId, roomId)));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar ítem" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Notes
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/:roomId/items/project/:projectId/notes', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const projectId = parseInt(req.params.projectId, 10);
      const notes = await db
        .select({
          id: projectReviewNotes.id,
          projectId: projectReviewNotes.projectId,
          content: projectReviewNotes.content,
          noteDate: projectReviewNotes.noteDate,
          authorId: projectReviewNotes.authorId,
          authorName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          createdAt: projectReviewNotes.createdAt,
        })
        .from(projectReviewNotes)
        .leftJoin(users, eq(users.id, projectReviewNotes.authorId))
        .where(and(eq(projectReviewNotes.roomId, roomId), eq(projectReviewNotes.projectId, projectId)))
        .orderBy(desc(projectReviewNotes.noteDate));
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener notas" });
    }
  });

  router.post('/:roomId/items/project/:projectId/notes', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const authorId = await resolveAuthorId(req);
      if (!authorId) return res.status(401).json({ message: "No autenticado" });
      const roomId = req.roomMember!.roomId;
      const projectId = parseInt(req.params.projectId, 10);
      const { content } = req.body ?? {};
      if (!content?.trim()) return res.status(400).json({ message: "El contenido es requerido" });
      const [note] = await db.insert(projectReviewNotes)
        .values({ roomId, projectId, content: content.trim(), authorId, noteDate: new Date() })
        .returning();
      res.status(201).json(note);
    } catch (error) {
      console.error('POST project notes error:', error);
      res.status(500).json({ message: "Error al crear nota" });
    }
  });

  router.get('/:roomId/items/custom/:itemId/notes', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const itemId = parseInt(req.params.itemId, 10);
      const notes = await db
        .select({
          id: projectReviewNotes.id,
          weeklyStatusItemId: projectReviewNotes.weeklyStatusItemId,
          content: projectReviewNotes.content,
          noteDate: projectReviewNotes.noteDate,
          authorId: projectReviewNotes.authorId,
          authorName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          createdAt: projectReviewNotes.createdAt,
        })
        .from(projectReviewNotes)
        .leftJoin(users, eq(users.id, projectReviewNotes.authorId))
        .where(and(eq(projectReviewNotes.roomId, roomId), eq(projectReviewNotes.weeklyStatusItemId, itemId)))
        .orderBy(desc(projectReviewNotes.noteDate));
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener notas" });
    }
  });

  router.post('/:roomId/items/custom/:itemId/notes', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const authorId = await resolveAuthorId(req);
      if (!authorId) return res.status(401).json({ message: "No autenticado" });
      const roomId = req.roomMember!.roomId;
      const itemId = parseInt(req.params.itemId, 10);
      const { content } = req.body ?? {};
      if (!content?.trim()) return res.status(400).json({ message: "El contenido es requerido" });
      const [note] = await db.insert(projectReviewNotes)
        .values({ roomId, weeklyStatusItemId: itemId, content: content.trim(), authorId, noteDate: new Date() })
        .returning();
      res.status(201).json(note);
    } catch (error) {
      console.error('POST custom notes error:', error);
      res.status(500).json({ message: "Error al crear nota" });
    }
  });

  router.delete('/:roomId/notes/:noteId', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const noteId = parseInt(req.params.noteId, 10);
      const userId = req.user!.id;
      const [note] = await db.select({ authorId: projectReviewNotes.authorId })
        .from(projectReviewNotes)
        .where(and(eq(projectReviewNotes.id, noteId), eq(projectReviewNotes.roomId, roomId)));
      if (!note) return res.status(404).json({ message: "Nota no encontrada" });
      // Editor puede borrar su propia nota; owner puede borrar cualquiera.
      if (note.authorId !== userId && req.roomMember!.role !== 'owner') {
        return res.status(403).json({ message: "No autorizado" });
      }
      await db.delete(projectReviewNotes)
        .where(and(eq(projectReviewNotes.id, noteId), eq(projectReviewNotes.roomId, roomId)));
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar nota" });
    }
  });

  router.patch('/:roomId/notes/:noteId', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const noteId = parseInt(req.params.noteId, 10);
      const { content } = req.body ?? {};
      if (!content?.trim()) return res.status(400).json({ message: "El contenido es requerido" });
      const userId = req.user!.id;
      const [note] = await db.select({ authorId: projectReviewNotes.authorId })
        .from(projectReviewNotes)
        .where(and(eq(projectReviewNotes.id, noteId), eq(projectReviewNotes.roomId, roomId)));
      if (!note) return res.status(404).json({ message: "Nota no encontrada" });
      if (note.authorId !== userId) return res.status(403).json({ message: "Solo el autor puede editarla" });
      const [updated] = await db.update(projectReviewNotes)
        .set({ content: content.trim() })
        .where(and(eq(projectReviewNotes.id, noteId), eq(projectReviewNotes.roomId, roomId)))
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Error al editar nota" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Update entries
  // ═══════════════════════════════════════════════════════════════════════════

  router.get('/:roomId/items/project/:projectId/updates', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const projectId = parseInt(req.params.projectId, 10);
      const entries = await db.select({
        id: statusUpdateEntries.id,
        content: statusUpdateEntries.content,
        authorId: statusUpdateEntries.authorId,
        authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'Usuario')`,
        createdAt: statusUpdateEntries.createdAt,
      }).from(statusUpdateEntries)
        .leftJoin(users, eq(users.id, statusUpdateEntries.authorId))
        .where(and(eq(statusUpdateEntries.roomId, roomId), eq(statusUpdateEntries.projectId, projectId)))
        .orderBy(desc(statusUpdateEntries.createdAt));
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener updates" });
    }
  });

  router.post('/:roomId/items/project/:projectId/updates', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const projectId = parseInt(req.params.projectId, 10);
      const { content } = req.body ?? {};
      if (!content?.trim()) return res.status(400).json({ message: "Contenido vacío" });
      const userId = req.user!.id;
      const [entry] = await db.insert(statusUpdateEntries)
        .values({ roomId, projectId, content: content.trim(), authorId: userId })
        .returning();
      // Reflejar en currentAction del review
      const [existing] = await db.select({ id: projectStatusReviews.id }).from(projectStatusReviews)
        .where(and(eq(projectStatusReviews.roomId, roomId), eq(projectStatusReviews.projectId, projectId)));
      if (existing) {
        await db.update(projectStatusReviews)
          .set({ currentAction: content.trim(), updatedAt: new Date(), updatedBy: userId })
          .where(and(eq(projectStatusReviews.roomId, roomId), eq(projectStatusReviews.projectId, projectId)));
      } else {
        await db.insert(projectStatusReviews)
          .values({ roomId, projectId, currentAction: content.trim(), updatedBy: userId });
      }
      res.status(201).json(entry);
    } catch (error) {
      console.error('POST project updates error:', error);
      res.status(500).json({ message: "Error al guardar update" });
    }
  });

  router.get('/:roomId/items/custom/:itemId/updates', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const itemId = parseInt(req.params.itemId, 10);
      const entries = await db.select({
        id: statusUpdateEntries.id,
        content: statusUpdateEntries.content,
        authorId: statusUpdateEntries.authorId,
        authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'Usuario')`,
        createdAt: statusUpdateEntries.createdAt,
      }).from(statusUpdateEntries)
        .leftJoin(users, eq(users.id, statusUpdateEntries.authorId))
        .where(and(eq(statusUpdateEntries.roomId, roomId), eq(statusUpdateEntries.weeklyStatusItemId, itemId)))
        .orderBy(desc(statusUpdateEntries.createdAt));
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener updates" });
    }
  });

  router.post('/:roomId/items/custom/:itemId/updates', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const itemId = parseInt(req.params.itemId, 10);
      const { content } = req.body ?? {};
      if (!content?.trim()) return res.status(400).json({ message: "Contenido vacío" });
      const userId = req.user!.id;
      const [entry] = await db.insert(statusUpdateEntries)
        .values({ roomId, weeklyStatusItemId: itemId, content: content.trim(), authorId: userId })
        .returning();
      await db.update(weeklyStatusItems)
        .set({ currentAction: content.trim(), updatedAt: new Date(), updatedBy: userId })
        .where(and(eq(weeklyStatusItems.id, itemId), eq(weeklyStatusItems.roomId, roomId)));
      res.status(201).json(entry);
    } catch (error) {
      console.error('POST custom updates error:', error);
      res.status(500).json({ message: "Error al guardar update" });
    }
  });

  router.patch('/:roomId/updates/:entryId', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const entryId = parseInt(req.params.entryId, 10);
      const { content } = req.body ?? {};
      if (!content?.trim()) return res.status(400).json({ message: "El contenido es requerido" });
      const userId = req.user!.id;
      const [entry] = await db.select({ authorId: statusUpdateEntries.authorId })
        .from(statusUpdateEntries)
        .where(and(eq(statusUpdateEntries.id, entryId), eq(statusUpdateEntries.roomId, roomId)));
      if (!entry) return res.status(404).json({ message: "Update no encontrado" });
      if (entry.authorId !== userId) return res.status(403).json({ message: "Solo el autor puede editarlo" });
      const [updated] = await db.update(statusUpdateEntries)
        .set({ content: content.trim() })
        .where(and(eq(statusUpdateEntries.id, entryId), eq(statusUpdateEntries.roomId, roomId)))
        .returning();
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Error al editar update" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Activity timeline
  // ═══════════════════════════════════════════════════════════════════════════

  async function timelineFor(roomId: number, where: { projectId?: number; itemId?: number }) {
    const notesQ = where.projectId != null
      ? db.select({
          id: projectReviewNotes.id,
          content: projectReviewNotes.content,
          authorId: projectReviewNotes.authorId,
          authorName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          createdAt: projectReviewNotes.noteDate,
        }).from(projectReviewNotes)
          .leftJoin(users, eq(users.id, projectReviewNotes.authorId))
          .where(and(eq(projectReviewNotes.roomId, roomId), eq(projectReviewNotes.projectId, where.projectId)))
      : db.select({
          id: projectReviewNotes.id,
          content: projectReviewNotes.content,
          authorId: projectReviewNotes.authorId,
          authorName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          createdAt: projectReviewNotes.noteDate,
        }).from(projectReviewNotes)
          .leftJoin(users, eq(users.id, projectReviewNotes.authorId))
          .where(and(eq(projectReviewNotes.roomId, roomId), eq(projectReviewNotes.weeklyStatusItemId, where.itemId!)));

    const changesQ = where.projectId != null
      ? db.select({
          id: statusChangeLog.id,
          userId: statusChangeLog.userId,
          userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          fieldName: statusChangeLog.fieldName,
          oldValue: statusChangeLog.oldValue,
          newValue: statusChangeLog.newValue,
          createdAt: statusChangeLog.createdAt,
        }).from(statusChangeLog)
          .leftJoin(users, eq(users.id, statusChangeLog.userId))
          .where(and(eq(statusChangeLog.roomId, roomId), eq(statusChangeLog.projectId, where.projectId)))
      : db.select({
          id: statusChangeLog.id,
          userId: statusChangeLog.userId,
          userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
          fieldName: statusChangeLog.fieldName,
          oldValue: statusChangeLog.oldValue,
          newValue: statusChangeLog.newValue,
          createdAt: statusChangeLog.createdAt,
        }).from(statusChangeLog)
          .leftJoin(users, eq(users.id, statusChangeLog.userId))
          .where(and(eq(statusChangeLog.roomId, roomId), eq(statusChangeLog.weeklyStatusItemId, where.itemId!)));

    const [notes, changes] = await Promise.all([notesQ, changesQ.catch(() => [] as any[])]);

    return [
      ...notes.map(n => ({ type: 'note' as const, id: n.id, content: n.content, authorId: n.authorId, authorName: n.authorName, createdAt: n.createdAt })),
      ...changes.map((c: any) => ({ type: 'change' as const, id: c.id, userId: c.userId, userName: c.userName, fieldName: c.fieldName, oldValue: c.oldValue, newValue: c.newValue, createdAt: c.createdAt })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  router.get('/:roomId/items/project/:projectId/activity', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const timeline = await timelineFor(req.roomMember!.roomId, { projectId });
      res.json(timeline);
    } catch (error) {
      console.error('GET activity (project) error:', error);
      res.status(500).json({ message: "Error al obtener actividad" });
    }
  });

  router.get('/:roomId/items/custom/:itemId/activity', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const itemId = parseInt(req.params.itemId, 10);
      const timeline = await timelineFor(req.roomMember!.roomId, { itemId });
      res.json(timeline);
    } catch (error) {
      console.error('GET activity (custom) error:', error);
      res.status(500).json({ message: "Error al obtener actividad" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AI summary (scoped a la sala)
  // ═══════════════════════════════════════════════════════════════════════════

  router.post('/:roomId/ai-summary', requireAuth, requireRoomMember(), async (req: Request, res: Response) => {
    try {
      const roomId = req.roomMember!.roomId;
      const { generateWeeklySummary } = await import("./services/ai-weekly-summary");

      const rows = await db
        .select({
          projectId: activeProjects.id,
          clientName: clients.name,
          quotationName: quotations.projectName,
          healthStatus: projectStatusReviews.healthStatus,
          marginStatus: projectStatusReviews.marginStatus,
          teamStrain: projectStatusReviews.teamStrain,
          mainRisk: projectStatusReviews.mainRisk,
          currentAction: projectStatusReviews.currentAction,
          nextMilestone: projectStatusReviews.nextMilestone,
          ownerId: projectStatusReviews.ownerId,
          decisionNeeded: projectStatusReviews.decisionNeeded,
          hiddenFromWeekly: projectStatusReviews.hiddenFromWeekly,
        })
        .from(projectStatusReviews)
        .innerJoin(activeProjects, eq(activeProjects.id, projectStatusReviews.projectId))
        .leftJoin(clients, eq(clients.id, activeProjects.clientId))
        .leftJoin(quotations, eq(quotations.id, activeProjects.quotationId))
        .where(eq(projectStatusReviews.roomId, roomId));

      const ownerIds = [...new Set(rows.map(r => r.ownerId).filter(Boolean))] as number[];
      const owners = ownerIds.length > 0
        ? await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(inArray(users.id, ownerIds))
        : [];
      const ownerMap = new Map(owners.map((u: any) => [u.id, `${u.firstName} ${u.lastName}`]));

      const snapshots = rows.map(r => ({
        projectId: r.projectId,
        clientName: r.clientName,
        quotationName: r.quotationName,
        healthStatus: r.healthStatus,
        marginStatus: r.marginStatus,
        teamStrain: r.teamStrain,
        mainRisk: r.mainRisk,
        currentAction: r.currentAction,
        nextMilestone: r.nextMilestone,
        ownerName: r.ownerId ? ownerMap.get(r.ownerId) ?? null : null,
        decisionNeeded: r.decisionNeeded,
        hiddenFromWeekly: r.hiddenFromWeekly,
        noteCount: 0,
      }));

      const summary = await generateWeeklySummary(snapshots);
      res.json(summary);
    } catch (error: any) {
      console.error('POST ai-summary error:', error);
      res.status(500).json({ message: error.message || "Error al generar resumen IA" });
    }
  });

  return router;
}
