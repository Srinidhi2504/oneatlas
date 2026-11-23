// GET /api/v1/code/file?path=: one file from the build-time code snapshot (404 for anything outside it).
import { NotFoundError } from "@/server/errors";
import { codeFile } from "@/server/code-index";
import { handler, ok, queryOf } from "@/server/http";
import { codeFileQuerySchema } from "@/lib/schemas";

/** GET /api/v1/code/file?path=src/lib/db.ts -> { path, lines, content } from the snapshot (404 outside it). */
export const GET = handler(async (req) => {
  const { path } = codeFileQuerySchema.parse(queryOf(req));
  const file = codeFile(path);
  if (!file) throw new NotFoundError(`No file "${path}" in the code snapshot.`);
  return ok(file);
});
