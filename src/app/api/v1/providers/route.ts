import { providersQuerySchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { listProviders } from "@/server/services/directory";

export const GET = handler(async (req) => {
  const { q, sort } = providersQuerySchema.parse(queryOf(req));
  return ok(await listProviders(q, sort));
});
