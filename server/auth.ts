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

  // Verificar que stored tenga el formato correcto
  if (!stored.includes(".")) {
    console.error("Formato de hash incorrecto, no contiene separador '.'");
    return false;
  }

  const [hashed, salt] = stored.split(".");

  try {
    const hashedBuf = Buffer.from(hashed, "hex");

    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;

    try {
      const result = timingSafeEqual(hashedBuf, suppliedBuf);
      return result;
    } catch (error) {
      console.error("Error en timingSafeEqual:", error);
      // Fallback en caso de error con timingSafeEqual
      const result = Buffer.compare(hashedBuf, suppliedBuf) === 0;
      return result;
    }
  } catch (error) {
    console.error("Error al comparar contraseñas:", error);
    return false;
  }
}

export function setupAuth(app: Express, storage: IStorage) {
  const isReplit = !!(process.env.REPLIT_DOMAINS || process.env.REPL_ID);

  const sessionConfig = {
    secret: process.env.SESSION_SECRET || "epical-secret-key-enhanced-2025",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: isReplit,
      maxAge: 1000 * 60 * 60 * 24 * 30,
      sameSite: (isReplit ? 'none' : 'lax') as 'none' | 'lax',
      httpOnly: true,
      path: '/',
    },
    name: 'epical.sid',
  };

  // Agregar el store de sesiones a la configuración
  const sessionWithStore = {
    ...sessionConfig,
    store: storage.sessionStore
  };

  app.use(session(sessionWithStore));

  // Middleware para verificar autenticación
  const requireAuth = async (req: Request, res: Response, next: Function) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const user = await storage.getUser(req.session.userId);

      if (!user) {
        req.session.destroy(() => {});
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

      // Buscar el usuario
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

      // Establecer la sesión y guardarla explícitamente
      req.session.userId = user.id;
      console.log(`✅ Session established for user ID: ${user.id}`);

      // Guardar la sesión explícitamente antes de enviar la respuesta
      req.session.save((saveError) => {
        if (saveError) {
          console.error('❌ Error saving session:', saveError);
          return res.status(500).json({ message: "Error al guardar sesión" });
        }

        console.log(`💾 Session saved successfully for user: ${user.id}`);

        const userResponse = {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          avatar: user.avatar || null,
          isAdmin: user.isAdmin,
          isActive: user.isActive,
          permissions: (user as any).permissions || []
        };

        console.log(`📤 Sending login response for: ${user.email}`);
        res.status(200).json(userResponse);
      });
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

      res.clearCookie('sessionId', { path: '/' });
      res.clearCookie('connect.sid', { path: '/' });

      res.status(200).json({ message: "Sesión cerrada correctamente" });
    });
  });

  app.get("/api/current-user", async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    try {
      const user = await storage.getUser(req.session.userId);

      if (!user) {
        req.session.destroy(() => {});
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

      // Verificar si el usuario existe
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Por seguridad, siempre devolvemos éxito incluso si el email no existe
        return res.status(200).json({ 
          message: "Si el correo existe en nuestro sistema, recibirás un enlace de recuperación." 
        });
      }

      // Generar token único
      const resetToken = randomBytes(32).toString('hex');

      // Token expira en 1 hora
      const expiresAt = new Date(Date.now() + 3600000);

      // Guardar token en la base de datos
      await storage.createPasswordResetToken(email, resetToken, expiresAt);

      // En un entorno real, aquí enviarías un email
      // Por ahora, devolvemos el token para testing
      console.log(`🔑 Password reset token for ${email}: ${resetToken}`);

      res.status(200).json({ 
        message: "Si el correo existe en nuestro sistema, recibirás un enlace de recuperación.",
        // En producción, remove esta línea por seguridad
        token: resetToken 
      });
    } catch (error) {
      console.error("Error en forgot-password:", error);
      res.status(500).json({ message: "Error en el servidor" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      // Verificar token
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

      // Hash de la nueva contraseña
      const hashedPassword = await hashPassword(password);

      // Actualizar contraseña del usuario
      await storage.updateUserPassword(resetToken.email, hashedPassword);

      // Marcar token como usado
      await storage.markPasswordResetTokenAsUsed(token);

      res.status(200).json({ message: "Contraseña actualizada correctamente" });
    } catch (error) {
      console.error("Error en reset-password:", error);
      res.status(500).json({ message: "Error en el servidor" });
    }
  });

  // Exportar el middleware para su uso en otras rutas
  return { requireAuth };
}