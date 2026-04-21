import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { activeProjects, timeEntries } from "@shared/schema";
import { eq } from "drizzle-orm";

type ProjectIdSource = (req: Request) => number | null | Promise<number | null>;

const defaultSource: ProjectIdSource = (req) => {
  const raw =
    req.body?.projectId ??
    req.body?.activeProjectId ??
    req.params?.projectId;
  const n = typeof raw === "string" ? parseInt(raw, 10) : raw;
  return Number.isFinite(n) ? (n as number) : null;
};

/** Looks up the projectId of an existing time entry by `:id` param. */
export const projectIdFromTimeEntry: ProjectIdSource = async (req) => {
  const id = parseInt(req.params?.id ?? "", 10);
  if (!Number.isFinite(id)) return null;
  const [row] = await db
    .select({ projectId: timeEntries.projectId })
    .from(timeEntries)
    .where(eq(timeEntries.id, id));
  return row?.projectId ?? null;
};

/**
 * Blocks writes to a project that's been closed (isFinished=true or closedAt set),
 * unless the caller is admin. Admin bypass lets ops/support fix mistakes post-cierre.
 *
 * Usage: `app.post('/api/foo', requireAuth, requireProjectUnlocked(), handler)`.
 * Pass a custom source if projectId lives somewhere unusual on the request.
 */
export function requireProjectUnlocked(source: ProjectIdSource = defaultSource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const projectId = await source(req);
    if (projectId === null) {
      // If no project in payload, skip — downstream validation handles missing fields.
      return next();
    }

    const [project] = await db
      .select({
        id: activeProjects.id,
        isFinished: activeProjects.isFinished,
        closedAt: activeProjects.closedAt,
        status: activeProjects.status,
      })
      .from(activeProjects)
      .where(eq(activeProjects.id, projectId));

    if (!project) return next(); // not found — let handler return 404 with its own message

    const isClosed = Boolean(project.isFinished) || Boolean(project.closedAt);
    const isAdmin = Boolean((req.user as any)?.isAdmin);

    if (isClosed && !isAdmin) {
      return res.status(423).json({
        message: "El proyecto está cerrado. No se pueden cargar horas ni costos.",
        projectId: project.id,
        status: project.status,
        closedAt: project.closedAt,
      });
    }

    next();
  };
}
