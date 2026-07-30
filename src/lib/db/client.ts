import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

// Pooled connection (PgBouncer, the `-pooler` host) — correct for ordinary
// app queries from serverless functions. Schema migrations use the direct
// (unpooled) connection instead — see drizzle.config.ts.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Lets Vercel's Fluid compute reuse this pool across invocations on the
// same instance instead of opening a fresh connection every request.
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
