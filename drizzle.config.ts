import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  // Direct (unpooled) connection for migrations — PgBouncer's transaction
  // pooling mode doesn't support the session-level features some migration
  // operations need.
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
