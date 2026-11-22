@AGENTS.md

# OneAtlas: AI model discovery & intelligence platform

Take-home assignment, **Role 3: Full Stack Engineer**. Build a working MVP that lets developers discover, search, filter, compare and rank AI models across labs and providers. Inspired by oneatlas.dev / OpenRouter / LiteLLM. The author must be able to **explain every line and decision** in a Loom, so favour simple, readable code over clever code.

Evaluation for this role: **architecture, integration, reliability, scalability, execution quality.** Hard rules: Next.js + React + TypeScript + Tailwind; Node/TS backend via Next route handlers; PostgreSQL + Prisma; app data must come from the DB through APIs (no hardcoded frontend data); no prompt-to-app generators.

## Read in this order (before writing code)

| # | File | Use it for |
|---|------|-----------|
| 1 | `docs/07-roadmap.md` | **What to do next.** Pick the first unchecked task; tick it when done. |
| 2 | `docs/03-architecture.md` | Decisions, layering, Next 16 caching rules, decision log (append to it). |
| 3 | `docs/04-data-model-and-ingestion.md` | Schema semantics, source mapping, the ingestion algorithm. |
| 4 | `docs/05-api-spec.md` | The API contract. Backend and frontend both build against it. |
| 5 | `docs/06-frontend-spec.md` | Routes, components, UX, URL state. |
| 6 | `docs/01-requirements.md`, `02-research.md`, `08-deploy-and-submission.md` | Rubric, evidence behind decisions, deploy + Loom. |

If code and docs disagree, fix whichever is wrong and note it in the decision log. Do not silently drift.

## Pinned stack (do not "upgrade" casually)

- **Next.js 16.4** (App Router, `cacheComponents: true`), React 19.3, Tailwind 4.3, **TypeScript ~5.9** (NOT 7.x: `typescript-eslint` supports `<6.1`).
- **Prisma 7.x** (`prisma@7`, `@prisma/client@7`, `@prisma/adapter-pg`). NOT 8 (npm `latest` is the 8 RC; ignore the "update available" banner).
- PostgreSQL on Neon (pooled URL at runtime, direct URL for migrations). Zod 4, TanStack Query 5, nuqs 2, Vitest 5, tsx.
- Package manager: **npm** (pnpm is not installed). Node >= 22.

## Commands

```
npm run dev          # next dev
npm run build        # next build (queries the DB at build time, DATABASE_URL must be set)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
npm run db:generate  # prisma generate -> src/generated/prisma (gitignored, rebuild after schema edits and after clone)
npm run db:migrate   # prisma migrate dev
npm run db:deploy    # prisma migrate deploy (prod)
```
Scripts `ingest:fetch` and `db:seed` do not exist yet: roadmap P1 creates them.

## Rules that prevent the known traps

**Prisma 7**
- `PrismaClient` needs a driver adapter (`src/lib/db.ts` already does this). No `url` in `schema.prisma`; the CLI URL lives in `prisma7.config.ts`. Keep exactly ONE config file.
- Import from `@/generated/prisma/client`, never `@prisma/client`.
- After editing `schema.prisma`: `npm run db:generate` and add a migration. The `pg_trgm` index in `prisma/migrations/*_init` is hand-written: never regenerate it away.
- Raw SQL: model/column names are PascalCase/camelCase, so quote them (`"Model"."searchKey"`).
- `Decimal` and `Date` must be converted to `number` / ISO string **inside the service/mapper**, never returned raw (cached functions require serialisable values).

**Next.js 16 with Cache Components** (read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` once)
- Do NOT use `export const dynamic/revalidate/runtime/dynamicParams` (removed under cacheComponents).
- Cache **data** in the service layer: `'use cache'` + `cacheLife('hours')` + `cacheTag('catalog')`. Arguments and return values must be plain serialisable objects.
- Any component that reads `searchParams`, `params`, `cookies()` or `headers()` must sit under `<Suspense>`. A static shell (header, skeleton) + streamed content is the intended shape.
- Dynamic routes using `generateStaticParams` must return **at least one** param (return the top ~50 models/labs); others render on demand.
- `GET` route handlers that read the request run at request time; cache the inner service call, not the handler.

**Architecture**
- Layers: `app/api/**/route.ts` (thin: parse, call service, shape response) -> `src/server/services/*` (business logic, the only code that touches Prisma) -> `src/lib/db.ts`. Server Components call the **same services**; client components call `/api/v1/*`.
- Every request input is validated with a Zod schema from `src/lib/schemas.ts` (shared by routes, pages and client). Never trust query strings.
- Every API error uses the envelope in `docs/05-api-spec.md`. Never leak Prisma/Postgres messages.
- Prices are USD per 1M tokens everywhere. `blended = (3*input + output)/4` via `src/lib/pricing.ts`.
- Data comes from the DB. Seed data is **ingested from public APIs** (`docs/04`), not typed into components.
- Do not copy oneatlas.dev's text, logos or assets. Use initials avatars. Attribute data sources in the footer.

**Conventions**
- Strict TS, no `any`. Path alias `@/` = `src/`. Files: `kebab-case.ts`, components `PascalCase.tsx` exported by name.
- Backend/data code: fewest dependencies possible. Ask before adding one not named in the docs.
- **UI is the exception (author wants an excellent UI).** Pre-approved: `lucide-react`, `recharts`, `clsx`, `tailwind-merge`, `class-variance-authority`, Radix primitives (`@radix-ui/react-*`, or via the `shadcn` CLI, Tailwind 4 compatible) for accessible Select/Popover/Dialog/Tooltip/Tabs/Dropdown, `cmdk` for the command palette, `motion` for restrained animation, `@playwright/test` for visual checks. Anything else: ask. Do not hand-roll accessible comboboxes or popovers.
- Env lives in plain `.env` (not `.env.local`); `.env.example` is committed. Never commit secrets.
- Non-trivial logic (normalisers, query builder, ranking, price math) gets a small Vitest test next to it. No snapshot-test theatre.

## Definition of done (every task)

1. Behaviour matches the spec in `docs/`. 2. `npm run typecheck && npm run lint && npm test` pass. 3. `npm run build` passes. 4. UI work: checked at 375px and 1280px, loading / empty / error states exist. 5. Roadmap box ticked, deviations logged in `docs/03-architecture.md`.

## Tool notes

Neon and Vercel MCP servers are connected in the author's Claude app. Creating cloud projects, databases or deployments is outward-facing: **ask the author before provisioning** anything.
