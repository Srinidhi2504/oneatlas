// Provider page URL state, shared by the server page and the client table.
import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const providerParsers = {
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(["name", "price", "context"] as const).withDefault("name"),
  page: parseAsInteger.withDefault(1),
};
export const loadProviderState = createLoader(providerParsers);

export const providerModelsQuery = (s: { q: string; sort: string; page: number }) => {
  const p = new URLSearchParams();
  if (s.q.trim()) p.set("q", s.q.trim().slice(0, 80));
  p.set("sort", s.sort);
  p.set("page", String(Math.max(1, s.page)));
  p.set("pageSize", "50");
  return p.toString();
};
