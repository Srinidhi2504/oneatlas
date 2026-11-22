# Prompt to paste into Claude Code (VS Code)

Run these two commands once in the Claude Code chat, before the prompt, then restart the session if the skills do not show up:

```
/plugin install frontend-design@claude-plugins-official
claude mcp add playwright -- npx -y @playwright/mcp@latest
```
(The second one is a terminal command, not a chat command. Optional extra UI skills are listed at the bottom.)

---

## THE PROMPT (copy everything below this line)

You are the lead engineer finishing **OneAtlas**, my AI Software Engineer internship take-home (**Role 3: Full Stack**). The repo at the current folder is already scaffolded, the database is live and migrated, and the plan is written. Your job: **build the entire project from P1 to P6 and make the UI excellent.** I will be graded on architecture, integration, reliability, scalability and execution quality, and I must be able to explain every decision in a Loom, so keep the code clear and simple.

### Step 0: orient (do this first, in order)
1. Read `CLAUDE.md` fully (it imports `AGENTS.md`), then `docs/07-roadmap.md`, then the docs it points to: `03`, `04`, `05`, `06`, and skim `01`, `02`, `08`. Also read `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`: this is Next 16 with Cache Components, which differs from older versions.
2. Run `npm install`, `npm run typecheck`, `npm test`, `npm run build` to confirm the baseline is green. `.env` already holds working Neon URLs. Never print, log or commit them.
3. Make the first git commit of the current state on `main` (imperative message). Commit once per roadmap task from then on. Do NOT push, create GitHub repos, or deploy without asking me (see Step 4).
4. Ensure the UI skills are available. Run `/plugin install frontend-design@claude-plugins-official` if the `frontend-design` skill is not listed, and confirm the Playwright MCP tools are present. If either is missing, tell me the exact command and continue with `@playwright/test` screenshots instead of stopping.

### Step 1: how to work
- Execute `docs/07-roadmap.md` phase by phase (P1, P2, P3, P4, then P5, P6). Take the first unchecked task, implement it, run the Definition of Done in `CLAUDE.md`, tick the box, commit. The roadmap checkboxes are the source of truth for progress: if context gets long, re-read them and continue.
- The docs are the contract. `docs/05-api-spec.md` is the API contract and `docs/04` the data contract. If you must deviate, append a row to the decision log in `docs/03-architecture.md` with the reason. Do not drift silently.
- Use subagents for broad read-only research or parallelisable chunks, but keep schema/API/seed work sequential and single-writer.
- Verify with real runs, not assumptions: after P1 print the seed report and check the sanity bands in `docs/04`; after P2 curl every endpoint (200, 400, 404 cases) and note warm latency; after each UI task look at it in the browser.
- Anything outward-facing or needing my accounts: stop and ask. Everything else: just do it, do not ask for permission between tasks.

### Step 2: backend quality bar (P1 and P2)
Follow `docs/04` and `docs/05` exactly: models.dev `canonical_model_id` is the spine, OpenRouter is enrichment, the join key and alias map are unit-tested (baseline expectation: 283 matched, 5 ambiguous, 74 unmatched), seed is idempotent (run twice, identical counts) and reads only `data/snapshots/`. Routes are thin, services are the only Prisma users, every input goes through Zod, errors use the envelope, no Prisma errors leak, reads use `'use cache'` + `cacheLife` + `cacheTag`. Money is `Decimal` in the DB and `number` in the DTOs. Write the small tests the docs call for (normalisers, join key, schemas, where-builder, format helpers). Do not fake data anywhere.

### Step 3: UI quality bar (P3, P4, P5): this is where I want you to go beyond the minimum
**Before every UI task, invoke the `frontend-design` skill**, and apply web-design-guidelines / accessibility rules if those skills are installed. Then build, then run the visual loop below.

**Design direction.** This is a data-dense developer tool in the spirit of Linear, Vercel and OpenRouter: calm, precise, fast, trustworthy. Make deliberate choices instead of defaults:
- A distinctive but restrained identity: a considered neutral scale plus ONE accent colour, real light and dark themes (system default + a toggle, no flash on load), refined typography (Geist is already loaded; pick the type scale, weights, `tabular-nums` for every number, tight tracking on headings). Subtle borders over heavy shadows, 8px grid, consistent radii.
- Explicitly avoid the generic "AI app" look: no purple-to-blue gradients, no glassmorphism everywhere, no emoji as icons, no giant hero with stock copy, no card-in-card-in-card. Information density and clarity are the aesthetic.
- Craft details that make it feel premium: skeletons matching real row height (zero layout shift), smooth `keepPreviousData` transitions with a thin progress bar, sticky table headers and first column, hover/focus/active states on everything interactive, keyboard shortcuts (`/` focus search, `Cmd/Ctrl+K` palette, arrow keys in palette), copy-link feedback, animated score bars and number transitions kept subtle and respecting `prefers-reduced-motion`, helpful empty and error states with a clear next action, a branded 404.
- Lab "logos": deterministic initials avatars (no external or scraped logos).
- Make the signature screens excellent: Explorer (stats strip with capability coverage meters, chips, faceted filters with counts, table/cards toggle), Model detail (stat tiles, price table, benchmark bars with rank, provider table), Compare (best-in-row highlight, differences-only toggle, shareable URL), Rankings (score bars, board tabs, price-vs-intelligence scatter), Benchmarks matrix, Labs and Providers directories.
- Use the pre-approved UI libraries listed in `CLAUDE.md` (shadcn/Radix primitives, lucide-react, cmdk, recharts, motion). Do not hand-roll accessible Select/Popover/Dialog/Combobox.

**Visual verification loop (mandatory for every page/component).** Using the Playwright MCP (or `@playwright/test` screenshots), load the page from `npm run dev` at **375, 768 and 1280 px**, in light and dark, and with loading, empty and error states. Look at the screenshots critically: spacing, alignment, overflow, truncation, contrast, focus rings, jank. Fix what you see and re-shoot. Check the browser console is clean. Do not call a UI task done on "it compiles".

**Accessibility and performance gates.** Semantic landmarks, skip link, visible focus, aria-sort/labels, colour never the only signal, contrast 4.5:1, full keyboard path through explorer, compare and palette. Run Lighthouse (mobile) on `/`, a model page and `/compare` after P4: target Performance >= 85, Accessibility >= 95, Best Practices >= 95, fix the top findings. Keep client JS small: server-render lists, lazy-load charts.

### Step 4: finishing and shipping (P5, P6)
- Finish P5 polish (cost calculator, scatter, Playwright smoke spec, revalidate endpoint), then P6: a real `README.md` (what/why, architecture diagram from `docs/03`, data sources and attribution, setup, API summary, decisions, limitations, next steps) and final QA.
- **Stop and ask me** before: pushing to GitHub or creating the repo, creating/linking/deploying on Vercel, or seeding any database other than the current Neon one. When you reach that point, give me the exact commands/steps from `docs/08` and what you need from me (e.g. the Vercel project link), then continue with everything that does not depend on it.
- Finish by running `npm run typecheck && npm run lint && npm test && npm run build`, then give me: a summary of what exists, the sanity-band numbers from the seed, the API latency numbers, Lighthouse scores, any deviations from the docs, known limitations, and a 10-bullet "things I should be ready to explain in the Loom" list drawn from what you actually built.

Start now with Step 0, then begin P1. Do not stop between phases to ask for confirmation unless you hit something in the "stop and ask" list or a genuine blocker.

---

## Optional extra skills (install only if you want more polish)

- `audit-suite` (community plugin in Anthropic's directory): bundles `web-design-guidelines`, `vercel-react-best-practices`, `web-animation-design`, `make-interfaces-feel-better`, `audit-as-a11y-eng`, `audit-as-perf-eng`. Useful for a final UI/a11y/perf audit pass. Community-authored: skim it before trusting it.
- Anthropic `design` plugin (`design-critique`, `accessibility-review`, `design-system`): lives in `anthropics/knowledge-work-plugins`, path `design`. Add the marketplace with `/plugin marketplace add anthropics/knowledge-work-plugins`, then `/plugin` to browse and install it.

I verified these plugin names exist in Anthropic's plugin directory today. I did not verify the exact install command spellings for the optional two, so use `/plugin` to browse if a command errors.
