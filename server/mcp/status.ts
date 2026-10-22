import type { Pool } from "pg";
import { activeStatusUserSql } from "./oauth";

// No support/admin bypass through the agent: only active rooms the user belongs to.
const roomsCte = `accessible_rooms AS (
  SELECT r.id,r.name,r.description FROM review_rooms r
  JOIN review_room_members m ON m.room_id=r.id
  JOIN users u ON u.id=m.user_id
  WHERE m.user_id=$1 AND r.archived_at IS NULL AND ${activeStatusUserSql}
)`;

const itemsCte = `${roomsCte}, visible_items AS (
  SELECT 'project'::text AS kind,p.project_id AS id,p.room_id,
    COALESCE(NULLIF(a.name,''),q.project_name,'Proyecto '||a.id) AS title,c.name AS subtitle,
    a.status AS project_status,p.health_status,p.margin_status,p.team_strain,p.main_risk,
    p.current_action,p.next_milestone,p.next_milestone_date,p.deadline,p.owner_id,
    concat_ws(' ',o.first_name,o.last_name) AS owner_name,p.decision_needed,p.updated_at
  FROM project_status_reviews p JOIN accessible_rooms r ON r.id=p.room_id
  JOIN active_projects a ON a.id=p.project_id
  LEFT JOIN quotations q ON q.id=a.quotation_id LEFT JOIN clients c ON c.id=a.client_id
  LEFT JOIN users o ON o.id=p.owner_id WHERE p.hidden_from_weekly IS NOT TRUE
  UNION ALL
  SELECT 'custom',w.id,w.room_id,w.title,w.subtitle,NULL,w.health_status,w.margin_status,
    w.team_strain,w.main_risk,w.current_action,w.next_milestone,NULL,w.deadline,w.owner_id,
    concat_ws(' ',o.first_name,o.last_name),w.decision_needed,w.updated_at
  FROM weekly_status_items w JOIN accessible_rooms r ON r.id=w.room_id
  LEFT JOIN users o ON o.id=w.owner_id WHERE w.hidden_from_weekly IS NOT TRUE
)`;

function page<T>(rows: T[], limit: number, offset: number) {
  return { items: rows.slice(0, limit), nextOffset: rows.length > limit ? offset + limit : null };
}

export class MindStatusReader {
  constructor(private pool: Pool, private origin: string) {}
  private url(roomId: number) { return `${this.origin}/review/${roomId}`; }

  async listRooms(userId: number, query: string, limit: number, offset: number) {
    // A literal substring search, including member names, lets “Vick” find a shared room.
    const { rows } = await this.pool.query(`WITH ${roomsCte}
      SELECT r.*, COALESCE((SELECT json_agg(json_build_object('id',u.id,'name',concat_ws(' ',u.first_name,u.last_name)) ORDER BY u.id)
        FROM review_room_members m JOIN users u ON u.id=m.user_id WHERE m.room_id=r.id),'[]') AS members
      FROM accessible_rooms r WHERE $2='' OR strpos(lower(r.name||' '||COALESCE(r.description,'')),lower($2))>0
        OR EXISTS (SELECT 1 FROM review_room_members m JOIN users u ON u.id=m.user_id
          WHERE m.room_id=r.id AND strpos(lower(concat_ws(' ',u.first_name,u.last_name)),lower($2))>0)
      ORDER BY r.id LIMIT $3 OFFSET $4`, [userId, query, limit + 1, offset]);
    return { ...page(rows.map(r => ({ ...r, url: this.url(r.id) })), limit, offset), retrievedAt: new Date().toISOString() };
  }

  async room(userId: number, roomId: number) {
    const { rows } = await this.pool.query(`WITH ${roomsCte} SELECT * FROM accessible_rooms WHERE id=$2`, [userId, roomId]);
    if (!rows[0]) throw new StatusAccessError();
    return { ...rows[0], url: this.url(roomId) };
  }

  async getStatus(userId: number, roomId: number, limit: number, offset: number) {
    const room = await this.room(userId, roomId);
    const { rows } = await this.pool.query(`WITH ${itemsCte}
      SELECT * FROM visible_items WHERE room_id=$2 ORDER BY kind,id LIMIT $3 OFFSET $4`, [userId, roomId, limit + 1, offset]);
    return { room, ...page(rows, limit, offset), retrievedAt: new Date().toISOString(),
      timezone: "America/Argentina/Buenos_Aires" };
  }

  async getActivity(userId: number, roomId: number, since: string, until: string,
    kind: "project" | "custom" | undefined, itemId: number | undefined, limit: number, offset: number) {
    const room = await this.room(userId, roomId);
    const { rows } = await this.pool.query(`WITH ${itemsCte}, events AS (
      SELECT 'note'::text AS type,n.id,n.room_id,n.project_id,n.weekly_status_item_id,
        n.content,NULL::text AS field,NULL::text AS old_value,NULL::text AS new_value,
        n.author_id AS actor_id,n.created_at,n.note_date AS note_date FROM project_review_notes n WHERE n.room_id=$2
      UNION ALL
      SELECT 'update',e.id,e.room_id,e.project_id,e.weekly_status_item_id,e.content,NULL,NULL,NULL,
        e.author_id,e.created_at,NULL FROM status_update_entries e WHERE e.room_id=$2
      UNION ALL
      SELECT 'change',s.id,s.room_id,s.project_id,s.weekly_status_item_id,NULL,s.field_name,s.old_value,s.new_value,
        s.user_id,s.created_at,NULL FROM status_change_log s WHERE s.room_id=$2
    ) SELECT e.type,e.id,v.kind AS item_kind,v.id AS item_id,v.title,e.content,e.field,e.old_value,e.new_value,
      e.created_at,e.note_date,concat_ws(' ',u.first_name,u.last_name) AS author_name
      FROM events e JOIN visible_items v ON v.room_id=e.room_id AND
        ((v.kind='project' AND v.id=e.project_id) OR (v.kind='custom' AND v.id=e.weekly_status_item_id))
      LEFT JOIN users u ON u.id=e.actor_id
      WHERE e.room_id=$2 AND e.created_at >= $3::timestamptz AND e.created_at < $4::timestamptz
        AND ($5::text IS NULL OR v.kind=$5) AND ($6::integer IS NULL OR v.id=$6)
      ORDER BY e.created_at DESC,e.type,e.id DESC LIMIT $7 OFFSET $8`,
    [userId, roomId, since, until, kind ?? null, itemId ?? null, limit + 1, offset]);
    return { room, ...page(rows, limit, offset), since, until, retrievedAt: new Date().toISOString(),
      timezone: "America/Argentina/Buenos_Aires" };
  }
}

export class StatusAccessError extends Error {
  constructor() { super("Sala inexistente, archivada o sin acceso. Consultá list_status_rooms."); }
}
