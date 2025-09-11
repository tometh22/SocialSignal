import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Enhanced connection pool configuration for better stability
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error if connection takes longer than 10 seconds
  maxUses: 7500, // Close a connection after it has been used this many times
  allowExitOnIdle: true, // Allow the pool to exit if all connections are idle
});

// Add error handling for pool events
pool.on('error', (err) => {
  console.error('💾 Database pool error:', err);
});

pool.on('connect', () => {
  console.log('💾 Database connected successfully');
});

export const db = drizzle({ client: pool, schema });
