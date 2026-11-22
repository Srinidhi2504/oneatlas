// Formulas verified against oneatlas.dev: Claude Opus 5.5 ($4 in / $20 out) shows blended $8.00 and value 7.4 at intelligence 59.1.

/** Blended USD per 1M tokens, assuming a 3:1 input:output token mix. */
export const blendedPrice = (input: number, output: number) => (3 * input + output) / 4;

/** Intelligence points per blended dollar. Null when either side is unknown or the model is free. */
export const valueScore = (intelligence: number | null, blended: number | null) =>
  intelligence == null || !blended ? null : intelligence / blended;

/** Monthly USD for a token volume given in millions; null when a needed price is unknown. */
export const monthlyCost = (input: number | null, output: number | null, inputM: number, outputM: number) =>
  (inputM > 0 && input == null) || (outputM > 0 && output == null) ? null : (input ?? 0) * inputM + (output ?? 0) * outputM;

/** Cheapest listing for a token mix (both prices known). */
export function cheapestListing<T extends { pricing: { input: number | null; output: number | null } }>(listings: T[], inputM: number, outputM: number) {
  let best: { listing: T; cost: number } | null = null;
  for (const l of listings) {
    const cost = monthlyCost(l.pricing.input, l.pricing.output, inputM, outputM);
    if (cost != null && (!best || cost < best.cost)) best = { listing: l, cost };
  }
  return best;
}

/** OpenRouter quotes USD per token as a string ("0.000000075"); we store USD per 1M tokens. */
export const perTokenToPerMillion = (perToken: string | number) => Math.round(Number(perToken) * 1e12) / 1e6;
