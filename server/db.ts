import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced connection pool configuration for better stability
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Math.max(2, Math.min(100, Number(process.env.DB_POOL_MAX) || 20)),
  statement_timeout: Math.max(1000, Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 15_000),
  query_timeout: Math.max(1000, Number(process.env.DB_QUERY_TIMEOUT_MS) || 20_000),
  application_name: "mind-web",
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Math.max(500, Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 3000),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Add error handling for pool events
pool.on('error', (err) => {
  console.error('💾 Database pool error:', err);
});

pool.on('connect', () => {
  console.log('💾 Database connected successfully');
});

export const db = drizzle({ client: pool, schema });
