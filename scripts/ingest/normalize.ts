// Source-row validation and pure field normalisers. No I/O here, so everything is unit-testable.
import { z } from "zod";
import { perTokenToPerMillion } from "@/lib/pricing";

// ---------- source schemas (only the fields we use; unknown keys are stripped) ----------

const price = z.number().nonnegative().nullish();

export const modelsDevRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullish(),
  family: z.string().nullish(),
  reasoning: z.boolean().nullish(),
  tool_call: z.boolean().nullish(),
  structured_output: z.boolean().nullish(),
  temperature: z.boolean().nullish(),
  open_weights: z.boolean().nullish(),
  knowledge: z.string().nullish(),
  release_date: z.string().nullish(),
  last_updated: z.string().nullish(),
  modalities: z.object({ input: z.array(z.string()).default([]), output: z.array(z.string()).default([]) }).nullish(),
  limit: z.object({ context: z.number().nullish(), input: z.number().nullish(), output: z.number().nullish() }).nullish(),
  cost: z
    .object({ input: price, output: price, cache_read: price, cache_write: price, reasoning: price })
    .nullish(),
  status: z.string().nullish(),
  type: z.string().nullish(),
  canonical_model_id: z.string().nullish(),
});
export type ModelsDevRow = z.infer<typeof modelsDevRowSchema>;

export const modelsDevProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  api: z.string().nullish(),
  doc: z.string().nullish(),
  models: z.record(z.string(), z.unknown()),
});

const orPrice = z.union([z.string(), z.number()]).nullish();

export const openRouterEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullish(),
  created: z.number().nullish(),
  hugging_face_id: z.string().nullish(),
  context_length: z.number().nullish(),
  architecture: z
    .object({ input_modalities: z.array(z.string()).nullish(), output_modalities: z.array(z.string()).nullish() })
    .nullish(),
  pricing: z
    .object({ prompt: orPrice, completion: orPrice, input_cache_read: orPrice, input_cache_write: orPrice })
    .nullish(),
  top_provider: z.object({ max_completion_tokens: z.number().nullish() }).nullish(),
  supported_parameters: z.array(z.string()).nullish(),
  benchmarks: z
    .object({
      artificial_analysis: z.record(z.string(), z.number().nullable()).nullish(),
      design_arena: z
        .array(
          z.object({ arena: z.string(), category: z.string(), elo: z.number(), win_rate: z.number().nullish() }),
        )
        .nullish(),
    })
    .nullish(),
});
export type OpenRouterEntry = z.infer<typeof openRouterEntrySchema>;

// ---------- field normalisers ----------

/** OpenRouter per-token price string -> USD per 1M tokens. Negative ("-1" = variable router pricing) or junk -> null. */
export function orPriceToPerMillion(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? perTokenToPerMillion(n) : null;
}

/** "2025-05-31" | "2025-05" | "2025" -> UTC Date (partial dates become the 1st). Anything else -> null. */
export function parsePartialDate(s: string | null | undefined): Date | null {
  const m = s?.trim().match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) : 1;
  const d = m[3] ? Number(m[3]) : 1;
  const date = new Date(Date.UTC(y, mo - 1, d));
  // reject overflow such as 2025-02-31
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

export const MODALITIES = ["text", "image", "audio", "video", "pdf"] as const;
export type Modality = (typeof MODALITIES)[number];

/** Lower-case, map OpenRouter "file" to "pdf", drop unknown values, dedupe, stable order. */
export function normalizeModalities(list: readonly string[] | null | undefined): Modality[] {
  const set = new Set((list ?? []).map((m) => (m.toLowerCase() === "file" ? "pdf" : m.toLowerCase())));
  return MODALITIES.filter((m) => set.has(m));
}

export const MODEL_TYPES = ["TEXT", "IMAGE", "VIDEO", "EMBEDDING", "SPEECH", "TRANSCRIPTION", "RERANK", "REALTIME"] as const;
export type ModelTypeValue = (typeof MODEL_TYPES)[number];

/** models.dev `type` -> our enum. Missing or "chat" = TEXT; unknown values fall back to TEXT. */
export function mapModelsDevType(type: string | null | undefined): ModelTypeValue {
  const t = (type ?? "chat").toLowerCase();
  if (t === "reranking" || t === "rerank") return "RERANK";
  const upper = t.toUpperCase() as ModelTypeValue;
  return MODEL_TYPES.includes(upper) ? upper : "TEXT";
}

/** OpenRouter has no type field: infer from output modalities. */
export function mapOpenRouterType(output: readonly string[]): ModelTypeValue {
  if (output.includes("image")) return "IMAGE";
  if (output.includes("video")) return "VIDEO";
  if (output.includes("audio")) return "SPEECH";
  return "TEXT";
}

/** Median of the known numbers, or null. */
export function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
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

/** "Thinking Machines: Inkling 2 Mini" -> { lab: "Thinking Machines", model: "Inkling 2 Mini" } */
export function splitOpenRouterName(name: string): { lab: string | null; model: string } {
  const i = name.indexOf(": ");
  return i > 0 ? { lab: name.slice(0, i), model: name.slice(i + 2) } : { lab: null, model: name };
}
