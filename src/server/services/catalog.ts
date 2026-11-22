// Cross-cutting reads: global search, facet counts, catalog stats, health.
import { connection } from "next/server";
import { db } from "@/lib/db";
import type { ModelFilters } from "@/lib/schemas";
import { toSearchKey } from "@/lib/search-key";
import { CAPABILITIES, MODALITIES, type Facets, type ModelType, type SearchResult, type Stats } from "@/lib/types";
import { num } from "../mappers";
import { buildModelWhere, relevanceSort, without } from "../model-where";
import { catalogCache, providerModelCounts } from "./common";

export async function search(q: string, limit: number): Promise<SearchResult> {
  "use cache";
  catalogCache();
  const key = toSearchKey(q);
  const nameMatch = { contains: q.trim(), mode: "insensitive" as const };
  const [models, labs, providers, counts] = await Promise.all([
    key
      ? db.model.findMany({
          where: { searchKey: { contains: key } },
          select: { id: true, slug: true, name: true, type: true, providerCount: true, deprecated: true, lab: { select: { slug: true, name: true } } },
        })
      : [],
    db.lab.findMany({
      where: { OR: [{ name: nameMatch }, ...(key ? [{ slug: { contains: key } }] : [])] },
      select: { slug: true, name: true, _count: { select: { models: true } } },
    }),
    db.provider.findMany({
      where: { OR: [{ name: nameMatch }, ...(key ? [{ slug: { contains: key } }] : [])] },
      select: { id: true, slug: true, name: true },
    }),
    providerModelCounts(),
  ]);
  return {
    models: relevanceSort(models, q)
      .slice(0, limit)
      .map((m) => ({ id: `${m.lab.slug}/${m.slug}`, name: m.name, labName: m.lab.name, type: m.type.toLowerCase() as ModelType })),
    labs: labs
      .map((l) => ({ slug: l.slug, name: l.name, modelCount: l._count.models }))
      .sort((a, b) => b.modelCount - a.modelCount)
      .slice(0, Math.min(limit, 5)),
    providers: providers
      .map((p) => ({ slug: p.slug, name: p.name, modelCount: counts[p.id] ?? 0 }))
      .sort((a, b) => b.modelCount - a.modelCount)
      .slice(0, Math.min(limit, 5)),
  };
}

/**
 * Counts for each filter UI given the *other* active filters ("what would I get if I changed this one").
 * ponytail: ~15 small queries in parallel, cached per filter combination; one SQL with GROUPING SETS if it gets hot.
 */
export async function getFacets(f: ModelFilters): Promise<Facets> {
  "use cache";
  catalogCache();
  const [labGroups, providerPairs, typeGroups, capCounts, modalityCounts, ranges, labs, providers] = await Promise.all([
    db.model.groupBy({ by: ["labId"], where: buildModelWhere(without(f, "lab")), _count: { _all: true } }),
    db.providerModel.groupBy({ by: ["providerId", "modelId"], where: { model: buildModelWhere(without(f, "provider")) } }),
    db.model.groupBy({ by: ["type"], where: buildModelWhere(without(f, "type")), _count: { _all: true } }),
    Promise.all(
      CAPABILITIES.map((c) => db.model.count({ where: buildModelWhere({ ...f, capability: [...new Set([...(f.capability ?? []), c])] }) })),
    ),
    Promise.all(MODALITIES.map((m) => db.model.count({ where: buildModelWhere({ ...without(f, "inputModality"), inputModality: [m] }) }))),
    db.model.aggregate({ where: buildModelWhere(without(f, "minContext", "maxPrice")), _max: { contextWindow: true, blendedPrice: true } }),
    db.lab.findMany({ select: { id: true, slug: true, name: true } }),
    db.provider.findMany({ select: { id: true, slug: true, name: true } }),
  ]);

  const labById = new Map(labs.map((l) => [l.id, l]));
  const providerById = new Map(providers.map((p) => [p.id, p]));
  const perProvider = new Map<string, number>();
  for (const p of providerPairs) perProvider.set(p.providerId, (perProvider.get(p.providerId) ?? 0) + 1);
  const byCountThenName = (a: { count: number; name: string }, b: { count: number; name: string }) =>
    b.count - a.count || a.name.localeCompare(b.name);

  return {
    labs: labGroups
      .map((g) => ({ slug: labById.get(g.labId)!.slug, name: labById.get(g.labId)!.name, count: g._count._all }))
      .sort(byCountThenName),
    providers: [...perProvider]
      .map(([id, count]) => ({ slug: providerById.get(id)!.slug, name: providerById.get(id)!.name, count }))
      .sort(byCountThenName)
      .slice(0, 50),
    types: typeGroups
      .map((g) => ({ value: g.type.toLowerCase() as ModelType, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    capabilities: Object.fromEntries(CAPABILITIES.map((c, i) => [c, capCounts[i]])) as Facets["capabilities"],
    inputModalities: MODALITIES.map((value, i) => ({ value, count: modalityCounts[i] })),
    ranges: { maxContext: ranges._max.contextWindow, maxBlendedPrice: num(ranges._max.blendedPrice) },
  };
}

export async function getStats(): Promise<Stats> {
  "use cache";
  catalogCache();
  const [models, labs, providers, listings, openWeights, toolCall, reasoning, vision, latest] = await Promise.all([
    db.model.count(),
    db.lab.count(),
    db.provider.count(),
    db.providerModel.count(),
    db.model.count({ where: { openWeights: true } }),
    db.model.count({ where: { toolCall: true } }),
    db.model.count({ where: { reasoning: true } }),
    db.model.count({ where: { vision: true } }),
    db.model.aggregate({ _max: { updatedAt: true } }),
  ]);
  const share = (n: number) => (models ? Math.round((n / models) * 1000) / 1000 : 0);
  return {
    models,
    labs,
    providers,
    listings,
    openWeights,
    coverage: { toolCall: share(toolCall), reasoning: share(reasoning), vision: share(vision), openWeights: share(openWeights) },
    updatedAt: latest._max.updatedAt?.toISOString() ?? null,
  };
}

/** Never cached: proves the DB is reachable right now. */
export async function getHealth() {
  await connection();
  await db.$queryRaw`SELECT 1`;
  const models = await db.model.count();
  return { status: "ok" as const, db: "up" as const, models, time: new Date().toISOString() };
}
