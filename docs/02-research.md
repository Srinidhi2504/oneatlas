# 02 Research findings

Measured on **2026-11-22**. Numbers come from the snapshots in `data/snapshots/` (so they are reproducible), or from pages read that day. What I did *not* study in depth is marked.

## 1. oneatlas.dev (the target product), as observed

Scale shown on its home page: **1,118 models, 78 labs, 223 providers, 8,274 API listings**.

**Site map**

| Route | What it is |
|-------|-----------|
| `/` | Explorer: stat header, capability coverage, search, filters (Lab, Provider, Type), quick chips, Table/Cards toggle, sortable columns |
| `/models/{lab}/{slug}` | Detail page. Slug is exactly models.dev's `canonical_model_id` (e.g. `zhipuai/glm-5.3`) |
| `/rankings/` + boards | Boards: reach (most providers), intelligence, design arena, value, cheapest, context, newest. "Labs in the top 100" panel. Filter by lab |
| `/benchmarks/` + `/benchmarks/{key}` | Matrix of every score per model, best-in-column highlighted; per-benchmark pages |
| `/labs/`, `/labs/{slug}` | Lab cards: model count, open-weights count, latest release |
| `/providers/{slug}` | Provider page with its models |
| 404 | "That page isn't in the atlas" with link back to the list |

**Explorer details worth matching or beating:** quick filter chips (Reasoning, Tool calling, Structured output, Vision, Open weights, 1M+ context, Free, Hide deprecated); type facets with counts (Text 912, Image 55, Embedding 39, Video 38, Speech 28, Transcription 19, Reranking 15, Realtime 12); columns Model, Providers, Context, Output, Modalities, Reasoning, Tools, JSON, Temp, Weights, Price/1M, Cache, Intelligence, Released, Updated; global search on Cmd+K; "New" badge on recent models.

**Detail page anatomy:** description; stat tiles (Context, Max output, Input $, Output $, Providers, Intelligence); price table by tier (Standard / over 200K context / fast mode x input, output, cache read, cache write); capability list (Reasoning + effort levels, Tool call, Structured output, Temperature, Attachments, Open weights); input/output modalities; benchmark summary (Intelligence, Coding, Agentic, Arena with "#1 of 51"); Design Arena category table (Elo, win rate, rank); rank chips (Most available, Intelligence, Design Arena, Best value, Cheapest, Longest context, Newest, each "#N of M"); provider chips; full provider listing table (provider, model id, context, input limit, output, input $, output $, reasoning $, cache read/write, audio, flags, updated).

**Formulas I verified against live numbers** (Claude Opus 5.5: $4 in / $20 out, Intelligence 59.1):
- Blended price = `(3 x input + output) / 4` -> $8.00 (matches "Blended $8.00"). Covered by `src/lib/pricing.test.ts`.
- Best value = `intelligence / blended` -> 59.1 / 8 = 7.39 (matches "7.4").
- Rankings "reach" = number of providers serving the model.

## 2. Reference platforms

| Platform | How I studied it | Takeaway for OneAtlas |
|----------|------------------|-----------------------|
| **OpenRouter** | Its public, keyless API `https://openrouter.ai/api/v1/models` (analysed in depth). I did **not** review the website UX: do that yourself before the Loom (10 min on `openrouter.ai/models`) | Gold-standard model directory: per-model pricing, context, modalities, supported parameters, provider endpoints. Its API also ships benchmark data (see 3) |
| **LiteLLM** | Its public cost map `model_prices_and_context_window.json` (7,100 entries, 4,462 chat) analysed. Product site not reviewed | Proves pricing/context data is a shared, community-maintained asset. Its `mode` field (chat, embedding, image_generation, rerank, audio_*) is a clean model-type taxonomy. Optional enrichment source |
| **RouterPlus** | Homepage read | It is an inference router/optimizer ("routing on your own evals", reserved capacity), not a catalog. Borrow only the framing: price/quality trade-offs. Our "value" board and price-vs-intelligence chart express this. No router/playground in scope |

## 3. Data sources (all free, no API key)

### A. models.dev `https://models.dev/api.json` (6.8 MB): **the spine**
324 providers, 10,023 model rows. Per provider: `id, name, api, doc, env, npm`. Per model row: `id, name, description, family, attachment, reasoning, tool_call, structured_output, temperature, interleaved, knowledge, release_date, last_updated, modalities{input,output}, open_weights, limit{context,input?,output}, cost{input,output,cache_read,cache_write,reasoning,input_audio,output_audio,tiers,context_over_200k}, status, type`, and crucially **`canonical_model_id`**.

- `cost` is already **USD per 1M tokens** (Opus 4.6: `input: 5, output: 25`).
- `canonical_model_id` is `lab/slug` and is present on **8,618 of 10,023 rows**, grouping them into **658 canonical models**. Lab slugs there are the same ones OneAtlas shows (`zhipuai`, `alibaba`, `moonshotai`, `bytedance-seed`, `xai`, `mistral`...). This is the entity-resolution problem solved upstream.
- `type` is set on 462 rows: image 180, embedding 81, video 72, transcription 44, speech 43, reranking 18, realtime 15, chat 9. Missing = text.
- `status`: deprecated 870, beta 81, alpha 1. Input modalities: text, image, video, audio, **pdf**. Output: text, image, video, audio.
- 1,405 rows have no `canonical_model_id` (mostly small gateways: nano-gpt, kilo, vercel, openrouter...): 925 distinct ids. **MVP ignores them** (stretch in `07`).
- Biggest providers by listings: nano-gpt 613, llmgateway-providers 507, kilo 465, vercel 417, edenai 389, openrouter 379.

### B. OpenRouter `https://openrouter.ai/api/v1/models` (0.9 MB): **enrichment + benchmarks**
476 entries. Per entry: `id` (`lab/slug`, some with `:free` / `:batch` / `:thinking` suffix or a `~` alias prefix), `name`, `description`, `created`, `context_length`, `architecture{input_modalities, output_modalities}`, `pricing` (**USD per token as strings**, e.g. `"0.000000075"`), `top_provider.max_completion_tokens`, `supported_parameters`, `expiration_date`, and a `benchmarks` object.

- `benchmarks` is **missing entirely on 202 entries**. Where present: `artificial_analysis` (220 entries have >= 1 value) and `design_arena` (187 entries).
- Artificial Analysis keys that actually carry values today: `intelligence_index`, `engineering_index`, `finance_and_accounting_index`, `healthcare_and_medical_index`, `legal_index`, `strategy_and_ops_index`, `economics_index`, `cyber_index`, `decision_index`, `multilingual_index`, `openness_index`. **`coding_index` and `agentic_index` exist as keys but are never non-null** in today's data (OneAtlas shows them, so it must use another feed: Artificial Analysis API is a stretch).
- Design Arena: array of `{arena, category, elo, win_rate, rank}`. Categories (models arena): website 181, codecategories 177, gamedev 176, uicomponent 172, 3d 168, dataviz 164, svg 124, asciiart 106; (agents arena): mobileapps 84, pdf 77, webapps 76, fullstack 74, androidnative 66, spreadsheet 56, ... and several small slide/image categories.
- Per-model provider endpoints (uptime, latency, throughput, per-endpoint pricing incl. >200K tiers): `GET /api/v1/models/{id}/endpoints`, one call per model. Stretch only.

### C. LiteLLM cost map (5 MB): optional
Only needed if we want `mode`-based typing beyond models.dev's `type`. Skip for MVP.

### Join analysis (the reason for the ingestion design)
- Matching OpenRouter to models.dev canonical ids by exact string works for only **192 / 658**: OpenRouter uses different lab prefixes (`qwen` vs `alibaba`, `z-ai` vs `zhipuai`, `x-ai` vs `xai`, `mistralai` vs `mistral`, `meta-llama` vs `meta`) and dots vs dashes.
- With a **5-entry lab alias map + normalising the slug** (lowercase, strip non-alphanumerics, drop `:variant`, drop trailing date): **283 of 357** distinct OpenRouter models match a canonical model (5 ambiguous), and **200 of the benchmark-carrying OpenRouter models land on a canonical model**. 74 OpenRouter models have no canonical twin (new/obscure labs, `openai/gpt-6.2-*-pro` etc.): they become OpenRouter-only models.
- Expected result: **about 658 canonical + about 74 OpenRouter-only = about 730 models**, **about 8,600 provider listings**, **about 60 labs**, **about 300 providers**. Comparable to OneAtlas's 1,118 / 8,274 / 78 / 223 (they additionally ingest orphan rows).

Data licensing: both sources are public and keyless, but **confirm each one's terms before submission and attribute them in the footer and README** ("Data: models.dev, OpenRouter, Artificial Analysis, Design Arena").

## 4. Where OneAtlas can be better (kept deliberately small)

1. **Cost calculator** on detail and compare pages: "N input + M output tokens per month" -> monthly cost, per provider. Pure client maths, high developer value.
2. **Price vs intelligence scatter** on Rankings (value frontier), small Recharts chart.
3. **Shareable state everywhere**: filters, sort, compare set, ranking filters are all URL state.
4. **Compare diff mode** and best-value highlighting per row.
5. Speed: static shell + cached data, instant filter feedback (`keepPreviousData`).

## 5. Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Source APIs change shape or go down | Zod-validate every source row at ingest, log + skip bad rows, commit snapshots, seed from snapshots (offline, deterministic) |
| Wrong joins pollute benchmarks | Deterministic key, ambiguous matches resolved by exact-id preference, unit test on the alias map, ingest prints an `unmatched` report |
| Next 16 Cache Components errors ("blocking route") | Rules in `CLAUDE.md`; static shell + `<Suspense>`; read the bundled docs |
| Prisma 7 specifics (adapter, config file) | Already wired and verified (`src/lib/db.ts`, `prisma7.config.ts`) |
| Neon cold starts / connection limits | Pooled URL for runtime, direct for CLI, single client per process |
| Build queries the DB (`generateStaticParams`, cached reads) | `DATABASE_URL` must exist in Vercel build env; keep static params to top ~50 |
| Scope creep | `07-roadmap.md` has an explicit MVP cut line; stretch items are labelled |
