# 03 Architecture and decisions

## System at a glance

This file is the decision record: what was decided, why, and every later deviation (the log at the bottom). The full system design (components, flows, caching layers, reliability, security, scaling) is in [`09-system-design.md`](09-system-design.md); the schema and indexes are in [`10-database-design.md`](10-database-design.md); the deployment runbook is [`08`](08-deploy-and-submission.md).

```mermaid
flowchart LR
  subgraph Sources[Public sources, no key]
    MD[models.dev api.json]
    OR[OpenRouter /models]
  end
  subgraph Ingest[scripts/ingest: run locally or in CI]
    F[fetch -> data/snapshots] --> N[normalise + Zod validate] --> J[join by canonical key] --> U[upsert in one transaction] --> R[ranks + denormalised columns]
  end
  MD --> F
  OR --> F
  R --> DB[(Neon Postgres via Prisma 7)]
  subgraph App[Next.js 16 on Vercel, region iad1]
    SVC[src/server/services: the only code that touches Prisma, 'use cache' + tag catalog]
    API[app/api/v1/**/route.ts: thin handlers]
    RSC[Server Components: static shell + Suspense]
    CL[Client islands: TanStack Query + nuqs]
    IDX[Build-time code snapshot: /code viewer, ZIP download, Ask the code]
  end
  DB --> SVC
  SVC --> API
  SVC --> RSC
  API --> CL
  RSC -- initial data --> CL
  IDX --> API
```

## Decisions (ADR-lite)

| # | Decision | Why | Rejected alternative |
|---|----------|-----|----------------------|
| D1 | **Next.js route handlers** for the backend, not NestJS | One repo, one deploy (Vercel), types/Zod shared with the UI, far less glue. The brief allows either. Clean layering inside gives the same architectural story | NestJS: second deployable + DTO duplication for no MVP gain |
| D2 | **Service layer** (`src/server/services`) is the only Prisma user; routes and Server Components both call it | Business logic in one place, testable, no logic in route files or components | Prisma calls inside route handlers/pages |
| D3 | **Both SSR and API**: pages server-render first paint from services; interactive lists then use `/api/v1/*` via TanStack Query hydrated with the server result | Fast first paint + SEO **and** a real, demonstrable API integration (visible in the network tab) | Pure RSC (no visible API) or pure client fetch (empty first paint) |
| D4 | **models.dev is the spine, OpenRouter is enrichment** | models.dev already resolves provider listings to canonical models (`canonical_model_id`), has per-provider prices, flags and 10k rows. OpenRouter adds benchmarks and descriptions. See `02` join analysis | Spine = OpenRouter: only 476 entries, 1 provider per model, no real provider directory |
| D5 | **Seed from committed snapshots**; a separate script refreshes them | Deterministic, offline, reviewers can run it, immune to upstream breakage | Live fetch inside seed |
| D6 | **Search = Postgres `pg_trgm`** on a normalised `searchKey` | 1k-row catalog: trigram GIN gives typo/partial tolerance ("gpt4o", "claude son") with zero extra infra | Elasticsearch/Algolia (overkill), plain `LIKE` on name (misses "gpt4o") |
| D7 | **Offset pagination**, `pageSize` capped at 100, stable tiebreak on `id` | Simple, supports numbered pages and totals, fine at this size | Keyset: listed under "at 100x" |
| D8 | **Booleans for capabilities, `String[]` for modalities, `Decimal` for money** | Cheap filters, indexable, exact prices; DTOs convert to `number` | JSON blobs (unfilterable), floats for money |
| D9 | **Precompute benchmark ranks and a few hot columns at ingest** (`BenchmarkScore.rank`, `Model.providerCount`, `intelligenceIndex`, `blendedPrice`) | Rankings and sorts need no join/aggregation at request time; data only changes at ingest | Window functions on every request |
| D10 | **Cache Components**: cache in the service layer with `'use cache'` | It is the Next 16 default and a good story (static shell + cached data + streaming). Data changes only at ingest, so hours-long caching is correct | Disable `cacheComponents` and use route segment `revalidate` (legacy model) |
| D11 | **URL is the state** for filters/sort/page/compare (nuqs) | Shareable, back-button safe, SSR can render the same view | Component state / Zustand |
| D12 | **No auth, no writes** | Out of scope, removes a class of risk; read-only API is trivially safe to cache | Admin CRUD |

## Code layout

```
src/
  app/                          # routes (App Router)
    layout.tsx, page.tsx        #   root layout; / = hero + stats + explorer
    models/[lab]/[slug]/        #   model detail
    compare/  rankings/[board]/  benchmarks/  labs/[slug]/  providers/[slug]/  code/
    api/v1/**/route.ts          #   REST API: thin handlers (parse -> service -> envelope)
    api/internal/revalidate/    #   bearer-protected cache bust after a re-seed
    api/[...path]/              #   JSON 404 for unknown API paths
    not-found.tsx, error.tsx, globals.css
  server/                       # server-only code
    services/                   #   models, catalog (search/facets/stats/health), directory (labs/providers),
                                #   rankings, benchmarks, common: the ONLY Prisma users, all 'use cache'
    mappers.ts                  #   Prisma row -> DTO (Decimal -> number, Date -> ISO)
    model-where.ts              #   filters -> Prisma where (pure, unit-tested)
    http.ts  errors.ts          #   envelopes, handler wrapper, NotFoundError
    rate-limit.ts               #   sliding-window limiter for POST /explain
    code-index.ts               #   loader for the build-time code snapshot and archive metadata
    explain/                    #   Live "Ask the code": Claude loop + read-only code tools
  lib/                          # shared by server and client (client code never imports db.ts or Zod)
    db.ts                       #   Prisma client (server only)
    schemas.ts                  #   Zod request schemas (route handlers + pages)
    types.ts pricing.ts ranking.ts format.ts search-key.ts labs.ts tones.ts site.ts api.ts compare-store.ts
  components/                   # React: ui/ primitives, layout/, explorer/, models/, compare/, rankings/,
                                #   benchmarks/, directory/, hero/, ask/, code/
  generated/                    # gitignored: Prisma client, code-index.json, ask-anchors.json, source-archive.json
scripts/
  ingest/                       # fetch.ts, normalize.ts, join.ts, seed.ts (+ tests)
  build-code-index.ts, zip.ts   # build-time snapshots: code index, citations, public/oneatlas-source.zip
data/snapshots/                 # committed source data (the seed's only input)
prisma/                         # schema.prisma, migrations/
e2e/                            # Playwright smoke spec
docs/                           # 01..10 (this folder)
vercel.json                     # function region (iad1, next to the database)
```

## Request flows

**Explorer (`/`).** Page = static shell (header, filter skeleton) + `<Suspense>` around a server part that `await searchParams`, parses them with `modelListQuerySchema`, calls `listModels(query)` (cached) and passes the result as `initialData` to the client `<Explorer>`. The client keeps the same query key; changing a filter updates the URL (nuqs), TanStack Query fetches `/api/v1/models?...` with `placeholderData: keepPreviousData` (no flicker), search input is debounced 250 ms.

**Detail (`/models/[lab]/[slug]`).** `generateStaticParams` returns the top ~50 models by provider count; others render on demand. Page calls `getModel(lab, slug)` (cached, tag `catalog`) and `notFound()` when absent.

**Compare.** Tray state in `localStorage` (max 4) mirrored to the URL `?ids=`; page calls `/api/v1/compare`.

## Caching rules (Next 16 `cacheComponents: true`)

- Service read functions: `'use cache'; cacheLife('hours'); cacheTag('catalog')`. Inputs and outputs are plain objects.
- Route handlers set `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600` on success, `no-store` on errors.
- After a re-seed, invalidate with `revalidateTag('catalog')` (small secret-protected `POST /api/internal/revalidate`, roadmap P6) or simply redeploy.
- Everything reading `searchParams`/`params` lives under `<Suspense>`.

## Validation and errors

- One Zod schema per endpoint input in `src/lib/schemas.ts` (`z.coerce` numbers, CSV -> array, enums, `pageSize` max 100, unknown params ignored). The same schemas parse page `searchParams`.
- `http.ts` wraps handlers: `ZodError` -> 400 `INVALID_QUERY` with field details; service `NotFoundError` -> 404; anything else -> 500 `INTERNAL` with a generic message and a server-side log carrying a request id. Prisma errors never reach clients.
- DB integrity: unique keys (`Lab.slug`, `[labId, slug]`, `[providerId, providerModelId]`), foreign keys with cascade on listings/scores, `Decimal` money.

## Performance budget

- List API: p95 < 300 ms warm; page JS for `/` < 200 kB gzip; LCP < 2.5 s on throttled mobile; no layout shift from table loads (fixed row height skeleton).
- List queries select only list columns; one query for items + one count; facets in one grouped query set; no N+1 (detail page: one query with `include` on listings/scores).

## Scalability: what breaks at 100x and the fix (say this in the Loom)

| Pressure | Fix |
|----------|-----|
| Deep offset pages slow | Keyset pagination on `(sortValue, id)` |
| Trigram `ILIKE` insufficient for relevance | `tsvector` + `ts_rank`, or a search service |
| Ranking/facet aggregates heavy | Materialised views refreshed at ingest, or extra denormalised columns |
| Many concurrent serverless connections | Neon pooler (already) + Prisma adapter pool limits; read replica |
| Ingest too slow for a function | Move to a scheduled job/queue; incremental upserts keyed by `updatedAt` |
| Abuse of the public API | Rate limit at the edge (Vercel firewall / Upstash) |

## Security notes

Read-only public API; every input validated and bounded with Zod; LIKE wildcards escaped; only parameterised raw SQL; no secrets in the repo or the browser bundle; security headers (CSP, HSTS, nosniff, frame denial) on every response; the internal revalidate endpoint needs a bearer secret and the assistant endpoint is rate-limited and size-capped. Details: [`09` section 6](09-system-design.md#6-security).

## Decision log (append here when you deviate from the docs)

| Date | Change | Reason |
|------|--------|--------|
| 2026-11-22 | `deprecated Boolean` instead of `deprecatedAt`; `ProviderModel.status` added | models.dev exposes status, not a date |
| 2026-11-22 | models.dev made the spine, OpenRouter enrichment (reversed the initial plan) | Discovered `canonical_model_id`; see `02` |
| 2026-11-22 | Join baseline corrected to 350 keys / 284 matched / 5 ambiguous / 66 unmatched (was 357 / 283 / 74) | The original count included the 7 `openrouter/*` routers that `04` says to skip; +1 match from the `ibm-granite` alias |
| 2026-11-22 | Sanity bands: Lab 40..100 (was ..90), models with intelligence >= 60 (was >= 150) | Measured maxima of the snapshot: 8 labs exist only on OpenRouter; only 65 distinct models carry `intelligence_index`. The old band counted any AA value incl. variants |
| 2026-11-22 | Added `ibm-granite -> ibm` to `LAB_ALIAS` | Found by the seed's unmatched-lab report |
| 2026-11-22 | Added `Model.valueScore` (denormalised, indexed) + migration `20261122120000_value_score` | `05` allowed it: makes the `value` sort and board a plain `ORDER BY` instead of raw SQL. The generated migration tried to drop the hand-written trigram index; that line was removed by hand |
| 2026-11-22 | OpenRouter-only models: `openWeights = !!hugging_face_id` | OpenRouter has no open-weights flag, but links a Hugging Face repo exactly for open-weights models |
| 2026-11-22 | Seed clears `openrouterId` before upserting models | The id is unique and can move between models when aliases or snapshots change |
| 2026-11-22 | Model name = first-party name, else the most common name across listings | The "primary row" name was often decorated ("GPT-4o (Fast)"), which also broke search relevance |
| 2026-11-22 | Cached service loaders return `null`; uncached wrappers throw `NotFoundError` | Errors thrown inside `'use cache'` lose their class across the cache boundary, so they surfaced as 500 instead of 404 |
| 2026-11-22 | `handler()` and `/health` call `unstable_rethrow` first in `catch` | Otherwise Next's internal prerender-interrupt signal is swallowed and logged as a 500 during `next build` |
| 2026-11-22 | `db.ts` retries a query once on connection-level errors (P1001/P1002/P1017) | Observed intermittent "Can't reach database server" against Neon in dev (~2 in 60 requests). All app queries are reads, so a retry is safe |
| 2026-11-22 | Filtered ranks and relevance computed in memory over the light filtered set (`competitionRanks`, `relevanceSort`), not `RANK() OVER` SQL | Same semantics, plain Prisma, unit-tested; <= ~1k rows per board. The 100x path (SQL window function / materialised view) is marked with `ponytail:` comments |
| 2026-11-22 | Leaderboards and the benchmark matrix exclude deprecated models; detail rank chips use the unfiltered boards | Deprecated models are not a choice a developer can make; consistent with the explorer default |
| 2026-11-22 | `Rankings` response adds `best` (best value in the filtered set); `/providers/{p}` returns `{ provider, listings }` + meta; matrix ignores unknown `keys` | Score bars need the max without a second request; shapes otherwise unspecified in `05` |
| 2026-11-22 | `formatTokens` uses decimal units (1,048,576 -> "1.05M", not "1M") | Honest and matches oneatlas.dev |
| 2026-11-22 | `typecheck` script runs `next typegen` first | Route handlers use the generated `RouteContext<...>` types; a fresh clone has none | price, context and intelligence match for Claude Opus 5.5, GLM-5.3, Kimi K3. Provider counts are 15 to 30% higher (e.g. GLM-5.3 133 vs 93) | We count every distinct models.dev provider (incl. plan/regional variants); oneatlas curates providers (223 vs our 307 overall, same ratio). GPT OSS 120B / DeepSeek V4 Pro have no first-party listing, so the rules pick the OpenRouter price; oneatlas uses another feed for their intelligence scores |
| 2026-11-22 | `BenchmarkResult` gains `best` (best score on that benchmark) | Detail and compare score bars need the max without another request (additive field) |
| 2026-11-22 | Model display names that collide within a lab get a suffix from their slug ("DeepSeek V4 Pro (0423)") | Consensus naming gave dated snapshots their parent's name |
| 2026-11-22 | Command palette uses Radix Dialog + cmdk instead of a native `<dialog>` | CLAUDE.md pre-approves both; cmdk gives tested listbox keyboard semantics, Radix gives focus trap + labelled title |
| 2026-11-22 | Explorer facet lists (Lab, Provider, Type) are native checkbox fieldsets with a filter input, not popovers | Simpler, fully accessible, shows counts inline; Radix Select is used for single-choice sort/filter menus |
| 2026-11-22 | Labs and providers directories filter in memory on the client (data server-rendered from the cached service) | 91 / 307 rows: instant filtering beats a round trip; the `/labs` and `/providers` APIs still exist for other clients |
| 2026-11-22 | Cost calculator ignores $0 listings on paid models | They are subscription-bundled (e.g. coding plans), not usable per-token prices |
| 2026-11-22 | Table min width tuned so the explorer table fits at 1280 px without horizontal scroll (Type shown as a badge for non-text models; max output under context) | Density goal from the brief |
| 2026-11-22 | Pool capped at 5 connections per process; connection errors retried 3x with backoff (150/500/1500 ms) | `next build` (15 prerender workers) intermittently hit "DatabaseNotReachable" on Neon; bounded pools are also right for serverless |
| 2026-11-22 | `usePathname()` consumers in the layout (nav active state, compare tray) wrapped in `<Suspense>` with a static fallback | Under Cache Components the pathname is runtime data; outside Suspense it made on-demand/revalidated dynamic routes return 500 (`CLIENT_HOOK_DYNAMIC`) |
| 2026-11-22 | Revalidate endpoint uses `revalidateTag("catalog", { expire: 0 })` and answers 404 to missing/wrong tokens | Data changed at the source, so the next request must not see the old catalog; 404 avoids advertising the endpoint |
| 2026-11-22 | Known limitation: an unknown model/lab/provider URL renders the branded 404 page with HTTP 200 | With PPR the static shell is already streamed before `notFound()` runs. The API returns a real 404. Fix later with `generateStaticParams` for all slugs + `dynamicParams`-style gating if needed |
| 2026-11-22 | Added "Ask the code": a chat panel where Claude (Opus 5.5) explains this codebase by reading it. `POST /api/v1/explain` (the only non-GET, uncached endpoint) streams NDJSON events from a bounded tool loop (max 6 rounds) | A distinctive feature for reviewers; tool use over a code snapshot gives grounded, cited answers instead of guesses |
| 2026-11-22 | Code knowledge = a build-time snapshot (`scripts/build-code-index.ts` -> `src/generated/code-index.json`, traced into the route via `outputFileTracingIncludes`) with three read-only tools: `search_code`, `read_file`, `list_files` | Serverless functions have no source tree at runtime; paths are looked up in the snapshot, never on disk, so there is no traversal and `.env`/`data/` are never included |
| 2026-11-22 | Project map (every file + its leading comment) + README + this doc go in a byte-stable, cached system prompt; code is read on demand through tools | Whole-repo-in-prompt (~110k tokens) would cost ~10x more per cold question; on-demand reads also make the visible "reading trail" possible |
| 2026-11-22 | Messages API with a manual streaming loop, not Managed Agents | Tools are pure functions over in-app data; no sandbox to host; streams inside an ordinary route handler on Vercel; simplest thing to explain |
| 2026-11-22 | Refusals use server-side `fallbacks: "default"`; per-IP sliding-window limit (12 questions / 10 min, in memory, per instance); questions capped at 2,000 chars, history at 20 turns; new error code `RATE_LIMITED` (429) | The endpoint spends money and is public: bound cost per visitor; a refusal should still produce an answer |
| 2026-11-22 | Assistant answers render through a small in-house Markdown subset (no dependency, no innerHTML); `path:line` citations open an in-panel source viewer (`GET /api/v1/explain/source`) | Safe rendering of model output; citations make answers checkable |
| 2026-11-22 | "Ask the code" defaults to **prepared answers** (21, ordered by importance) with a Live toggle when `ANTHROPIC_API_KEY` exists; Live implementation kept unchanged | No API spend on a public demo; reviewed answers are accurate and instant. Anchors (`{{path|text}}`) are resolved to line numbers at build time and the build fails on a missing anchor, so citations never drift |
| 2026-11-22 | Visual layer without a 3D/animation library: canvas globe (Fibonacci sphere, perspective projection), CSS scroll-driven reveals (`animation-timeline: view()` under `@supports`), CSS odometer, pointer tilt, CSS 3D podium | three.js / motion would add 100 kB+ of JS; these keep Lighthouse at 87 to 91 performance. All effects stop under reduced motion |
| 2026-11-22 | Scroll reveals animate transform only (no opacity) | Lighthouse measured headings mid-fade as low-contrast; text is now always full contrast |
| 2026-11-22 | `SelectMenu` renders the selected label inside `Select.Value` itself | Radix fills it only after hydration; the wider trigger wrapped the filter row on mobile (CLS 0.157 on rankings) |
| 2026-11-22 | The price-vs-intelligence chart mounts only near the viewport | Recharts no longer competes with first paint (rankings TBT 1,250 ms to under 100 ms warm) |

| 2026-11-22 | Prepared answers grow to 32, listed in an explicit `ORDER` array (overview first, next steps last); a test fails if any entry is missing from it | Importance order is a decision worth making in one visible place, not a side effect of where an entry sits in the file |
| 2026-11-22 | `/code`: an editor-style viewer over the same build-time snapshot as Ask the code (`src/server/code-index.ts`, three GET endpoints under `/api/v1/code`). Tree, tabs, search and `Ctrl+P` are client-side; the file tree is server-rendered | One snapshot, one loader, no disk access at runtime (no traversal, `.env` never included). Reviewers can read every line without cloning |
| 2026-11-22 | Syntax highlighting is a small in-house regex tokenizer (`src/components/code/highlight.ts`, tested), not Shiki/Prism | Covers TS/TSX/CSS/JSON/SQL/Prisma/Markdown, which is all this repo has; avoids a 200 kB+ dependency and a grammar loader |
| 2026-11-22 | Code lines are 24 px tall and line-number buttons are out of the tab order | Lighthouse target-size (24 px minimum); a tab stop per line would trap keyboard users (the code region itself is focusable) |
| 2026-11-22 | Six-hue palette (`--c-blue/violet/amber/coral/green/rose` + `-soft`, light and dark) mapped in one place (`src/lib/tones.ts`) to capabilities, model types, benchmark groups, medals and lab strips | More colour without random per-component hex values; dark-mode variants are tuned for contrast |
| 2026-11-22 | Filter fieldsets get `min-w-0` | A fieldset defaults to `min-inline-size: min-content`, so a long provider name widened the sidebar and clipped the counts |
| 2026-11-22 | Full-width layout (no 1280 px container); gutters 16/24/32/40 px; prose blocks keep their `ch` limits | Requested by the author; tables and card grids use the room, long text still reads at a comfortable measure. Main nav shows from 1024 px, the wide search box and "Compare" label from 1280 px |
| 2026-11-22 | Theme is a two-state light/dark switch; the first visit follows the OS. The icon is chosen by CSS from the same selectors as the colour tokens | No "system" state to explain; the server-rendered button is right before hydration (no icon flash) |
| 2026-11-22 | `.enter` entrance animates transform only (no opacity) | An element first painted at opacity 0 is not an LCP candidate, so LCP fell to the logo after the font swap. Measured LCP is now the hero text at first paint (912 ms under 4x CPU + slow network) |
| 2026-11-22 | Ask panel and command palette are loaded on first use (`next/dynamic`, prefetched on hover/focus); sort constants moved out of `schemas.ts` | Zod, cmdk and the panel no longer ship with every page (home JS 298 KB to 262 KB transferred) |
| 2026-11-22 | Security headers in `next.config.ts` (CSP without nonces, nosniff, DENY framing, referrer and permissions policy, HSTS); `poweredByHeader: false` | Nonces need per-request rendering and would drop PPR; same-origin CSP still blocks foreign scripts, framing and exfiltration via fetch |
| 2026-11-22 | User text in `contains` filters is LIKE-escaped; a query with no letters or digits matches nothing | Prisma passes `%`/`_` through to ILIKE, so "%" matched every lab and provider; "!!" listed every model |
| 2026-11-22 | `POST /explain` rejects bodies over 256 KB (413) and keys the rate limit on `x-real-ip` (or the last `x-forwarded-for` hop) | The first `x-forwarded-for` entry is client-controlled; an unbounded body was parsed before validation |
| 2026-11-22 | Unknown `/api/*` paths return the JSON 404 envelope (`app/api/[...path]/route.ts`) | The API contract promises the envelope for every error |
| 2026-11-22 | An out-of-range `?page=` shows "Page N is past the end" with a link to the last page (explorer, rankings, benchmarks, provider listings) | It used to say "no models match", which is wrong when the filters do match |
| 2026-11-22 | Compare table uses narrower columns on phones (two models fit at 375 px); compare tray hides model chips below 640 px | One model per screen made the comparison pointless on mobile; the tray covered content |
| 2026-11-23 | Palette "ink and indigo": ink-navy neutrals (light bg `#fbfbfd`, dark bg `#0a0d16`) and a sapphire-indigo accent (`#2d3fb5` light, `#8f9eff` dark), replacing teal on graphite | Looks more premium and professional; all text pairs measured at >= 5:1 (fg 16 to 18, muted 7 to 8.5, faint >= 5.2, accent 8). The six data hues are unchanged |
| 2026-11-23 | Rollback for the palette: `git tag palette-v1-teal`, or copy `docs/palettes/v1-teal-graphite.css` over the token blocks at the top of `globals.css` (plus `themeColor` in `layout.tsx` and the fallback colours in `AtlasGlobe.tsx`) | Colours live in tokens, so reverting is a single-file change |
| 2026-11-23 | Palette changed again to "gold, black and warm white": near-black `#0b0b0c` / off-white `#fcfcfb` neutrals, antique-gold accent (`#7a5800` light for 6:1 text and white-on-gold buttons, `#d9ad45` dark). Text pairs >= 5.2:1 | Author asked for gold, white and black. The indigo version is kept: `git tag palette-v2-indigo`, `docs/palettes/v2-ink-indigo.css` (v1 teal: `palette-v1-teal`) |
| 2026-11-23 | Hover text effect (`components/ui/HoverText.tsx`): headings and intro text split into letters; letters near the mouse turn gold and scale up (Gaussian falloff by distance, sigma = 0.85 x font size). JS only sets one CSS variable `--i` per letter per animation frame; CSS turns it into `scale()` and colour with transitions. Skipped for touch and `prefers-reduced-motion`; screen readers read a visually hidden copy | Ported from the portfolio project's per-letter hover (which used GSAP font-weight animation). Transform-only, so no layout shift, no new dependency, no re-render on pointer move. Applied to the hero, page titles and descriptions, section titles, "Browse models" |
| 2026-11-23 | `/code` offers **Download ZIP**: `scripts/build-code-index.ts` zips every git-visible file (the runnable repo, incl. lockfile and data snapshots) into `public/oneatlas-source.zip` with an in-house ZIP writer (`scripts/zip.ts`, Node `zlib` deflate + crc32, tested) | A static file the CDN serves costs no function time and is exactly the deployed commit; no zip dependency for ~90 lines of format code |
| 2026-11-23 | The build script falls back to a filesystem walk with a deny list when `.git` is missing, and reads the commit from `VERCEL_GIT_COMMIT_SHA` | Vercel checks out sources without `.git`; verified the walk yields the same 157 code-index files as `git ls-files` |
| 2026-11-23 | Vercel prep: `vercel.json` pins functions to `iad1` (next to Neon `aws-us-east-1`); `engines.node` = `24.x` (was `>=22`, which Vercel resolves with a warning) | Same-region DB round trips; deterministic runtime matching the verified local version |
| 2026-11-23 | Every source file starts with a one-line purpose comment | Readable codebase for reviewers; the `/code` tree and the assistant's project map show it per file |
| 2026-11-23 | Added `09-system-design.md` and `10-database-design.md`; rewrote `08` as a Vercel runbook | System design and database design as standalone references; `03` stays the decision record |
| 2026-11-23 | Demo video via [ndemo](https://github.com/splitbrain/ndemo) (installed as a gitignored local skill): `demo/oneatlas-tour/oneatlas-tour.yaml` drives a real browser through the site and renders a silent 1080p mp4; `SCRIPT.md` is the voiceover, one section per segment, with holds sized at 2.5 words/s | The author records their own voice; no narration field means ndemo skips TTS and needs no API key. Selectors carry `>> visible=true` because Next 16 keeps visited routes in the DOM inside hidden `<Activity>` boundaries (duplicate ids such as `#scatter` are expected there) |
