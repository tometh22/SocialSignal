import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, 64) as Buffer;
  return `${hash.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  if (typeof supplied !== "string" || typeof stored !== "string") return false;
  const [hash, salt] = stored.split(".");
  if (!hash || !salt) return false;
  try {
    const expected = Buffer.from(hash, "hex");
    const actual = await scryptAsync(supplied, salt, 64) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}
