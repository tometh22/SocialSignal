import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { mindResources } from "./catalog";

type Field = { type: string; sqlType: string };
type Resource = { name: string; table: string; module: string; description: string; permissions: readonly string[];
  fields: Readonly<Record<string, Field>>; key: readonly string[];
  references: readonly { fields: readonly string[]; resource: string; targetFields: readonly string[] }[] };
type User = { id: number; email: string; is_admin: boolean; role: string; permissions: string[] };
const resources: readonly Resource[] = mindResources;
const internalPermissions = ["crm", "quotations", "projects", "operations", "status", "dashboard", "finance", "task_manager", "admin"];
const isAdmin = (u: User) => u.is_admin || u.role === "admin";
const has = (u: User, ...permissions: string[]) => isAdmin(u) || permissions.some(p => u.permissions?.includes(p));
const allowed = (u: User, r: Resource) => r.module === "admin" ? isAdmin(u) : has(u, ...r.permissions);
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
const financialField = /(cost|costo|salary|rate|budget|amount|margin|markup|billing|invoice|revenue|price|sales|usd|ars|^fx$)/i;
const secretKey = /password|passwd|secret|credential|authorization|cookie|private.?key|api.?key|access.?token|refresh.?token|public.?token|token.?hash|storage.?key|idempotency.?key|^token$|^auth$|^p256dh$/i;

export class MindDataError extends Error {}
const fail = (message: string): never => { throw new MindDataError(message); };

const scalar = z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]);
export const mindFilter = z.object({ field: z.string().max(100), op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in", "is_null", "not_null"]),
  value: z.union([scalar, z.array(scalar).min(1).max(100)]).optional() }).strict();
const baseQuery = { resource: z.string().max(100), filters: z.array(mindFilter).max(20).default([]),
  search: z.string().trim().max(200).default("") };
const paging = { limit: z.number().int().min(1).max(50).default(25), offset: z.number().int().min(0).max(1000000).default(0) };
export const mindQuerySchema = z.object({ ...baseQuery, ...paging,
  fields: z.array(z.string().max(100)).min(1).max(60).optional(),
  orderBy: z.array(z.object({ field: z.string().max(100), direction: z.enum(["asc", "desc"]).default("asc") })).max(3).default([]) }).strict();
export const mindAggregateSchema = z.object({ ...baseQuery, ...paging,
  groupBy: z.array(z.string().max(100)).max(4).default([]),
  metrics: z.array(z.object({ operation: z.enum(["count", "sum", "avg", "min", "max"]), field: z.string().max(100).optional() }).strict()).min(1).max(8),
}).strict();
export const mindFieldSchema = z.object({ resource: z.string().max(100), key: z.record(scalar), field: z.string().max(100),
  offset: z.number().int().min(0).max(10000000).default(0), length: z.number().int().min(1).max(16000).default(8000) }).strict();
export const mindCatalogSchema = z.object({ resource: z.string().max(100).optional(), query: z.string().trim().max(150).default(""), ...paging }).strict();

// Snapshots and JSON business content can embed credentials from old versions.
// Redact before either returning or chunking, including administrator responses.
export function redactMindSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMindSecrets);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).filter(([k]) => !secretKey.test(k)).map(([k, v]) => [k, redactMindSecrets(v)]));
}

function visibleFields(u: User, r: Resource) {
  return Object.fromEntries(Object.entries(r.fields).filter(([key]) =>
    (r.module === "personal" || has(u, "projects", "quotations", "operations", "finance", "dashboard") || !financialField.test(key)) &&
    (key !== "admin_notes" || has(u, "operations", "finance"))));
}

// All subqueries are fixed application policy, never supplied by the model.
function rowPolicy(u: User, r: Resource): string {
  const ownPerson = `SELECT id FROM personnel WHERE lower(trim(email))=lower(trim($2::text))`;
  const ownRoom = (room: string) => `EXISTS (SELECT 1 FROM review_rooms mr JOIN review_room_members mm ON mm.room_id=mr.id WHERE mr.id=${room} AND mm.user_id=$1 AND mr.archived_at IS NULL)`;
  const visibleItem = (alias: string) => `(( ${alias}.project_id IS NOT NULL AND EXISTS (SELECT 1 FROM project_status_reviews si WHERE si.room_id=${alias}.room_id AND si.project_id=${alias}.project_id AND si.hidden_from_weekly IS NOT TRUE)) OR (${alias}.weekly_status_item_id IS NOT NULL AND EXISTS (SELECT 1 FROM weekly_status_items si WHERE si.room_id=${alias}.room_id AND si.id=${alias}.weekly_status_item_id AND si.hidden_from_weekly IS NOT TRUE)))`;
  if (r.module === "status") {
    if (r.table === "status_item_proposal_attachments") return `EXISTS (SELECT 1 FROM status_item_proposals sp WHERE sp.id=t.proposal_id AND ${ownRoom("sp.room_id")} AND ${visibleItem("sp")})`;
    const room = r.table === "review_rooms" ? "t.id" : "t.room_id";
    let policy = ownRoom(room);
    if (["project_status_reviews", "weekly_status_items"].includes(r.table)) policy += " AND t.hidden_from_weekly IS NOT TRUE";
    if (["project_review_notes", "status_update_entries", "status_change_log", "status_item_proposals"].includes(r.table)) policy += ` AND ${visibleItem("t")}`;
    if (["review_daily_sessions", "review_item_read_state"].includes(r.table)) policy += " AND t.user_id=$1";
    return policy;
  }
  if (r.module === "chat") return `EXISTS (SELECT 1 FROM chat_conversation_participants cp WHERE cp.conversation_id=${r.table === "chat_conversations" ? "t.id" : "t.conversation_id"} AND cp.user_id=$1)`;
  if (["user_notifications", "user_notification_preferences", "personal_fx_overrides"].includes(r.table)) return "t.user_id=$1";
  if (["personnel_absences", "absence_allowances"].includes(r.table)) return has(u, "operations") ? "TRUE" : `t.personnel_id IN (${ownPerson})`;
  if (r.table === "absence_events") return has(u, "operations") ? "TRUE" : `EXISTS (SELECT 1 FROM personnel_absences a WHERE a.id=t.absence_id AND a.personnel_id IN (${ownPerson}))`;
  if (r.table === "personal_monthly_invoices") return has(u, "finance") ? "TRUE" : "t.user_id=$1";
  if (r.table === "personal_invoice_project_allocations") return has(u, "finance") ? "TRUE" : "EXISTS (SELECT 1 FROM personal_monthly_invoices i WHERE i.id=t.invoice_id AND i.user_id=$1)";
  if (r.table === "personnel_monthly_settlements") return has(u, "operations", "finance") ? "TRUE" : `t.personnel_id IN (${ownPerson}) AND t.published_at IS NOT NULL`;
  if (r.module === "tasks" && r.name !== "people_directory") {
    if (has(u, "operations", "task_manager")) return "TRUE";
    let project = "t.project_id";
    if (r.name === "task_projects") project = "t.id";
    if (["task_comments", "task_weekly_estimates", "task_time_entries"].includes(r.table)) project = "(SELECT tt.project_id FROM tasks tt WHERE tt.id=t.task_id)";
    if (r.table === "quick_time_entry_details") project = "(SELECT qt.project_id FROM quick_time_entries qt WHERE qt.id=t.quick_time_entry_id)";
    return `EXISTS (SELECT 1 FROM active_projects p WHERE p.id=${project} AND p.status='active' AND
      (EXISTS (SELECT 1 FROM task_project_members tm WHERE tm.project_id=p.id AND tm.personnel_id IN (${ownPerson})) OR
       EXISTS (SELECT 1 FROM tasks tt JOIN personnel pp ON pp.id=tt.assignee_id OR tt.collaborator_ids @> jsonb_build_array(pp.id) WHERE tt.project_id=p.id AND pp.id IN (${ownPerson}))))`;
  }
  return "TRUE";
}

export class MindDataReader {
  constructor(private pool: Pool, private origin: string) {}

  private async read<T>(userId: number, work: (db: PoolClient, user: User) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await db.query("SET LOCAL statement_timeout='5s'");
      const { rows } = await db.query<User>("SELECT id,email,is_admin,role,permissions FROM users WHERE id=$1 AND is_active IS NOT FALSE", [userId]);
      const user = rows[0];
      if (!user || user.role === "external_provider" || !has(user, ...internalPermissions)) fail("Cuenta sin acceso a Mind.");
      const result = await work(db, user);
      await db.query("COMMIT");
      return result;
    } catch (error) { await db.query("ROLLBACK"); throw error; }
    finally { db.release(); }
  }

  private resource(user: User, name: string) {
    const r = resources.find(r => r.name === name);
    if (!r || !allowed(user, r)) return fail("Recurso inexistente o sin permiso. Consultá list_mind_resources; no interpretes esto como ausencia de datos.");
    return r;
  }

  private async availableFields(db: PoolClient, u: User, r: Resource) {
    const { rows } = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1", [r.table]);
    const existing = new Set(rows.map(row => row.column_name));
    const fields = Object.fromEntries(Object.entries(visibleFields(u, r)).filter(([key]) => existing.has(key)));
    if (!Object.keys(fields).length) fail("Este recurso todavía no está disponible en el despliegue actual.");
    return fields;
  }

  async catalog(userId: number, input: z.input<typeof mindCatalogSchema>) {
    const args = mindCatalogSchema.parse(input);
    return this.read(userId, async (db, u) => {
      if (args.resource) {
        const r = this.resource(u, args.resource), fields = await this.availableFields(db, u, r);
        return { resource: r.name, module: r.module, description: r.description, key: r.key, fields,
          unavailableFields: Object.keys(visibleFields(u, r)).filter(key => !Object.hasOwn(fields, key)),
          references: r.references.filter(ref => resources.some(target => target.name === ref.resource && allowed(u, target))),
          sourceUrl: this.origin, retrievedAt: new Date().toISOString(),
          instructions: "Filtros combinados con AND. contains busca texto literal. Los nombres de campos usan snake_case. Usá IDs de resultados; no inventes relaciones. Los permisos se aplican también a totales." };
      }
      const matching = resources.filter(r => allowed(u, r) && `${r.name} ${r.module} ${r.description}`.toLowerCase().includes(args.query.toLowerCase()));
      return { resources: matching.slice(args.offset, args.offset + args.limit).map(r => ({ resource: r.name, module: r.module, description: r.description })),
        nextOffset: matching.length > args.offset + args.limit ? args.offset + args.limit : null, totalResources: matching.length,
        retrievedAt: new Date().toISOString(), instructions: "Pedí resource para ver campos, claves y relaciones antes de consultar. Credenciales, sesiones y configuración secreta no son datos de negocio disponibles." };
    });
  }

  private where(u: User, r: Resource, fields: Record<string, Field>, args: { filters: z.infer<typeof mindFilter>[]; search: string }) {
    // Keep $1/$2 typed even for resources with no row policy.
    const values: unknown[] = [u.id, u.email ?? ""];
    const bind = (value: unknown) => { values.push(value); return `$${values.length}`; };
    const conditions = ["$1::int IS NOT NULL", "$2::text IS NOT NULL", `(${rowPolicy(u, r)})`];
    for (const f of args.filters) {
      if (!Object.hasOwn(fields, f.field) || ["json", "array"].includes(fields[f.field].type)) fail("Campo de filtro no disponible o no escalar.");
      const col = `t.${quote(f.field)}`;
      if (f.op === "is_null" || f.op === "not_null") { conditions.push(`${col} IS ${f.op === "not_null" ? "NOT " : ""}NULL`); continue; }
      if (f.value === undefined) fail("El filtro requiere value.");
      if (f.value === null) {
        if (!["eq", "ne"].includes(f.op)) fail("Usá is_null o not_null para valores nulos.");
        conditions.push(`${col} IS ${f.op === "ne" ? "NOT " : ""}NULL`); continue;
      }
      if (f.op === "in") {
        if (!Array.isArray(f.value)) fail("in requiere una lista.");
        conditions.push(`${col} IN (${(f.value as unknown[]).map(bind).join(",")})`); continue;
      }
      if (Array.isArray(f.value)) fail("Este operador requiere un valor escalar.");
      if (f.op === "contains") {
        if (typeof f.value !== "string" || fields[f.field].type !== "string") fail("contains requiere un campo de texto y un texto.");
        conditions.push(`strpos(lower(${col}::text),lower(${bind(f.value)}::text))>0`); continue;
      }
      const op = { eq: "=", ne: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" }[f.op];
      conditions.push(`${col} ${op} ${bind(f.value)}`);
    }
    if (args.search) {
      const searchable = Object.entries(fields).filter(([, f]) => f.type === "string").map(([name]) => `coalesce(t.${quote(name)}::text,'')`);
      conditions.push(searchable.length ? `strpos(lower(concat_ws(' ',${searchable.join(",")})),lower(${bind(args.search)}::text))>0` : "FALSE");
    }
    return { sql: conditions.join(" AND "), values, bind };
  }

  async query(userId: number, input: z.input<typeof mindQuerySchema>) {
    const args = mindQuerySchema.parse(input);
    return this.read(userId, async (db, u) => {
      const r = this.resource(u, args.resource), fields = await this.availableFields(db, u, r);
      const selected = args.fields ?? Object.keys(fields);
      if (selected.some(f => !Object.hasOwn(fields, f))) fail("Campo solicitado inexistente o sin permiso.");
      if (!r.key.length || r.key.some(k => !Object.hasOwn(fields, k))) fail("El recurso no tiene una clave de paginación disponible.");
      const projection = [...new Set([...r.key, ...selected])];
      for (const order of args.orderBy) if (!Object.hasOwn(fields, order.field) || ["json", "array"].includes(fields[order.field].type)) fail("Orden no disponible.");
      const order = [...args.orderBy.map(o => `t.${quote(o.field)} ${o.direction.toUpperCase()} NULLS LAST`), ...r.key.map(k => `t.${quote(k)} ASC`)];
      const w = this.where(u, r, fields, args);
      const { rows } = await db.query(`SELECT ${projection.map(f => `t.${quote(f)}`).join(",")} FROM ${quote(r.table)} t WHERE ${w.sql} ORDER BY ${order.join(",")} LIMIT ${w.bind(args.limit + 1)} OFFSET ${w.bind(args.offset)}`, w.values);
      const items: Record<string, unknown>[] = [];
      let bytes = 0;
      for (const raw of rows.slice(0, args.limit)) {
        const row = redactMindSecrets(raw) as Record<string, unknown>;
        const key = Object.fromEntries(r.key.map(k => [k, raw[k]]));
        for (const [field, value] of Object.entries(row)) {
          const encoded = typeof value === "string" ? value : JSON.stringify(value);
          if (encoded && encoded.length > 4000) row[field] = { truncated: true, preview: encoded.slice(0, 2000),
            readWith: "read_mind_field", field, key };
        }
        if (Buffer.byteLength(JSON.stringify(row)) > 80000) {
          for (const [field, value] of Object.entries(row)) {
            const text = typeof value === "string" ? value : JSON.stringify(value);
            if (!r.key.includes(field) && text && text.length > 256) row[field] = { truncated: true, preview: text.slice(0, 128), readWith: "read_mind_field", field, key };
          }
        }
        const size = Buffer.byteLength(JSON.stringify(row));
        if (items.length && bytes + size > 160000) break;
        items.push(row); bytes += size;
      }
      return { resource: r.name, items, nextOffset: rows.length > items.length ? args.offset + items.length : null,
        sourceUrl: this.origin, retrievedAt: new Date().toISOString(),
        note: "Datos persistidos. Incluyen archivados/anulados si el recurso los tiene: filtrá explícitamente. nextOffset indica si faltan registros. No confundir fuentes, versiones o monedas." };
    });
  }

  async aggregate(userId: number, input: z.input<typeof mindAggregateSchema>) {
    const args = mindAggregateSchema.parse(input);
    return this.read(userId, async (db, u) => {
      const r = this.resource(u, args.resource), fields = await this.availableFields(db, u, r);
      const group = [...new Set(args.groupBy)];
      for (const field of group) if (!Object.hasOwn(fields, field) || ["json", "array"].includes(fields[field].type)) fail("Campo de agrupación no disponible.");
      // Always separate currency denominators, including if the caller forgets.
      if (args.metrics.some(m => m.operation !== "count")) {
        for (const c of ["quotation_currency", "currency", "currency_native", "invoice_currency", "moneda", "billing_currency"]) if (Object.hasOwn(fields, c) && !group.includes(c)) group.push(c);
      }
      const metrics = args.metrics.map((m, i) => {
        if (m.field && (!Object.hasOwn(fields, m.field) || ["json", "array"].includes(fields[m.field].type))) fail("Campo de métrica no disponible.");
        if (m.operation !== "count" && (!m.field || !["number", "bigint"].includes(fields[m.field].type) && !/^(numeric|decimal)/.test(fields[m.field].sqlType))) fail("La métrica requiere un campo numérico.");
        return `${m.operation.toUpperCase()}(${m.field ? `t.${quote(m.field)}` : "*"}) AS ${quote(`metric_${i}`)}`;
      });
      const w = this.where(u, r, fields, args), columns = group.map(f => `t.${quote(f)}`);
      const { rows } = await db.query(`SELECT ${[...columns, ...metrics].join(",")} FROM ${quote(r.table)} t WHERE ${w.sql}
        ${columns.length ? `GROUP BY ${columns.join(",")} ORDER BY ${columns.join(",")}` : ""} LIMIT ${w.bind(args.limit + 1)} OFFSET ${w.bind(args.offset)}`, w.values);
      return { resource: r.name, groups: group, metrics: args.metrics.map((m, i) => ({ ...m, resultField: `metric_${i}` })), items: rows.slice(0, args.limit),
        nextOffset: rows.length > args.limit ? args.offset + args.limit : null, sourceUrl: this.origin, retrievedAt: new Date().toISOString(),
        note: "Agregado sobre TODOS los registros autorizados que cumplen los filtros, no solo una página. Las monedas se separan; no sumar fuentes ni revisiones entre sí." };
    });
  }

  async field(userId: number, input: z.input<typeof mindFieldSchema>) {
    const args = mindFieldSchema.parse(input);
    return this.read(userId, async (db, u) => {
      const r = this.resource(u, args.resource), fields = await this.availableFields(db, u, r);
      if (!Object.hasOwn(fields, args.field) || !r.key.length || Object.keys(args.key).length !== r.key.length || r.key.some(k => !Object.hasOwn(args.key, k))) fail("Indicá un campo disponible y la clave completa del registro obtenida de query_mind.");
      const w = this.where(u, r, fields, { search: "", filters: r.key.map(k => ({ field: k, op: "eq", value: args.key[k] })) });
      const { rows } = await db.query(`SELECT t.${quote(args.field)} AS value FROM ${quote(r.table)} t WHERE ${w.sql} LIMIT 1`, w.values);
      if (!rows.length) fail("Registro inexistente o sin acceso.");
      const value = redactMindSecrets(rows[0].value), text = typeof value === "string" ? value : JSON.stringify(value);
      return { resource: r.name, key: args.key, field: args.field, encoding: typeof value === "string" ? "text" : "json", text: text.slice(args.offset, args.offset + args.length),
        totalCharacters: text.length, nextOffset: text.length > args.offset + args.length ? args.offset + args.length : null, retrievedAt: new Date().toISOString() };
    });
  }
}
