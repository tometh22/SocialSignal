import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { db } from "./db";
import { users, User, InsertUser } from "@shared/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const scryptAsync = promisify(scrypt);

const PostgresSessionStore = connectPg(session);
const sessionStore = new PostgresSessionStore({
  pool,
  createTableIfMissing: true
});

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Configuración de la sesión
  const sessionSettings: session.SessionOptions = {
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "super-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configuración de passport
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const [user] = await db.select().from(users).where(eq(users.email, email));
          
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Credenciales incorrectas" });
          }
          
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Rutas de autenticación
  app.post("/api/register", async (req, res) => {
    try {
      // Comprobar si el usuario ya existe
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, req.body.email));

      if (existingUser) {
        return res.status(400).json({ message: "El correo electrónico ya está registrado" });
      }

      // Crear el nuevo usuario
      const hashedPassword = await hashPassword(req.body.password);
      
      const [newUser] = await db
        .insert(users)
        .values({
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          password: hashedPassword,
          avatar: req.body.avatar || null,
          isAdmin: false,
        })
        .returning();

      // Eliminar la contraseña antes de devolver el usuario
      const { password, ...userWithoutPassword } = newUser;
      
      // Iniciar sesión con el nuevo usuario
      req.login(newUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Error al iniciar sesión después del registro" });
        }
        return res.status(201).json(userWithoutPassword);
      });

    } catch (error) {
      console.error("Error al registrar usuario:", error);
      return res.status(500).json({ message: "Error al registrar el usuario" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Credenciales incorrectas" });
      }
      
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        
        // Eliminar la contraseña antes de devolver el usuario
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout(function(err) {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      res.status(200).json({ message: "Sesión cerrada exitosamente" });
    });
  });

  app.get("/api/current-user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    // Eliminar la contraseña antes de devolver el usuario
    const { password, ...userWithoutPassword } = req.user as User;
    return res.json(userWithoutPassword);
  });
}

// Middleware para proteger rutas que requieren autenticación
export function requireAuth(req: Express.Request, res: Express.Response, next: Express.NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "No autorizado" });
}

// Función para hashear contraseñas (para crear usuarios iniciales)
export { hashPassword };