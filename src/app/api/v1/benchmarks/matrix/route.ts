import { matrixQuerySchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { getMatrix } from "@/server/services/benchmarks";

export const GET = handler(async (req) => {
  const { meta, ...data } = await getMatrix(matrixQuerySchema.parse(queryOf(req)));
  return ok(data, meta);
});
