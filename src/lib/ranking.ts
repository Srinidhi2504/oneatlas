/** Competition ranking (1, 2, 2, 4) over values, best first. Returns ranks aligned with the input order. */
export function competitionRanks(values: number[], higherIsBetter = true): number[] {
  const sorted = [...values].sort((a, b) => (higherIsBetter ? b - a : a - b));
  const firstIndex = new Map<number, number>();
  sorted.forEach((v, i) => {
    if (!firstIndex.has(v)) firstIndex.set(v, i + 1);
  });
  return values.map((v) => firstIndex.get(v)!);
}
