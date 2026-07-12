import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and set it.");
}

// Reuse the pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { _pgPool?: Pool };
const pool = globalForDb._pgPool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") globalForDb._pgPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
