import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { access } from "node:fs/promises";
import { financialIntakeUpload } from "../server/services/financial-intake-files";

describe("financial uploads stream to temporary disk with an aggregate limit", () => {
  let server: Server, base: string;
  const temporary: string[] = [];
  beforeAll(async () => {
    const app = express();
    app.post("/upload", (req, res) => financialIntakeUpload.array("files", 10)(req, res, error => {
      if (error) { res.status(400).json({ message: error.message }); return; }
      const files = req.files as Express.Multer.File[];
      temporary.push(...files.map(file => file.path));
      res.json(files.map(file => ({ onDisk: Boolean(file.path), inMemory: Boolean(file.buffer), size: file.size })));
    }));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  it("keeps files out of memory and removes temporary files after responding", async () => {
    const form = new FormData(); form.append("files", new Blob(["Valid text"], { type: "text/plain" }), "document.txt");
    const response = await fetch(`${base}/upload`, { method: "POST", body: form });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ onDisk: true, inMemory: false, size: 10 }]);
    await expect.poll(async () => { try { await access(temporary[0]); return false; } catch { return true; } }).toBe(true);
  });
  it("rejects a batch exceeding 40 MiB even when individual files fit", async () => {
    const form = new FormData();
    const content = new Blob([new Uint8Array(15 * 1024 * 1024)], { type: "application/pdf" });
    for (let index = 0; index < 3; index++) form.append("files", content, `${index}.pdf`);
    const response = await fetch(`${base}/upload`, { method: "POST", body: form });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("40 MB");
  }, 20_000);
});
