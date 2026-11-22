import { handler, ok } from "@/server/http";
import { getStats } from "@/server/services/catalog";

export const GET = handler(async () => ok(await getStats()));
