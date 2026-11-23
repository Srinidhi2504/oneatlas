// GET /api/v1/health: liveness + DB ping for uptime checks and the post-deploy smoke test. Never cached.
import { unstable_rethrow } from "next/navigation";
import { fail, ok } from "@/server/http";
import { getHealth } from "@/server/services/catalog";

// Not wrapped in handler(): a DB failure here is a 503 (service unavailable), not a 500.
export async function GET() {
  try {
    return ok(await getHealth(), undefined, { cache: false });
  } catch (err) {
    unstable_rethrow(err); // build-time prerender of this route is interrupted by connection(): not a failure
    console.error("[health] database ping failed:", err);
    return fail(503, "INTERNAL", "Database unreachable.");
  }
}
