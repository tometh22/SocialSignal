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
  "text/csv",
  "application/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const financialIntakeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("Formato no admitido. Usá PDF, imagen, TXT, CSV, Word o Excel."));
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
    "text/csv": ".csv",
    "application/csv": ".csv",
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

export async function storeFinancialIntakeFile(file: Express.Multer.File): Promise<StoredFinancialFile> {
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

