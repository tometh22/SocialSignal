import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { externalProviders, providerProjectAccess } from "@shared/schema";
import { and, eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      provider?: {
        id: number;
        userId: number;
        companyName: string;
      };
    }
  }
}

/**
 * Allows only users whose role (or legacy isAdmin flag for 'admin') matches one
 * of the given roles. Role is read from req.user, which requires requireAuth to
 * have run first.
 *
 * Back-compat: legacy users still use isAdmin=true without role='admin' — tratamos
 * isAdmin=true como role='admin' para no romper cuentas existentes.
 */
export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: any = req.user;
    if (!user) return res.status(401).json({ message: "No autenticado" });
    const effectiveRole = user.role ?? (user.isAdmin ? "admin" : "member");
    if (!allowed.includes(effectiveRole)) {
      return res.status(403).json({ message: "Acceso denegado (rol insuficiente)" });
    }
    next();
  };
}

/**
 * Guards an /api/provider/* route. Loads the externalProviders row bound to the
 * authenticated user, attaches it as req.provider, and rejects if the user has
 * no provider profile.
 */
export async function requireProvider(req: Request, res: Response, next: NextFunction) {
  const user: any = req.user;
  if (!user) return res.status(401).json({ message: "No autenticado" });
  const [row] = await db
    .select({ id: externalProviders.id, userId: externalProviders.userId, companyName: externalProviders.companyName, active: externalProviders.active })
    .from(externalProviders)
    .where(eq(externalProviders.userId, user.id));
  if (!row) return res.status(403).json({ message: "Tu usuario no tiene un perfil de proveedor" });
  if (!row.active) return res.status(403).json({ message: "Proveedor inactivo" });
  req.provider = { id: row.id, userId: row.userId, companyName: row.companyName };
  next();
}

/**
 * For a provider-scoped route that operates on a projectId (read from body or
 * params), verifies the provider has access. Returns 403 if not granted.
 * Caller must have run requireProvider first.
 */
export function requireProviderCanAccessProject(source: "body" | "params" = "body") {
  return async (req: Request, res: Response, next: NextFunction) => {
    const provider = req.provider;
    if (!provider) return res.status(403).json({ message: "Proveedor requerido" });
    const raw = source === "body" ? req.body?.projectId : req.params?.projectId;
    const projectId = typeof raw === "string" ? parseInt(raw, 10) : raw;
    if (!Number.isFinite(projectId)) {
      return res.status(400).json({ message: "projectId inválido" });
    }
    const [row] = await db
      .select()
      .from(providerProjectAccess)
      .where(and(
        eq(providerProjectAccess.providerId, provider.id),
        eq(providerProjectAccess.projectId, projectId as number),
      ));
    if (!row) return res.status(403).json({ message: "No tenés acceso a este proyecto" });
    (req as any).providerAccess = row;
    next();
  };
}
