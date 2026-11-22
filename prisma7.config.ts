import "dotenv/config";
import { defineConfig } from "prisma/config";

// CLI (migrate/generate) must use a DIRECT (unpooled) connection. Runtime uses DATABASE_URL (pooled) via src/lib/db.ts.
// Keep ONLY this config file: if prisma.config.ts also exists, the CLI silently prefers this one.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});
