import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { putObject, getObject, removeObject, safeObjectKey } from "../server/services/object-storage";
import { storeFinancialIntakeFile, readFinancialIntakeFile, deleteFinancialIntakeFile } from "../server/services/financial-intake-files";

describe("shared object storage protocol and legacy migration", () => {
  let server: Server, temporary: string;
  const objects = new Map<string, { buffer: Buffer; mime: string }>();
  beforeAll(async () => {
    temporary = await mkdtemp(path.join(os.tmpdir(), "mind-storage-test-"));
    server = createServer(async (req, res) => {
      const key = decodeURIComponent(req.url!.split("?", 1)[0]);
      if (req.method === "PUT") {
        const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
        let buffer = Buffer.concat(chunks);
        if (String(req.headers["content-encoding"]).includes("aws-chunked")) {
          // S3 decodes the SDK's inner AWS chunk framing before storing bytes.
          const decoded: Buffer[] = [];
          for (let offset = 0; offset < buffer.length;) {
            const end = buffer.indexOf("\r\n", offset);
            const size = parseInt(buffer.subarray(offset, end).toString(), 16);
            if (!size) break;
            decoded.push(buffer.subarray(end + 2, end + 2 + size)); offset = end + 2 + size + 2;
          }
          buffer = Buffer.concat(decoded);
        }
        objects.set(key, { buffer, mime: String(req.headers["content-type"]) });
        res.writeHead(200, { ETag: '"fixture"' }).end();
      } else if (req.method === "DELETE") { objects.delete(key); res.writeHead(204).end(); }
      else {
        const value = objects.get(key);
        if (!value) { res.writeHead(404, { "Content-Type": "application/xml" }).end("<Error><Code>NoSuchKey</Code></Error>"); return; }
        res.writeHead(200, { "Content-Type": value.mime, "Content-Length": value.buffer.length }).end(value.buffer);
      }
    }).listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    vi.stubEnv("S3_BUCKET", "fixture"); vi.stubEnv("S3_REGION", "us-east-1"); vi.stubEnv("S3_FORCE_PATH_STYLE", "true");
    vi.stubEnv("S3_ENDPOINT", `http://127.0.0.1:${(server.address() as any).port}`);
    vi.stubEnv("AWS_ACCESS_KEY_ID", "local-test"); vi.stubEnv("AWS_SECRET_ACCESS_KEY", "local-test-only");
    vi.stubEnv("FINANCIAL_PRIVATE_STORAGE_DIR", temporary);
  });
  afterAll(async () => { vi.unstubAllEnvs(); await rm(temporary, { recursive: true, force: true }); await new Promise<void>(resolve => server.close(() => resolve())); });
  it("streams uploads to S3-compatible storage and reads/deletes with stable object keys", async () => {
    const file = path.join(temporary, "stream.txt"); await writeFile(file, "streamed content");
    await putObject("uploads/stream.txt", file, "text/plain");
    const object = await getObject("uploads/stream.txt");
    expect(await object.Body!.transformToString()).toBe("streamed content");
    expect(object.ContentType).toBe("text/plain");
    await removeObject("uploads/stream.txt");
    await expect(getObject("uploads/stream.txt")).rejects.toMatchObject({ name: "NoSuchKey" });
  });
  it("keeps new private documents private and supports copied legacy keys on another replica", async () => {
    const buffer = Buffer.from("Financial fixture");
    const file = await storeFinancialIntakeFile({ originalname: "document.txt", mimetype: "text/plain", buffer, size: buffer.length } as Express.Multer.File);
    expect(file.storageKey).toMatch(/^s3:financial\//);
    expect(await readFinancialIntakeFile(file.storageKey)).toEqual(buffer);
    await deleteFinancialIntakeFile(file.storageKey);
    await mkdir(path.join(temporary, "legacy"), { recursive: true });
    await putObject("financial/legacy/document.txt", buffer, "text/plain");
    expect(await readFinancialIntakeFile("legacy/document.txt")).toEqual(buffer);
    await deleteFinancialIntakeFile("legacy/document.txt");
    await expect(getObject("financial/legacy/document.txt")).rejects.toMatchObject({ name: "NoSuchKey" });
  });
  it("rejects traversal and absolute object names", () => {
    for (const key of ["../private", "/private", "x/../private", "x\\private", "x//private"]) expect(() => safeObjectKey(key)).toThrow();
  });
});
