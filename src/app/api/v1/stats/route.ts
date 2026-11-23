// GET /api/v1/stats: catalog totals and capability coverage for the stats strip.
import { handler, ok } from "@/server/http";
import { getStats } from "@/server/services/catalog";

export const GET = handler(async () => ok(await getStats()));
