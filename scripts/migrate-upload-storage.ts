import { readdir } from "node:fs/promises";
import path from "node:path";
import { objectStorageEnabled, putObject } from "../server/services/object-storage";

// Copy-only migration. Existing URLs/keys remain readable; no local data is deleted.
if (!objectStorageEnabled()) throw new Error("Configure S3_BUCKET and AWS credentials first");
const mimeTypes: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif", ".mp4": "video/mp4", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".txt": "text/plain" };
const apply = process.argv.includes("--apply");
async function copyTree(root: string, prefix: string, relative = "") {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true }).catch(error => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) await copyTree(root, prefix, next);
    else if (entry.isFile()) {
      const key = `${prefix}/${next.split(path.sep).join("/")}`;
      if (apply) await putObject(key, path.join(root, next), mimeTypes[path.extname(next).toLowerCase()] || "application/octet-stream");
      console.log(apply ? "Copied" : "Would copy", key);
    }
  }
}
await copyTree(path.resolve("public/uploads"), "uploads");
await copyTree(path.resolve(process.env.FINANCIAL_PRIVATE_STORAGE_DIR || "private/financial-intake"), "financial");
