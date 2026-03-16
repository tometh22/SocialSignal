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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
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
