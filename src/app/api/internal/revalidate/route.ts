// POST /api/internal/revalidate: bearer-protected cache bust after a re-seed (expires every `catalog`-tagged read).
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { fail, ok } from "@/server/http";

/**
 * POST /api/internal/revalidate with `Authorization: Bearer $REVALIDATE_SECRET`.
 * Run after `npm run db:seed` against production: every service read is tagged "catalog", so this one call
 * expires all cached catalog data (pages and API) without a redeploy.
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return fail(404, "NOT_FOUND", "Not found."); // endpoint disabled unless configured
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return fail(404, "NOT_FOUND", "Not found."); // same answer as "disabled": do not reveal the endpoint
  // { expire: 0 }: data changed at the source, so the next request must not be served the old catalog
  revalidateTag("catalog", { expire: 0 });
  return ok({ revalidated: ["catalog"], at: new Date().toISOString() }, undefined, { cache: false });
}
