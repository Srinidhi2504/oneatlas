# 01 Requirements and evaluation rubric

Source: `AI Software Engineer Internship.pdf` (assignment brief). Role chosen: **3, Full Stack Engineer**.

## What is being built

A functional MVP of **OneAtlas** (https://oneatlas.dev), an AI model discovery and intelligence platform, for developers, AI engineers and researchers. Reference platforms to study: OpenRouter, RouterPlus, LiteLLM. Not expected to replicate them, expected to build "a better OneAtlas experience".

## Hard rules from the brief

- **Stack (mandatory):** Next.js, React, TypeScript, TailwindCSS; Node.js + TypeScript backend via Next.js API routes (or NestJS); PostgreSQL + Prisma.
- **Deploy (preferred):** Vercel, Railway, Render, Cloudflare or Neon. We use **Vercel + Neon**.
- **Data:** mock/generated data allowed, but app data must be managed through the **database and APIs**. No hardcoded frontend-only implementations.
- **AI tools** (ChatGPT, Claude, Cursor, Copilot...) allowed. **Banned:** Lovable, Bolt.new, Base44, Replit AI app generation, Firebase Studio, Google AI Studio apps, similar prompt-to-app generators.
- Author must understand the code and be able to explain architecture and decisions.

## Role 3 scope and how it is scored

"Build the complete product: frontend and backend, database and API integration, discovery and comparison workflows, rankings and provider directories, deployment and working functionality." **Evaluated on: architecture, integration, reliability, scalability, execution quality.**

| Criterion | Evidence we will show (and demo in the Loom) |
|-----------|-----------------------------------------------|
| Architecture | Layered design (route -> service -> Prisma), shared Zod schemas, documented decisions (`03`), clean folder layout |
| Integration | One typed API contract (`05`) consumed by SSR pages and by the client (TanStack Query); URL-as-state filters; no mock data in UI |
| Reliability | Zod validation at every boundary, uniform error envelope, idempotent ingestion, DB constraints, loading/empty/error states, health endpoint, tests on logic that can silently break (normalisers, pricing, ranking) |
| Scalability | Indexed filters/sorts, trigram search, pagination caps, cached reads (`use cache`), denormalised hot columns, written "what breaks at 100x and the fix" (`03`) |
| Execution quality | Live URL works end to end, real data (about 700 models, 8k+ provider listings), polished responsive UI, README, clean commits |

## Functional requirements (acceptance criteria)

**R1 Model discovery and search.** Browse and search models. Filter by lab, provider, capabilities and model type. Sort by price, context window, release date. Show specs and pricing.
*Accept:* `/` lists models from `/api/v1/models`; combined filters work and are in the URL (shareable, back-button safe); search "gpt4o" finds "GPT-4o"; sort by blended price/context/release works with nulls last; results paginate; table and card views.

**R2 Model detail pages.** Overview and specs; input/output pricing and context window; modalities and capabilities; available providers; benchmarks.
*Accept:* `/models/[lab]/[slug]` shows all of these from the DB; provider table lists every listing with its own price; benchmark section shows value, rank and "of N"; unknown slug gives a proper 404.

**R3 Model comparison.** Side by side: pricing, context length, capabilities, benchmarks.
*Accept:* 2 to 4 models via "Add to compare" tray; `/compare?ids=a/b,c/d` is shareable; best value per row highlighted; "show differences only" toggle.

**R4 Rankings and benchmarks.** Rankings/leaderboards; filter by category and benchmark; comparative scores.
*Accept:* `/rankings/[board]` boards (reach, intelligence, value, cheapest, context, newest + each benchmark); filters (lab, type, open weights); score bars show relative performance; `/benchmarks` matrix with best-in-column highlighted.

**R5 AI labs and provider directory.** Browse companies/labs; their models and releases; providers and the models they support.
*Accept:* `/labs`, `/labs/[slug]` (models by release date, stats), `/providers`, `/providers/[slug]` (supported models with provider-specific prices).

**R6 Product experience.** Clean navigation and global search; responsive; structured listings/detail; consistent UX.
*Accept:* header nav + `Ctrl/Cmd+K` palette searching models, labs and providers; usable at 375px; shared components and tokens; consistent empty/loading/error states.

## Non-goals (say so in the Loom, do not build)

User accounts/auth, playground / live inference, billing, writing data from the UI (admin CRUD), real-time provider uptime, multi-language, review/rating systems.

## Submission checklist (Google Form: https://forms.gle/oDQ6ucjpiFaZtCGL9)

- [ ] Live URL (working product)
- [ ] GitHub repository URL (public or access granted; clean history; README)
- [ ] Loom video, **5 to 10 minutes**: architecture, features, technical decisions, challenges
