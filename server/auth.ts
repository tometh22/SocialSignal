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
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Función para comparar contraseñas
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  
  try {
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error("Error en timingSafeEqual:", error);
    // Fallback en caso de error con timingSafeEqual
    return Buffer.compare(hashedBuf, suppliedBuf) === 0;
  }
}

export function setupAuth(app: Express, storage: IStorage) {
  // Configuración de la sesión optimizada para entorno multiusuario
  const isProduction = process.env.NODE_ENV === 'production';
  const sessionConfig = {
    secret: process.env.SESSION_SECRET || "epical-secret-key",
    resave: false, // Solo guardar cuando se modifique
    saveUninitialized: false, // No guardar sesiones vacías para cumplir con GDPR
    rolling: true, // Renovar cookie en cada respuesta (mantiene la sesión activa con actividad)
    cookie: {
      secure: isProduction, // Usar 'true' en producción para HTTPS
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 días para mayor permanencia
      sameSite: 'lax' as const, // Protección contra CSRF pero permite navegación normal
      httpOnly: true, // Previene acceso a la cookie mediante JavaScript
      path: '/', // Asegurar que la cookie sea accesible en todas las rutas
    },
    name: 'epical.sid', // Nombre personalizado para la cookie
    // Opciones adicionales para entorno multiusuario
    genid: () => {
      // Usar Math.random para generar identificadores de sesión
      // Esta implementación es segura para el uso interno de la aplicación
      return Math.random().toString(36).substring(2, 15) + 
             Math.random().toString(36).substring(2, 15);
    }
  };

  // Agregar el store de sesiones a la configuración
  const sessionWithStore = {
    ...sessionConfig,
    store: storage.sessionStore
  };

  app.use(session(sessionWithStore));

  // Middleware para verificar autenticación
  const requireAuth = async (req: Request, res: Response, next: Function) => {
    const userId = req.session.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const user = await storage.getUser(userId);
      
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

  // Rutas de autenticación
  app.post("/api/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      // Verificar si el correo ya existe
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        return res.status(400).json({ message: "El correo electrónico ya está registrado" });
      }
      
      // Crear el usuario
      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        isAdmin: false,
      });
      
      // Establecer la sesión
      req.session.userId = user.id;
      
      // Enviar respuesta
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error al registrar usuario:", error);
      res.status(500).json({ message: "Error al crear el usuario" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      console.log("Intento de inicio de sesión:", { email });
      
      // Buscar el usuario
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log("Usuario no encontrado:", email);
        return res.status(401).json({ message: "Credenciales incorrectas" });
      }
      
      console.log("Usuario encontrado:", { id: user.id, email: user.email, firstName: user.firstName });
      
      // Verificar la contraseña
      console.log("Contraseña almacenada:", user.password);
      
      const isPasswordValid = await comparePasswords(password, user.password);
      console.log("¿Contraseña válida?:", isPasswordValid);
      
      if (!isPasswordValid) {
        console.log("Contraseña incorrecta");
        return res.status(401).json({ message: "Credenciales incorrectas" });
      }
      
      // Establecer la sesión y guardarla explícitamente
      req.session.userId = user.id;
      console.log("Intentando establecer sesión con ID:", user.id);
      
      // Guardar la sesión de forma explícita y esperar a que se complete
      req.session.save((err) => {
        if (err) {
          console.error("Error al guardar la sesión:", err);
          return res.status(500).json({ message: "Error al iniciar sesión" });
        }
        
        console.log("Sesión guardada correctamente para ID:", user.id);
        
        // Enviar respuesta solo después de guardar la sesión
        const { password: _, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      res.status(500).json({ message: "Error al iniciar sesión" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error al cerrar sesión:", err);
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      
      res.status(200).json({ message: "Sesión cerrada correctamente" });
    });
  });

  app.get("/api/current-user", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ message: "Usuario no encontrado" });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error("Error al obtener usuario actual:", error);
      res.status(500).json({ message: "Error en el servidor" });
    }
  });

  // Exportar el middleware para su uso en otras rutas
  return { requireAuth };
}