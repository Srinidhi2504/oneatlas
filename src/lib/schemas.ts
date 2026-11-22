// One Zod schema per endpoint input (docs/05). Shared by route handlers (URLSearchParams), Server Component
// pages (searchParams) and the client. Unknown params are ignored; bad values become a 400 INVALID_QUERY.
import { z } from "zod";
import { CAPABILITIES, MODALITIES, MODEL_TYPES } from "./types";

/** "" and [] count as "not provided"; repeated params (?a=1&a=2) are joined like a CSV. */
const blankToUndefined = (v: unknown) => {
  if (Array.isArray(v)) v = v.join(",");
  return typeof v === "string" && v.trim() === "" ? undefined : v;
};

/** CSV string ("a,b") -> deduped string[] validated item by item. */
const csv = <T extends z.ZodType<string>>(item: T, max = 50) =>
  z.preprocess((v) => {
    const s = blankToUndefined(v);
    return typeof s === "string" ? [...new Set(s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))] : s;
  }, z.array(item).max(max).optional());

const opt = <T extends z.ZodType>(schema: T) => z.preprocess(blankToUndefined, schema.optional());

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "must be a slug (a-z, 0-9, '.', '_', '-')");

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");
const q = opt(z.string().trim().max(80));
const page = opt(int(1, 10_000)).transform((v) => v ?? 1);
const pageSize = (fallback: number) => opt(int(1, 100)).transform((v) => v ?? fallback);
const order = opt(z.enum(["asc", "desc"]));

export const modelTypeSchema = z.enum(MODEL_TYPES);
export const capabilitySchema = z.enum(CAPABILITIES);
export const modalitySchema = z.enum(MODALITIES);

export const MODEL_SORTS = ["relevance", "name", "price", "context", "released", "intelligence", "providers", "value"] as const;
export type ModelSort = (typeof MODEL_SORTS)[number];
/** Per-sort default direction (docs/05): name and price ascend, everything else descends. */
export const defaultOrder = (sort: ModelSort): "asc" | "desc" => (sort === "name" || sort === "price" ? "asc" : "desc");

/** Filters shared by /models, /facets (and a subset by /rankings). */
const modelFilterShape = {
  q,
  lab: csv(slugSchema),
  provider: csv(slugSchema),
  type: csv(modelTypeSchema),
  capability: csv(capabilitySchema),
  inputModality: csv(modalitySchema),
  outputModality: csv(modalitySchema),
  minContext: opt(int(0, 100_000_000)),
  maxPrice: opt(z.coerce.number().min(0).max(1_000_000)),
  includeDeprecated: opt(bool).transform((v) => v ?? false),
};

export const modelFiltersSchema = z.object(modelFilterShape);
export type ModelFilters = z.output<typeof modelFiltersSchema>;

export const modelListQuerySchema = z
  .object({
    ...modelFilterShape,
    sort: opt(z.enum(MODEL_SORTS)),
    order,
    page,
    pageSize: pageSize(24),
  })
  .transform((v) => {
    // relevance only makes sense with a query; it is also the default when there is one
    const sort: ModelSort = v.sort === "relevance" && !v.q ? "providers" : (v.sort ?? (v.q ? "relevance" : "providers"));
    return { ...v, sort, order: v.order ?? defaultOrder(sort) };
  });
export type ModelListQuery = z.output<typeof modelListQuerySchema>;

export const modelParamsSchema = z.object({ lab: slugSchema, slug: slugSchema });

export const compareQuerySchema = z.object({
  ids: z.preprocess(
    (v) => {
      const s = blankToUndefined(v);
      return typeof s === "string" ? [...new Set(s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean))] : (s ?? []);
    },
    z
      .array(z.string().regex(/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/, "must be lab/slug"))
      .min(2, "compare needs 2 to 4 ids")
      .max(4, "compare needs 2 to 4 ids"),
  ),
});

export const searchQuerySchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().min(1).max(80)),
  limit: opt(int(1, 20)).transform((v) => v ?? 8),
});

export const labsQuerySchema = z.object({
  q,
  sort: opt(z.enum(["models", "name", "latest"])).transform((v) => v ?? "models"),
});

export const providersQuerySchema = z.object({
  q,
  sort: opt(z.enum(["models", "name"])).transform((v) => v ?? "models"),
});

export const providerModelsQuerySchema = z.object({
  q,
  sort: opt(z.enum(["name", "price", "context"])).transform((v) => v ?? "name"),
  page,
  pageSize: pageSize(50),
});

export const rankingsQuerySchema = z.object({
  lab: csv(slugSchema),
  type: csv(modelTypeSchema),
  capability: csv(capabilitySchema),
  page,
  pageSize: pageSize(50),
});
export type RankingsQuery = z.output<typeof rankingsQuerySchema>;

export const boardParamSchema = z.object({ board: slugSchema });

export const matrixQuerySchema = z.object({
  keys: csv(slugSchema, 12),
  lab: csv(slugSchema),
  type: csv(modelTypeSchema),
  page,
  pageSize: pageSize(50),
});
export type MatrixQuery = z.output<typeof matrixQuerySchema>;

/** URLSearchParams or Next's searchParams record -> plain object for the schemas above. */
export function paramsToObject(params: URLSearchParams | Record<string, string | string[] | undefined>) {
  if (params instanceof URLSearchParams) {
    const out: Record<string, string> = {};
    for (const key of new Set(params.keys())) out[key] = params.getAll(key).join(",");
    return out;
  }
  return params;
}

/** POST /api/v1/explain body: the visible chat transcript (text only), oldest first, ending with the user's question. */
export const explainRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(20, "conversation too long: clear it and ask again")
    .superRefine((msgs, ctx) => {
      if (msgs[0].role !== "user" || msgs[msgs.length - 1].role !== "user")
        ctx.addIssue({ code: "custom", message: "the conversation must start and end with a user message" });
      const last = msgs[msgs.length - 1];
      if (last.content.length > 2_000) ctx.addIssue({ code: "custom", message: "questions are limited to 2,000 characters" });
    }),
});

export const sourceQuerySchema = z.object({
  path: z.string().min(1).max(300),
  line: z.coerce.number().int().min(1).max(100_000).default(1),
  end: z.coerce.number().int().min(1).max(100_000).optional(),
});
