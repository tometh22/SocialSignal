import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";
import * as schema from "../shared/schema";
import { mindResources, excludedMindTables } from "../server/mcp/catalog";
import { MindDataReader } from "../server/mcp/data";

const tables = Object.values(schema).filter(t => is(t, Table));
const q = (s: string) => '"' + s.replaceAll('"', '""') + '"';

describe("Mind business catalog contract", () => {
  it("classifies every schema table explicitly and never silently publishes new columns", () => {
    const catalogTables = new Set(mindResources.map(r => r.table));
    for (const table of tables) expect(catalogTables.has(getTableName(table)) || Object.hasOwn(excludedMindTables, getTableName(table)), getTableName(table)).toBe(true);
    expect(new Set(mindResources.map(r => r.name)).size).toBe(mindResources.length);
    for (const r of mindResources) {
      const table = tables.find(t => getTableName(t) === r.table)!;
      expect(table, r.name).toBeDefined();
      const fields = new Set(Object.values(getTableColumns(table)).map(c => c.name));
      expect(r.key.length, r.name).toBeGreaterThan(0);
      for (const key of [...Object.keys(r.fields), ...r.key]) expect(fields.has(key), `${r.name}.${key}`).toBe(true);
      expect(Object.keys(r.fields).join(" ")).not.toMatch(/password|token_hash|storage_key|idempotency_key_hash/);
    }
  });
});

describe.skipIf(!process.env.TEST_MCP_DATABASE_URL)("Mind data: read-only SQL, permissions, full catalog and analytics", () => {
  const namespace = `mind_data_${randomUUID().replaceAll("-", "")}`;
  let admin: pg.Pool, pool: pg.Pool, reader: MindDataReader;
  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.TEST_MCP_DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${namespace}`);
    pool = new pg.Pool({ connectionString: process.env.TEST_MCP_DATABASE_URL, options: `-c search_path=${namespace}` });
    // Full schema-shaped tables exercise every projection and policy, including optional modules.
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map(c => `${q(c.name)} ${c.getSQLType() === "view_type" ? "text" : c.getSQLType()}`);
      await pool.query(`CREATE TABLE ${q(getTableName(table))} (${columns.join(",")})`);
    }
    for (const [id, permission] of [[1,"admin"],[2,"quotations"],[3,"task_manager"],[4,"projects"],[5,"status"],[6,"finance"],[7,"operations"],[8,"crm"],[9,"status"],[10,"status"]] as const) {
      await pool.query("INSERT INTO users(id,email,first_name,is_admin,is_active,role,permissions) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, `person${id}@test.invalid`, `User ${id}`, id === 1, id !== 9, id === 10 ? "external_provider" : "member", [permission]]);
      await pool.query("INSERT INTO personnel(id,email,name,hourly_rate,monthly_fixed_salary) VALUES($1,$2,$3,100,10000)", [id, `person${id}@test.invalid`, `Person ${id}`]);
    }
    await pool.query(`INSERT INTO clients(id,name) VALUES(1,'Cliente Uno'),(2,'Cliente Dos');
      INSERT INTO quotations(id,client_id,project_name,status,total_amount,quotation_currency,public_token_hash) VALUES
        (1,1,'Escucha regional','draft',100,'USD','SECRET'),(2,1,'Escucha mensual','approved',200,'USD','SECRET'),(3,2,'Otra cuenta','approved',30000,'ARS','SECRET');
      INSERT INTO quotation_team_members(id,quotation_id,personnel_id,hours,rate,cost) VALUES(1,1,2,10,10,100);
      INSERT INTO active_projects(id,name,status,budget) VALUES(100,'Proyecto visible','active',1000),(200,'Proyecto ajeno','active',2000);
      INSERT INTO task_project_members(id,project_id,personnel_id) VALUES(1,100,4),(2,100,3);
      INSERT INTO tasks(id,project_id,title,assignee_id,collaborator_ids) VALUES(1,100,'Mi tarea',4,'[]'),(2,200,'Otra tarea',2,'[]'),(3,200,'Asignación sin membresía',4,'[]');
      INSERT INTO task_time_entries(id,task_id,personnel_id,hours,total_cost,hourly_rate_at_time) VALUES(1,1,4,2,200,100),(2,2,2,1,100,100),(3,1,3,3,300,100);
      INSERT INTO chat_conversations(id,title) VALUES(1,'Privada de cotizaciones'),(2,'Privada de proyectos');
      INSERT INTO chat_conversation_participants(id,conversation_id,user_id) VALUES(1,1,2),(2,2,4);
      INSERT INTO chat_messages(id,conversation_id,sender_id,content) VALUES(1,1,2,'Mi conversación'),(2,2,4,'Ajena');
      INSERT INTO personal_monthly_invoices(id,user_id,declared_invoice_amount,invoice_currency) VALUES(1,2,500,'USD'),(2,4,700,'USD');
      INSERT INTO personnel_absences(id,personnel_id,notes) VALUES(1,2,'Privada'),(2,4,'Ajena');
      INSERT INTO review_rooms(id,name) VALUES(10,'Compartida'),(20,'Ajena');
      INSERT INTO review_room_members(id,room_id,user_id) VALUES(1,10,1),(2,10,5),(3,20,6);
      INSERT INTO weekly_status_items(id,room_id,title,hidden_from_weekly) VALUES(1,10,'Visible',false),(2,10,'Oculto',true),(3,20,'Ajeno',false);
      INSERT INTO status_item_proposals(id,room_id,weekly_status_item_id,content) VALUES(1,10,1,'Visible'),(2,10,2,'Oculto'),(3,20,3,'Ajeno');
      INSERT INTO status_item_proposal_attachments(id,proposal_id,file_name) VALUES(1,1,'Visible'),(2,2,'Oculto'),(3,3,'Ajeno');`);
    await pool.query("INSERT INTO proposal_documents(id,quotation_id,content) VALUES(1,1,$1)", [JSON.stringify({ body: "Propuesta extensa ".repeat(1000), nested: { password: "SECRET", public_token_hash: "SECRET", token: "SECRET", title: "Permitido" } })]);
    reader = new MindDataReader(pool, "https://mind.example");
  }, 30000);
  afterAll(async () => {
    await pool?.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`); await admin.end(); }
  });

  it("queries every registered resource against schema-shaped PostgreSQL tables", async () => {
    for (const resource of mindResources) {
      const result = await reader.query(1, { resource: resource.name, limit: 1 });
      expect(result.resource).toBe(resource.name);
      const totals = await reader.aggregate(1, { resource: resource.name, metrics: [{ operation: "count" }] });
      expect(totals.items).toHaveLength(1);
    }
  }, 30000);
  it("enforces module permissions in discovery, queries, filters, aggregates and chunks", async () => {
    const catalog = await reader.catalog(2, { query: "cotizaciones", limit: 50 });
    expect(catalog.resources?.some(r => r.resource === "quotations")).toBe(true);
    expect((await reader.catalog(2, { resource: "quotations" })).fields).not.toHaveProperty("public_token_hash");
    await expect(reader.query(5, { resource: "quotations" })).rejects.toThrow("sin permiso");
    await expect(reader.aggregate(2, { resource: "cashflow_transactions", metrics: [{ operation: "count" }] })).rejects.toThrow("sin permiso");
    await expect(reader.field(5, { resource: "proposal_documents", key: { id: 1 }, field: "content" })).rejects.toThrow("sin permiso");
    await expect(reader.query(2, { resource: "quotations", fields: ["public_token_hash"] })).rejects.toThrow();
    for (const resource of Object.keys(excludedMindTables)) await expect(reader.query(1, { resource })).rejects.toThrow();
    await expect(reader.catalog(9, {})).rejects.toThrow("sin acceso");
    await expect(reader.catalog(10, {})).rejects.toThrow("sin acceso");
  });
  it("supports quotation exploration, relations, pagination and whole-set currency-separated totals", async () => {
    const first = await reader.query(2, { resource: "quotations", search: "Escucha", limit: 1 });
    expect(first.items[0].id).toBe(1); expect(first.nextOffset).toBe(1);
    const next = await reader.query(2, { resource: "quotations", search: "Escucha", offset: first.nextOffset!, limit: 1 });
    expect(next.items[0].id).toBe(2); expect(next.nextOffset).toBeNull();
    const team = await reader.query(2, { resource: "quotation_team_members", filters: [{ field: "quotation_id", op: "eq", value: 1 }] });
    expect(team.items[0].personnel_id).toBe(2);
    expect((await reader.query(2, { resource: "people_directory", filters: [{ field: "id", op: "eq", value: 2 }] })).items[0].name).toBe("Person 2");
    const total = await reader.aggregate(2, { resource: "quotations", metrics: [{ operation: "count" }, { operation: "sum", field: "total_amount" }] });
    expect(total.groups).toEqual(["quotation_currency"]);
    expect(total.items).toEqual([{ quotation_currency: "ARS", metric_0: "1", metric_1: 30000 }, { quotation_currency: "USD", metric_0: "2", metric_1: 300 }]);
    const approved = await reader.aggregate(2, { resource: "quotations", filters: [{ field: "status", op: "eq", value: "approved" }], metrics: [{ operation: "count" }] });
    expect(approved.items[0].metric_0).toBe("2");
  });
  it("does not let SQL input, hidden fields, or aggregate filters bypass the allowlist", async () => {
    expect((await reader.query(2, { resource: "quotations", search: "' OR TRUE; DROP TABLE users; --" })).items).toEqual([]);
    await expect(reader.query(2, { resource: "quotations;DROP TABLE users" })).rejects.toThrow();
    await expect(reader.query(2, { resource: "quotations", filters: [{ field: "id) OR TRUE --", op: "eq", value: 1 }] })).rejects.toThrow();
    await expect(reader.query(2, { resource: "quotations", orderBy: [{ field: "public_token_hash", direction: "asc" }] })).rejects.toThrow();
    await expect(reader.aggregate(2, { resource: "quotations", groupBy: ["public_token_hash"], metrics: [{ operation: "count" }] })).rejects.toThrow();
    await expect(reader.aggregate(2, { resource: "quotations", metrics: [{ operation: "sum", field: "project_name" }] })).rejects.toThrow();
    expect((await pool.query("SELECT count(*) FROM users")).rows[0].count).toBe("10");
  });
  it("enforces task membership and prevents task-only users from reading financial columns", async () => {
    expect((await reader.query(4, { resource: "tasks" })).items.map(r => r.id)).toEqual([1]);
    expect((await reader.query(4, { resource: "active_projects" })).items.map(r => r.id)).toEqual([100]);
    await expect(reader.query(4, { resource: "tasks", fields: ["id", "logged_hours"] })).rejects.toThrow();
    await expect(reader.query(3, { resource: "objectives" })).rejects.toThrow();
    expect((await reader.query(4, { resource: "task_time_entries" })).items.map(r => r.id)).toEqual([1]);
    const entries = await reader.query(3, { resource: "task_time_entries" });
    expect(entries.items.map(row => row.id)).toEqual([3]); expect(entries.items[0]).not.toHaveProperty("total_cost");
    expect(entries.items[0]).not.toHaveProperty("hourly_rate_at_time");
    await expect(reader.query(3, { resource: "task_time_entries", filters: [{ field: "total_cost", op: "gt", value: 0 }] })).rejects.toThrow();
    await expect(reader.aggregate(3, { resource: "task_time_entries", metrics: [{ operation: "sum", field: "total_cost" }] })).rejects.toThrow();
    expect((await reader.query(3, { resource: "task_projects" })).items[0]).not.toHaveProperty("budget");
    await expect(reader.query(3, { resource: "personnel" })).rejects.toThrow();
    expect((await reader.query(3, { resource: "people_directory" })).items[0]).not.toHaveProperty("hourly_rate");
  });
  it("protects private conversations, personal records and hidden Status items even for administrators", async () => {
    expect((await reader.query(2, { resource: "chat_messages" })).items.map(r => r.id)).toEqual([1]);
    expect((await reader.query(1, { resource: "chat_messages" })).items).toEqual([]);
    expect((await reader.query(2, { resource: "personal_monthly_invoices" })).items.map(r => r.id)).toEqual([1]);
    expect((await reader.query(6, { resource: "personal_monthly_invoices" })).items).toHaveLength(2);
    expect((await reader.query(2, { resource: "personnel_absences" })).items.map(r => r.id)).toEqual([1]);
    expect((await reader.query(7, { resource: "personnel_absences" })).items).toHaveLength(2);
    for (const userId of [1,5]) {
      expect((await reader.query(userId, { resource: "weekly_status_items" })).items.map(r => r.id)).toEqual([1]);
      expect((await reader.query(userId, { resource: "status_item_proposals" })).items.map(r => r.id)).toEqual([1]);
      expect((await reader.query(userId, { resource: "status_item_proposal_attachments" })).items.map(r => r.id)).toEqual([1]);
      expect((await reader.aggregate(userId, { resource: "status_item_proposals", metrics: [{ operation: "count" }] })).items[0].metric_0).toBe("1");
    }
    await expect(reader.field(1, { resource: "status_item_proposals", key: { id: 2 }, field: "content" })).rejects.toThrow();
  });
  it("retrieves large proposal content in full while redacting nested credentials", async () => {
    const page = await reader.query(2, { resource: "proposal_documents", fields: ["content"] });
    expect((page.items[0].content as any).truncated).toBe(true);
    let offset: number | null = 0, combined = "";
    while (offset !== null) {
      const part = await reader.field(2, { resource: "proposal_documents", key: { id: 1 }, field: "content", offset, length: 5000 });
      combined += part.text; offset = part.nextOffset;
    }
    expect(combined).not.toContain("SECRET");
    expect(JSON.parse(combined)).toEqual({ body: "Propuesta extensa ".repeat(1000), nested: { title: "Permitido" } });
    await expect(reader.field(2, { resource: "proposal_documents", key: { quotation_id: 1 }, field: "content" })).rejects.toThrow();
  });
  it("rechecks changed permissions for each read", async () => {
    await pool.query("UPDATE users SET permissions=ARRAY['status'] WHERE id=8");
    await expect(reader.query(8, { resource: "crm_leads" })).rejects.toThrow();
  });
  it("tolerates old deployments with missing optional columns and reports unavailable tables", async () => {
    await pool.query("ALTER TABLE indirect_cost_categories DROP COLUMN remove_iva");
    const catalog = await reader.catalog(6, { resource: "indirect_cost_categories" });
    expect(catalog.unavailableFields).toEqual(["remove_iva"]);
    expect((await reader.query(6, { resource: "indirect_cost_categories" })).items).toEqual([]);
    await pool.query("DROP TABLE task_comments");
    await expect(reader.query(3, { resource: "task_comments" })).rejects.toThrow("todavía no está disponible");
  });
});
