import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { activeStatusUserSql, tokenHash } from "./oauth";
import type { MindMcpConfig } from "./config";

const text = z.string().trim().max(20000).nullable().optional();
const date = z.string().datetime({ offset: true }).nullable().optional();
export const statusPatchSchema = z.object({
  healthStatus: z.enum(["verde", "amarillo", "rojo"]).optional(),
  marginStatus: z.enum(["alto", "medio", "bajo"]).optional(),
  teamStrain: z.enum(["alto", "medio", "bajo"]).optional(),
  mainRisk: text, currentAction: text, nextMilestone: text,
  nextMilestoneDate: date, deadline: date,
  ownerId: z.number().int().positive().nullable().optional(),
  decisionNeeded: z.enum(["ninguna", "priorizacion", "recursos", "reprecio", "salida"]).optional(),
}).strict().refine(p => Object.keys(p).length > 0, "Indicá al menos un cambio.");
const target = { roomId: z.number().int().positive(), kind: z.enum(["project", "custom"]), itemId: z.number().int().positive(),
  requestId: z.string().uuid().describe("UUID único por pedido; reutilizarlo al reintentar el mismo pedido para evitar duplicados.") };
export const statusEditSchema = z.object({ ...target, changes: statusPatchSchema }).strict();
export const statusNoteSchema = z.object({ ...target, content: z.string().trim().min(1).max(20000) }).strict();
const actionSchema = z.discriminatedUnion("operation", [
  statusEditSchema.extend({ operation: z.literal("edit") }),
  statusNoteSchema.extend({ operation: z.literal("note") }),
]);
type Action = z.infer<typeof actionSchema>;
export type StatusWriterIdentity = { userId: number; grantId: string };
export type StatusNoteNotifier = (db: PoolClient, note: { id: number; roomId: number; kind: "project" | "custom"; itemId: number; userId: number; title: string }) => Promise<void>;
const columns: Record<string, string> = { healthStatus: "health_status", marginStatus: "margin_status", teamStrain: "team_strain",
  mainRisk: "main_risk", currentAction: "current_action", nextMilestone: "next_milestone", nextMilestoneDate: "next_milestone_date",
  deadline: "deadline", ownerId: "owner_id", decisionNeeded: "decision_needed" };
export const statusFieldLabels: Record<string, string> = { healthStatus: "Semáforo", marginStatus: "Margen", teamStrain: "Carga del equipo",
  mainRisk: "Riesgo principal", currentAction: "Estado actual / avance", nextMilestone: "Próximo hito", nextMilestoneDate: "Fecha del hito",
  deadline: "Fecha límite", ownerId: "Responsable", decisionNeeded: "Decisión pendiente" };
export class StatusWriteError extends Error {
  constructor(message: string, readonly status = 403) { super(message); }
}

export class MindStatusWriter {
  constructor(private pool: Pool, private config: MindMcpConfig, private notifyNote?: StatusNoteNotifier) {}
  private async transaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SET LOCAL statement_timeout='5s'");
      const result = await fn(db);
      await db.query("COMMIT");
      return result;
    } catch (error) { await db.query("ROLLBACK"); throw error; }
    finally { db.release(); }
  }
  private async access(db: PoolClient, identity: StatusWriterIdentity, roomId: number) {
    // Share locks serialize revocation, scope reduction, deactivation and membership removal with commit.
    const grant = await db.query(`SELECT g.id FROM mcp_oauth_grants g JOIN users u ON u.id=g.user_id
      WHERE g.id=$1 AND g.user_id=$2 AND g.client_id=$3 AND g.resource=$4 AND g.revoked_at IS NULL
      AND 'status:write'=ANY(g.scopes) AND (g.access_expires_at>now() OR g.refresh_expires_at>now())
      AND ${activeStatusUserSql} AND u.role IS DISTINCT FROM 'external_provider' FOR SHARE OF g,u`,
    [identity.grantId, identity.userId, this.config.clientId, this.config.resource]);
    if (!grant.rowCount) throw new StatusWriteError("La autorización de edición venció, fue revocada o no tenés permiso. Reconectá con status:write.");
    const room = await db.query(`SELECT r.name FROM review_rooms r JOIN review_room_members m ON m.room_id=r.id
      WHERE r.id=$1 AND m.user_id=$2 AND m.role IN ('owner','editor') AND r.archived_at IS NULL FOR SHARE OF r,m`, [roomId, identity.userId]);
    if (!room.rowCount) throw new StatusWriteError("Sala archivada o sin permiso de edición. Se requiere membresía en la sala.");
    return room.rows[0].name as string;
  }
  private async item(db: PoolClient, action: Action) {
    const table = action.kind === "project" ? "project_status_reviews" : "weekly_status_items";
    const key = action.kind === "project" ? "project_id" : "id";
    const result = await db.query(`SELECT to_jsonb(s) AS snapshot FROM ${table} s
      WHERE room_id=$1 AND ${key}=$2 AND hidden_from_weekly IS NOT TRUE FOR UPDATE`, [action.roomId, action.itemId]);
    if (result.rowCount !== 1) throw new StatusWriteError("Ítem inexistente, oculto o fuera de la sala.");
    const row = result.rows[0].snapshot;
    let title = row.title;
    if (action.kind === "project") {
      const p = await db.query(`SELECT COALESCE(NULLIF(a.name,''),q.project_name,'Proyecto '||a.id) AS title
        FROM active_projects a LEFT JOIN quotations q ON q.id=a.quotation_id WHERE a.id=$1`, [action.itemId]);
      if (!p.rowCount) throw new StatusWriteError("Proyecto inexistente.");
      title = p.rows[0].title;
    }
    return { table, key, row, title: String(title), fingerprint: tokenHash(JSON.stringify(row)) };
  }
  private async ownerName(db: PoolClient, id: number | null) {
    if (id == null) return "Sin responsable";
    const { rows } = await db.query("SELECT concat_ws(' ',first_name,last_name) AS name FROM users WHERE id=$1", [id]);
    return rows[0]?.name || `Usuario ${id}`;
  }
  private async validateOwner(db: PoolClient, action: Action) {
    if (action.operation !== "edit" || action.changes.ownerId == null) return;
    const { rowCount } = await db.query("SELECT id FROM users WHERE id=$1 AND is_active IS NOT FALSE FOR SHARE", [action.changes.ownerId]);
    if (!rowCount) throw new StatusWriteError("El responsable debe ser un usuario activo.", 400);
  }
  async prepare(identity: StatusWriterIdentity, input: unknown) {
    const parsed = actionSchema.safeParse(input);
    if (!parsed.success) throw new StatusWriteError("Pedido inválido: revisá campos, tipos, fechas ISO y requestId.", 400);
    const action = parsed.data;
    if (action.operation === "edit" && action.kind === "custom" && action.changes.nextMilestoneDate !== undefined) {
      throw new StatusWriteError("Los temas adicionales no tienen fecha de hito; usá deadline.", 400);
    }
    return this.transaction(async db => {
      const roomName = await this.access(db, identity, action.roomId);
      // Serialize duplicate preparations before reading the item or inserting an action.
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`${identity.grantId}:${action.requestId}`]);
      const old = await db.query("SELECT * FROM mcp_status_actions WHERE grant_id=$1 AND request_id=$2", [identity.grantId, action.requestId]);
      if (old.rows[0]) {
        if (tokenHash(JSON.stringify(action)) !== old.rows[0].request_hash) throw new StatusWriteError("requestId ya usado para otro pedido.", 409);
        return this.result(old.rows[0]);
      }
      const item = await this.item(db, action);
      await this.validateOwner(db, action);
      const changes = [];
      if (action.operation === "edit") for (const [field, raw] of Object.entries(action.changes)) {
        const value = field === "currentAction" ? raw ?? "" : raw;
        const before = item.row[columns[field]] ?? null;
        if (before === value) continue;
        changes.push({ field, label: statusFieldLabels[field], before, after: value,
          ...(field === "ownerId" ? { beforeName: await this.ownerName(db, before), afterName: await this.ownerName(db, value as number | null) } : {}) });
      }
      if (action.operation === "edit" && changes.length === 0) throw new StatusWriteError("El ítem ya tiene esos valores; no hay cambios para guardar.", 400);
      const preview = { roomName, title: item.title, changes, ...(action.operation === "note" ? { note: action.content } : {}) };
      const { rows } = await db.query(`INSERT INTO mcp_status_actions
        (id,grant_id,user_id,request_id,request_hash,action,preview,fingerprint,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+interval '15 minutes') RETURNING *`,
      [randomUUID(), identity.grantId, identity.userId, action.requestId, tokenHash(JSON.stringify(action)), action, preview, item.fingerprint]);
      // Bound retention of abandoned requests; applied changes remain in the normal Status audit history.
      await db.query("DELETE FROM mcp_status_actions WHERE user_id=$1 AND expires_at < now()-interval '1 day'", [identity.userId]);
      return this.result(rows[0]);
    });
  }
  private result(row: any) {
    return { id: row.id, state: row.state === "pending" && new Date(row.expires_at) < new Date() ? "expired" : row.state,
      ...row.preview, roomId: row.action.roomId, kind: row.action.kind, itemId: row.action.itemId,
      expiresAt: new Date(row.expires_at).toISOString(), roomUrl: `${this.config.origin}/review/${row.action.roomId}`,
      confirmationUrl: `${this.config.origin}/mcp/status-changes/${row.id}`,
      instruction: "Pendiente no significa guardado. El usuario debe abrir confirmationUrl, revisar y confirmar en Mind. No confirmar en su nombre." };
  }
  async inspect(userId: number, id: string, grantId?: string) {
    return this.transaction(async db => {
      const row = await this.load(db, userId, id, grantId);
      await this.access(db, { userId, grantId: row.grant_id }, row.action.roomId);
      await this.item(db, actionSchema.parse(row.action));
      return this.result(row);
    });
  }
  private async load(db: PoolClient, userId: number, id: string, grantId?: string) {
    if (!z.string().uuid().safeParse(id).success) throw new StatusWriteError("Solicitud no disponible.", 404);
    const { rows } = await db.query(`SELECT * FROM mcp_status_actions WHERE id=$1 AND user_id=$2
      AND ($3::text IS NULL OR grant_id=$3) FOR UPDATE`, [id, userId, grantId ?? null]);
    if (!rows[0]) throw new StatusWriteError("Solicitud no disponible para esta cuenta.", 404);
    return rows[0];
  }
  async decide(userId: number, id: string, allow: boolean) {
    return this.transaction(async db => {
      const row = await this.load(db, userId, id);
      const action = actionSchema.parse(row.action);
      await this.access(db, { userId, grantId: row.grant_id }, action.roomId);
      if (row.state !== "pending") return this.result(row); // Repeated submissions never duplicate notes/history.
      if (new Date(row.expires_at) < new Date()) throw new StatusWriteError("Solicitud vencida. Pedí un nuevo cambio al agente.", 410);
      if (allow) {
        const item = await this.item(db, action);
        if (item.fingerprint !== row.fingerprint) throw new StatusWriteError("El Status cambió desde la propuesta. Pedí al agente una propuesta nueva para no sobrescribir cambios.", 409);
        await this.validateOwner(db, action);
        const target = [action.roomId, action.kind === "project" ? action.itemId : null, action.kind === "custom" ? action.itemId : null];
        if (action.operation === "note") {
          const note = await db.query(`INSERT INTO project_review_notes(room_id,project_id,weekly_status_item_id,author_id,content)
            VALUES($1,$2,$3,$4,$5) RETURNING id`, [...target, userId, action.content]);
          await this.notifyNote?.(db, { id: note.rows[0].id, roomId: action.roomId, kind: action.kind, itemId: action.itemId, userId, title: item.title });
        } else {
          const changes: { field: string; before: any; after: any }[] = row.preview.changes;
          const assignments = changes.map((c, i) => `${columns[c.field]}=$${i + 4}`).join(",");
          await db.query(`UPDATE ${item.table} SET ${assignments},updated_at=now(),updated_by=$3
            WHERE room_id=$1 AND ${item.key}=$2`, [action.roomId, action.itemId, userId, ...changes.map(c => c.after)]);
          for (const c of changes) {
            await db.query(`INSERT INTO status_change_log(room_id,project_id,weekly_status_item_id,user_id,field_name,old_value,new_value)
              VALUES($1,$2,$3,$4,$5,$6,$7)`, [...target, userId, c.field, c.before == null ? null : String(c.before), c.after == null ? null : String(c.after)]);
            if (c.field === "currentAction") await db.query(`INSERT INTO status_update_entries(room_id,project_id,weekly_status_item_id,author_id,content)
              VALUES($1,$2,$3,$4,$5)`, [...target, userId, c.after]);
          }
        }
      }
      const { rows } = await db.query("UPDATE mcp_status_actions SET state=$2,decided_at=now() WHERE id=$1 RETURNING *", [id, allow ? "applied" : "cancelled"]);
      return this.result(rows[0]);
    });
  }
}
