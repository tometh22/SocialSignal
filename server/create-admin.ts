import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { pool } from "./db";

const scryptAsync = promisify(scrypt);

// Función para generar hash de contraseña
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function createAdminUser() {
  const email = "tomas@epical.digital";
  const firstName = "Tomás";
  const lastName = "Criado";
  const password = "admin123"; // Esta será la contraseña
  
  try {
    // Verificar si el usuario ya existe
    const checkResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    
    if (checkResult.rows.length > 0) {
      // Actualizar el usuario existente
      const userId = checkResult.rows[0].id;
      const hashedPassword = await hashPassword(password);
      
      await pool.query(
        "UPDATE users SET password = $1, first_name = $2, last_name = $3, is_admin = true WHERE id = $4",
        [hashedPassword, firstName, lastName, userId]
      );
      
    } else {
      // Crear un nuevo usuario
      const hashedPassword = await hashPassword(password);
      
      const result = await pool.query(
        "INSERT INTO users (first_name, last_name, email, password, is_admin, created_at, updated_at) VALUES ($1, $2, $3, $4, true, NOW(), NOW()) RETURNING id",
        [firstName, lastName, email, hashedPassword]
      );
      
    }
  } catch (error) {
    console.error("Error al crear/actualizar usuario administrador:", error);
  } finally {
    pool.end();
  }
}

createAdminUser();