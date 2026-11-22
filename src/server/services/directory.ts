// Labs and providers directories (docs/05 /labs, /providers).
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { toSearchKey } from "@/lib/search-key";
import type { FacetCount, LabDetail, LabSummary, Paginated, ProviderDetail, ProviderModelRow, ProviderSummary } from "@/lib/types";
import { NotFoundError } from "../errors";
import { isoDate, listMeta, modelListSelect, num, toModelListItem } from "../mappers";
import { catalogCache, providerModelCounts } from "./common";

const nameOrSlug = (q: string | undefined) => {
  if (!q) return {};
  const key = toSearchKey(q);
  return { OR: [{ name: { contains: q, mode: "insensitive" as const } }, ...(key ? [{ slug: { contains: key } }] : [])] };
};

export async function listLabs(q: string | undefined, sort: "models" | "name" | "latest"): Promise<LabSummary[]> {
  "use cache";
  catalogCache();
  const [labs, open, latest] = await Promise.all([
    db.lab.findMany({ where: nameOrSlug(q), select: { id: true, slug: true, name: true, _count: { select: { models: true } } } }),
    db.model.groupBy({ by: ["labId"], where: { openWeights: true }, _count: { _all: true } }),
    // newest model per lab: DISTINCT ON labId after ordering by release date
    db.model.findMany({
      where: { releasedAt: { not: null } },
      orderBy: [{ labId: "asc" }, { releasedAt: "desc" }, { id: "asc" }],
      distinct: ["labId"],
      select: { labId: true, name: true, slug: true, releasedAt: true },
    }),
  ]);
  const openBy = new Map(open.map((o) => [o.labId, o._count._all]));
  const latestBy = new Map(latest.map((m) => [m.labId, m]));
  const rows: LabSummary[] = labs.map((l) => {
    const m = latestBy.get(l.id);
    return {
      slug: l.slug,
      name: l.name,
      modelCount: l._count.models,
      openWeightsCount: openBy.get(l.id) ?? 0,
      latestRelease: m ? { name: m.name, slug: m.slug, releasedAt: isoDate(m.releasedAt) } : null,
    };
  });
  const compare: Record<typeof sort, (a: LabSummary, b: LabSummary) => number> = {
    models: (a, b) => b.modelCount - a.modelCount || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
    latest: (a, b) => (b.latestRelease?.releasedAt ?? "").localeCompare(a.latestRelease?.releasedAt ?? "") || a.name.localeCompare(b.name),
  };
  return rows.sort(compare[sort]);
}

// Cached loaders return null (errors lose their class across the 'use cache' boundary); wrappers throw the 404.
export async function getLab(slug: string): Promise<LabDetail> {
  const lab = await loadLab(slug);
  if (!lab) throw new NotFoundError(`No lab "${slug}".`);
  return lab;
}

async function loadLab(slug: string): Promise<LabDetail | null> {
  "use cache";
  catalogCache();
  const lab = await db.lab.findUnique({ where: { slug }, select: { id: true, slug: true, name: true } });
  if (!lab) return null;
  const [models, providers] = await Promise.all([
    db.model.findMany({
      where: { labId: lab.id },
      select: modelListSelect,
      orderBy: [{ releasedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    }),
    db.$queryRaw<FacetCount[]>`
      SELECT p.slug, p.name, COUNT(DISTINCT pm."modelId")::int AS count
      FROM "ProviderModel" pm
      JOIN "Provider" p ON p.id = pm."providerId"
      JOIN "Model" m ON m.id = pm."modelId"
      WHERE m."labId" = ${lab.id}
      GROUP BY p.slug, p.name
      ORDER BY count DESC, p.name ASC`,
  ]);
  const items = models.map(toModelListItem);
  return {
    slug: lab.slug,
    name: lab.name,
    stats: {
      modelCount: items.length,
      openWeightsCount: items.filter((m) => m.capabilities.openWeights).length,
      providerCount: providers.length,
      benchmarkedCount: items.filter((m) => m.intelligenceIndex != null).length,
      latestReleaseAt: items.find((m) => m.releasedAt)?.releasedAt ?? null,
    },
    models: items,
    providers,
  };
}

export async function listProviders(q: string | undefined, sort: "models" | "name"): Promise<ProviderSummary[]> {
  "use cache";
  catalogCache();
  const [providers, counts] = await Promise.all([
    db.provider.findMany({ where: nameOrSlug(q), select: { id: true, slug: true, name: true, docUrl: true, lab: { select: { slug: true } } } }),
    providerModelCounts(),
  ]);
  return providers
    .map((p) => ({ slug: p.slug, name: p.name, modelCount: counts[p.id] ?? 0, labSlug: p.lab?.slug ?? null, docUrl: p.docUrl }))
    .sort(sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.modelCount - a.modelCount || a.name.localeCompare(b.name));
}

const LISTING_ORDER: Record<"name" | "price" | "context", Prisma.ProviderModelOrderByWithRelationInput[]> = {
  name: [{ model: { name: "asc" } }, { providerModelId: "asc" }],
  price: [{ inputPrice: { sort: "asc", nulls: "last" } }, { providerModelId: "asc" }],
  context: [{ contextWindow: { sort: "desc", nulls: "last" } }, { providerModelId: "asc" }],
};

type ProviderQuery = { q?: string; sort: "name" | "price" | "context"; page: number; pageSize: number };
type ProviderPage = { provider: ProviderDetail; listings: Paginated<ProviderModelRow> };

export async function getProvider(slug: string, query: ProviderQuery): Promise<ProviderPage> {
  const result = await loadProvider(slug, query);
  if (!result) throw new NotFoundError(`No provider "${slug}".`);
  return result;
}

async function loadProvider(slug: string, query: ProviderQuery): Promise<ProviderPage | null> {
  "use cache";
  catalogCache();
  const provider = await db.provider.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, apiUrl: true, docUrl: true, lab: { select: { slug: true, name: true } } },
  });
  if (!provider) return null;

  const key = query.q ? toSearchKey(query.q) : "";
  const where: Prisma.ProviderModelWhereInput = { providerId: provider.id, ...(key ? { model: { searchKey: { contains: key } } } : {}) };
  const [rows, total, listingCount, counts] = await Promise.all([
    db.providerModel.findMany({
      where,
      orderBy: LISTING_ORDER[query.sort],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        providerModelId: true,
        inputPrice: true,
        outputPrice: true,
        cacheReadPrice: true,
        cacheWritePrice: true,
        contextWindow: true,
        maxOutputTokens: true,
        status: true,
        model: { select: modelListSelect },
      },
    }),
    db.providerModel.count({ where }),
    db.providerModel.count({ where: { providerId: provider.id } }),
    providerModelCounts(),
  ]);

  return {
    provider: {
      slug: provider.slug,
      name: provider.name,
      apiUrl: provider.apiUrl,
      docUrl: provider.docUrl,
      lab: provider.lab,
      modelCount: counts[provider.id] ?? 0,
      listingCount,
    },
    listings: {
      items: rows.map((r) => ({
        model: toModelListItem(r.model),
        providerModelId: r.providerModelId,
        pricing: { input: num(r.inputPrice), output: num(r.outputPrice), cacheRead: num(r.cacheReadPrice), cacheWrite: num(r.cacheWritePrice) },
        contextWindow: r.contextWindow,
        maxOutputTokens: r.maxOutputTokens,
        status: r.status,
      })),
      meta: listMeta(query.page, query.pageSize, total),
    },
  };
}

/** Most-served labs and providers for generateStaticParams. */
export async function topDirectorySlugs(limit = 50): Promise<{ labs: string[]; providers: string[] }> {
  "use cache";
  catalogCache();
  const [labs, providers] = await Promise.all([listLabs(undefined, "models"), listProviders(undefined, "models")]);
  return { labs: labs.slice(0, limit).map((l) => l.slug), providers: providers.slice(0, limit).map((p) => p.slug) };
}
