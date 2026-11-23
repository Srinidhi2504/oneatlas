// GET /api/v1/code/search?q=: line search across the code snapshot for the /code viewer's search panel.
import { codeSearch } from "@/server/code-index";
import { handler, ok, queryOf } from "@/server/http";
import { codeSearchQuerySchema } from "@/lib/schemas";

/** GET /api/v1/code/search?q=cacheTag -> matching lines across the snapshot (all terms on one line, case-insensitive). */
export const GET = handler(async (req) => ok(codeSearch(codeSearchQuerySchema.parse(queryOf(req)).q)));
