// GET /api/v1/models/{lab}/{slug}: one model's full detail (listings, benchmarks with rank, board ranks).
import { modelParamsSchema } from "@/lib/schemas";
import { handler, ok } from "@/server/http";
import { getModel } from "@/server/services/models";

export const GET = handler(async (_req, ctx: RouteContext<"/api/v1/models/[lab]/[slug]">) => {
  const { lab, slug } = modelParamsSchema.parse(await ctx.params);
  return ok(await getModel(lab, slug));
});
