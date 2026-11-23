// Benchmark service: catalogue with leaders and the paginated models x benchmarks score matrix (cached reads).
import { db } from "@/lib/db";
import type { MatrixQuery } from "@/lib/schemas";
import type { BenchmarkInfo, BenchmarkSummary, ListMeta, Matrix } from "@/lib/types";
import { listMeta } from "../mappers";
import { buildModelWhere } from "../model-where";
import { catalogCache, listItemsById, paginate } from "./common";
import { compareBenchmarks } from "./models";

const toInfo = (b: { key: string; name: string; group: string; category: string; unit: string; higherIsBetter: boolean }): BenchmarkInfo => ({
  key: b.key,
  name: b.name,
  group: b.group,
  category: b.category,
  unit: b.unit === "elo" ? "elo" : "index",
  higherIsBetter: b.higherIsBetter,
});

export async function listBenchmarks(): Promise<BenchmarkSummary[]> {
  "use cache";
  catalogCache();
  const rows = await db.benchmark.findMany({
    select: {
      key: true,
      name: true,
      group: true,
      category: true,
      unit: true,
      higherIsBetter: true,
      _count: { select: { scores: true } },
      scores: {
        where: { rank: 1 },
        orderBy: { modelId: "asc" },
        take: 1,
        select: { value: true, model: { select: { slug: true, name: true, lab: { select: { slug: true } } } } },
      },
    },
  });
  return rows
    .map((b) => ({
      ...toInfo(b),
      scoredCount: b._count.scores,
      top: b.scores[0] ? { model: { id: `${b.scores[0].model.lab.slug}/${b.scores[0].model.slug}`, name: b.scores[0].model.name }, value: b.scores[0].value } : null,
    }))
    .sort(compareBenchmarks);
}

/** intelligence + the 4 most-populated Design Arena (models) categories. */
async function defaultMatrixKeys(): Promise<string[]> {
  const all = await listBenchmarks();
  const design = all.filter((b) => b.category === "design" && b.key !== "arena").sort((a, b) => b.scoredCount - a.scoredCount);
  return [...all.filter((b) => b.key === "intelligence"), ...design.slice(0, 4)].map((b) => b.key);
}

/**
 * Score matrix: one row per model with at least one score in the chosen benchmarks, sorted by the first one.
 * ponytail: groups all scores for <= 12 benchmarks in memory (~2k rows today); paginate in SQL at 100x.
 */
export async function getMatrix(query: MatrixQuery): Promise<Matrix & { meta: ListMeta }> {
  "use cache";
  catalogCache();
  const all = await listBenchmarks();
  const known = new Set(all.map((b) => b.key));
  const requested = (query.keys ?? []).filter((k) => known.has(k)); // unknown keys are ignored, like unknown params
  const keys = requested.length ? requested : await defaultMatrixKeys();
  const benchmarks = keys.map((k) => all.find((b) => b.key === k)!).map(toInfo);

  const scores = await db.benchmarkScore.findMany({
    where: { benchmark: { key: { in: keys } }, model: buildModelWhere({ lab: query.lab, type: query.type }) },
    select: { value: true, rank: true, modelId: true, benchmark: { select: { key: true } } },
  });

  const byModel = new Map<string, Record<string, { value: number; rank: number } | null>>();
  for (const s of scores) {
    const row = byModel.get(s.modelId) ?? Object.fromEntries(keys.map((k) => [k, null]));
    row[s.benchmark.key] = { value: s.value, rank: s.rank };
    byModel.set(s.modelId, row);
  }

  const best: Record<string, number> = {};
  for (const b of benchmarks) {
    const values = [...byModel.values()].map((r) => r[b.key]?.value).filter((v): v is number => v != null);
    if (values.length) best[b.key] = b.higherIsBetter ? Math.max(...values) : Math.min(...values);
  }

  const first = benchmarks[0];
  const sign = first.higherIsBetter ? -1 : 1;
  const ordered = [...byModel.entries()].sort(([idA, a], [idB, b]) => {
    const va = a[first.key]?.value;
    const vb = b[first.key]?.value;
    if (va == null || vb == null) return va == null && vb == null ? idA.localeCompare(idB) : va == null ? 1 : -1; // nulls last
    return sign * (va - vb) || idA.localeCompare(idB);
  });

  const pageRows = paginate(ordered, query.page, query.pageSize);
  const items = await listItemsById(pageRows.map(([id]) => id));
  return {
    benchmarks,
    rows: pageRows.flatMap(([id, s]) => {
      const model = items.get(id);
      return model ? [{ model, scores: s, blendedPrice: model.pricing.blended }] : [];
    }),
    best,
    meta: listMeta(query.page, query.pageSize, ordered.length),
  };
}
