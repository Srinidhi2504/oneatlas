import { compareQuerySchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { compareModels } from "@/server/services/models";

export const GET = handler(async (req) => {
  const { ids } = compareQuerySchema.parse(queryOf(req));
  return ok(await compareModels(ids));
});
