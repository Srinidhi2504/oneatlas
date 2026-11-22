import { modelFiltersSchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { getFacets } from "@/server/services/catalog";

export const GET = handler(async (req) => ok(await getFacets(modelFiltersSchema.parse(queryOf(req)))));
