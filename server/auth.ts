import { Express, Request, Response } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { User } from "@shared/schema";
import type { IStorage } from "./storage";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Extender la definición de session para TypeScript
declare module 'express-session' {
  interface SessionData {
    userId: number;
  }
}

const scryptAsync = promisify(scrypt);

// Función para generar hash de contraseña
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Función para comparar contraseñas
async function comparePasswords(supplied: string, stored: string) {
  if (!stored.includes(".")) {
    console.error("Formato de hash incorrecto, no contiene separador '.'");
    return false;
  }

  const [hashed, salt] = stored.split(".");

  try {
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;

    try {
      return timingSafeEqual(hashedBuf, suppliedBuf);
    } catch (error) {
      console.error("Error en timingSafeEqual:", error);
      return false;
    }
  } catch (error) {
    console.error("Error al comparar contraseñas:", error);
    return false;
  }
}

// Helper: resolve userId from session store by session ID token
function getUserIdFromStore(store: session.Store, sessionId: string): Promise<number | null> {
  return new Promise((resolve) => {
    store.get(sessionId, (err, sessionData) => {
      if (err || !sessionData) return resolve(null);
      resolve((sessionData as any).userId ?? null);
    });
  });
}

export function setupAuth(app: Express, storage: IStorage) {
  const sessionConfig = {
    secret: process.env.SESSION_SECRET || (() => { console.warn("⚠️ SESSION_SECRET not set — using random secret (sessions won't persist across restarts)"); return randomBytes(32).toString('hex'); })(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30,
      sameSite: 'lax' as const,
      httpOnly: true,
      path: '/',
    },
    name: 'epical_sid',
  };

  const sessionStore = storage.sessionStore;

  const sessionWithStore = {
    ...sessionConfig,
    store: sessionStore
  };

  app.use(session(sessionWithStore));

  // Helper: resolve session from Authorization: Session <token> header when cookie is missing
  async function resolveSessionFromToken(req: Request): Promise<number | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Session ')) return null;
    const tokenId = authHeader.slice(8).trim();
    if (!tokenId) return null;
    return getUserIdFromStore(sessionStore, tokenId);
  }

  // Middleware para verificar autenticación
  const requireAuth = async (req: Request, res: Response, next: Function) => {
    let userId = req.session?.userId;

    // Fallback: token-based auth for environments where cookies don't propagate (e.g. Replit preview iframe)
    if (!userId) {
      const tokenUserId = await resolveSessionFromToken(req);
      if (tokenUserId) userId = tokenUserId;
    }

    if (!userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const user = await storage.getUser(userId);

      if (!user) {
        req.session?.destroy(() => {});
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("Error de autenticación:", error);
      return res.status(500).json({ message: "Error en el servidor" });
    }
  };

  // Registro público deshabilitado — los usuarios se crean desde el panel de administración
  app.post("/api/register", (_req, res) => {
    res.status(403).json({ message: "El registro público está deshabilitado. Contactá al administrador." });
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      console.log(`🔐 Login attempt for: ${email}`);

      const user = await storage.getUserByEmail(email);

      if (!user) {
        console.log(`❌ User not found: ${email}`);
        return res.status(401).json({ message: "Credenciales incorrectas" });
      }

      const isPasswordValid = await comparePasswords(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ message: "Credenciales incorrectas" });
      }

      if (user.isActive === false) {
        return res.status(403).json({ message: "Tu cuenta está desactivada. Contactá al administrador." });
      }

      req.session.userId = user.id;
      console.log(`✅ Session established for user ID: ${user.id}, sessionID: ${req.sessionID}`);

      const userResponse = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar || null,
        isAdmin: user.isAdmin,
        isActive: user.isActive,
        permissions: (user as any).permissions || [],
        sessionToken: req.sessionID,
      };

      res.status(200).json(userResponse);
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      res.status(500).json({ message: "Error al iniciar sesión" });
    }
  });

  app.post("/api/logout", (req, res) => {
    console.log('🚪 Logout request received');

    req.session.destroy((err) => {
      if (err) {
        console.error("Error al cerrar sesión:", err);
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }

      console.log('✅ Session destroyed successfully');

      const isProduction = process.env.NODE_ENV === 'production';

      // Clear all session cookies — try both secure and non-secure variants
      // to cover cookies set before the secure flag was standardised
      const cookieNames = ['epical_sid', 'connect.sid', 'epical.persistent.sid'];
      cookieNames.forEach(name => {
        res.clearCookie(name, { path: '/', sameSite: 'lax', secure: false });
        if (isProduction) {
          res.clearCookie(name, { path: '/', sameSite: 'none', secure: true });
          res.clearCookie(name, { path: '/', sameSite: 'lax', secure: true });
        }
      });

      console.log('🍪 All session cookies cleared');
      res.status(200).json({ message: "Sesión cerrada correctamente" });
    });
  });

  app.get("/api/current-user", async (req, res) => {
    let userId = req.session?.userId;

    // Fallback: token-based auth for environments where cookies don't propagate
    if (!userId) {
      const tokenUserId = await resolveSessionFromToken(req);
      if (tokenUserId) userId = tokenUserId;
    }

    if (!userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const user = await storage.getUser(userId);

      if (!user) {
        req.session?.destroy(() => {});
        return res.status(401).json({ message: "Usuario no encontrado" });
      }

      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error("Error al obtener usuario actual:", error);
      res.status(500).json({ message: "Error en el servidor" });
    }
  });

  // Rutas de recuperación de contraseñas
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(200).json({ 
          message: "Si el correo existe en nuestro sistema, recibirás un enlace de recuperación." 
        });
      }

      const resetToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 3600000);

      await storage.createPasswordResetToken(email, resetToken, expiresAt);

      console.log(`🔑 Password reset token generated for ${email}`);

      res.status(200).json({
        message: "Si el correo existe en nuestro sistema, recibirás un enlace de recuperación."
      });
    } catch (error) {
      console.error("Error en forgot-password:", error);
      res.status(500).json({ message: "Error en el servidor" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      const resetToken = await storage.getPasswordResetToken(token);

      if (!resetToken) {
        return res.status(400).json({ message: "Token inválido o expirado" });
      }

      if (resetToken.used) {
        return res.status(400).json({ message: "Este token ya ha sido utilizado" });
      }

      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({ message: "Token expirado" });
      }

      const hashedPassword = await hashPassword(password);
      await storage.updateUserPassword(resetToken.email, hashedPassword);
      await storage.markPasswordResetTokenAsUsed(token);

      res.status(200).json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
      console.error("Error en reset-password:", error);
      res.status(500).json({ message: "Error en el servidor" });
    }
  });

  return { requireAuth };
}
