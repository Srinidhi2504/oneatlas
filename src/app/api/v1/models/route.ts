import { modelListQuerySchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { listModels } from "@/server/services/models";

export const GET = handler(async (req) => {
  const query = modelListQuerySchema.parse(queryOf(req));
  const { items, meta } = await listModels(query);
  return ok(items, meta);
});
