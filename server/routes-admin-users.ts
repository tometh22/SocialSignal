import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { accountEmailSchema, accountPasswordSchema } from "@shared/account-access";
import type { IStorage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { createInvitedUser, getInvitationStatuses, sendAccountLink } from "./services/account-access";
import { hashPassword } from "./services/passwords";

const sections = z.enum(["dashboard", "crm", "quotations", "projects", "status", "finance", "admin", "operations", "task_manager"]);
const userInput = z.object({
  firstName: z.string().trim().min(1, "El nombre es requerido").max(100),
  lastName: z.string().trim().min(1, "El apellido es requerido").max(100),
  email: accountEmailSchema,
  permissions: z.array(sections).default([]),
  isAdmin: z.boolean().default(false),
});
const updateInput = userInput.partial().extend({
  password: accountPasswordSchema.optional(), isActive: z.boolean().optional(),
});
const userId = z.coerce.number().int().positive();

export function registerAdminUserRoutes(app: Express, storage: IStorage, requireAuth: RequestHandler, requireAdmin: RequestHandler) {
  const noStore: RequestHandler = (_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); };
  const guards = [requireAuth, requireAdmin, noStore];
  const failure = (res: Parameters<RequestHandler>[1], error: any, fallback: string) => {
    const duplicate = error?.code === "23505";
    res.status(duplicate ? 409 : [400, 409, 429, 503].includes(error?.statusCode) ? error.statusCode : 500)
      .json({ message: duplicate ? "El email ya está registrado" : error?.statusCode ? error.message : fallback });
  };
  app.get("/api/admin/users", ...guards, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const invitations = await getInvitationStatuses(allUsers.map(user => user.id));
      res.json(allUsers.map(({ password, ...user }) => ({ ...user, invitation: invitations.get(user.id) ?? { status: "none" } })));
    } catch (error) { failure(res, error, "Error al obtener usuarios"); }
  });
  app.post("/api/admin/users", ...guards, async (req, res) => {
    const parsed = userInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    try { res.status(201).json(await createInvitedUser(parsed.data)); }
    catch (error) { failure(res, error, "No se pudo crear el usuario"); }
  });
  app.post("/api/admin/users/:id/invitation", ...guards, async (req, res) => {
    const id = userId.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Usuario inválido" });
    try {
      const result = await sendAccountLink(id.data, "invitation");
      res.status(result.sent ? 200 : 502).json({ ...result, message: result.sent ? "Invitación enviada. El enlace vence en 48 horas." : "No se pudo confirmar el envío. Podés reenviar la invitación en un minuto." });
    } catch (error) { failure(res, error, "No se pudo enviar la invitación"); }
  });
  app.patch("/api/admin/users/:id", ...guards, async (req, res) => {
    const id = userId.safeParse(req.params.id);
    const parsed = updateInput.safeParse(req.body);
    if (!id.success || !parsed.success) return res.status(400).json({ message: parsed.success ? "Usuario inválido" : parsed.error.issues[0].message });
    try {
      const input = { ...parsed.data, ...(parsed.data.password ? { password: await hashPassword(parsed.data.password) } : {}) };
      const updated = await db.transaction(async tx => {
        const [previous] = await tx.select().from(users).where(eq(users.id, id.data)).for("update");
        if (!previous) return undefined;
        if (input.email && input.email !== previous.email) {
          const [duplicate] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email})=lower(${input.email}) AND ${users.id}<>${id.data}`);
          if (duplicate) throw Object.assign(new Error("El email ya está registrado"), { statusCode: 409 });
        }
        if (input.password || (input.email && input.email !== previous.email) || input.isActive === false) {
          // Same user lock as issuance/consumption; revoke before changing the email snapshot.
          await tx.execute(sql`UPDATE account_access_links SET revoked_at=NOW() WHERE user_id=${id.data} AND consumed_at IS NULL AND revoked_at IS NULL`);
          await tx.execute(sql`UPDATE password_reset_tokens SET used=true WHERE email=${previous.email}`);
          await tx.execute(sql`DELETE FROM sessions WHERE sess->>'userId'=${String(id.data)}`);
        }
        const [user] = await tx.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, id.data)).returning();
        return user;
      });
      if (!updated) return res.status(404).json({ message: "Usuario no encontrado" });
      const { password, ...user } = updated;
      res.json(user);
    } catch (error) { failure(res, error, "Error al actualizar usuario"); }
  });
  app.delete("/api/admin/users/:id", ...guards, async (req, res) => {
    const id = userId.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ message: "Usuario inválido" });
    if (id.data === req.user!.id) return res.status(400).json({ message: "No podés eliminar tu propia cuenta" });
    try {
      if (!await storage.deleteUser(id.data)) return res.status(404).json({ message: "Usuario no encontrado" });
      res.json({ message: "Usuario eliminado correctamente" });
    } catch (error) { failure(res, error, "Error al eliminar usuario"); }
  });
}
