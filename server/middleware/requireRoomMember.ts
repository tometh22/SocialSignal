import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { reviewRoomMembers, reviewRooms } from "@shared/schema";
import { and, eq, isNull } from "drizzle-orm";

type RoomRole = 'owner' | 'editor';

declare global {
  namespace Express {
    interface Request {
      roomMember?: {
        roomId: number;
        userId: number;
        role: RoomRole;
        isAdminBypass: boolean;
      };
    }
  }
}

/**
 * Guards a room-scoped route.
 * - Reads `:roomId` from the path.
 * - Requires the user to be a member of the room.
 * - If `requiredRole === 'owner'` the user must have that role.
 * - `isAdmin` users bypass all membership/role checks (debugging + support).
 */
export function requireRoomMember(requiredRole?: RoomRole) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const roomId = parseInt(req.params.roomId, 10);
    if (!Number.isFinite(roomId)) {
      return res.status(400).json({ message: "roomId inválido" });
    }

    // Verify the room exists and is not archived.
    const [room] = await db
      .select({ id: reviewRooms.id, archivedAt: reviewRooms.archivedAt })
      .from(reviewRooms)
      .where(eq(reviewRooms.id, roomId));

    if (!room) return res.status(404).json({ message: "Sala no encontrada" });
    if (room.archivedAt) return res.status(410).json({ message: "Sala archivada" });

    const isAdmin = Boolean((req.user as any)?.isAdmin);

    const [membership] = await db
      .select({ role: reviewRoomMembers.role })
      .from(reviewRoomMembers)
      .where(and(eq(reviewRoomMembers.roomId, roomId), eq(reviewRoomMembers.userId, userId)));

    if (!membership && !isAdmin) {
      return res.status(403).json({ message: "No tenés acceso a esta sala" });
    }

    const effectiveRole: RoomRole = (membership?.role as RoomRole | undefined) ?? 'owner';

    if (requiredRole === 'owner' && effectiveRole !== 'owner' && !isAdmin) {
      return res.status(403).json({ message: "Solo los owners pueden hacer esto" });
    }

    req.roomMember = {
      roomId,
      userId,
      role: effectiveRole,
      isAdminBypass: isAdmin && !membership,
    };
    next();
  };
}
