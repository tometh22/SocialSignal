/** Read-only inventory before enforcing explicit project memberships. Never grants access. */
import { Pool } from 'pg';
const pool = new Pool({connectionString:process.env.DATABASE_URL,max:1});
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout='10s'");
    const {rows} = await client.query(`
      WITH assignments AS (
        SELECT t.project_id,t.id task_id,t.assignee_id personnel_id FROM tasks t WHERE t.status NOT IN ('done','cancelled')
        UNION
        SELECT t.project_id,t.id,(jsonb_array_elements_text(COALESCE(t.collaborator_ids,'[]'::jsonb)))::int FROM tasks t WHERE t.status NOT IN ('done','cancelled')
      )
      SELECT a.project_id,COALESCE(ap.name,q.project_name) project_name,a.personnel_id,p.name personnel_name,COUNT(DISTINCT a.task_id)::int task_count,
        array_agg(DISTINCT a.task_id ORDER BY a.task_id) task_ids
      FROM assignments a JOIN active_projects ap ON ap.id=a.project_id
      LEFT JOIN quotations q ON q.id=ap.quotation_id JOIN personnel p ON p.id=a.personnel_id
      WHERE ap.status='active' AND NOT EXISTS(SELECT 1 FROM task_project_members m WHERE m.project_id=a.project_id AND m.personnel_id=a.personnel_id)
      GROUP BY a.project_id,ap.name,q.project_name,a.personnel_id,p.name ORDER BY project_name,personnel_name`);
    await client.query('COMMIT');
    console.log(JSON.stringify({readOnly:true,missingMemberships:rows.length,assignments:rows},null,2));
  } finally {client.release();}
} finally {await pool.end();}
