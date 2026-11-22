# 08 Deploy and submission

## Environments

| Var | Where | Value |
|-----|-------|-------|
| `DATABASE_URL` | local `.env`, Vercel (Production + Preview) | Neon **pooled** connection string (host contains `-pooler`) |
| `DIRECT_URL` | local `.env`, Vercel build env | Neon **direct** string (used by Prisma CLI: migrate) |
| `REVALIDATE_SECRET` | Vercel (P5 only) | long random string for `POST /api/internal/revalidate` |

`DATABASE_URL` must be present at **build time** on Vercel: cached reads and `generateStaticParams` query the DB during `next build`.

## One-time setup

1. **Neon:** create a project (current Postgres version). Copy both connection strings. Optional: create a `dev` branch for local work and keep `main` for production.
2. **Local:** `copy .env.example .env`, paste the strings, then `npm run db:generate` and `npx prisma migrate deploy`.
3. **Seed:** `npm run db:seed` (reads `data/snapshots/`). Seeding production = run the same command locally with the production `DATABASE_URL`/`DIRECT_URL` in `.env`. Re-running is safe.
4. **GitHub:** create the repo, push `main`.
5. **Vercel:** import the repo (Framework: Next.js). Build command: `npm run db:generate && next build` (add `prisma migrate deploy &&` only if you want migrations to run on deploy, which needs `DIRECT_URL` in the build env). Set env vars. Deploy.
6. **Verify:** `https://<app>.vercel.app/api/v1/health` returns `status: ok` with a model count; click through every route.

`package.json` already has `"postinstall": "prisma generate"` so Vercel builds always have the client (the generated client is gitignored).

## Pre-submission QA checklist

- [ ] Every acceptance criterion R1 to R6 in `01` passes on the **live** URL
- [ ] 375 px layouts, keyboard navigation, dark mode, 404 page, a bad API call returns the error envelope
- [ ] `npm run typecheck && npm run lint && npm test && npm run build` clean; no `console.log` noise; no unused deps
- [ ] README complete, `.env` not in git history (`git log -p -- .env` empty), attributions present
- [ ] Repo is public (or access granted); commit history readable
- [ ] Loom link opens without login

## Loom outline (target 8 minutes; 5 to 10 is required)

| Time | Show | Say |
|------|------|-----|
| 0:00 | Live site home | What OneAtlas is, who it is for, the six capabilities delivered |
| 0:45 | Quick tour: search + filters, detail, compare, rankings, labs/providers | Real data, everything URL-shareable |
| 2:00 | Architecture diagram (`03`) | Next route handlers + service layer + Prisma + Neon; why not NestJS; SSR + API together |
| 3:15 | Ingestion (`04`) | **The key insight:** models.dev `canonical_model_id` as the spine, OpenRouter for benchmarks, join key + alias map, measured 283/357, idempotent seed from snapshots |
| 4:30 | Schema + indexes | Decimal money, booleans for capabilities, trigram search, precomputed ranks, why denormalise |
| 5:15 | API | Zod validation, error envelope, caching with `use cache`, show a 400 and a 404, latency numbers |
| 6:15 | Frontend integration | nuqs URL state, TanStack Query + hydration, keepPreviousData, accessibility |
| 7:00 | Challenges | Cache Components rules, Prisma 7 adapter/config, entity resolution, TS 7 vs eslint pin |
| 7:40 | Next steps | The 100x table from `03`; stretch list |

## "Explain your code" prep (you will be asked)

- Why Next route handlers over NestJS? Why a service layer if Next can call Prisma in components?
- What does `'use cache'` cache, for how long, and how does it get invalidated after a re-seed?
- How does search handle "gpt4o"? Why trigram and not full-text? What are its limits?
- How are two sources joined? What happens on ambiguity? Show the unmatched report.
- Why Decimal for price and `number` in the API? Where is rounding handled?
- Walk through one request end to end: URL -> nuqs -> TanStack Query -> route -> Zod -> service -> Prisma -> mapper -> JSON.
- What breaks at 100x data and what would you change first?
- What did AI tools generate, and how did you verify it? (Have 2 concrete examples of you correcting it.)
