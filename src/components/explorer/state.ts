// Explorer URL state (nuqs). The SAME parsers run on the server (createLoader, in page.tsx) and in the browser
// (useQueryStates), and both build the API query with toApiQuery(), so the server-rendered first page and the
// client's TanStack Query cache share one key: no refetch after hydration.
import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";
import { MODEL_SORTS, defaultOrder, type ModelSort } from "@/lib/schemas";
import { CAPABILITIES, MODEL_TYPES } from "@/lib/types";

export const VIEWS = ["table", "cards"] as const;

export const explorerParsers = {
  q: parseAsString.withDefault(""),
  lab: parseAsArrayOf(parseAsString).withDefault([]),
  provider: parseAsArrayOf(parseAsString).withDefault([]),
  type: parseAsArrayOf(parseAsStringLiteral(MODEL_TYPES)).withDefault([]),
  capability: parseAsArrayOf(parseAsStringLiteral(CAPABILITIES)).withDefault([]),
  minContext: parseAsInteger,
  includeDeprecated: parseAsBoolean.withDefault(false),
  sort: parseAsStringLiteral(MODEL_SORTS),
  order: parseAsStringLiteral(["asc", "desc"] as const),
  page: parseAsInteger.withDefault(1),
  view: parseAsStringLiteral(VIEWS),
};

export type ExplorerState = inferParserType<typeof explorerParsers>;
export const loadExplorerState = createLoader(explorerParsers);

const SLUG = /^[a-z0-9][a-z0-9._-]*$/;
const slugs = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()).filter((x) => SLUG.test(x)))].sort();

/** The effective sort: relevance by default while searching, most providers otherwise. */
export function effectiveSort(s: Pick<ExplorerState, "q" | "sort" | "order">): { sort: ModelSort; order: "asc" | "desc" } {
  const q = s.q.trim();
  const sort: ModelSort = s.sort === "relevance" && !q ? "providers" : (s.sort ?? (q ? "relevance" : "providers"));
  return { sort, order: s.order ?? defaultOrder(sort) };
}

/** Filters only (for /facets), canonical order so equal states give equal strings. */
export function toFilterQuery(s: ExplorerState): URLSearchParams {
  const p = new URLSearchParams();
  const q = s.q.trim().slice(0, 80);
  if (q) p.set("q", q);
  const lab = slugs(s.lab);
  if (lab.length) p.set("lab", lab.join(","));
  const provider = slugs(s.provider);
  if (provider.length) p.set("provider", provider.join(","));
  if (s.type.length) p.set("type", [...s.type].sort().join(","));
  if (s.capability.length) p.set("capability", [...s.capability].sort().join(","));
  if (s.minContext != null && s.minContext > 0) p.set("minContext", String(s.minContext));
  if (s.includeDeprecated) p.set("includeDeprecated", "true");
  return p;
}

export const pageSizeFor = (view: ExplorerState["view"]) => (view === "cards" ? 24 : 50);

/** Full /models query: filters + sort + page + pageSize. */
export function toApiQuery(s: ExplorerState): string {
  const p = toFilterQuery(s);
  const { sort, order } = effectiveSort(s);
  p.set("sort", sort);
  p.set("order", order);
  p.set("page", String(Math.max(1, Math.min(10_000, s.page))));
  p.set("pageSize", String(pageSizeFor(s.view)));
  return p.toString();
}

export const hasActiveFilters = (s: ExplorerState) =>
  !!(s.q.trim() || s.lab.length || s.provider.length || s.type.length || s.capability.length || s.minContext || s.includeDeprecated);
