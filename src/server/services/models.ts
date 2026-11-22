import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { ModelListQuery, ModelSort } from "@/lib/schemas";
import { toSearchKey } from "@/lib/search-key";
import type { BenchmarkResult, CompareResult, ModelDetail, ModelListItem, Paginated } from "@/lib/types";
import { NotFoundError } from "../errors";
import { isoDate, listMeta, modelListSelect, num, toModelListItem } from "../mappers";
import { buildModelWhere, relevanceSort } from "../model-where";
import { catalogCache, listItemsInOrder, paginate } from "./common";
import { coreRanksFor } from "./rankings";

const SORT_FIELD: Record<Exclude<ModelSort, "relevance" | "name" | "providers">, keyof Prisma.ModelOrderByWithRelationInput> = {
  price: "blendedPrice",
  context: "contextWindow",
  released: "releasedAt",
  intelligence: "intelligenceIndex",
  value: "valueScore",
};

/** Nulls always last, stable tiebreak on id (docs/05). */
function orderByFor(sort: ModelSort, order: "asc" | "desc"): Prisma.ModelOrderByWithRelationInput[] {
  if (sort === "name") return [{ name: order }, { id: "asc" }];
  if (sort === "providers" || sort === "relevance") return [{ providerCount: order }, { id: "asc" }];
  return [{ [SORT_FIELD[sort]]: { sort: order, nulls: "last" } }, { id: "asc" }];
}

export async function listModels(query: ModelListQuery): Promise<Paginated<ModelListItem>> {
  "use cache";
  catalogCache();
  const where = buildModelWhere(query);
  const { page, pageSize } = query;

  if (query.sort === "relevance" && query.q && toSearchKey(query.q)) {
    // Relevance needs the name of every match: rank the (small, light) matching set, then load one page.
    const candidates = await db.model.findMany({ where, select: { id: true, name: true, providerCount: true, deprecated: true } });
    const ranked = relevanceSort(candidates, query.q);
    const items = await listItemsInOrder(paginate(ranked, page, pageSize).map((c) => c.id));
    return { items, meta: listMeta(page, pageSize, ranked.length) };
  }

  const [rows, total] = await Promise.all([
    db.model.findMany({
      where,
      select: modelListSelect,
      orderBy: orderByFor(query.sort, query.order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.model.count({ where }),
  ]);
  return { items: rows.map(toModelListItem), meta: listMeta(page, pageSize, total) };
}

/** Per benchmark id: number of scored models (for "#rank of N") and the best value (for relative bars). */
async function benchmarkTotals(): Promise<Record<string, { count: number; best: number }>> {
  "use cache";
  catalogCache();
  const [rows, meta] = await Promise.all([
    db.benchmarkScore.groupBy({ by: ["benchmarkId"], _count: { _all: true }, _max: { value: true }, _min: { value: true } }),
    db.benchmark.findMany({ select: { id: true, higherIsBetter: true } }),
  ]);
  const higher = new Map(meta.map((b) => [b.id, b.higherIsBetter]));
  return Object.fromEntries(
    rows.map((r) => [r.benchmarkId, { count: r._count._all, best: (higher.get(r.benchmarkId) === false ? r._min.value : r._max.value) ?? 0 }]),
  );
}

const GROUP_ORDER = ["Artificial Analysis", "Design Arena"];
const CATEGORY_ORDER = ["general", "domain", "design", "design-agents"];
/** Intelligence first, then by group, category, the derived arena average, name. */
const benchmarkSortKey = (b: { key: string; group: string; category: string; name: string }) =>
  [
    b.key === "intelligence" ? 0 : 1,
    GROUP_ORDER.indexOf(b.group),
    CATEGORY_ORDER.indexOf(b.category),
    b.key === "arena" ? 0 : 1,
    b.name,
  ] as const;
export const compareBenchmarks = (a: Parameters<typeof benchmarkSortKey>[0], b: Parameters<typeof benchmarkSortKey>[0]) => {
  const ka = benchmarkSortKey(a);
  const kb = benchmarkSortKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
};

async function findModelDetail(lab: string, slug: string): Promise<ModelDetail | null> {
  "use cache";
  catalogCache();
  const m = await db.model.findFirst({
    where: { slug, lab: { slug: lab } },
    select: {
      ...modelListSelect,
      description: true,
      family: true,
      knowledgeCutoff: true,
      listings: {
        select: {
          providerModelId: true,
          contextWindow: true,
          inputLimit: true,
          maxOutputTokens: true,
          inputPrice: true,
          outputPrice: true,
          reasoningPrice: true,
          cacheReadPrice: true,
          cacheWritePrice: true,
          reasoning: true,
          toolCall: true,
          structuredOutput: true,
          temperature: true,
          status: true,
          sourceUpdatedAt: true,
          provider: { select: { slug: true, name: true } },
        },
        orderBy: [{ inputPrice: { sort: "asc", nulls: "last" } }, { provider: { name: "asc" } }, { providerModelId: "asc" }],
      },
      scores: {
        select: {
          value: true,
          winRate: true,
          rank: true,
          benchmark: { select: { id: true, key: true, name: true, group: true, category: true, unit: true } },
        },
      },
    },
  });
  if (!m) return null;

  const [totals, ranks] = await Promise.all([benchmarkTotals(), coreRanksFor(m.id)]);
  const benchmarks: BenchmarkResult[] = m.scores
    .map((s) => ({
      key: s.benchmark.key,
      name: s.benchmark.name,
      group: s.benchmark.group,
      category: s.benchmark.category,
      unit: s.benchmark.unit === "elo" ? ("elo" as const) : ("index" as const),
      value: s.value,
      winRate: s.winRate,
      rank: s.rank,
      ofTotal: totals[s.benchmark.id]?.count ?? 0,
      best: totals[s.benchmark.id]?.best ?? s.value,
    }))
    .sort(compareBenchmarks);
  const inputs = m.listings.map((l) => num(l.inputPrice)).filter((v): v is number => v != null);

  return {
    ...toModelListItem(m),
    description: m.description,
    family: m.family,
    knowledgeCutoff: isoDate(m.knowledgeCutoff),
    benchmarks,
    listings: m.listings.map((l) => ({
      provider: l.provider,
      providerModelId: l.providerModelId,
      contextWindow: l.contextWindow,
      inputLimit: l.inputLimit,
      maxOutputTokens: l.maxOutputTokens,
      pricing: {
        input: num(l.inputPrice),
        output: num(l.outputPrice),
        reasoning: num(l.reasoningPrice),
        cacheRead: num(l.cacheReadPrice),
        cacheWrite: num(l.cacheWritePrice),
      },
      flags: { reasoning: l.reasoning, toolCall: l.toolCall, structuredOutput: l.structuredOutput, temperature: l.temperature },
      status: l.status,
      updatedAt: isoDate(l.sourceUpdatedAt),
    })),
    providerPriceRange: { minInput: inputs.length ? Math.min(...inputs) : null, maxInput: inputs.length ? Math.max(...inputs) : null },
    ranks,
  };
}

export async function getModel(lab: string, slug: string): Promise<ModelDetail> {
  const model = await findModelDetail(lab, slug);
  if (!model) throw new NotFoundError(`No model "${lab}/${slug}".`);
  return model;
}

/** Up to 4 models in the requested order + the union of their benchmark keys (group, then name). */
export async function compareModels(ids: string[]): Promise<CompareResult> {
  const found = await Promise.all(ids.map((id) => findModelDetail(...(id.split("/") as [string, string]))));
  const missing = ids.filter((_, i) => !found[i]);
  if (missing.length) throw new NotFoundError(`Unknown model id(s): ${missing.join(", ")}.`);
  const models = found as ModelDetail[];
  const seen = new Map<string, BenchmarkResult>();
  for (const b of models.flatMap((m) => m.benchmarks)) if (!seen.has(b.key)) seen.set(b.key, b);
  return { models, benchmarkKeys: [...seen.values()].sort(compareBenchmarks).map((b) => b.key) };
}

/** Top models by provider count, for generateStaticParams. */
export async function topModelIds(limit = 50): Promise<{ lab: string; slug: string }[]> {
  "use cache";
  catalogCache();
  const rows = await db.model.findMany({
    where: { deprecated: false },
    orderBy: [{ providerCount: "desc" }, { id: "asc" }],
    take: limit,
    select: { slug: true, lab: { select: { slug: true } } },
  });
  return rows.map((r) => ({ lab: r.lab.slug, slug: r.slug }));
}

/** Newest models from one lab (detail page "More from {lab}"). */
export async function latestFromLab(lab: string, excludeSlug: string, limit = 4): Promise<ModelListItem[]> {
  "use cache";
  catalogCache();
  const rows = await db.model.findMany({
    where: { lab: { slug: lab }, slug: { not: excludeSlug }, deprecated: false },
    orderBy: [{ releasedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: limit,
    select: modelListSelect,
  });
  return rows.map(toModelListItem);
}
