// Shared service helpers: the catalog cache profile/tag and per-model provider counts used by several services.
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import type { ModelListItem } from "@/lib/types";
import { modelListSelect, toModelListItem } from "../mappers";

/**
 * Call first thing inside every `'use cache'` service function. Catalog data only changes at ingest, so hours of
 * caching is correct; after a re-seed, `revalidateTag('catalog')` (POST /api/internal/revalidate) or a redeploy
 * invalidates everything at once.
 */
export function catalogCache() {
  cacheLife("hours");
  cacheTag("catalog");
}

/** List items keyed by internal (cuid) id. Used after in-memory ranking/relevance sorting picked a page of ids. */
export async function listItemsById(ids: string[]): Promise<Map<string, ModelListItem>> {
  if (!ids.length) return new Map();
  const rows = await db.model.findMany({ where: { id: { in: ids } }, select: modelListSelect });
  return new Map(rows.map((r) => [r.id, toModelListItem(r)]));
}

/** Same, as an array in the order of `ids`. */
export async function listItemsInOrder(ids: string[]): Promise<ModelListItem[]> {
  const byId = await listItemsById(ids);
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** Distinct models per provider id (a provider can list one model under several ids, e.g. Bedrock regions). */
export async function providerModelCounts(): Promise<Record<string, number>> {
  "use cache";
  catalogCache();
  const rows = await db.$queryRaw<{ id: string; n: number }[]>`
    SELECT "providerId" AS id, COUNT(DISTINCT "modelId")::int AS n FROM "ProviderModel" GROUP BY "providerId"`;
  return Object.fromEntries(rows.map((r) => [r.id, r.n]));
}

export const paginate = <T>(items: T[], page: number, pageSize: number) => items.slice((page - 1) * pageSize, page * pageSize);
