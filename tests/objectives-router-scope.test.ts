// El router de objetivos se monta en /api, así que un router.use() sin path se
// ejecuta para TODO lo que entra a /api — incluso para rutas que este router no
// maneja. Eso hacía que /api/crm/stages respondiera 403 a cualquier usuario sin
// permiso "status", porque el pedido moría acá antes de llegar al router de CRM.
//
// No hay tests de integración HTTP en el repo, y por eso ni tsc ni los tests lo
// atraparon. Este levanta un Express de verdad y pega los dos pedidos.
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type FakeUser = { id: number; isAdmin: boolean; permissions: string[] };

let baseUrl = "";
let server: ReturnType<express.Express["listen"]>;
let currentUser: FakeUser | null = null;

beforeAll(async () => {
  // El import tiene que ser dinámico: server/db.ts explota si no encuentra
  // DATABASE_URL al cargarse, y los imports estáticos se izan por encima de
  // cualquier asignación. El pool de node-postgres no conecta hasta la primera
  // consulta, así que una URL inválida alcanza para ejercitar el guard.
  process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";
  const { createObjectivesRouter } = await import("../server/routes-objectives");

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { (req as any).user = currentUser; next(); });

  const requireAuth = (req: any, res: any, next: any) =>
    req.user ? next() : res.status(401).json({ message: "No autenticado" });

  // Mismo montaje que producción: app.use('/api', createObjectivesRouter(...))
  app.use("/api", createObjectivesRouter(requireAuth as any));
  // Una ruta ajena registrada después, como el router de CRM.
  app.get("/api/crm/stages", (_req, res) => res.json({ stages: [] }));

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
});

afterAll(() => { server?.close(); });

const get = (path: string) => fetch(`${baseUrl}${path}`);

describe("el guard de objetivos no puede bloquear rutas ajenas", () => {
  it("un usuario sin permiso 'status' llega al CRM", async () => {
    currentUser = { id: 1, isAdmin: false, permissions: ["crm"] };
    const res = await get("/api/crm/stages");
    expect(res.status, "el guard de objetivos volvió a comerse el CRM").toBe(200);
    expect(await res.json()).toEqual({ stages: [] });
  });

  it("pero sigue sin poder ver objetivos", async () => {
    currentUser = { id: 1, isAdmin: false, permissions: ["crm"] };
    expect((await get("/api/objectives")).status).toBe(403);
  });

  it("y sin sesión no entra a ninguna de las dos", async () => {
    currentUser = null;
    expect((await get("/api/objectives")).status).toBe(401);
  });

  it("quien sí tiene 'status' pasa el guard", async () => {
    currentUser = { id: 2, isAdmin: false, permissions: ["status"] };
    // Pasa el permiso y entra al handler; falla después por la base falsa,
    // que es justamente la prueba de que el guard lo dejó pasar.
    expect((await get("/api/objectives")).status).not.toBe(403);
  });

  it("el admin pasa aunque no tenga el permiso listado", async () => {
    currentUser = { id: 3, isAdmin: true, permissions: [] };
    expect((await get("/api/objectives")).status).not.toBe(403);
  });
});
