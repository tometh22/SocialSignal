import type { Request, Response, NextFunction } from "express";

/**
 * Allows only users that hold at least one of the given section permissions
 * (stored in req.user.permissions, e.g. "operations", "admin") or that are
 * admins. Mirrors the client-side usePermissions() logic so the backend is not
 * left open while the UI hides the controls.
 *
 * Requires requireAuth to have run first (reads req.user).
 *
 * Back-compat: legacy users with isAdmin=true (no explicit role) are treated as
 * admins and pass any permission check.
 */
export function requirePermission(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: any = req.user;
    if (!user) return res.status(401).json({ message: "No autenticado" });
    const isAdmin = user.isAdmin === true || user.role === "admin";
    if (isAdmin) return next();
    const perms: string[] = Array.isArray(user.permissions) ? user.permissions : [];
    if (!allowed.some((p) => perms.includes(p))) {
      return res.status(403).json({ message: "No tenés permiso para esta acción" });
    }
    next();
  };
}
