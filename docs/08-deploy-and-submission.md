# 08 Deploy and submission

Runbook for putting OneAtlas on Vercel, keeping it fresh, and the submission checklist. Architecture background: [`09-system-design.md`](09-system-design.md#10-deployment-topology).

## Environment variables

| Variable | Required | Scope on Vercel | Value |
|---|---|---|---|
| `DATABASE_URL` | **Yes**, at build **and** runtime | Production, Preview | Neon **pooled** connection string (host contains `-pooler`), `?sslmode=verify-full` |
| `DIRECT_URL` | Only if migrations run during the build | Production | Neon **direct** connection string (used by the Prisma CLI) |
| `REVALIDATE_SECRET` | Optional | Production | Long random string; enables `POST /api/internal/revalidate`. Generate: `node -e "console.log(crypto.randomUUID())"` |
| `ANTHROPIC_API_KEY` | Optional | Production | Enables Live mode in "Ask the code". Without it, prepared answers still work |

`DATABASE_URL` is needed at **build time** because `next build` prerenders pages (and `generateStaticParams` lists the top 50 models, labs and providers) from cached database reads. Never prefix any of these with `NEXT_PUBLIC_`: that would ship them to the browser.

## What the build does (no configuration needed)

| Step | Command | Result |
|---|---|---|
| Install | `npm install` -> `postinstall` | `prisma generate` (client into `src/generated/prisma`) and `scripts/build-code-index.ts` |
| Build | `npm run build` -> `prebuild` | Re-runs the code index, then `next build` |

`scripts/build-code-index.ts` writes `src/generated/code-index.json` (the `/code` viewer and assistant), `src/generated/ask-anchors.json` (citations; **the build fails if a prepared answer cites code that moved**) and `public/oneatlas-source.zip` (the download on `/code`). Vercel checks out the source without `.git`, so the script falls back to a filesystem walk with the same exclusions; the commit shown on `/code` comes from `VERCEL_GIT_COMMIT_SHA`.

Other settings already in the repo:
- `vercel.json` pins functions to `iad1` (Washington, D.C.), next to the Neon database in `aws-us-east-1`. Change both together if you move the database.
- `package.json` `engines.node` is `24.x`, so Vercel builds and runs on Node 24.
- `next.config.ts` lists the build-time JSON files in `outputFileTracingIncludes` so they ship with the functions that read them.

## First deployment

1. **Database** (already done for this project: migrated and seeded). For a fresh Neon project:
   ```bash
   cp .env.example .env        # paste the pooled and direct strings
   npm run db:deploy           # tables, indexes, pg_trgm + trigram index
   npm run db:seed             # about 1 minute; safe to re-run
   ```
2. **GitHub:** the code is on `main` at https://github.com/Srinidhi2504/oneatlas.
3. **Vercel:** Add New -> Project -> import `Srinidhi2504/oneatlas`.
   - Framework preset: Next.js (detected). Root directory: `./`.
   - Build, install and output commands: leave the defaults.
   - Environment variables: add the table above (at least `DATABASE_URL` for Production and Preview).
   - Deploy.
4. **Verify** on the deployment URL:
   - [ ] `/api/v1/health` returns `{"data":{"status":"ok","db":"up","models":724,...}}`
   - [ ] `/` renders the hero, stats and the model table; filters update the URL
   - [ ] `/models/anthropic/claude-opus-5-5`, `/compare`, `/rankings/value`, `/benchmarks`, `/labs`, `/providers` render
   - [ ] `/code` shows the file tree, the commit link and **Download ZIP** downloads `oneatlas-source.zip`
   - [ ] `/api/v1/nope` returns the JSON error envelope; `/api/v1/models?pageSize=1000` returns 400
   - [ ] Response headers include `content-security-policy` and `strict-transport-security`
   - [ ] Optional: `E2E_BASE_URL=https://<your-app>.vercel.app npm run test:e2e` runs the Playwright suite against the live site
5. **README:** replace "_added after the Vercel deploy_" with the live URL and commit.

## Refreshing the data

```bash
npm run ingest:fetch     # new snapshots in data/snapshots (commit them)
npm run db:seed          # with the production DATABASE_URL / DIRECT_URL in .env
curl -X POST https://<your-app>.vercel.app/api/internal/revalidate -H "Authorization: Bearer $REVALIDATE_SECRET"
```
The last call expires every cached catalog read at once. Without `REVALIDATE_SECRET`, redeploy instead. Static pages built from the old data refresh as their cache entries expire (hours) or on the next deploy.

## Schema changes

1. Edit `prisma/schema.prisma`, run `npm run db:migrate` locally, review the SQL (it must not drop `Model_searchKey_trgm_idx`).
2. Commit the migration.
3. Run `npm run db:deploy` against production **before** the code that needs it goes live (additive changes first, removals in a later deploy).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Build fails with `DATABASE_URL is not set` | The variable is missing for the build environment: add it to Production (and Preview) and redeploy |
| Build fails with `Prepared answers cite code that no longer exists` | A file cited in `src/components/ask/knowledge.ts` changed: update the `{{path|text}}` anchor |
| `Cannot find module '@/generated/prisma/client'` | `postinstall` did not run (install command overridden): restore the default install command |
| `/code` or `/api/v1/explain` 500 with `ENOENT ... code-index.json` | A new route reads a build-time file not listed in `outputFileTracingIncludes` in `next.config.ts` |
| First request after idle is slow | Function cold start plus Neon compute waking from suspend; subsequent requests hit the data cache |
| `P1001` / `DatabaseNotReachable` in logs | Transient; the client retries 3 times. If persistent, check the Neon project is active and the string uses the pooled host |

## Pre-submission QA checklist

- [ ] Every acceptance criterion R1 to R6 in `01` passes on the **live** URL
- [ ] 375 px layouts, keyboard navigation, dark mode, 404 page, a bad API call returns the error envelope
- [ ] `npm run typecheck && npm run lint && npm test && npm run build` clean; `npm run test:e2e` green
- [ ] README has the live URL; `.env` not in git history (`git log --all -- .env` is empty); attributions present
- [ ] Repo is public (or access granted); commit history readable
- [ ] Loom link opens without login

## Loom outline (target 8 minutes; 5 to 10 is required)

The recording is scripted: [`demo/oneatlas-tour/SCRIPT.md`](../demo/oneatlas-tour/SCRIPT.md) is the voiceover, and `demo/oneatlas-tour/demo.mp4` is the matching silent video rendered by ndemo from [`oneatlas-tour.yaml`](../demo/oneatlas-tour/oneatlas-tour.yaml) (play it and read along while recording). The table below is the outline it follows.

| Time | Show | Say |
|------|------|-----|
| 0:00 | Live site home | What OneAtlas is, who it is for, what it covers (724 models, 307 providers, 30 benchmarks) |
| 0:45 | Tour: search + filters, detail, compare, rankings, labs/providers, `/code` | Real data from Postgres, every view URL-shareable, the source is browsable and downloadable |
| 2:00 | System design diagram (`09`) | Route handlers + service layer + Prisma + Neon on Vercel; three caching layers; why not NestJS |
| 3:15 | Ingestion (`04`) | models.dev `canonical_model_id` as the spine, OpenRouter for benchmarks, join key + alias map, 284 of 350 matched, idempotent seed from committed snapshots |
| 4:30 | Database design (`10`) | Decimal money, boolean capabilities, trigram search, denormalised sort columns with matching indexes, precomputed ranks |
| 5:15 | API | Zod validation, error envelope, `'use cache'` + tag invalidation; show a 400 and a 404; latency numbers |
| 6:15 | Frontend integration | nuqs URL state, TanStack Query hydrated from SSR (one query key, no refetch), keepPreviousData, accessibility |
| 7:00 | Challenges | Cache Components rules, Prisma 7 adapter, entity resolution, the LCP fix, the wildcard search bug |
| 7:40 | Next steps | The 100x plan in `09` |

## "Explain your code" prep

- Why Next route handlers over NestJS? Why a service layer if Server Components can call Prisma directly?
- What does `'use cache'` cache, for how long, and how is it invalidated after a re-seed?
- How does search handle "gpt4o"? Why trigram and not full-text? What are its limits?
- How are the two sources joined? What happens on ambiguity? Where is the report?
- Why `Decimal` in the database and `number` in the API? Where does the conversion happen?
- Walk one request end to end: URL -> nuqs -> TanStack Query -> route -> Zod -> service -> Prisma -> mapper -> JSON.
- What breaks at 100x data, and what would you change first?
- What did AI tools generate, and how did you verify it? (Two concrete examples of correcting it: the join baseline numbers, the migration that tried to drop the trigram index.)
