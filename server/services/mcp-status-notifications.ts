import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import type { StatusNoteNotifier } from "../mcp/status-write";
import { createUserNotifications } from "./user-notifications";

// Use the existing permission/preference-aware outbox on the same PG transaction as the note.
export const notifyMcpStatusNote: StatusNoteNotifier = async (client, note) => {
  const column = note.kind === "project" ? "project_id" : "weekly_status_item_id";
  const previous = await client.query(`SELECT DISTINCT author_id FROM project_review_notes
    WHERE room_id=$1 AND ${column}=$2 AND id<>$3 AND author_id<>$4`, [note.roomId, note.itemId, note.id, note.userId]);
  const author = await client.query("SELECT concat_ws(' ',first_name,last_name) AS name FROM users WHERE id=$1", [note.userId]);
  const itemKey = `${note.kind === "project" ? "p" : "c"}_${note.itemId}`;
  await createUserNotifications(previous.rows.map(r => Number(r.author_id)), {
    eventKey: `mind-reply:${note.id}`, type: "mind_reply", title: "Nueva respuesta en Mind",
    message: `${author.rows[0]?.name || "Alguien"} respondió en “${note.title}”.`,
    entityType: "review_room", entityId: note.roomId, threadKey: `mind:${note.roomId}:${itemKey}`,
    actionUrl: `/review/${note.roomId}?item=${itemKey}&noteId=${note.id}`,
  }, drizzle(client, { schema }));
};
