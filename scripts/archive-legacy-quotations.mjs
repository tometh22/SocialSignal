/** Archivado controlado de cotizaciones legacy (reversible). Dry-run por defecto.
 *
 *   DATABASE_URL=… node scripts/archive-legacy-quotations.mjs --list "Animal Studio" "Arcos Dorados"
 *   DATABASE_URL=… node scripts/archive-legacy-quotations.mjs manifest.json            # vista previa
 *   DATABASE_URL=… node scripts/archive-legacy-quotations.mjs manifest.json --apply    # archiva
 *
 * manifest.json: { "label": "feedback-5-10", "quotations": [
 *   { "id": 123, "clientName": "Animal Studio", "projectName": "Diego Perez", "createdOn": "2025-08-27", "totalAmount": 1000,
 *     "status": "approved" (opcional), "allowLead": true (sólo si tiene lead y es intencional) } ] }
 *
 * Nunca borra: marca `archived_at` (se recupera con POST /api/quotations/:id/restore o el
 * diálogo de archivadas) y guarda un respaldo previo. Aborta si alguna cotización tiene
 * proyectos, vínculos, grupos o actividad comercial asociada, o si los datos del manifiesto
 * no coinciden exactamente con la fila (para no archivar otra cotización por un id mal copiado).
 */
import fs from 'node:fs';
import pg from 'pg';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const listMode = args.includes('--list');
const positional = args.filter((arg) => !arg.startsWith('--'));
if (!process.env.DATABASE_URL || positional.length === 0) {
  throw new Error('Uso: DATABASE_URL=… node scripts/archive-legacy-quotations.mjs (--list <cliente…> | manifest.json [--apply])');
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false } });
await db.connect();
try {
  if (listMode) {
    await db.query('BEGIN READ ONLY');
    const rows = (await db.query(
      `SELECT q.id, c.name AS client, q.project_name, q.status, q.total_amount, q.quotation_currency, q.created_at::date::text AS created_on, q.archived_at::text AS archived_at
       FROM quotations q LEFT JOIN clients c ON c.id = q.client_id
       WHERE c.name ILIKE ANY($1) ORDER BY c.name, q.created_at`, [positional.map((name) => `%${name}%`)])).rows;
    console.table(rows);
    await db.query('ROLLBACK');
    process.exit(0);
  }

  const manifest = JSON.parse(fs.readFileSync(positional[0], 'utf8'));
  if (!Array.isArray(manifest.quotations) || manifest.quotations.length === 0) throw new Error('Manifiesto vacío');
  const label = manifest.label || 'legacy-archive';
  const ids = manifest.quotations.map((item) => item.id);
  if (!ids.every(Number.isSafeInteger) || new Set(ids).size !== ids.length) throw new Error('Ids inválidos o repetidos en el manifiesto');
  for (const item of manifest.quotations) {
    if (!item.clientName || !item.projectName || !/^\d{4}-\d{2}-\d{2}$/.test(item.createdOn ?? '') || !Number.isFinite(Number(item.totalAmount))) {
      throw new Error(`Manifiesto incompleto para #${item.id}: se requieren clientName, projectName, createdOn (YYYY-MM-DD) y totalAmount numérico`);
    }
  }

  await db.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  if (apply) await db.query("SELECT pg_advisory_xact_lock(hashtext('mind-archive-legacy-quotations'))");

  // FOR UPDATE OF q: nadie edita estas cotizaciones entre la verificación y el archivado.
  const rows = (await db.query(
    `SELECT q.*, q.created_at::date::text AS created_on, c.name AS client_name FROM quotations q LEFT JOIN clients c ON c.id = q.client_id WHERE q.id = ANY($1) ORDER BY q.id${apply ? ' FOR UPDATE OF q' : ''}`, [ids])).rows;
  const report = [];
  const problems = [];
  for (const expected of manifest.quotations) {
    const row = rows.find((candidate) => candidate.id === expected.id);
    if (!row) { problems.push(`#${expected.id}: no existe`); continue; }
    const createdOn = row.created_on;
    const mismatches = [
      row.client_name !== expected.clientName && `cliente (${row.client_name})`,
      row.project_name !== expected.projectName && `proyecto (${row.project_name})`,
      createdOn !== expected.createdOn && `fecha (${createdOn})`,
      Math.abs(Number(row.total_amount) - Number(expected.totalAmount)) > 0.01 && `total (${row.total_amount})`,
      expected.status && row.status !== expected.status && `estado (${row.status})`,
    ].filter(Boolean);
    if (mismatches.length) problems.push(`#${expected.id}: no coincide el manifiesto → ${mismatches.join(', ')}`);
    if (row.archived_at) problems.push(`#${expected.id}: ya está archivada`);
    // La ficha del lead sigue mostrando la cotización archivada: no se archiva sin confirmarlo.
    if (row.lead_id && !expected.allowLead) problems.push(`#${expected.id}: está vinculada al lead ${row.lead_id} (agregá "allowLead": true al manifiesto si es intencional)`);
  }

  // Dependencias: toda FK hacia quotations(id) de tablas que NO se borran en cascada con la cotización
  // más las que muestran la cotización en otras vistas (proyectos, vínculos, grupos, CRM).
  const fks = (await db.query(
    `SELECT con.conrelid::regclass::text AS table_name, att.attname AS column_name
     FROM pg_constraint con
     JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
     WHERE con.contype = 'f' AND con.confrelid = 'quotations'::regclass`)).rows;
  const blocking = new Set(['active_projects', 'project_quotation_links', 'quotation_group_items', 'crm_activities', 'crm_leads', 'quotation_revisions']);
  const dependencies = [];
  for (const { table_name: table, column_name: column } of fks) {
    const { rows: counts } = await db.query(`SELECT "${column}" AS quotation_id, count(*)::int AS n FROM ${table} WHERE "${column}" = ANY($1) GROUP BY 1`, [ids]);
    for (const { quotation_id: quotationId, n } of counts) {
      dependencies.push({ quotationId, table, n, blocking: blocking.has(table.replace(/^public\./, '')) });
    }
  }
  for (const dep of dependencies.filter((item) => item.blocking)) problems.push(`#${dep.quotationId}: tiene ${dep.n} fila(s) en ${dep.table}`);

  console.log(JSON.stringify({ at: new Date().toISOString(), label, applied: apply, quotations: rows.map((row) => ({ id: row.id, client: row.client_name, project: row.project_name, status: row.status, total: row.total_amount })), dependencies, problems }, null, 2));
  if (problems.length) throw new Error(`Abortado: ${problems.length} problema(s). No se modificó nada.`);

  if (apply) {
    await db.query(`CREATE TABLE IF NOT EXISTS quotation_archive_rollback_backups (
      id SERIAL PRIMARY KEY, label TEXT NOT NULL, quotation_id INTEGER NOT NULL, snapshot JSONB NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT now())`);
    const now = new Date();
    for (const row of rows) {
      await db.query('INSERT INTO quotation_archive_rollback_backups(label, quotation_id, snapshot) VALUES($1,$2,$3)', [label, row.id, JSON.stringify(row)]);
      await db.query('UPDATE quotations SET archived_at=$2, updated_at=$2, lock_version=lock_version+1 WHERE id=$1 AND archived_at IS NULL', [row.id, now]);
      await db.query(
        `INSERT INTO quotation_events(quotation_id, event_type, event_key, actor_type, metadata) VALUES($1,'archived',$2,'system',$3) ON CONFLICT (event_key) DO NOTHING`,
        [row.id, `archived:${row.id}:${now.toISOString()}`, JSON.stringify({ source: 'scripts/archive-legacy-quotations.mjs', label })]);
    }
    const check = (await db.query('SELECT count(*)::int AS n FROM quotations WHERE id = ANY($1) AND archived_at IS NOT NULL', [ids])).rows[0].n;
    if (check !== ids.length) throw new Error(`Verificación fallida: ${check}/${ids.length} archivadas`);
    await db.query('COMMIT');
    console.log(`Archivadas ${check} cotizaciones. Se recuperan con POST /api/quotations/:id/restore.`);
  } else {
    await db.query('ROLLBACK');
    console.log('Vista previa: no se modificó nada. Repetí con --apply para archivar.');
  }
} catch (error) {
  await db.query('ROLLBACK').catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
