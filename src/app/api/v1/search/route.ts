import { searchQuerySchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { search } from "@/server/services/catalog";

export const GET = handler(async (req) => {
  const { q, limit } = searchQuerySchema.parse(queryOf(req));
  return ok(await search(q, limit));
});
