// Read-only diagnostic: prints review rooms, their members, and the full
// item list (projects + custom) per "Mi Review" room, including archived ones.
// Useful to debug "vicky archived X but I still see it" issues.
//
// Run with: node scripts/diag-review-state.mjs
// Requires DATABASE_URL env var (same as fix-orphans.mjs).

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const print = (title, rows) => {
  console.log(`\n━━━ ${title} (${rows.length} filas) ━━━`);
  if (rows.length === 0) return;
  console.table(rows);
};

try {
  // 1. All review rooms
  const rooms = await client.query(`
    SELECT id, name, created_by, created_at, archived_at
    FROM   review_rooms
    ORDER  BY id
  `);
  print("Todas las salas (review_rooms)", rooms.rows);

  // 2. "Mi Review" rooms specifically — must be exactly 1 in a healthy system
  const miReviews = rooms.rows.filter(r => r.name === "Mi Review");
  console.log(`\n→ Cantidad de salas llamadas "Mi Review": ${miReviews.length}`);
  if (miReviews.length === 0) console.log("  ⚠ No hay sala Mi Review — corré la migración 0010.");
  if (miReviews.length > 1)   console.log("  ⚠ Hay MÁS DE UNA sala Mi Review — usuarios distintos pueden estar editando salas distintas.");

  // 3. Members of every Mi Review
  for (const r of miReviews) {
    const members = await client.query(`
      SELECT m.user_id, u.first_name || ' ' || u.last_name AS name, u.email, m.role, m.last_visited_at
      FROM   review_room_members m
      JOIN   users u ON u.id = m.user_id
      WHERE  m.room_id = $1
      ORDER  BY m.role DESC, u.first_name
    `, [r.id]);
    print(`Miembros de Mi Review (room_id=${r.id})`, members.rows);

    // 4. All items in this room — projects + custom — incl. archived
    const items = await client.query(`
      SELECT 'project' AS kind,
             psr.project_id AS item_id,
             COALESCE(c.name || ' / ' || q.project_name,
                      c.name, q.project_name, 'proj#' || psr.project_id) AS label,
             psr.hidden_from_weekly AS hidden,
             psr.updated_at,
             u.first_name || ' ' || u.last_name AS updated_by
      FROM   project_status_reviews psr
      LEFT JOIN active_projects ap ON ap.id = psr.project_id
      LEFT JOIN clients c          ON c.id = ap.client_id
      LEFT JOIN quotations q       ON q.id = ap.quotation_id
      LEFT JOIN users u            ON u.id = psr.updated_by
      WHERE  psr.room_id = $1
      UNION ALL
      SELECT 'custom' AS kind,
             wsi.id  AS item_id,
             wsi.title AS label,
             wsi.hidden_from_weekly AS hidden,
             wsi.updated_at,
             u.first_name || ' ' || u.last_name AS updated_by
      FROM   weekly_status_items wsi
      LEFT JOIN users u ON u.id = wsi.updated_by
      WHERE  wsi.room_id = $1
      ORDER  BY 5 DESC
    `, [r.id]);
    print(`Items en Mi Review (room_id=${r.id}) — todos, incluso archivados`, items.rows);

    // Quick filter: anything whose label mentions Movistar
    const movistar = items.rows.filter(x => /movistar/i.test(x.label || ""));
    if (movistar.length > 0) {
      print(`→ Items con "Movistar" en la sala ${r.id}`, movistar);
    } else {
      console.log(`  (ningún item con "Movistar" en la sala ${r.id})`);
    }
  }

  // 5. Recent change log — who touched what, last 30 events across all rooms
  const log = await client.query(`
    SELECT scl.created_at,
           scl.room_id,
           scl.project_id,
           scl.field_name,
           scl.old_value,
           scl.new_value,
           u.first_name || ' ' || u.last_name AS who
    FROM   status_change_log scl
    LEFT JOIN users u ON u.id = scl.user_id
    ORDER  BY scl.created_at DESC
    LIMIT  30
  `);
  print("Últimos 30 cambios (status_change_log)", log.rows);
} finally {
  client.release();
  await pool.end();
}
