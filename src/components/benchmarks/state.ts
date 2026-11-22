// Benchmarks matrix URL state, shared by the server page and the client matrix.
import { createLoader, parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { MODEL_TYPES } from "@/lib/types";

export const matrixParsers = {
  keys: parseAsArrayOf(parseAsString).withDefault([]),
  lab: parseAsArrayOf(parseAsString).withDefault([]),
  type: parseAsArrayOf(parseAsStringLiteral(MODEL_TYPES)).withDefault([]),
  page: parseAsInteger.withDefault(1),
};
export const loadMatrixState = createLoader(matrixParsers);

const SLUG = /^[a-z0-9][a-z0-9._-]*$/;

/** Canonical /benchmarks/matrix query. Key order is meaningful (first key = sort column), so it is kept. */
export function matrixApiQuery(s: { keys: string[]; lab: string[]; type: string[]; page: number }) {
  const p = new URLSearchParams();
  const keys = [...new Set(s.keys.filter((k) => SLUG.test(k)))].slice(0, 12);
  if (keys.length) p.set("keys", keys.join(","));
  const lab = s.lab.filter((x) => SLUG.test(x)).sort();
  if (lab.length) p.set("lab", lab.join(","));
  if (s.type.length) p.set("type", [...s.type].sort().join(","));
  p.set("page", String(Math.max(1, s.page)));
  p.set("pageSize", "50");
  return p.toString();
}
