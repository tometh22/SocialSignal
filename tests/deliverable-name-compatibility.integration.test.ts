import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { deliverables } from "../shared/schema";
import { deliverableNameCompatibilityMigrationSql } from "../server/migrations/deliverable-name-compatibility";

const url = process.env.FINANCIAL_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Only a local test database is allowed");
const namespace = `deliverable_compat_test_${process.pid}`;
let client: Client;

describe.skipIf(!url)("deliverable names against the production legacy contract", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: url }); await client.connect();
    await client.query(`CREATE SCHEMA ${namespace}; SET search_path TO ${namespace}`);
    const dialect = new PgDialect();
    const columns = getTableConfig(deliverables).columns.map(c => {
      const v = c.default;
      const d = v instanceof SQL ? dialect.sqlToQuery(v).sql : v === undefined ? undefined : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${(typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll("'", "''")}'`;
      return `"${c.name}" ${c.getSQLType()}${c.primary ? " PRIMARY KEY" : ""}${c.notNull ? " NOT NULL" : ""}${d ? " DEFAULT " + d : ""}`;
    });
    // Deliberate production drift: the legacy required title is NOT in Drizzle.
    await client.query(`CREATE TABLE deliverables (${columns.join(",")},title text NOT NULL)`);
  });
  afterAll(async () => { if (client) { await client.query(`DROP SCHEMA ${namespace} CASCADE`); await client.end(); } });
  it("reproduces the exact failure and allows the unchanged canonical writer after migration", async () => {
    const db = drizzle(client);
    const values = { clientId: 1, name: "Informe vendido", deliveryMonth: "2026-10", sourceScopeItemId: "scope-qa:1", acceptanceCriteria: ["Criterio QA"], slaDefinition: { level: "standard" } };
    await expect(db.insert(deliverables).values(values).returning()).rejects.toMatchObject({ cause: { code: "23502", column: "title" } });
    await client.query(deliverableNameCompatibilityMigrationSql);
    const [created] = await db.insert(deliverables).values(values).returning();
    expect(created.name).toBe("Informe vendido");
    const raw = (await client.query("SELECT name,title,source_scope_item_id,acceptance_criteria FROM deliverables WHERE id=$1", [created.id])).rows[0];
    expect(raw).toEqual({ name: "Informe vendido", title: "Informe vendido", source_scope_item_id: "scope-qa:1", acceptance_criteria: ["Criterio QA"] });
  });
  it("preserves old titles and quality values across repeated migrations", async () => {
    await client.query("INSERT INTO deliverables(client_id,name,title,delivery_month,narrative_quality) VALUES(1,'Nombre anterior','Título histórico','2026-10',4.5)");
    const before = (await client.query("SELECT to_jsonb(d) data FROM deliverables d ORDER BY id")).rows;
    await client.query(readFileSync("migrations/0090_deliverable_name_compatibility.sql", "utf8"));
    await client.query(deliverableNameCompatibilityMigrationSql);
    expect((await client.query("SELECT to_jsonb(d) data FROM deliverables d ORDER BY id")).rows).toEqual(before);
  });
  it("supports legacy writes and edits through either name without dropping required-name validation", async () => {
    const { rows: [row] } = await client.query("INSERT INTO deliverables(client_id,title,delivery_month) VALUES(1,'Título de escritor antiguo','2026-10') RETURNING id,name,title");
    expect(row.name).toBe(row.title);
    await client.query("UPDATE deliverables SET name='Nombre corregido' WHERE id=$1", [row.id]);
    expect((await client.query("SELECT title FROM deliverables WHERE id=$1", [row.id])).rows[0].title).toBe("Nombre corregido");
    await client.query("UPDATE deliverables SET title='Título corregido' WHERE id=$1", [row.id]);
    expect((await client.query("SELECT name FROM deliverables WHERE id=$1", [row.id])).rows[0].name).toBe("Título corregido");
    await expect(client.query("INSERT INTO deliverables(client_id,delivery_month) VALUES(1,'2026-10')")).rejects.toMatchObject({ code: "23502" });
  });
  it("also installs on a fresh schema and fills the added alias from existing names", async () => {
    await client.query("DROP TABLE deliverables; CREATE TABLE deliverables(id serial PRIMARY KEY,name text NOT NULL); INSERT INTO deliverables(name) VALUES('Nombre canónico')");
    await client.query(deliverableNameCompatibilityMigrationSql);
    expect((await client.query("SELECT name,title FROM deliverables")).rows).toEqual([{ name: "Nombre canónico", title: "Nombre canónico" }]);
    await client.query("INSERT INTO deliverables(name) VALUES('Nuevo nombre')");
    expect((await client.query("SELECT title FROM deliverables ORDER BY id DESC LIMIT 1")).rows[0].title).toBe("Nuevo nombre");
  });
});
