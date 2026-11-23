// GET /api/v1/labs: the lab directory with model counts and latest release.
import { labsQuerySchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { listLabs } from "@/server/services/directory";

export const GET = handler(async (req) => {
  const { q, sort } = labsQuerySchema.parse(queryOf(req));
  return ok(await listLabs(q, sort));
});
