import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const orphaned = await client.query(`
    SELECT cmc.id, cmc.client_id FROM client_modo_comments cmc
    LEFT JOIN clients c ON cmc.client_id = c.id WHERE c.id IS NULL
  `);
  console.log(`Found ${orphaned.rows.length} orphaned rows`);
  if (orphaned.rows.length > 0) {
    const result = await client.query(`
      DELETE FROM client_modo_comments
      WHERE client_id NOT IN (SELECT id FROM clients)
    `);
    console.log(`Deleted ${result.rowCount} orphaned rows`);
  }
} finally {
  client.release();
  await pool.end();
}
