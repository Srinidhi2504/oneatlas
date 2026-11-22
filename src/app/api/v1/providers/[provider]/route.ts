import { providerModelsQuerySchema, slugSchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { getProvider } from "@/server/services/directory";

export const GET = handler(async (req, ctx: RouteContext<"/api/v1/providers/[provider]">) => {
  const slug = slugSchema.parse((await ctx.params).provider);
  const { provider, listings } = await getProvider(slug, providerModelsQuerySchema.parse(queryOf(req)));
  return ok({ provider, listings: listings.items }, listings.meta);
});
