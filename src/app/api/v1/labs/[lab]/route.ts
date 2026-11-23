// GET /api/v1/labs/{lab}: one lab with its stats, all its models and the providers serving them.
import { slugSchema } from "@/lib/schemas";
import { handler, ok } from "@/server/http";
import { getLab } from "@/server/services/directory";

export const GET = handler(async (_req, ctx: RouteContext<"/api/v1/labs/[lab]">) => {
  const lab = slugSchema.parse((await ctx.params).lab);
  return ok(await getLab(lab));
});
