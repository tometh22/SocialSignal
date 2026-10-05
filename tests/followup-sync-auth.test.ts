import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { requirePermission } from "../server/middleware/requirePermission";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

function run(user: unknown) {
  let status = 0;
  let nextCalled = false;
  const res: any = { status(code: number) { status = code; return this; }, json() { return this; } };
  requirePermission("admin")({ user } as any, res, () => { nextCalled = true; });
  return { status, nextCalled };
}

describe("sync de valor hora: sólo administración", () => {
  it("el middleware deja pasar a admins y rechaza al resto (incluido Operaciones)", () => {
    expect(run(undefined)).toEqual({ status: 401, nextCalled: false });
    expect(run({ permissions: ["operations"] })).toEqual({ status: 403, nextCalled: false });
    expect(run({ permissions: ["quotations", "projects"] })).toEqual({ status: 403, nextCalled: false });
    expect(run({ permissions: ["admin"] }).nextCalled).toBe(true);
    expect(run({ isAdmin: true, permissions: [] }).nextCalled).toBe(true);
  });

  it("los tres endpoints de sync (preview, apply y auto-apply) lo exigen, igual que la pantalla que los usa", () => {
    const routes = source("server/routes.ts");
    for (const route of [
      'app.get("/api/personnel/sheets-sync/preview", requireAuth, requirePermission("admin")',
      'app.post("/api/personnel/sheets-sync/apply", requireAuth, requirePermission("admin")',
      'app.post("/api/personnel/sheets-sync/auto-apply", requireAuth, requirePermission("admin")',
    ]) expect(routes).toContain(route);
    expect(source("client/src/App.tsx")).toContain('path="/admin" component={Admin} requiredPermission="admin"');
  });
});
