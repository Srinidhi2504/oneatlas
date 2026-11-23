// GET /api/v1/benchmarks: the benchmark catalogue with scored-model counts and each benchmark's leader.
import { handler, ok } from "@/server/http";
import { listBenchmarks } from "@/server/services/benchmarks";

export const GET = handler(async () => ok(await listBenchmarks()));
