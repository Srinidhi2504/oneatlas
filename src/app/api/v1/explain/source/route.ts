import { sourceQuerySchema } from "@/lib/schemas";
import { sourceExcerpt } from "@/server/code-index";
import { handler, ok, queryOf } from "@/server/http";
import { NotFoundError } from "@/server/errors";

/** GET /api/v1/explain/source?path=src/lib/db.ts&line=12: the lines around a citation, from the bundled code index. */
export const GET = handler(async (req) => {
  const { path, line, end } = sourceQuerySchema.parse(queryOf(req));
  const excerpt = sourceExcerpt(path, line, end);
  if (!excerpt) throw new NotFoundError(`No file "${path}" in the code snapshot.`);
  return ok(excerpt);
});
