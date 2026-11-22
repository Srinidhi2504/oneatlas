# 07 Roadmap (execution plan; tick boxes as you finish)

Rough effort for one engineer with Claude Code: **P0 1 to 2 h, P1 4 to 6, P2 4 to 6, P3 6 to 8, P4 6 to 8, P5 3 to 4, P6 2 to 3 = about 26 to 37 h (4 to 5 working days)**. These are estimates, not measurements: adjust after P1.

**MVP cut line = end of P4.** P5 and stretch only after P4 is deployed and working. Deploy early (end of P2 with a stub UI is fine) so the live URL is never a last-day risk.

Working agreement for Claude Code: take the first unchecked task, read the docs it names, implement, run the Definition of Done in `CLAUDE.md`, tick the box, commit (one logical commit per task, imperative message).

---

## P0 Foundation: DONE in the initial setup

- [x] Next.js 16.4 + TS + Tailwind scaffold, deps pinned (`CLAUDE.md`)
- [x] `prisma/schema.prisma` (validated), init migration SQL generated offline + `pg_trgm` index, `prisma7.config.ts`, `src/lib/db.ts`
- [x] `src/lib/pricing.ts` + test, Vitest configured, `.env.example`, snapshots committed
- [x] `typecheck`, `test`, `build` all pass on the scaffold
- [x] Neon project `oneatlas` created (id `floral-glitter-43452264`, aws-us-east-1, Postgres 17). Pooled `DATABASE_URL` + direct `DIRECT_URL` are in the gitignored `.env`
- [x] Init migration applied and verified on Neon: 6 tables + `_prisma_migrations`, `pg_trgm`, `Model_searchKey_trgm_idx`; pooled runtime connection tested
- [ ] First commit on a `main` branch, create the GitHub repo, push (public, or grant access to reviewers)

## P1 Data pipeline (`docs/04`)

Files: `scripts/ingest/{fetch,normalize,join,seed}.ts`, `src/lib/labs.ts` (alias + name overrides), tests next to them. Add scripts `ingest:fetch`, `db:seed` to `package.json` (`tsx`, `import "dotenv/config"`).
- [ ] `fetch.ts`: download both sources to `data/snapshots/`, update `MANIFEST.json` (counts, date). Keyless, with timeout + clear errors
- [ ] `normalize.ts` + tests: Zod schemas for source rows; `perTokenToPerMillion`, partial dates, modalities, type mapping, search key
- [ ] `join.ts` + tests: `joinKey`, alias map, ambiguity rule. **Test against the baseline snapshot: expect 283 matches / 5 ambiguous / 74 unmatched** (document any drift)
- [ ] `seed.ts`: build canonical models, primary row, reference price, providerCount, OpenRouter enrichment, OpenRouter-only models, benchmarks catalogue + ranks, upsert/replace with long transaction timeouts
- [ ] Run seed twice: counts identical; report printed; **all sanity bands in `04` met**
- [ ] Spot-check 5 models against oneatlas.dev (Claude Opus 5.5, GLM-5.3, GPT OSS 120B, Kimi K3, DeepSeek V4 Pro): price, context, provider count within a small tolerance

## P2 API (`docs/05`)

Files: `src/lib/schemas.ts`, `src/server/{http.ts,mappers.ts,services/*}`, `src/app/api/v1/**/route.ts`, tests.
- [ ] `schemas.ts` + test (CSV parsing, bounds, defaults, bad enums)
- [ ] `http.ts`: handler wrapper (Zod -> 400, NotFoundError -> 404, else 500 + request id log), success/error envelopes, cache headers
- [ ] `models` service + `GET /models` (all filters, sort, pagination, search relevance) + test for the where-builder
- [ ] `GET /models/{lab}/{slug}` (detail, listings, benchmarks, ranks)
- [ ] `GET /search`, `GET /facets`, `GET /stats`, `GET /health`
- [ ] `labs`, `providers` endpoints
- [ ] `rankings/{board}` (all boards + benchmark keys, lab/type/capability filters, filtered `RANK()`), `benchmarks`, `benchmarks/matrix`, `compare`
- [ ] Verify with curl: every endpoint 200 on valid input, 400 on bad input (`pageSize=1000`, `type=foo`), 404 on unknown slug; list endpoint warm latency < 300 ms (note numbers for the Loom)
- [ ] **Deploy checkpoint:** push, connect repo to Vercel, set env vars, confirm `/api/v1/health` on the live URL (`08`)

## P3 Core UI: explorer and detail (`docs/06`)

- [ ] Design tokens + layout shell (Header, Footer, skip link), `format.ts` (+ test), `ui/` primitives, lab Avatar
- [ ] TanStack Query provider; nuqs adapter; typed API client in `src/lib/api.ts` (fetch + Zod-free typed response, throws on `error` envelope)
- [ ] Explorer: SSR initial data + client `Explorer` (filters, chips, sort, pagination, table + cards, all states)
- [ ] `CommandPalette` (native dialog) + `/search`
- [ ] Compare tray + `useCompareList`
- [ ] Model detail page (all sections, `generateStaticParams` top 50, `generateMetadata`, `notFound`)
- [ ] Checked at 375 / 768 / 1280 px, keyboard-only pass, no console errors

## P4 Compare, rankings, benchmarks, labs, providers

- [ ] `/compare` page (grouped rows, best highlight, diff toggle, share URL)
- [ ] `/rankings/[board]` (boards, benchmark picker, filters, score bars, labTop panel) + redirect from `/rankings`
- [ ] `/benchmarks` matrix
- [ ] `/labs` + `/labs/[slug]`; `/providers` + `/providers/[slug]`
- [ ] Global `not-found.tsx` and `error.tsx`
- [ ] Seed the production DB, redeploy, full click-through on the **live URL** against the acceptance criteria in `01` (this is the MVP)

## P5 Polish (after MVP is live)

- [ ] Cost calculator on detail and compare
- [ ] Price-vs-intelligence scatter on Rankings (lazy-loaded Recharts, table fallback)
- [ ] Playwright smoke test: explorer filter -> detail -> compare -> rankings (`npx playwright install chromium`; keep to 1 spec)
- [ ] Lighthouse mobile pass (Performance, A11y >= 90), fix top 3 findings; bundle check
- [ ] `POST /api/internal/revalidate` (bearer secret) calling `revalidateTag('catalog')`

## P6 Ship

- [ ] Real `README.md`: what/why, live URL, stack, architecture diagram (from `03`), data sources + attribution, setup (`npm i`, `.env`, `db:migrate`, `db:seed`, `dev`), API summary, decisions, limitations, what I'd do next
- [ ] Final QA on the live URL (mobile too); `npm run typecheck && npm run lint && npm test && npm run build` clean; remove dead code; `.env` not committed
- [ ] Record the Loom using the outline in `08` (5 to 10 min)
- [ ] Submit the Google Form (live URL, repo URL, Loom URL)

## Stretch backlog (only if time remains, in value order)

1. Orphan-row ingest (`04` stretch) for a bigger catalogue.
2. Price tiers (>200K context) in detail + calculator.
3. OpenRouter endpoints: uptime/latency/throughput per provider.
4. Artificial Analysis API for coding/agentic indices (needs a free key).
5. Rate limiting at the edge; request-id header on responses.
6. Provider-specific region/variant grouping on the detail table.
