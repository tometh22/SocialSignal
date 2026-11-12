import type { Express, RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { accountEmailSchema, accountLinkSchema, completeAccountLinkSchema } from "@shared/account-access";
import type { IStorage } from "./storage";
import { completeAccountLink, sendAccountLink, validateAccountLink } from "./services/account-access";

const recoveryMessage = "Si el correo corresponde a una cuenta activa, recibirás un enlace para restablecer tu contraseña.";
export function registerAccountAccessRoutes(app: Express, storage: IStorage) {
  const noStore: RequestHandler = (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); };
  const issueLimit = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false,
    message: { message: "Demasiadas solicitudes. Volvé a intentar en unos minutos." } });
  const tokenLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false,
    message: { message: "Demasiados intentos. Volvé a intentar en unos minutos." } });

  app.post("/api/forgot-password", noStore, issueLimit, async (req, res) => {
    const parsed = accountEmailSchema.safeParse(req.body?.email);
    if (!parsed.success) return res.status(400).json({ message: "Email inválido" });
    try {
      const user = await storage.getUserByEmail(parsed.data);
      if (user && user.isActive !== false) {
        try { await sendAccountLink(user.id, "password_reset"); }
        catch { console.error("No se pudo emitir el enlace de recuperación"); }
      }
      // Never reveal whether the address is registered, disabled or rate limited.
      res.json({ message: recoveryMessage });
    } catch { res.status(503).json({ message: "No se pudo procesar la solicitud. Volvé a intentar." }); }
  });
  app.post("/api/account-links/validate", noStore, tokenLimit, async (req, res) => {
    const parsed = accountLinkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "El enlace no es válido" });
    try {
      const account = await validateAccountLink(parsed.data.token, parsed.data.purpose);
      res.json({ email: account.email, firstName: account.firstName });
    } catch (error: any) { res.status(error.statusCode === 400 ? 400 : 503).json({ message: error.statusCode === 400 ? error.message : "No se pudo verificar el enlace. Volvé a intentar." }); }
  });
  const complete: RequestHandler = async (req, res) => {
    const parsed = completeAccountLinkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
    try {
      await completeAccountLink(parsed.data.token, parsed.data.purpose, parsed.data.password);
      res.json({ message: "Contraseña guardada. Ya podés ingresar a Mind." });
    } catch (error: any) { res.status(error.statusCode === 400 ? 400 : 503).json({ message: error.statusCode === 400 ? error.message : "No se pudo guardar la contraseña. Volvé a intentar." }); }
  };
  app.post("/api/account-links/complete", noStore, tokenLimit, complete);
  app.post("/api/reset-password", noStore, tokenLimit, (req, _res, next) => { req.body = { ...req.body, purpose: "password_reset" }; next(); }, complete);
}
