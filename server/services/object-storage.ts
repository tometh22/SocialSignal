import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

let client: S3Client | undefined;
export const objectStorageEnabled = () => Boolean(process.env.S3_BUCKET);
function storage() {
  return client ??= new S3Client({ region: process.env.S3_REGION || "us-east-1", endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true", maxAttempts: 2 });
}
export function safeObjectKey(key: string) {
  if (!key || key.startsWith("/") || key.includes("\\") || key.split("/").some(part => part === ".." || part === "." || !part)) throw new Error("Clave de archivo inválida");
  return key;
}
export async function putObject(key: string, body: Buffer | string, mimeType: string) {
  const fromFile = typeof body === "string";
  const size = fromFile ? (await stat(body)).size : body.length;
  await storage().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: safeObjectKey(key),
    Body: fromFile ? createReadStream(body) : body, ContentLength: size, ContentType: mimeType }), { abortSignal: AbortSignal.timeout(120_000) });
}
export async function getObject(key: string) {
  const result = await storage().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: safeObjectKey(key) }), { abortSignal: AbortSignal.timeout(30_000) });
  return result;
}
export async function removeObject(key: string) {
  await storage().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: safeObjectKey(key) }), { abortSignal: AbortSignal.timeout(30_000) });
}
