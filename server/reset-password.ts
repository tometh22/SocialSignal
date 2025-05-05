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

// Función para comparar contraseñas
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  
  // Usar una comparación de tiempo constante para evitar ataques de tiempo
  return Buffer.compare(hashedBuf, suppliedBuf) === 0;
}

async function resetUserPassword() {
  const email = "tomas@epical.digital";
  const newPassword = "admin123"; // Contraseña nueva o a restablecer
  
  try {
    // Verificar si el usuario existe
    const checkResult = await pool.query(
      "SELECT id, password FROM users WHERE email = $1",
      [email]
    );
    
    if (checkResult.rows.length === 0) {
      console.log(`Usuario no encontrado: ${email}`);
      return;
    }
    
    const userId = checkResult.rows[0].id;
    const oldPassword = checkResult.rows[0].password;
    const newHashedPassword = await hashPassword(newPassword);
    
    console.log(`Contraseña plana: ${newPassword}`);
    console.log(`Contraseña hasheada nueva: ${newHashedPassword}`);
    
    // Verificar si la contraseña dada coincide con la actual
    const testPassword = "admin123";
    const passwordMatches = await comparePasswords(testPassword, oldPassword);
    console.log(`La contraseña de prueba '${testPassword}' coincide con la actual: ${passwordMatches}`);
    
    // Actualizar la contraseña del usuario
    await pool.query(
      "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
      [newHashedPassword, userId]
    );
    
    console.log(`Contraseña actualizada para el usuario ID: ${userId}`);
    console.log(`Email: ${email}`);
    console.log(`Nueva contraseña: ${newPassword}`);
    
  } catch (error) {
    console.error("Error al restablecer la contraseña:", error);
  } finally {
    pool.end();
  }
}

resetUserPassword();