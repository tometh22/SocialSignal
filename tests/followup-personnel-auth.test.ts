import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("alta, edición y baja de personal: sólo administración", () => {
  it("los tres endpoints exigen permiso de administración en el servidor", () => {
    const routes = source("server/routes.ts");
    for (const route of [
      'app.post("/api/personnel", requireAuth, requirePermission("admin")',
      'app.patch("/api/personnel/:id", requireAuth, requirePermission("admin")',
      'app.delete("/api/personnel/:id", requireAuth, requirePermission("admin")',
    ]) expect(routes).toContain(route);
  });

  it("la lectura sigue abierta a usuarios autenticados (el resto de la app depende de ella)", () => {
    expect(source("server/routes.ts")).toContain('app.get("/api/personnel", requireAuth, async');
  });

  it("todo uso de escritura de personal en el cliente vive dentro de la pantalla de administración", () => {
    expect(source("client/src/App.tsx")).toContain('path="/admin" component={Admin} requiredPermission="admin"');
    const clientFiles = ["client/src/pages/admin-fixed.tsx", "client/src/components/admin/inline-edit-personnel.tsx", "client/src/components/admin/SheetsSyncDialog.tsx"];
    for (const file of clientFiles) expect(source(file)).toMatch(/\/api\/personnel/);
    expect(source("client/src/pages/admin-fixed.tsx")).toContain("inline-edit-personnel");
    expect(source("client/src/pages/admin-fixed.tsx")).toContain("SheetsSyncDialog");
  });
});
