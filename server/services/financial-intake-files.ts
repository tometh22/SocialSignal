import os from "node:os";
import { Transform, pipeline } from "node:stream";
import { createWriteStream } from "node:fs";
import { objectStorageEnabled, putObject, getObject, removeObject } from "./object-storage";
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

const uploadBytes = new WeakMap<object, number>();
const boundedStorage: multer.StorageEngine = {
  _handleFile(req, file, callback) {
    const filename = `mind-intake-${randomUUID()}`;
    const filePath = path.join(os.tmpdir(), filename);
    let size = 0;
    const counter = new Transform({ transform(chunk, _encoding, done) {
      size += chunk.length;
      const total = (uploadBytes.get(req) ?? 0) + chunk.length;
      uploadBytes.set(req, total);
      done(total > 40 * 1024 * 1024 ? new Error("El lote supera 40 MB. Subí los archivos en lotes más pequeños.") : null, chunk);
    } });
    const cleanup = () => { void fs.unlink(filePath).catch(() => {}); };
    req.res?.once("close", cleanup);
    pipeline(file.stream, counter, createWriteStream(filePath, { mode: 0o600, flags: "wx" }), error => {
      if (error) { cleanup(); callback(error); }
      else callback(null, { path: filePath, filename, destination: os.tmpdir(), size });
    });
  },
  _removeFile(_req, file, callback) { fs.unlink(file.path).then(() => callback(null), error => callback(error)); },
};
export const financialIntakeUpload = multer({
  storage: boundedStorage,
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
  if (!file.buffer && file.path) file = { ...file, buffer: await fs.readFile(file.path) };
  assertMagicBytes(file);
  const now = new Date();
  const segment = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const storageKey = `${segment}/${randomUUID()}${safeExtension(file)}`;
  const root = privateRoot();
  const destination = path.resolve(root, storageKey);
  if (!destination.startsWith(`${root}${path.sep}`)) {
    throw new Error("Ruta de almacenamiento inválida");
  }
  if (objectStorageEnabled()) {
    const objectKey = `financial/${storageKey}`;
    await putObject(objectKey, file.buffer, file.mimetype);
    return { storageKey: `s3:${objectKey}`, fileHash: createHash("sha256").update(file.buffer).digest("hex"), originalFileName: path.basename(file.originalname).slice(0, 255), mimeType: file.mimetype, fileSize: file.size };
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
  if (storageKey.startsWith("s3:financial/")) {
    const object = await getObject(storageKey.slice(3));
    return Buffer.from(await object.Body!.transformToByteArray());
  }
  const root = privateRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw Object.assign(new Error("Archivo inválido"), { statusCode: 400 });
  }
  try { return await fs.readFile(resolved); }
  catch (error: any) {
    if (error.code !== "ENOENT" || !objectStorageEnabled()) throw error;
    const object = await getObject(`financial/${storageKey}`);
    return Buffer.from(await object.Body!.transformToByteArray());
  }
}

export async function deleteFinancialIntakeFile(storageKey: string): Promise<void> {
  if (storageKey.startsWith("s3:financial/")) { await removeObject(storageKey.slice(3)); return; }
  const root = privateRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) return;
  await fs.unlink(resolved).catch(() => undefined);
  if (objectStorageEnabled()) await removeObject(`financial/${storageKey}`);
}

export async function cleanupFinancialUploads(files: Express.Multer.File[] = []) {
  await Promise.all(files.filter(file => file.path).map(file => fs.unlink(file.path).catch(() => {})));
}
