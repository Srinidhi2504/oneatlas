# 05 API specification (contract: backend and frontend both build to this)

Base path `/api/v1`. Read-only, JSON, `GET` only. All inputs validated with Zod (`src/lib/schemas.ts`). Prices are USD per 1M tokens. Dates are ISO `YYYY-MM-DD`; timestamps ISO 8601.

## Conventions

**Success:** `{ "data": <payload>, "meta"?: {...} }`. **List:** `meta = { page, pageSize, total, totalPages }`.
**Error:** `{ "error": { "code": string, "message": string, "details"?: unknown } }`

| HTTP | code | when |
|------|------|------|
| 400 | `INVALID_QUERY` | Zod failure. `details` = `[{ path, message }]` |
| 404 | `NOT_FOUND` | unknown lab/model/provider/board, or an unknown `/api/*` path |
| 413 | `INVALID_QUERY` | `/explain` body over 256 KB |
| 429 | `RATE_LIMITED` | too many assistant questions from one client (`/explain` only); `Retry-After` header set |
| 500 | `INTERNAL` | anything else. Generic message, details logged server-side with a request id |

Headers: success `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`; errors `no-store`. Unknown query params are ignored. CSV params accept `a,b,c`. A `page` past the last page returns `data: []` with the real `totalPages` (clients offer a link back). Free-text `q` with no letters or digits matches nothing.

## Shared shapes (TypeScript, put in `src/lib/types.ts` or derive from Zod)

```ts
type ModelType = "text"|"image"|"video"|"embedding"|"speech"|"transcription"|"rerank"|"realtime";
type Modality  = "text"|"image"|"audio"|"video"|"pdf";

interface Pricing { input: number|null; output: number|null; cacheRead: number|null; cacheWrite: number|null; blended: number|null; isFree: boolean }

interface ModelListItem {
  id: string;                       // "lab/slug"
  slug: string;
  name: string;
  lab: { slug: string; name: string };
  type: ModelType;
  releasedAt: string|null;
  contextWindow: number|null;
  maxOutputTokens: number|null;
  inputModalities: Modality[];
  outputModalities: Modality[];
  capabilities: { reasoning: boolean; toolCall: boolean; structuredOutput: boolean; vision: boolean; openWeights: boolean };
  pricing: Pricing;
  intelligenceIndex: number|null;
  providerCount: number;
  deprecated: boolean;
}

interface BenchmarkResult { key: string; name: string; group: string; category: string; unit: "index"|"elo"; value: number; winRate: number|null; rank: number; ofTotal: number }

interface ProviderListing {
  provider: { slug: string; name: string };
  providerModelId: string;
  contextWindow: number|null; inputLimit: number|null; maxOutputTokens: number|null;
  pricing: { input: number|null; output: number|null; reasoning: number|null; cacheRead: number|null; cacheWrite: number|null };
  flags: { reasoning: boolean|null; toolCall: boolean|null; structuredOutput: boolean|null; temperature: boolean|null };
  status: string|null; updatedAt: string|null;
}

interface ModelDetail extends ModelListItem {
  description: string|null; family: string|null; knowledgeCutoff: string|null;
  benchmarks: BenchmarkResult[];
  listings: ProviderListing[];                  // sorted by input price asc, nulls last
  providerPriceRange: { minInput: number|null; maxInput: number|null };
  ranks: Record<"reach"|"intelligence"|"value"|"cheapest"|"context"|"newest", { rank: number; of: number } | null>;
}
```

## Endpoints

### `GET /models`
| param | type | notes |
|-------|------|-------|
| `q` | string (<= 80) | normalised to `searchKey` form, `contains` |
| `lab`, `provider`, `type` | CSV of slugs / `ModelType` | OR within a param, AND across params |
| `capability` | CSV of `reasoning, tools, structured, vision, open, free` | AND across the listed capabilities |
| `inputModality`, `outputModality` | CSV of `Modality` | has-any |
| `minContext` | int | `1000000` powers the "1M+" chip |
| `maxPrice` | number | on `blended` |
| `includeDeprecated` | bool, default `false` | |
| `sort` | `relevance` (only with `q`, default then) `name` `price` `context` `released` `intelligence` `providers` `value` | default `providers` without `q` |
| `order` | `asc`/`desc` | per-sort default: name asc, price asc, rest desc |
| `page` / `pageSize` | int, default 1 / 24, max 100 | |

Returns `ModelListItem[]` + list meta. Nulls always last. Stable tiebreak `id`. `relevance` = exact name, then prefix, then contains, then `providerCount` desc.

### `GET /models/{lab}/{slug}` -> `ModelDetail`. 404 `NOT_FOUND` if absent.

### `GET /compare?ids=lab/slug,lab/slug[,...]` (2 to 4 ids; fewer/more = 400)
Returns `{ models: ModelDetail[] , benchmarkKeys: string[] }` in the requested order (unknown id = 404 listing it). `benchmarkKeys` = union of benchmark keys any model has, ordered by group then name. The client computes "best in row" (lowest price, highest context/score).

### `GET /search?q=&limit=8` (q >= 1 char, limit <= 20)
`{ models: {id,name,labName,type}[], labs: {slug,name,modelCount}[], providers: {slug,name,modelCount}[] }`. Models by trigram match + relevance order; labs/providers by name `contains`.

### `GET /facets` (accepts the same filters as `/models` except pagination and sort)
Counts for the *other* filters, to render filter UIs: `{ labs:[{slug,name,count}], providers:[{slug,name,count}] (top 50 + search handled client side), types:[{value,count}], capabilities:{reasoning,tools,structured,vision,open,free: count}, inputModalities:[...], ranges:{ maxContext, maxBlendedPrice } }`.

### `GET /labs?q=&sort=models|name|latest` -> `{ slug, name, modelCount, openWeightsCount, latestRelease: {name, slug, releasedAt}|null }[]`
### `GET /labs/{lab}` -> lab + `stats` + `models: ModelListItem[]` (all, release date desc) + `providers: {slug,name,count}[]` serving them.
### `GET /providers?q=&sort=models|name` -> `{ slug, name, modelCount, labSlug|null, docUrl|null }[]`
### `GET /providers/{provider}?q=&page=&pageSize=&sort=` -> provider + paginated listings `{ model: ModelListItem, providerModelId, pricing, contextWindow, maxOutputTokens, status }`.

### `GET /rankings/{board}`
`board` in `reach, intelligence, value, cheapest, context, newest` or any `Benchmark.key`. Params: `lab`, `type`, `capability` (same CSV as `/models`), `page`, `pageSize` (default 50, max 100). Unknown board = 404.
Returns `{ board: { key, label, measure, unit, higherIsBetter, description }, rows: [{ rank, model: ModelListItem, value: number|string, valueLabel: string }], labTop: [{ lab, count }] }` + list meta. `labTop` = labs in the top 100 of this board (for the sidebar panel). Rank semantics: see `04`.

### `GET /benchmarks` -> `{ key, name, group, category, unit, scoredCount, top: { model: {id,name}, value } }[]`
### `GET /benchmarks/matrix?keys=a,b,c&lab=&type=&page=&pageSize=`
`keys` default: `intelligence` + the 4 most-populated design categories (max 12). Returns `{ benchmarks: Benchmark[], rows: [{ model: ModelListItem, scores: Record<key, {value, rank}|null>, blendedPrice }], best: Record<key, number> }` + list meta. Rows sorted by the first key desc, nulls last.

### `GET /stats` -> `{ models, labs, providers, listings, openWeights, coverage: { toolCall, reasoning, vision, openWeights }  (0..1), updatedAt }`
### `GET /health` -> `{ status: "ok", db: "up", models: n, time }` (503 `INTERNAL` if the DB ping fails). Never cached.

### `POST /explain` (the "Ask the code" assistant; not cached)
Body `{ messages: [{ role: "user"|"assistant", content }] }` (1 to 20 turns, starts and ends with `user`, question <= 2,000 chars). Response: `application/x-ndjson`, one JSON event per line:
`{type:"tool", name, label}` (a step such as "Read src/lib/db.ts"), `{type:"text", text}` (answer delta, Markdown with `path:line` citations), then `{type:"done"}` or `{type:"error", message}`. Needs `ANTHROPIC_API_KEY`; without it the stream carries one `error` event.
### `GET /explain/source?path=&line=&end=` -> `{ path, totalLines, start, target, lines[] }` from the bundled code snapshot (404 for paths outside it).

### Code viewer (`/code`), all read from the same build-time snapshot
- `GET /code` -> `{ path, lines, summary|null }[]`: every file in the snapshot, no contents (the file tree).
- `GET /code/file?path=` -> `{ path, lines, content }`. 404 `NOT_FOUND` for paths outside the snapshot (no disk access, so no traversal).
- `GET /code/search?q=` (2 to 120 chars) -> `{ files, total, hits: { path, line, text }[] }`. Every whitespace-separated term must appear on the same line, case-insensitive, at most 60 hits.

## Implementation notes

- One service function per endpoint in `src/server/services`, `'use cache'` + `cacheLife('hours')` + `cacheTag('catalog')`, input = the parsed Zod object, output = DTOs only (`mappers.ts` converts `Decimal -> number`, `Date -> ISO`).
- Filters build a single `Prisma.ModelWhereInput`; the provider filter is `listings: { some: { provider: { slug: { in } } } }`. Search adds `searchKey: { contains, mode: "insensitive" }`.
- Sorting by `value` needs `intelligenceIndex / blendedPrice`: use `$queryRaw` with `Prisma.sql` for ids + order, then fetch rows by id; or store `valueScore` as a denormalised column (allowed: add it to the schema, log in `03`).
- Rankings with filtered ranks use `RANK() OVER (...)` in `$queryRaw` (quote identifiers).
- Write one Vitest file for `schemas.ts` (CSV parsing, bounds) and one for the filter-to-`where` builder.
