import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  // Fix exchange_rates -> users
  const r1 = await client.query(`
    SELECT id, created_by FROM exchange_rates
    WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM users)
  `);
  console.log(`exchange_rates orphans: ${r1.rows.length}`, r1.rows);
  if (r1.rows.length > 0) {
    await client.query(`
      UPDATE exchange_rates SET created_by = NULL
      WHERE created_by NOT IN (SELECT id FROM users)
    `);
    console.log("Fixed: set created_by to NULL");
  }

  // Check all FK violations in one shot
  const fks = await client.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  for (const fk of fks.rows) {
    const check = await client.query(`
      SELECT COUNT(*) as cnt FROM ${fk.table_name} t
      LEFT JOIN ${fk.ref_table} r ON t.${fk.column_name} = r.${fk.ref_column}
      WHERE t.${fk.column_name} IS NOT NULL AND r.${fk.ref_column} IS NULL
    `);
    if (parseInt(check.rows[0].cnt) > 0) {
      console.log(`⚠ ${fk.table_name}.${fk.column_name} -> ${fk.ref_table}.${fk.ref_column}: ${check.rows[0].cnt} orphans`);
    }
  }
} finally {
  client.release();
  await pool.end();
}
