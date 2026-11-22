# OneAtlas

AI model discovery and intelligence platform: browse, search, filter, compare and rank AI models across labs and providers (specs, pricing, capabilities, benchmarks).

> Work in progress. Status and plan: [`docs/07-roadmap.md`](docs/07-roadmap.md). Live URL: _to be added at deploy_.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind 4 · Node route handlers · PostgreSQL (Neon) · Prisma 7 · Zod · TanStack Query · nuqs.

## Quick start

```bash
npm install                      # also runs prisma generate
cp .env.example .env             # add your Neon pooled + direct URLs
npx prisma migrate deploy        # create tables, pg_trgm extension, indexes
npm run db:seed                  # ingest from data/snapshots (available after roadmap P1)
npm run dev
```

## Documentation

| Doc | Topic |
|-----|-------|
| [`CLAUDE.md`](CLAUDE.md) | Rules and commands for AI-assisted development |
| [`docs/01-requirements.md`](docs/01-requirements.md) | Assignment, rubric, acceptance criteria |
| [`docs/02-research.md`](docs/02-research.md) | Research and measured data-source findings |
| [`docs/03-architecture.md`](docs/03-architecture.md) | Architecture, decisions, scalability |
| [`docs/04-data-model-and-ingestion.md`](docs/04-data-model-and-ingestion.md) | Schema semantics and ingestion pipeline |
| [`docs/05-api-spec.md`](docs/05-api-spec.md) | REST API contract |
| [`docs/06-frontend-spec.md`](docs/06-frontend-spec.md) | Routes, components, UX |
| [`docs/07-roadmap.md`](docs/07-roadmap.md) | Phased task list |
| [`docs/08-deploy-and-submission.md`](docs/08-deploy-and-submission.md) | Deploy, QA, Loom outline |

## Data sources

[models.dev](https://models.dev) (providers, models, pricing, canonical ids) and [OpenRouter](https://openrouter.ai/api/v1/models) (descriptions, Artificial Analysis and Design Arena benchmarks). Snapshots are committed in `data/snapshots/` for reproducible seeding.
