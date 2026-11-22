// Rankings URL state, shared by the server page (createLoader) and the client view (useQueryStates).
import { createLoader, createSerializer, parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { CAPABILITIES, MODEL_TYPES } from "@/lib/types";

export const rankingParsers = {
  lab: parseAsArrayOf(parseAsString).withDefault([]),
  type: parseAsArrayOf(parseAsStringLiteral(MODEL_TYPES)).withDefault([]),
  capability: parseAsArrayOf(parseAsStringLiteral(CAPABILITIES)).withDefault([]),
  page: parseAsInteger.withDefault(1),
};
export const loadRankingFilters = createLoader(rankingParsers);
export const serializeRankingFilters = createSerializer(rankingParsers);

/** Canonical API query for a filter state, so the server render and the client cache share one key. */
export function rankingApiQuery(s: { lab: string[]; type: string[]; capability: string[]; page: number }) {
  const p = new URLSearchParams();
  const lab = s.lab.filter((x) => /^[a-z0-9][a-z0-9._-]*$/.test(x)).sort();
  if (lab.length) p.set("lab", lab.join(","));
  if (s.type.length) p.set("type", [...s.type].sort().join(","));
  if (s.capability.length) p.set("capability", [...s.capability].sort().join(","));
  p.set("page", String(Math.max(1, s.page)));
  p.set("pageSize", "50");
  return p.toString();
}
