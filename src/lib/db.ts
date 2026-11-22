import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Connection-level failures (DNS hiccup, refused/closed socket while the pool opens a connection). Observed
// intermittently against Neon during development; every app query is a read, so one retry is always safe.
const RETRYABLE = new Set(["P1001", "P1002", "P1017"]);
const isRetryable = (err: unknown) => typeof err === "object" && err !== null && RETRYABLE.has((err as { code?: string }).code ?? "");

function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) }).$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (err) {
          if (!isRetryable(err)) throw err;
          await new Promise((r) => setTimeout(r, 150));
          return query(args);
        }
      },
    },
  });
}

// One client per server process (survives dev HMR). Prisma 7 requires a driver adapter.
const g = globalThis as unknown as { prisma?: ReturnType<typeof create> };
export const db = g.prisma ?? (g.prisma = create());
