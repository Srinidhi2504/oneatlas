// GET /api/v1/rankings/{board}: a leaderboard (core board or any benchmark key), re-ranked for the active filters.
import { boardParamSchema, rankingsQuerySchema } from "@/lib/schemas";
import { handler, ok, queryOf } from "@/server/http";
import { getRankings } from "@/server/services/rankings";

export const GET = handler(async (req, ctx: RouteContext<"/api/v1/rankings/[board]">) => {
  const { board } = boardParamSchema.parse(await ctx.params);
  const { meta, ...data } = await getRankings(board, rankingsQuerySchema.parse(queryOf(req)));
  return ok(data, meta);
});
