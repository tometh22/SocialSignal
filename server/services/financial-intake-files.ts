import { createHash, randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import multer from "multer";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const financialIntakeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("Formato no admitido. Usá PDF, imagen, TXT, Word o Excel."));
      return;
    }
    callback(null, true);
  },
});

function privateRoot(): string {
  return path.resolve(
    process.env.FINANCIAL_PRIVATE_STORAGE_DIR
      || path.join(process.cwd(), "private", "financial-intake"),
  );
}

function safeExtension(file: Express.Multer.File): string {
  const fromName = path.extname(file.originalname).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  const byMime: Record<string, string> = {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "text/plain": ".txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  };
  return byMime[file.mimetype] ?? ".bin";
}

export interface StoredFinancialFile {
  storageKey: string;
  fileHash: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
}

function assertMagicBytes(file: Express.Multer.File): void {
  const b = file.buffer;
  const zip = b[0] === 0x50 && b[1] === 0x4b;
  const valid = file.mimetype === "application/pdf" ? b.subarray(0, 5).toString() === "%PDF-"
    : file.mimetype === "image/png" ? b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    : file.mimetype === "image/jpeg" ? b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9
    : file.mimetype === "image/webp" ? b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP"
    : file.mimetype.includes("openxmlformats") ? zip
    : !b.includes(0);
  if (!valid) throw Object.assign(new Error("El contenido del archivo no coincide con su formato declarado."), { statusCode: 400 });
}

export async function storeFinancialIntakeFile(file: Express.Multer.File): Promise<StoredFinancialFile> {
  assertMagicBytes(file);
  const now = new Date();
  const segment = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const storageKey = `${segment}/${randomUUID()}${safeExtension(file)}`;
  const root = privateRoot();
  const destination = path.resolve(root, storageKey);
  if (!destination.startsWith(`${root}${path.sep}`)) {
    throw new Error("Ruta de almacenamiento inválida");
  }
  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await fs.writeFile(destination, file.buffer, { mode: 0o600, flag: "wx" });
  return {
    storageKey,
    fileHash: createHash("sha256").update(file.buffer).digest("hex"),
    originalFileName: path.basename(file.originalname).slice(0, 255),
    mimeType: file.mimetype,
    fileSize: file.size,
  };
}

export async function readFinancialIntakeFile(storageKey: string): Promise<Buffer> {
  const root = privateRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw Object.assign(new Error("Archivo inválido"), { statusCode: 400 });
  }
  return fs.readFile(resolved);
}

export async function deleteFinancialIntakeFile(storageKey: string): Promise<void> {
  const root = privateRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) return;
  await fs.unlink(resolved).catch(() => undefined);
}
