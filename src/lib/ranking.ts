/**
 * Value frontier: walking from cheapest to most expensive, keep each point that is smarter than every cheaper one.
 * No model off the frontier is both cheaper and smarter than one on it.
 */
export function paretoFrontier<T extends { price: number; score: number }>(points: T[]): T[] {
  const sorted = [...points].sort((a, b) => a.price - b.price || b.score - a.score);
  const out: T[] = [];
  for (const p of sorted) if (!out.length || p.score > out[out.length - 1].score) out.push(p);
  return out;
}

/** Competition ranking (1, 2, 2, 4) over values, best first. Returns ranks aligned with the input order. */
export function competitionRanks(values: number[], higherIsBetter = true): number[] {
  const sorted = [...values].sort((a, b) => (higherIsBetter ? b - a : a - b));
  const firstIndex = new Map<number, number>();
  sorted.forEach((v, i) => {
    if (!firstIndex.has(v)) firstIndex.set(v, i + 1);
  });
  return values.map((v) => firstIndex.get(v)!);
}
