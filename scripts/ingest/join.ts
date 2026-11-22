// Entity resolution: OpenRouter ids -> models.dev canonical ids. The riskiest logic in ingestion; see docs/04 "Join key".
import { labAlias } from "@/lib/labs";

/** Normalised key shared by canonical ids ("lab/slug") and OpenRouter ids. */
export function joinKey(lab: string, slug: string): string {
  const s = slug
    .toLowerCase()
    .replace(/:.*$/, "") // :free  :batch  :thinking
    .replace(/-?(20\d{2}-?\d{2}-?\d{2})$/, "") // trailing date 20250929 / 2025-09-29
    .replace(/[^a-z0-9]/g, ""); // dots, dashes, underscores
  return `${labAlias(lab.toLowerCase())}/${s}`;
}

export const splitId = (id: string) => {
  const i = id.indexOf("/");
  return { lab: id.slice(0, i), slug: id.slice(i + 1) };
};

/** OpenRouter "latest" aliases (~) and its own routers (openrouter/) are not models. */
export const isSkippableOpenRouterId = (id: string) => id.startsWith("~") || id.startsWith("openrouter/") || !id.includes("/");

export interface JoinResult {
  /** OpenRouter key -> chosen canonical id */
  matched: Map<string, string>;
  /** OpenRouter key -> candidate canonical ids, for keys with more than one candidate (resolved or not) */
  ambiguous: Map<string, string[]>;
  /** ambiguous keys that the tie-break could not resolve (left unjoined) */
  unresolved: string[];
  /** OpenRouter keys with no candidate at all */
  unmatched: string[];
  /** OpenRouter key -> its entry ids, preferred entry first */
  groups: Map<string, string[]>;
}

/**
 * Join OpenRouter ids onto canonical ids.
 * Ambiguity rule: prefer the canonical id equal to an OpenRouter id (lower-cased, without ":variant"),
 * else the unique shortest slug; still tied -> leave unjoined.
 * Variants: within a key, entries without a ":" suffix come first.
 */
export function joinIds(canonicalIds: string[], openRouterIds: string[]): JoinResult {
  const byKey = new Map<string, string[]>();
  for (const id of canonicalIds) {
    const { lab, slug } = splitId(id);
    const k = joinKey(lab, slug);
    byKey.set(k, [...(byKey.get(k) ?? []), id]);
  }

  const groups = new Map<string, string[]>();
  for (const id of openRouterIds) {
    if (isSkippableOpenRouterId(id)) continue;
    const { lab, slug } = splitId(id);
    const k = joinKey(lab, slug);
    groups.set(k, [...(groups.get(k) ?? []), id]);
  }
  for (const ids of groups.values()) ids.sort((a, b) => Number(a.includes(":")) - Number(b.includes(":")));

  const result: JoinResult = { matched: new Map(), ambiguous: new Map(), unresolved: [], unmatched: [], groups };
  for (const [key, orIds] of groups) {
    const candidates = byKey.get(key) ?? [];
    if (candidates.length === 0) {
      result.unmatched.push(key);
      continue;
    }
    if (candidates.length === 1) {
      result.matched.set(key, candidates[0]);
      continue;
    }
    result.ambiguous.set(key, candidates);
    const chosen = resolveAmbiguous(candidates, orIds);
    if (chosen) result.matched.set(key, chosen);
    else result.unresolved.push(key);
  }
  return result;
}

function resolveAmbiguous(candidates: string[], orIds: string[]): string | null {
  const raw = new Set(orIds.map((id) => id.toLowerCase().replace(/:.*$/, "")));
  const exact = candidates.filter((c) => raw.has(c.toLowerCase()));
  if (exact.length === 1) return exact[0];
  const len = (c: string) => splitId(c).slug.length;
  const shortest = Math.min(...candidates.map(len));
  const tied = candidates.filter((c) => len(c) === shortest);
  return tied.length === 1 ? tied[0] : null;
}
