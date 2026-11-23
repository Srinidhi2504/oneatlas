// GET /api/v1/code: the code snapshot's file tree (paths, line counts, purpose lines; no contents).
import { handler, ok } from "@/server/http";
import { codeTree } from "@/server/code-index";

/** GET /api/v1/code -> every file in the source snapshot with its line count and purpose (no contents). */
export const GET = handler(async () => ok(codeTree()));
