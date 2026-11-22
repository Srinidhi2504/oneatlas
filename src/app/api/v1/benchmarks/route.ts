import { handler, ok } from "@/server/http";
import { listBenchmarks } from "@/server/services/benchmarks";

export const GET = handler(async () => ok(await listBenchmarks()));
