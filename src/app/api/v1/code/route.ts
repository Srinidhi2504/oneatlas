import { handler, ok } from "@/server/http";
import { codeTree } from "@/server/code-index";

/** GET /api/v1/code -> every file in the source snapshot with its line count and purpose (no contents). */
export const GET = handler(async () => ok(codeTree()));
