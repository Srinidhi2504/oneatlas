// Formulas verified against oneatlas.dev: Claude Opus 5.5 ($4 in / $20 out) shows blended $8.00 and value 7.4 at intelligence 59.1.

/** Blended USD per 1M tokens, assuming a 3:1 input:output token mix. */
export const blendedPrice = (input: number, output: number) => (3 * input + output) / 4;

/** Intelligence points per blended dollar. Null when either side is unknown or the model is free. */
export const valueScore = (intelligence: number | null, blended: number | null) =>
  intelligence == null || !blended ? null : intelligence / blended;

/** OpenRouter quotes USD per token as a string ("0.000000075"); we store USD per 1M tokens. */
export const perTokenToPerMillion = (perToken: string | number) => Math.round(Number(perToken) * 1e12) / 1e6;
