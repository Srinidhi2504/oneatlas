// GET /api/v1/search?q=: grouped models, labs and providers for the command palette.
import { searchQuerySchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { search } from "@/server/services/catalog";

export const GET = handler(async (req) => {
  const { q, limit } = searchQuerySchema.parse(queryOf(req));
  return ok(await search(q, limit));
});
