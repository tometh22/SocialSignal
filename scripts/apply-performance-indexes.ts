import { readFile } from "node:fs/promises";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false });
try {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(71291, hashtext('performance-index-migration'))");
    const migration = await readFile(new URL("../migrations/0093_performance_indexes.sql", import.meta.url), "utf8");
    for (const statement of migration.replace(/^--.*$/gm, "").split(";").filter(value => value.trim())) {
      await client.query(statement);
      console.log("Index ready:", statement.match(/EXISTS\s+(\w+)/)?.[1]);
    }
  } finally { client.release(true); }
} finally { await pool.end(); }
