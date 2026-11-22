// Filters -> one Prisma.ModelWhereInput. Pure (no DB), so it is unit-tested; used by /models, /facets, /rankings.
import type { Prisma } from "@/generated/prisma/client";
import { toSearchKey } from "@/lib/search-key";
import type { Capability, Modality, ModelType } from "@/lib/types";

export interface ModelFilterInput {
  q?: string;
  lab?: string[];
  provider?: string[];
  type?: ModelType[];
  capability?: Capability[];
  inputModality?: Modality[];
  outputModality?: Modality[];
  minContext?: number;
  maxPrice?: number;
  includeDeprecated?: boolean;
}

const CAPABILITY_WHERE: Record<Capability, Prisma.ModelWhereInput> = {
  reasoning: { reasoning: true },
  tools: { toolCall: true },
  structured: { structuredOutput: true },
  vision: { vision: true },
  open: { openWeights: true },
  free: { isFree: true },
};

/** OR within a param, AND across params. Capabilities are AND-ed (each one must hold). */
export function buildModelWhere(f: ModelFilterInput): Prisma.ModelWhereInput {
  const and: Prisma.ModelWhereInput[] = [];
  const key = f.q ? toSearchKey(f.q) : "";
  // searchKey is already normalised, so a plain LIKE '%key%' is case-safe and served by the pg_trgm GIN index
  if (key) and.push({ searchKey: { contains: key } });
  else if (f.q?.trim()) and.push({ id: { in: [] } }); // a query of only symbols ("%", "!!") matches nothing, not everything
  if (f.lab?.length) and.push({ lab: { slug: { in: f.lab } } });
  if (f.provider?.length) and.push({ listings: { some: { provider: { slug: { in: f.provider } } } } });
  if (f.type?.length) and.push({ type: { in: f.type.map((t) => t.toUpperCase() as Uppercase<ModelType>) } });
  for (const c of f.capability ?? []) and.push(CAPABILITY_WHERE[c]);
  if (f.inputModality?.length) and.push({ inputModalities: { hasSome: f.inputModality } });
  if (f.outputModality?.length) and.push({ outputModalities: { hasSome: f.outputModality } });
  if (f.minContext != null) and.push({ contextWindow: { gte: f.minContext } });
  if (f.maxPrice != null) and.push({ blendedPrice: { lte: f.maxPrice } });
  if (!f.includeDeprecated) and.push({ deprecated: false });
  return and.length ? { AND: and } : {};
}

/**
 * Relevance order for a search (docs/05): exact name, then name prefix, then name contains, then matched only via
 * lab/slug; inside a tier non-deprecated first, then most providers, then id for stability.
 * ponytail: sorts the whole matching set in memory (fine at ~1k rows); move to a SQL CASE / ts_rank at 100x.
 */
export function relevanceSort<T extends { id: string; name: string; providerCount: number; deprecated?: boolean }>(
  rows: T[],
  query: string,
): T[] {
  const key = toSearchKey(query);
  const tier = (name: string) => {
    const n = toSearchKey(name);
    return n === key ? 0 : n.startsWith(key) ? 1 : n.includes(key) ? 2 : 3;
  };
  return rows
    .map((row) => ({ row, tier: tier(row.name) }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        Number(!!a.row.deprecated) - Number(!!b.row.deprecated) ||
        b.row.providerCount - a.row.providerCount ||
        a.row.id.localeCompare(b.row.id),
    )
    .map((x) => x.row);
}

/** The same filters minus some keys: facet counts show "what you would get if you changed this filter". */
export const without = <K extends keyof ModelFilterInput>(f: ModelFilterInput, ...keys: K[]): ModelFilterInput => {
  const copy = { ...f };
  for (const k of keys) delete copy[k];
  return copy;
};
