import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Connection-level failures (DNS hiccup, refused/closed socket while the pool opens a connection). Seen against Neon
// during dev and under `next build` (15 prerender workers opening connections at once). Every app query is a read,
// so retrying is always safe.
const RETRYABLE = new Set(["P1001", "P1002", "P1017"]);
const RETRY_DELAYS_MS = [150, 500, 1500];
const isRetryable = (err: unknown) => typeof err === "object" && err !== null && RETRYABLE.has((err as { code?: string }).code ?? "");

function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (copy .env.example to .env)");
  // max 5 per process: enough for the parallel reads in a page, and bounded across build workers / serverless instances
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 5 }) }).$extends({
    query: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; ; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            if (!isRetryable(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
            await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
          }
        }
      },
    },
  });
}

// One client per server process (survives dev HMR). Prisma 7 requires a driver adapter.
const g = globalThis as unknown as { prisma?: ReturnType<typeof create> };
export const db = g.prisma ?? (g.prisma = create());
