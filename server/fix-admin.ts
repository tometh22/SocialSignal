import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

// Función para generar hash de contraseña
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createNewAdminUser() {
  try {
    // Borrar cualquier usuario existente con este email
    await db.delete(users).where(eq(users.email, "tomas@epical.digital"));
    
    // Creamos una contraseña simple para pruebas
    const plainPassword = "admin123";
    
    // Hash de la contraseña
    const hashedPassword = await hashPassword(plainPassword);
    
    console.log("Contraseña plana:", plainPassword);
    console.log("Contraseña hasheada:", hashedPassword);
    
    // Insertar nuevo usuario
    const [newUser] = await db.insert(users).values({
      firstName: "Tomás",
      lastName: "Criado",
      email: "tomas@epical.digital",
      password: hashedPassword,
      isAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    console.log("Nuevo usuario administrador creado:", {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName
    });
    
    console.log("\nUtiliza estas credenciales para iniciar sesión:");
    console.log("Email: tomas@epical.digital");
    console.log("Contraseña: admin123");
    
  } catch (error) {
    console.error("Error al crear usuario administrador:", error);
  }
}

createNewAdminUser().finally(() => {
  console.log("Proceso finalizado");
  process.exit(0);
});