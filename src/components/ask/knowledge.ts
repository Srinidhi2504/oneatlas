// Prepared answers for "Ask the code". Free to serve (no model call), reviewed for accuracy, ordered most to least important.
// Code references are anchors, {{path|text on the line}} or {{path|text|+N}} for a range. scripts/build-code-index.ts
// resolves each anchor to its current line number at build time and fails the build if the text is gone,
// so citations cannot silently drift as the code changes.

export interface PreparedAnswer {
  id: string;
  question: string;
  /** phrases that strongly signal this question (matched on normalised text) */
  keywords: string[];
  /** the "reading trail" shown while the answer is prepared */
  steps: string[];
  answer: string;
  related: string[];
}

export const KNOWLEDGE: PreparedAnswer[] = [
  {
    id: "overview",
    question: "What is OneAtlas, and what can I do with it?",
    keywords: ["what is oneatlas", "what is this", "overview", "what can i do", "features", "about this app", "purpose"],
    steps: ["Read README.md", "Read docs/01-requirements.md", "Listed src/app/"],
    answer: `OneAtlas is a discovery tool for AI models: it pulls **724 models from 91 labs, served by 307 API providers**, into one Postgres database and lets you search, compare and rank them. Everything you see comes from the database through a typed REST API, not from hard-coded data.

## What you can do
1. **Explore** (\`/\`): search with typo tolerance ("gpt4o" finds GPT-4o), filter by lab, provider, type and capabilities, sort by price, context, intelligence or value. Every filter lives in the URL, so a view can be shared ({{src/components/explorer/state.ts|export const explorerParsers}}).
2. **Open a model** (\`/models/{lab}/{slug}\`): stat tiles, pricing with a monthly cost calculator, benchmarks with "#rank of N", and every provider listing with that provider's own price ({{src/app/models/[lab]/[slug]/page.tsx|async function ModelView}}).
3. **Compare** up to four models, with the best value in each row labelled ({{src/components/compare/CompareView.tsx|function bestIndexes}}).
4. **Rankings**: availability, intelligence, value, cheapest, context, newest and 30 benchmarks, plus a price-vs-intelligence chart with the value frontier.
5. **Labs, providers and the benchmark matrix** for browsing by company.
6. **Ask the code** (this panel) to learn how any of it is built.

## How it is put together
Next.js 16 route handlers form the backend, a service layer is the only code that talks to Postgres (Prisma 7 on Neon), and pages render their first view on the server from the same services the API uses. The data is ingested from two public sources, models.dev and OpenRouter, by a script you can re-run safely.`,
    related: ["request-flow", "architecture", "data-join"],
  },
  {
    id: "request-flow",
    question: "Walk me through what happens when I change a filter, from the URL to the database and back.",
    keywords: ["change a filter", "filter", "end to end", "request flow", "walk me through", "from the url", "to the database", "data flow", "how does a request"],
    steps: [
      "Searched for “useQueryStates”",
      "Read src/components/explorer/Explorer.tsx",
      "Read src/components/explorer/state.ts",
      "Read src/app/api/v1/models/route.ts",
      "Read src/server/services/models.ts",
      "Read src/server/model-where.ts",
    ],
    answer: `Changing a filter touches seven layers, and each has exactly one job.

1. **URL state.** The chip calls \`setState\` from nuqs ({{src/components/explorer/Explorer.tsx|useQueryStates(explorerParsers}}). The URL changes (for example \`?capability=tools\`) without a page reload, and the page number resets to 1.
2. **Canonical query.** \`toApiQuery\` turns the state into a sorted, validated query string ({{src/components/explorer/state.ts|export function toApiQuery}}). The same function runs on the server for the first render, which is why hydration never refetches.
3. **Client fetch.** TanStack Query uses that string as its cache key and calls \`/api/v1/models\` through the typed client ({{src/lib/api.ts|export async function apiGet}}). \`placeholderData: keepPreviousData\` keeps the old rows on screen, dimmed, with a thin progress bar instead of a flash of skeletons ({{src/components/explorer/Explorer.tsx|placeholderData: keepPreviousData}}).
4. **Route handler.** The handler is three lines: parse the query with the shared Zod schema, call the service, wrap the result ({{src/app/api/v1/models/route.ts|modelListQuerySchema.parse}}). The \`handler()\` wrapper turns any thrown error into the error envelope ({{src/server/http.ts|export function handler}}).
5. **Validation.** \`modelListQuerySchema\` coerces numbers, splits CSV params, caps \`pageSize\` at 100 and picks the default sort ({{src/lib/schemas.ts|export const modelListQuerySchema}}).
6. **Service and database.** \`listModels\` is cached with \`'use cache'\` and builds one Prisma \`where\` from the filters ({{src/server/services/models.ts|export async function listModels}}, {{src/server/model-where.ts|export function buildModelWhere}}). It runs one query for the page and one for the total.
7. **Mapping and response.** Prisma rows become plain DTOs: \`Decimal\` prices become numbers and dates become \`YYYY-MM-DD\` ({{src/server/mappers.ts|export function toModelListItem}}). \`ok()\` adds the \`{ data, meta }\` envelope and CDN cache headers ({{src/server/http.ts|export function ok}}).

The first visit takes a shortcut: the page reads the URL on the server and calls the same service directly, then hands the result to the client as \`initialData\` ({{src/app/page.tsx|async function ExplorerData}}).`,
    related: ["url-state", "caching", "errors"],
  },
  {
    id: "architecture",
    question: "How is the architecture layered, and why route handlers instead of NestJS?",
    keywords: ["architecture", "layers", "layered", "nestjs", "nest", "backend", "service layer", "structure", "folder", "why next"],
    steps: ["Read docs/03-architecture.md", "Listed src/server/", "Read src/server/services/common.ts", "Read src/lib/db.ts"],
    answer: `There are three layers on the server, and the rule is simple: **only services touch the database**.

1. **Route handlers** (\`src/app/api/v1/**/route.ts\`) parse input, call one service and shape the response. No business logic lives here.
2. **Services** (\`src/server/services/*\`) hold the logic, cache their reads ({{src/server/services/common.ts|export function catalogCache}}) and are the only Prisma users.
3. **Database access** is one shared Prisma client with a Postgres driver adapter, a bounded pool and retries for connection errors ({{src/lib/db.ts|export const db}}).

Server Components call the **same services** as the API, so a page's first render and the JSON a client fetches can never disagree. Client components only call \`/api/v1/*\`.

## Why not NestJS?
The brief allows either. Next.js route handlers give **one repo and one deployment** (Vercel), and Zod schemas and TypeScript types are shared by the API, the pages and the browser. NestJS would add a second deployable and duplicated DTOs for no gain at this size. The layering above gives the same separation a NestJS module would. This and every later deviation is recorded in the decision log in \`docs/03-architecture.md\`.

## Supporting pieces
- \`src/lib/schemas.ts\`: one Zod schema per endpoint, used by routes, pages and tests.
- \`src/server/mappers.ts\`: the only place \`Decimal\` and \`Date\` are converted.
- \`src/server/http.ts\`: envelopes, cache headers and error mapping.`,
    related: ["request-flow", "caching", "scale"],
  },
  {
    id: "data-join",
    question: "Where does the data come from, and how are models.dev and OpenRouter joined into one catalog?",
    keywords: ["data come from", "data source", "models.dev", "openrouter", "join", "joined", "ingest", "ingestion", "canonical", "alias", "ambiguous", "entity resolution"],
    steps: ["Read docs/04-data-model-and-ingestion.md", "Read scripts/ingest/join.ts", "Read src/lib/labs.ts", "Read scripts/ingest/seed.ts lines 60-120"],
    answer: `Two free, keyless sources feed the catalog, and the key insight was choosing the right **spine**.

## models.dev is the spine
models.dev lists about 10,000 provider rows, and 8,618 of them carry a \`canonical_model_id\` such as \`anthropic/claude-opus-5-5\`. That field already groups every provider's copy of a model into **658 canonical models**, so the hard entity-resolution problem was solved upstream. It also has per-provider prices.

## OpenRouter adds descriptions and benchmarks
OpenRouter's catalogue uses different ids (\`qwen/...\` instead of \`alibaba/...\`, dots instead of dashes, \`:free\` suffixes). Ids are joined with a normalised key ({{scripts/ingest/join.ts|export function joinKey}}):
1. Map the lab through an alias table ({{src/lib/labs.ts|export const LAB_ALIAS}}).
2. Lower-case the slug, drop \`:variant\` suffixes and trailing dates, strip punctuation.

When several canonical models share a key, the tie-break prefers the exact id, then the unique shortest slug, otherwise leaves it unjoined ({{scripts/ingest/join.ts|function resolveAmbiguous}}).

## Measured, and pinned by a test
On the committed snapshots: **284 of 350 OpenRouter keys match, 5 are ambiguous (all resolved), 66 become OpenRouter-only models**. A unit test runs the join on the real snapshot so a regression fails CI ({{scripts/ingest/join.test.ts|reproduces the baseline join numbers}}).

## Choosing one value per model
- **Reference price**: the lab's own API, else OpenRouter, else the median across providers ({{scripts/ingest/seed.ts|function referencePrices}}).
- **Name**: the first-party name, else the most common name across providers, because provider rows add noise like "GPT-4o (Fast)" ({{scripts/ingest/normalize.ts|export function mostCommon}}).
- Duplicate names inside a lab get a suffix, for example "DeepSeek V4 Pro (0423)" ({{scripts/ingest/normalize.ts|export function disambiguateNames}}).`,
    related: ["seed", "pricing", "search"],
  },
  {
    id: "assistant",
    question: "How does this assistant work, and why are its answers prepared instead of live AI?",
    keywords: ["this assistant", "this chatbot", "ask the code", "why prepared", "why not live", "live ai", "claude", "api key", "not live", "how do you work", "are you an ai", "why predefined", "llm in this app"],
    steps: ["Read src/server/explain/assistant.ts", "Read src/server/explain/code-tools.ts", "Read src/app/api/v1/explain/route.ts", "Read scripts/build-code-index.ts"],
    answer: `This panel has **two modes**. The one answering you now is **Prepared**: curated answers written against the real code, played back with the same reading trail and citations a live answer has. It costs nothing to run. The **Live** mode is fully built and kept in the codebase; it switches on when the deployment has an \`ANTHROPIC_API_KEY\`.

## Why prepared answers by default
- **Cost.** This is a public demo. Every live question is a paid model call, and a curious visitor (or a script) could run up a bill.
- **Accuracy for reviewers.** Prepared answers were checked against the code. Their citations are resolved to line numbers at build time, and the build fails if the cited code moves away.
- **Speed and reliability.** No network round trip to a model, no rate limits, works offline.

## How Live mode works (still in the code)
1. **A code snapshot** is built on install, dev and build: allow-listed source and docs only, never \`.env\` ({{scripts/build-code-index.ts|const INCLUDE}}).
2. **Three read-only tools** search, read and list files in that snapshot. Paths are looked up in memory, never on disk, so nothing outside it can be read ({{src/server/explain/code-tools.ts|export function searchCode}}).
3. **A bounded tool loop** on Claude Opus 5.5: at most six rounds per question, streamed back to this panel ({{src/server/explain/assistant.ts|const MAX_ROUNDS}}, {{src/server/explain/assistant.ts|export async function explain(}}). The project map and architecture doc sit in a cached system prompt, and safety refusals fall back to another model server-side ({{src/server/explain/assistant.ts|fallbacks: "default"}}).
4. **The endpoint** validates the chat with Zod and rate-limits each visitor to 12 questions per 10 minutes ({{src/app/api/v1/explain/route.ts|export async function POST}}).

## Turning Live on
Set \`ANTHROPIC_API_KEY\` in \`.env\` (and in Vercel), restart, and a **Live** toggle appears at the top of this panel. Questions without a prepared answer can then be sent to Claude.`,
    related: ["local-llm", "testing", "reliability"],
  },
  {
    id: "caching",
    question: "How does caching work, and how is it invalidated after the data is re-seeded?",
    keywords: ["cache", "caching", "use cache", "cachelife", "cachetag", "revalidate", "invalidate", "stale", "cdn", "performance"],
    steps: ["Searched for “catalogCache”", "Read src/server/services/common.ts", "Read src/server/http.ts", "Read src/app/api/internal/revalidate/route.ts"],
    answer: `Catalog data only changes when the seed runs, so the app caches aggressively in two layers and clears both with one call.

## 1. Service-level cache (Next 16 Cache Components)
Every read service starts with \`'use cache'\` and calls \`catalogCache()\`, which sets an hours-long lifetime and tags the entry \`catalog\` ({{src/server/services/common.ts|export function catalogCache|+3}}). Arguments are part of the cache key, so each distinct filter combination is cached separately. Pages and API routes share these entries because they call the same functions.

## 2. HTTP cache headers
Successful API responses carry \`public, s-maxage=300, stale-while-revalidate=3600\`, so a CDN can serve them; errors are \`no-store\` ({{src/server/http.ts|const CACHE_OK}}).

## Invalidation after a re-seed
\`POST /api/internal/revalidate\` with a bearer secret calls \`revalidateTag("catalog", { expire: 0 })\`, which expires every tagged entry at once, pages and API alike ({{src/app/api/internal/revalidate/route.ts|revalidateTag(}}). Missing or wrong tokens get a 404, so the endpoint does not advertise itself.

## Two lessons learned
- Errors thrown inside a cached function **lose their class** when they cross the cache boundary. A "not found" thrown there became a 500. Cached loaders now return \`null\` and an uncached wrapper throws the 404 ({{src/server/services/directory.ts|async function loadLab}}).
- Measured locally, a warm request takes 2 to 6 ms; a cache miss is 0.5 to 0.9 s, mostly network distance to the database.`,
    related: ["request-flow", "reliability", "scale"],
  },
  {
    id: "search",
    question: "How does search handle queries like “gpt4o” or “claude son”?",
    keywords: ["search", "gpt4o", "typo", "trigram", "pg_trgm", "fuzzy", "relevance", "find a model", "searchkey"],
    steps: ["Read src/lib/search-key.ts", "Searched for “gin_trgm_ops”", "Read src/server/model-where.ts", "Read src/server/services/catalog.ts"],
    answer: `Search normalises both sides of the comparison so punctuation and spacing stop mattering, and lets a Postgres trigram index do the rest.

1. **A search key per model.** At ingest every model gets \`searchKey\`: the lab slug, lab name, model name and slug, lower-cased with everything except \`a-z0-9\` removed ({{src/lib/search-key.ts|export const toSearchKey}}). "GPT-4o by OpenAI" becomes \`...gpt4o...\`.
2. **The query gets the same treatment.** "gpt4o", "GPT 4o" and "gpt-4o" all become \`gpt4o\`, and "claude son" becomes \`claudeson\`, which is a substring of \`...claudesonnet55...\`.
3. **A trigram index makes \`contains\` fast.** A hand-written migration adds \`pg_trgm\` and a GIN index on \`searchKey\` ({{prisma/migrations/20261122000000_init/migration.sql|gin_trgm_ops}}). Prisma cannot express that index, so a generated migration once tried to drop it; that line was removed by hand and the rule is in CLAUDE.md.
4. **Relevance order.** Exact name first, then names that start with the query, then names that contain it, then matches only on lab or slug; inside each tier, non-deprecated and widely served models win ({{src/server/model-where.ts|export function relevanceSort}}). The command palette uses the same ranking ({{src/server/services/catalog.ts|export async function search(}}).

## Limits, honestly
Contains-matching cannot handle true misspellings ("cluade"), and relevance is computed in memory over the matching set, which is fine at about 1,000 models. At 100x the plan is \`tsvector\` with \`ts_rank\` or a search service.`,
    related: ["request-flow", "scale", "url-state"],
  },
  {
    id: "seed",
    question: "How does the seed script stay idempotent and safe to re-run?",
    keywords: ["seed", "idempotent", "re-run", "rerun", "upsert", "transaction", "snapshot", "sanity band", "ingest script"],
    steps: ["Read scripts/ingest/seed.ts", "Read scripts/ingest/normalize.ts", "Searched for “$transaction”"],
    answer: `The seed can run any number of times and always produces the same database. Four decisions make that true.

1. **It reads only committed snapshots**, never the network, so runs are deterministic and work offline. A separate \`npm run ingest:fetch\` refreshes the snapshots.
2. **Every source row is validated with Zod**, and bad rows are counted and skipped instead of crashing the run ({{scripts/ingest/normalize.ts|export const modelsDevRowSchema}}).
3. **Natural keys, not generated ids.** Labs, providers and models are upserted on their natural keys (slug, or lab plus slug), so ids stay stable across runs. Listings and benchmark scores are replaced inside **one transaction** with a two-minute timeout, so a reader never sees half a catalog ({{scripts/ingest/seed.ts|await db.$transaction(}}).
4. **Moving unique values are cleared first.** \`openrouterId\` is unique and can move from one model to another when an alias changes, so it is reset before the upserts ({{scripts/ingest/seed.ts|openrouterId: null}}).

Rows that disappeared from the snapshots are deleted at the end of the transaction, so a refresh is exact.

## It reports on itself
The run prints join statistics, skipped rows by reason, and every table count against a sanity band ({{scripts/ingest/seed.ts|async function report(}}). Measured: two runs gave identical counts (91 labs, 724 models, 307 providers, 8,618 listings, 1,964 scores) in about 55 seconds against Neon.`,
    related: ["data-join", "reliability", "testing"],
  },
  {
    id: "rankings",
    question: "How are rankings and the “value” score calculated?",
    keywords: ["ranking", "rankings", "leaderboard", "value score", "best value", "rank", "board", "podium", "frontier", "intelligence index"],
    steps: ["Read src/server/services/rankings.ts", "Read src/lib/ranking.ts", "Read src/lib/pricing.ts"],
    answer: `Every leaderboard is defined once as data: a label, the column it measures, its direction and which models qualify ({{src/server/services/rankings.ts|export const BOARDS}}).

| Board | Measure | Qualifies when |
|---|---|---|
| Most available | providers serving the model | at least one provider |
| Intelligence | Artificial Analysis Intelligence Index | scored |
| Best value | intelligence ÷ blended price | both known, price above 0 |
| Cheapest | blended price, ascending | price above 0 |
| Context, Newest | context window, release date | known |

Every benchmark key is a board too.

## Ranks respect your filters
\`rankedEntries\` loads the light list of eligible models for the board and your filters, then applies **competition ranking**: ties share a rank and the next rank skips, as in 1, 2, 2, 4 ({{src/server/services/rankings.ts|export async function rankedEntries}}, {{src/lib/ranking.ts|export function competitionRanks}}). Deprecated models are left out, since nobody can choose them.

## The value score
\`value = intelligence ÷ blended price\`, where blended price is \`(3 × input + output) ÷ 4\` per 1M tokens ({{src/lib/pricing.ts|export const valueScore}}). It is stored as a column at ingest so sorting by value is a plain indexed \`ORDER BY\`. Check: Claude Opus 5.5 at $4 / $20 gives a blended $8.00, and 59.1 ÷ 8 = 7.4, matching oneatlas.dev.

## The scatter's frontier line
The price-vs-intelligence chart draws the **value frontier**: walking from cheapest to most expensive, it keeps each model that is smarter than every cheaper one ({{src/lib/ranking.ts|export function paretoFrontier}}).

The model page's rank chips read these same ranked lists, so a model page and its leaderboard can never disagree.`,
    related: ["pricing", "scale", "compare"],
  },
  {
    id: "pricing",
    question: "How are prices stored and shown: Decimal vs number, blended price and the reference price?",
    keywords: ["price", "pricing", "decimal", "money", "blended", "reference price", "per million", "per 1m", "cost calculator", "monthly cost", "cheapest provider"],
    steps: ["Read prisma/schema.prisma", "Read src/server/mappers.ts", "Read src/lib/pricing.ts", "Read src/components/compare/CostCalculator.tsx"],
    answer: `Prices are **USD per 1M tokens everywhere**, and money is exact where it is stored.

1. **Storage: \`Decimal(12,6)\`** in Postgres, so sub-cent prices like $0.075 never pick up floating-point noise ({{prisma/schema.prisma|Decimal(12, 6)}}).
2. **API: plain numbers.** The mapper is the only place \`Decimal\` becomes \`number\` ({{src/server/mappers.ts|export const num}}). That keeps cached results serialisable (a Cache Components requirement) and keeps Prisma types out of the browser.
3. **Blended price** is \`(3 × input + output) ÷ 4\`, which assumes the usual 3:1 input-to-output mix ({{src/lib/pricing.ts|export const blendedPrice}}). It is computed once at ingest and indexed for sorting.
4. **One reference price per model**: the lab's own API if it lists one, else OpenRouter, else the median across providers. Every provider's own price is kept per listing, so the model page shows the full spread.

## The cost calculator
Enter monthly input and output tokens and it shows the cost at the reference price and at the cheapest provider for **that** mix ({{src/lib/pricing.ts|export function cheapestListing}}). The cheapest provider genuinely changes: an input-heavy workload favours cheap input, an output-heavy one cheap output. $0 listings on paid models are skipped, because they are coding-plan bundles, not usable per-token prices ({{src/components/compare/CostCalculator.tsx|plan-bundled}}).

Display formatting lives in one tested file: "Free" for 0, "$0.075", "$3.00", and "N/A" for unknown.`,
    related: ["rankings", "compare", "data-join"],
  },
  {
    id: "errors",
    question: "What happens when the API gets an invalid query or an unknown model?",
    keywords: ["invalid", "error", "errors", "400", "404", "500", "zod", "validation", "bad request", "unknown model", "error envelope", "not found"],
    steps: ["Read src/server/http.ts", "Read src/lib/schemas.ts", "Read src/server/errors.ts"],
    answer: `Every input is validated, every failure has the same shape, and database errors never reach the client.

## The envelope
Success is \`{ data, meta? }\`. Failure is always \`{ error: { code, message, details? } }\`.

| Status | Code | When |
|---|---|---|
| 400 | INVALID_QUERY | Zod rejected the input; \`details\` lists each field and why |
| 404 | NOT_FOUND | unknown model, lab, provider or board |
| 429 | RATE_LIMITED | too many assistant questions (live mode only) |
| 500 | INTERNAL | anything else: a generic message plus a request id, logged on the server |

## How it is wired
- Each route wraps its handler in \`handler()\` ({{src/server/http.ts|export function handler}}). Whatever is thrown goes to \`toErrorResponse\`, which maps \`ZodError\` to 400, \`NotFoundError\` to 404 and the rest to 500 ({{src/server/http.ts|export function toErrorResponse}}).
- \`unstable_rethrow\` runs first in every catch, so Next's own control-flow signals pass through instead of being logged as 500s during the build ({{src/server/http.ts|unstable_rethrow(err)}}).
- Schemas coerce and bound everything: \`pageSize=1000\` and \`type=foo\` are 400s, unknown params are ignored, and \`../etc\` is not a valid slug ({{src/lib/schemas.ts|export const slugSchema}}).

## Try it
\`/api/v1/models?pageSize=1000\` returns a 400 with \`"path": "pageSize"\`; \`/api/v1/models/nope/nothing\` returns a 404. In the UI an unknown model shows the branded 404 page, and a failed fetch shows a message with a Retry button.`,
    related: ["reliability", "request-flow", "testing"],
  },
  {
    id: "url-state",
    question: "Why is all the UI state kept in the URL, and how does the server render the same view?",
    keywords: ["url state", "nuqs", "query string", "shareable", "back button", "search params", "hydration", "initialdata", "tanstack"],
    steps: ["Read src/components/explorer/state.ts", "Read src/components/explorer/Explorer.tsx", "Read src/app/page.tsx"],
    answer: `Filters, sort, page, view and the compare selection all live in the URL. That gives three things for free: **shareable links, a working back button, and a server that can render exactly what you see**.

1. **One set of parsers, two runtimes.** \`explorerParsers\` describes every parameter with its type and default ({{src/components/explorer/state.ts|export const explorerParsers}}). The browser reads them with nuqs's \`useQueryStates\`, and the server reads the same parsers with \`createLoader\` ({{src/components/explorer/state.ts|export const loadExplorerState}}).
2. **One canonical API query.** Both sides build the request with \`toApiQuery\`, which sorts lists and drops junk such as \`type=foo\`, so equivalent URLs give the same string.
3. **No double fetch.** The server renders the first page with that query and passes it down. On the client, TanStack Query reuses it as \`initialData\` only when the keys match ({{src/components/explorer/Explorer.tsx|initialData: apiQs === initial.modelsQs}}).
4. **Smooth changes afterwards.** Later changes fetch through the API while the previous rows stay visible.

## Details that matter
- Any filter change resets the page to 1, and typing in search is debounced 250 ms and uses history \`replace\`, so the back button is not flooded with keystrokes.
- On the compare page the URL is the source of truth and is mirrored into the compare tray ({{src/lib/compare-store.ts|export function replaceCompareList}}).`,
    related: ["request-flow", "compare", "accessibility"],
  },
  {
    id: "compare",
    question: "How does the compare page decide which value is “best”?",
    keywords: ["compare", "comparison", "best value", "best in row", "differences only", "side by side", "tray", "compare tray"],
    steps: ["Read src/components/compare/CompareView.tsx", "Read src/lib/compare-store.ts"],
    answer: `Each row of the comparison table is a small definition: how to render a value, the number to compare (if any), and whether **higher or lower is better**. Prices are lower-is-better; context, providers and benchmark scores are higher-is-better.

\`bestIndexes\` then picks the winner per row ({{src/components/compare/CompareView.tsx|function bestIndexes}}):
- Unknown values never win, but a free ($0) price does.
- With fewer than two known values there is nothing to compare, so no winner.
- If every model ties, no cell is highlighted, since "best" would mean nothing.
- Real ties all win.

The winning cell gets a tinted background **and a visible "best" label**, so colour is never the only signal.

## The rest of the page
- **Differences only** hides rows where every model has the same value.
- **Share** copies the URL, which fully describes the comparison (\`/compare?ids=a/b,c/d\`).
- **The compare tray** is a tiny store shared through \`useSyncExternalStore\` and saved in \`localStorage\`, guarded for private browsing ({{src/lib/compare-store.ts|export function useCompareList}}).
- **The cost calculator** under the table prices your own monthly token mix at each model's cheapest provider.`,
    related: ["pricing", "url-state", "accessibility"],
  },
  {
    id: "reliability",
    question: "What makes the app reliable, and which production bugs were caught before shipping?",
    keywords: ["reliable", "reliability", "retry", "retries", "connection", "pool", "suspense", "500", "production bug", "robust", "health check", "rate limit"],
    steps: ["Read src/lib/db.ts", "Read src/components/layout/SiteChrome.tsx", "Read src/app/api/v1/health/route.ts", "Read src/server/rate-limit.ts"],
    answer: `Reliability came from testing the real build, not just the editor. Here are the safeguards and the bugs that made them necessary.

## Safeguards in place
- **Bounded pool and retries.** Five connections per process, and connection-level errors retried three times with backoff, which is safe because every query is a read ({{src/lib/db.ts|const RETRYABLE}}).
- **A health check** that pings the database and returns 503 when it is unreachable, never cached ({{src/app/api/v1/health/route.ts|export async function GET}}).
- **Validation and one error envelope** at every boundary, and no database messages in responses.
- **A rate limiter** on the only endpoint that costs money ({{src/server/rate-limit.ts|export function createRateLimiter}}).
- **Loading, empty and error states** on every page, each with a next action (Retry, Clear filters).

## Bugs caught before shipping
1. **On-demand pages returned 500 in production.** The nav's active-link highlight read the URL outside \`<Suspense>\`, which Next 16 refuses to prerender. Typecheck and build both passed; a Lighthouse run hit the 500. The fix wraps it with a static fallback ({{src/components/layout/SiteChrome.tsx|<Suspense fallback={<NavList />}}).
2. **Intermittent "database unreachable"** during builds, with 15 prerender workers opening connections at once. Fixed by the pool cap and retries above.
3. **404s that came back as 500s**, because errors lose their class across the cache boundary (see the caching answer).
4. **A panel that crashed** when opening a citation: newer browsers return a Promise from \`scrollIntoView()\`, and an effect returned it ({{src/components/ask/AskPanel.tsx|block body on purpose}}).`,
    related: ["errors", "caching", "hardest-bugs"],
  },
  {
    id: "ui-3d",
    question: "How are the 3D globe, scroll animations and other visual effects built?",
    keywords: ["3d", "globe", "animation", "animations", "scroll animation", "motion", "odometer", "tilt", "podium", "design", "ui", "visual"],
    steps: ["Read src/components/hero/AtlasGlobe.tsx", "Read src/app/globals.css", "Read src/components/ui/Odometer.tsx", "Read src/components/ui/Tilt.tsx"],
    answer: `The visual layer adds **no animation or 3D library**. Everything is canvas or native CSS, which keeps the JavaScript small and the Lighthouse score high.

1. **The globe** is about 150 lines of Canvas 2D ({{src/components/hero/AtlasGlobe.tsx|export function AtlasGlobe}}). 1,100 points are spread evenly on a sphere (a Fibonacci lattice), rotated and projected each frame, and shaded by depth so the back hemisphere fades. Lab hubs pulse, great-circle arcs carry moving dots, and you can drag it to spin with inertia. It pauses when off-screen or in a hidden tab, draws one still frame under reduced motion, and re-reads the theme colours when you switch light and dark.
2. **Scroll-driven 3D reveals.** Sections tilt up from the floor as they enter the viewport using CSS \`animation-timeline: view()\`, with no JavaScript scroll listeners ({{src/app/globals.css|.reveal-3d {}}). Score bars grow the same way.
3. **Odometer numbers.** Each digit is a column of 0 to 9 that rolls to its value on first paint. It is pure CSS and server-rendered, so there is no flash on hydration, and screen readers get the plain number ({{src/components/ui/Odometer.tsx|export function Odometer}}).
4. **Tilt cards** follow the pointer with a soft glare, for mouse and pen only ({{src/components/ui/Tilt.tsx|export function Tilt}}).
5. **The rankings podium** is built from CSS 3D faces that rise into place.

## Rules the effects follow
- Every effect switches off under \`prefers-reduced-motion\` ({{src/app/globals.css|@media (prefers-reduced-motion: reduce) {}}).
- Scroll animations are wrapped in \`@supports\`, so browsers without them simply show the content.
- A card never has both a reveal and a tilt on the same element, because both animate \`transform\` and the reveal would freeze the tilt.`,
    related: ["accessibility", "overview", "testing"],
  },
  {
    id: "scale",
    question: "What would break at 100x the data or traffic, and what would you change first?",
    keywords: ["scale", "scaling", "100x", "scalability", "bottleneck", "keyset", "materialized", "materialised", "read replica", "high traffic"],
    steps: ["Read docs/03-architecture.md", "Searched for “ponytail:”", "Read src/server/services/rankings.ts"],
    answer: `The current design is sized honestly for about 1,000 models. Every deliberate shortcut is marked in the code with a \`ponytail:\` comment naming its ceiling, so the upgrade path is written down where it applies.

| Pressure at 100x | Fix |
|---|---|
| Deep offset pages get slow | Keyset pagination on (sort value, id) |
| Contains-matching search is not enough | \`tsvector\` + \`ts_rank\`, or a search service |
| Filtered ranks computed in memory ({{src/server/services/rankings.ts|ponytail: ranks in memory}}) | \`RANK() OVER\` in SQL, or materialised views refreshed at ingest |
| About 15 facet queries per filter combination ({{src/server/services/catalog.ts|ponytail: ~15 small queries}}) | One query with \`GROUPING SETS\`, or precomputed facet tables |
| Many serverless connections | Neon pooler (already used), small per-instance pools (already 5), a read replica |
| Ingest too slow for one script | A scheduled job with incremental upserts keyed by \`updatedAt\` |
| Abuse of the public API | Edge rate limiting (Vercel firewall or Upstash); today's limiter is in memory per instance |

## What I would change first
**Caching and rate limiting at the edge**, because traffic grows before data does. Then keyset pagination, then moving ranks into SQL. The data model needs no change: the hot columns (\`providerCount\`, \`blendedPrice\`, \`valueScore\`, \`intelligenceIndex\`) are already denormalised and indexed for exactly this.`,
    related: ["caching", "architecture", "search"],
  },
  {
    id: "accessibility",
    question: "How is accessibility handled?",
    keywords: ["accessibility", "a11y", "screen reader", "keyboard", "contrast", "aria", "focus", "reduced motion", "wcag"],
    steps: ["Read src/app/layout.tsx", "Read src/components/models/ModelTable.tsx", "Read src/app/globals.css"],
    answer: `Accessibility was built in and then measured: Lighthouse accessibility is **100** on the home, model and compare pages.

- **Structure.** A skip link, landmarks (header, nav, main, footer) and one \`h1\` per page ({{src/app/layout.tsx|Skip to content}}).
- **Tables.** Real \`<table>\` markup with captions, \`scope\` on headers and \`aria-sort\` on sortable columns ({{src/components/models/ModelTable.tsx|aria-sort={ariaSort}}). Wide tables scroll inside a labelled, focusable region instead of the page.
- **Keyboard.** \`/\` focuses search, \`Ctrl/Cmd+K\` opens the palette with arrow-key navigation, and every control has a visible focus ring. Dialogs (palette, filters, this panel) trap focus and close on Escape, using Radix and cmdk rather than hand-rolled widgets.
- **Not colour alone.** "Best", "Deprecated", "Free" and "New" are text labels; capability icons have screen-reader text; score bars are \`role="meter"\` with values.
- **Contrast.** Every text colour token is at least 4.5:1 on its backgrounds in both themes. A Lighthouse finding lowered the faint grey slightly to pass on tinted cells.
- **Motion.** All animation stops under \`prefers-reduced-motion\`, including the globe, reveals and odometers.
- **Live regions.** Result counts and this assistant's progress are announced politely, without reading out streaming text token by token.`,
    related: ["ui-3d", "testing", "compare"],
  },
  {
    id: "testing",
    question: "How is the project tested?",
    keywords: ["test", "tests", "testing", "vitest", "playwright", "e2e", "unit test", "lighthouse", "quality", "ci"],
    steps: ["Listed **/*.test.ts", "Read e2e/smoke.spec.ts", "Read src/server/model-where.test.ts"],
    answer: `Tests target the logic that could silently go wrong. There is no snapshot-test theatre.

## Unit tests (Vitest, about 60)
- **Ingestion**: the join key, alias map and ambiguity rule, including a test that runs the join on the real snapshot and pins the result (284 / 5 / 66). Also normalisers (partial dates, modalities, prices) and name disambiguation.
- **API logic**: the Zod schemas (CSV parsing, bounds, bad enums) ({{src/lib/schemas.test.ts|rejects out-of-bounds and bad enums}}), the filter-to-\`where\` builder and search relevance ({{src/server/model-where.test.ts|describe("buildModelWhere"}}).
- **Maths**: blended price, value score, monthly cost, the cheapest listing for a token mix, competition ranks and the value frontier.
- **UI logic**: URL state canonicalisation, the Markdown renderer, citation parsing, the assistant's code tools, the rate limiter, and this panel's question matching.

## End to end (Playwright)
One smoke spec walks the core journey on a production build: search with \`/\`, a capability chip, picking two models, a model page, the compare page, the \`Ctrl+K\` palette and a filtered leaderboard. A second test checks the 404 page and the API error envelope ({{e2e/smoke.spec.ts|explorer filter, detail, compare and rankings}}).

## Beyond automated tests
Every page was screenshotted at 375, 768 and 1280 px in light and dark, with checks for console errors and horizontal overflow. Lighthouse ran on three pages. Two production-only bugs (a 500 on on-demand pages and a layout shift) were found that way, not by typecheck.`,
    related: ["reliability", "accessibility", "hardest-bugs"],
  },
  {
    id: "local-llm",
    question: "How could a local LLM (for example Ollama) power this assistant instead?",
    keywords: ["local llm", "ollama", "llama", "local model", "self hosted", "self-hosted", "offline model", "open source model", "lm studio", "vllm", "qwen", "run locally"],
    steps: ["Read src/server/explain/assistant.ts", "Read src/server/explain/code-tools.ts", "Read src/app/api/v1/explain/route.ts"],
    answer: `The assistant was built so that the model is the **only** replaceable part. The code index, the three tools, the streaming protocol to this panel and the UI do not care which LLM produces the tokens.

## What stays the same
- **Tools**: \`search_code\`, \`read_file\` and \`list_files\` are plain functions over the snapshot ({{src/server/explain/code-tools.ts|export function readFile}}).
- **The wire format** to the browser: newline-delimited JSON events for text, tool steps, done and error ({{src/server/explain/assistant.ts|export type ExplainEvent}}).
- **The route**, its validation and its rate limit ({{src/app/api/v1/explain/route.ts|export async function POST}}).

## What changes: one function
Write a second \`explain()\` beside the current one ({{src/server/explain/assistant.ts|export async function explain(}}) that talks to a local server instead of the Claude API:
1. Run a model with tool calling locally, for example \`ollama pull qwen2.5-coder\` (or a Llama 3.x instruct model), with Ollama serving on \`http://localhost:11434\`.
2. Send the same system prompt, history and tool definitions to Ollama's \`/api/chat\` with streaming on.
3. Map the stream: text chunks become \`{ type: "text" }\` events; tool calls run through the existing \`runTool()\` and are emitted as \`{ type: "tool" }\` steps; loop with the same six-round limit.
4. Pick the backend from an environment variable (\`ASSISTANT_BACKEND=ollama\`), keeping both implementations.

## Trade-offs to be honest about
- **Free per question, but not free to host.** A serverless platform like Vercel cannot reach a model on your laptop. You need a GPU machine or a VPS, or you use it only in local development.
- **Smaller models are weaker** at multi-step tool use. Expect more wrong file reads and less precise citations than a frontier model. The prepared answers and the build-time citation check help either way.
- **Latency** depends on your hardware. A 7B to 14B model on a recent laptop GPU is usable for single questions.`,
    related: ["assistant", "architecture", "next-steps"],
  },
  {
    id: "hardest-bugs",
    question: "What were the hardest problems or most surprising bugs while building it?",
    keywords: ["hardest", "challenge", "challenges", "difficult", "surprising", "problem", "lessons", "learned", "gotcha", "struggle"],
    steps: ["Read docs/03-architecture.md decision log", "Searched for “unstable_rethrow”", "Read scripts/ingest/join.test.ts"],
    answer: `The surprises clustered around one new framework feature and one data question.

1. **Next 16 Cache Components rules.** The framework prerenders as much as possible, and anything that reads the URL must sit under \`<Suspense>\`. A nav highlight outside it made every on-demand page a 500 in production while the build passed. A second rule: plain helpers exported from a \`"use client"\` file become client references on the server, so a grid class string arrived as an object and silently broke a layout. Shared helpers now live in plain \`.ts\` files ({{src/components/explorer/state.ts|createLoader}}).
2. **Errors losing their identity in the cache.** A "not found" thrown inside a cached function reached the route as a generic error, so 404s were 500s. Cached loaders now return \`null\` ({{src/server/services/rankings.ts|async function loadRankings}}).
3. **Entity resolution.** Matching two catalogues by exact id worked for only 192 of 658 models. The breakthrough was noticing models.dev already had canonical ids. The measured baseline in my own notes was also wrong: it counted 7 OpenRouter router ids as models. The join test now pins the corrected numbers.
4. **A sanity check that could never pass.** The plan expected at least 150 models with an intelligence score, but the data only has 65 distinct ones. The band was corrected and the reason logged, rather than fudging the data.
5. **A generated migration** that would have dropped the hand-written search index, because Prisma cannot model it. That line was removed and the rule written into the project instructions.

Each of these is a row in the decision log, which is the part of the repo I would read first.`,
    related: ["reliability", "data-join", "caching"],
  },
  {
    id: "next-steps",
    question: "What would you build next with more time?",
    keywords: ["next", "future", "roadmap", "more time", "improve", "what would you add", "todo", "stretch"],
    steps: ["Read docs/07-roadmap.md", "Read README.md"],
    answer: `In order of value:

1. **A bigger catalog.** Ingest the 1,405 models.dev rows that lack a canonical id (mostly small gateways), which would bring the count close to oneatlas.dev's 1,118 models.
2. **Long-context and batch price tiers.** Many models charge more beyond 200K tokens; the data is already in the snapshot and the cost calculator is the natural place to show it.
3. **Provider health.** OpenRouter publishes per-endpoint uptime, latency and throughput; a "fastest provider" column would complete the price story.
4. **Coding and agentic benchmarks** from the Artificial Analysis API (free with a key).
5. **Scheduled freshness.** A nightly job runs \`ingest:fetch\`, the seed and the revalidate call, so the catalog stays current with no deploy.
6. **Edge rate limiting and request ids** on every response, for operating it publicly.
7. **Live assistant hardening** if the API key is enabled: an evaluation set of real questions, answer caching, and per-visitor budgets.

What I would not add: accounts, a playground or admin editing. They are out of scope for a discovery product and add risk without helping the core job of choosing a model.`,
    related: ["scale", "local-llm", "overview"],
  },
];

// ---------- matching a typed question to a prepared answer ----------

const STOP = new Set("a an the is are was were be been of to in on for with and or how what why does do did can could would should i me my you your it its this that these those from by at as about into when where which who much many".split(" "));

export const normalise = (s: string) => s.toLowerCase().replace(/[“”"'’`]/g, "").replace(/[^a-z0-9.+\- ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => normalise(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w));

/**
 * Best prepared answer for free text, or null. Score = 3 per keyword phrase found + 1 per content word shared with
 * the prepared question; a match needs at least 3 points (one keyword, or three shared words).
 */
export function matchQuestion(text: string, kb: PreparedAnswer[] = KNOWLEDGE): { entry: PreparedAnswer; score: number } | null {
  const q = ` ${normalise(text)} `;
  const qWords = new Set(words(text));
  let best: { entry: PreparedAnswer; score: number } | null = null;
  for (const entry of kb) {
    let score = 0;
    for (const k of entry.keywords) if (q.includes(` ${normalise(k)} `) || (k.length > 4 && q.includes(normalise(k)))) score += 3;
    for (const w of words(entry.question)) if (qWords.has(w)) score += 1;
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= 3 ? best : null;
}

/** Closest questions by the same score, for "did you mean" suggestions. */
export function suggestQuestions(text: string, n = 3, kb: PreparedAnswer[] = KNOWLEDGE): PreparedAnswer[] {
  const qWords = new Set(words(text));
  return kb
    .map((entry) => ({ entry, score: words(entry.question + " " + entry.keywords.join(" ")).filter((w) => qWords.has(w)).length }))
    .sort((a, b) => b.score - a.score || kb.indexOf(a.entry) - kb.indexOf(b.entry))
    .slice(0, n)
    .map((x) => x.entry);
}

export const ANCHOR = /\{\{([^|}]+)\|([^}]+?)(?:\|\+(\d+))?\}\}/g;

/** {{path|text|+N}} -> `path:line` or `path:line-end` using the build-time map; unknown anchors fall back to `path`. */
export function resolveAnchors(text: string, anchors: Record<string, number>): string {
  const tick = "`";
  return text.replace(ANCHOR, (_, path: string, needle: string, extra?: string) => {
    const line = anchors[`${path}|${needle}`];
    if (!line) return tick + path + tick;
    return tick + path + ":" + line + (extra ? `-${line + Number(extra)}` : "") + tick;
  });
}
