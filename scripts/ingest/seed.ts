// Seed the database from data/snapshots/ only (never the network). Idempotent: run it twice, same counts.
// Algorithm and field rules: docs/04-data-model-and-ingestion.md. Usage: npm run db:seed
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { LAB_NAMES, labAlias, titleCase } from "@/lib/labs";
import { blendedPrice, valueScore } from "@/lib/pricing";
import { toSearchKey } from "@/lib/search-key";
import { joinIds, splitId } from "./join";
import {
  competitionRanks,
  mapModelsDevType,
  mapOpenRouterType,
  median,
  modelsDevProviderSchema,
  modelsDevRowSchema,
  normalizeModalities,
  openRouterEntrySchema,
  orPriceToPerMillion,
  parsePartialDate,
  splitOpenRouterName,
  type ModelTypeValue,
  type ModelsDevRow,
  type OpenRouterEntry,
} from "./normalize";

const SNAPSHOTS = "data/snapshots";
const readJson = (file: string): unknown => JSON.parse(readFileSync(`${SNAPSHOTS}/${file}`, "utf8"));

const skipped: Record<string, number> = {};
const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);

// ---------- 1. read + validate ----------

type Row = ModelsDevRow & { providerId: string; canonicalId: string };
const sourceProviders = new Map<string, { id: string; name: string; api?: string | null; doc?: string | null }>();
const rows: Row[] = [];

for (const raw of Object.values(readJson("modelsdev.json") as Record<string, unknown>)) {
  const p = modelsDevProviderSchema.safeParse(raw);
  if (!p.success) {
    skip("models.dev provider failed validation");
    continue;
  }
  sourceProviders.set(p.data.id, p.data);
  for (const m of Object.values(p.data.models)) {
    const r = modelsDevRowSchema.safeParse(m);
    if (!r.success) skip("models.dev row failed validation");
    else if (!r.data.canonical_model_id) skip("models.dev row without canonical_model_id (MVP ignores)");
    else if (!/^[^/]+\/[^/]+$/.test(r.data.canonical_model_id)) skip("models.dev malformed canonical_model_id");
    else rows.push({ ...r.data, providerId: p.data.id, canonicalId: r.data.canonical_model_id.toLowerCase() });
  }
}

const orEntries = new Map<string, OpenRouterEntry>();
for (const raw of (readJson("openrouter-models.json") as { data: unknown[] }).data) {
  const e = openRouterEntrySchema.safeParse(raw);
  if (e.success) orEntries.set(e.data.id, e.data);
  else skip("OpenRouter entry failed validation");
}

// ---------- 2. group models.dev rows into canonical models ----------

const groups = new Map<string, Row[]>();
for (const r of rows) groups.set(r.canonicalId, [...(groups.get(r.canonicalId) ?? []), r]);

// ---------- 3. join OpenRouter onto canonical ids ----------

const join = joinIds([...groups.keys()], [...orEntries.keys()]);
const orForCanonical = new Map<string, OpenRouterEntry>(); // canonical id -> spec entry
const orBenchFor = new Map<string, OpenRouterEntry>(); // canonical id -> entry carrying benchmarks
const hasBenchmarks = (e?: OpenRouterEntry) =>
  !!e?.benchmarks &&
  (Object.values(e.benchmarks.artificial_analysis ?? {}).some((v) => v != null) || !!e.benchmarks.design_arena?.length);

for (const [key, canonicalId] of join.matched) {
  const ids = join.groups.get(key)!;
  const plain = (id: string) => id.toLowerCase().replace(/:.*$/, "");
  const spec = orEntries.get(ids.find((id) => plain(id) === canonicalId) ?? ids[0])!;
  orForCanonical.set(canonicalId, spec);
  const bench = [spec, ...ids.map((id) => orEntries.get(id)!)].find(hasBenchmarks);
  if (bench) orBenchFor.set(canonicalId, bench);
}

// ---------- 4. OpenRouter-only models ----------

const orOnly: { lab: string; slug: string; entry: OpenRouterEntry }[] = [];
for (const key of [...join.unmatched, ...join.unresolved]) {
  const entry = orEntries.get(join.groups.get(key)![0])!;
  const { lab, slug } = splitId(entry.id);
  const id = `${labAlias(lab.toLowerCase())}/${slug.toLowerCase().replace(/:.*$/, "")}`;
  if (groups.has(id)) skip("OpenRouter-only id collides with a canonical id");
  else orOnly.push({ ...splitId(id), entry });
}

// ---------- 5. labs, providers, derived model fields ----------

const labSlugs = new Set([...[...groups.keys()].map((id) => splitId(id).lab), ...orOnly.map((m) => m.lab)]);
const orLabNames = new Map(orOnly.map((m) => [m.lab, splitOpenRouterName(m.entry.name).lab]));
const labName = (slug: string) =>
  LAB_NAMES[slug] ?? sourceProviders.get(slug)?.name ?? orLabNames.get(slug) ?? titleCase(slug);

const usedProviderIds = new Set(rows.map((r) => r.providerId));

const positive = (n: number | null | undefined) => (n != null && n > 0 ? n : null);
const round6 = (n: number | null) => (n == null ? null : Math.round(n * 1e6) / 1e6);
const orDate = (unixSeconds: number | null | undefined) =>
  unixSeconds ? parsePartialDate(new Date(unixSeconds * 1000).toISOString().slice(0, 10)) : null;

interface Prices {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
}
interface ModelRecord {
  lab: string;
  slug: string;
  name: string;
  description: string | null;
  type: ModelTypeValue;
  family: string | null;
  releasedAt: Date | null;
  knowledgeCutoff: Date | null;
  deprecated: boolean;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  reasoning: boolean;
  toolCall: boolean;
  structuredOutput: boolean;
  vision: boolean;
  openWeights: boolean;
  prices: Prices;
  providerCount: number;
  openrouterId: string | null;
  benchEntry: OpenRouterEntry | null;
  listings: Row[];
}

const filled = (r: Row) =>
  Object.values(r).filter((v) => v != null).length +
  Object.values(r.limit ?? {}).filter((v) => v != null).length +
  Object.values(r.cost ?? {}).filter((v) => v != null).length;

function primaryRow(lab: string, group: Row[]): Row {
  const firstParty = group.find((r) => r.providerId === lab);
  if (firstParty) return firstParty;
  return [...group].sort((a, b) => filled(b) - filled(a) || (b.last_updated ?? "").localeCompare(a.last_updated ?? ""))[0];
}

const rowPrices = (r: Row): Prices => ({
  input: r.cost?.input ?? null,
  output: r.cost?.output ?? null,
  cacheRead: r.cost?.cache_read ?? null,
  cacheWrite: r.cost?.cache_write ?? null,
});
const orPrices = (e: OpenRouterEntry): Prices => ({
  input: orPriceToPerMillion(e.pricing?.prompt),
  output: orPriceToPerMillion(e.pricing?.completion),
  cacheRead: orPriceToPerMillion(e.pricing?.input_cache_read),
  cacheWrite: orPriceToPerMillion(e.pricing?.input_cache_write),
});

/** Reference price: first-party listing -> openrouter listing -> median across listings -> OpenRouter API pricing. */
function referencePrices(lab: string, group: Row[], or?: OpenRouterEntry): Prices {
  const priced = (r?: Row) => r?.cost?.input != null && r.cost.output != null;
  const preferred = [group.find((r) => r.providerId === lab), group.find((r) => r.providerId === "openrouter")].find(priced);
  if (preferred) return rowPrices(preferred);
  const all = group.map(rowPrices);
  const med: Prices = {
    input: round6(median(all.map((p) => p.input))),
    output: round6(median(all.map((p) => p.output))),
    cacheRead: round6(median(all.map((p) => p.cacheRead))),
    cacheWrite: round6(median(all.map((p) => p.cacheWrite))),
  };
  return med.input == null && med.output == null && or ? orPrices(or) : med;
}

const models: ModelRecord[] = [];
for (const [canonicalId, group] of groups) {
  const { lab, slug } = splitId(canonicalId);
  const p = primaryRow(lab, group);
  const or = orForCanonical.get(canonicalId);
  const input = normalizeModalities(p.modalities?.input);
  const output = normalizeModalities(p.modalities?.output);
  const inputModalities = input.length ? input : normalizeModalities(or?.architecture?.input_modalities);
  models.push({
    lab,
    slug,
    name: p.name,
    description: p.description || group.find((r) => r.description)?.description || or?.description || null,
    type: mapModelsDevType(p.type ?? group.find((r) => r.type)?.type),
    family: p.family ?? null,
    releasedAt: parsePartialDate(p.release_date) ?? orDate(or?.created),
    knowledgeCutoff: parsePartialDate(p.knowledge ?? group.find((r) => r.knowledge)?.knowledge),
    deprecated: group.every((r) => r.status === "deprecated"),
    contextWindow: positive(p.limit?.context) ?? positive(or?.context_length),
    maxOutputTokens: positive(p.limit?.output) ?? positive(or?.top_provider?.max_completion_tokens),
    inputModalities,
    outputModalities: output.length ? output : normalizeModalities(or?.architecture?.output_modalities),
    reasoning: p.reasoning ?? false,
    toolCall: p.tool_call ?? false,
    structuredOutput: p.structured_output ?? false,
    vision: inputModalities.includes("image"),
    openWeights: p.open_weights ?? false,
    prices: referencePrices(lab, group, or),
    providerCount: new Set(group.map((r) => r.providerId)).size,
    openrouterId: or?.id ?? null,
    benchEntry: orBenchFor.get(canonicalId) ?? null,
    listings: group,
  });
}

for (const { lab, slug, entry } of orOnly) {
  const input = normalizeModalities(entry.architecture?.input_modalities);
  const output = normalizeModalities(entry.architecture?.output_modalities);
  const params = new Set(entry.supported_parameters ?? []);
  models.push({
    lab,
    slug,
    name: splitOpenRouterName(entry.name).model,
    description: entry.description || null,
    type: mapOpenRouterType(output),
    family: null,
    releasedAt: orDate(entry.created),
    knowledgeCutoff: null,
    deprecated: false,
    contextWindow: positive(entry.context_length),
    maxOutputTokens: positive(entry.top_provider?.max_completion_tokens),
    inputModalities: input,
    outputModalities: output,
    reasoning: params.has("reasoning"),
    toolCall: params.has("tools"),
    structuredOutput: params.has("structured_outputs"),
    vision: input.includes("image"),
    openWeights: !!entry.hugging_face_id, // OpenRouter links a Hugging Face repo only for open-weights models
    prices: orPrices(entry),
    providerCount: 0,
    openrouterId: entry.id,
    benchEntry: hasBenchmarks(entry) ? entry : null,
    listings: [],
  });
}

// ---------- 6. benchmarks: catalogue, scores, ranks ----------

const AA_KEYS: Record<string, { key: string; name: string; category: string }> = {
  intelligence_index: { key: "intelligence", name: "Intelligence Index", category: "general" },
  engineering_index: { key: "engineering", name: "Engineering Index", category: "domain" },
  finance_and_accounting_index: { key: "finance-accounting", name: "Finance & Accounting Index", category: "domain" },
  healthcare_and_medical_index: { key: "healthcare-medical", name: "Healthcare & Medical Index", category: "domain" },
  legal_index: { key: "legal", name: "Legal Index", category: "domain" },
  strategy_and_ops_index: { key: "strategy-ops", name: "Strategy & Ops Index", category: "domain" },
  economics_index: { key: "economics", name: "Economics Index", category: "domain" },
  cyber_index: { key: "cyber", name: "Cyber Index", category: "domain" },
  decision_index: { key: "decision", name: "Decision Index", category: "domain" },
  multilingual_index: { key: "multilingual", name: "Multilingual Index", category: "domain" },
  // openness_index skipped: it scores licence openness, not capability. coding/agentic are always null today.
};
const ARENA_NAMES: Record<string, string> = {
  codecategories: "Code",
  gamedev: "Game Dev",
  uicomponent: "UI Components",
  "3d": "3D",
  dataviz: "Data Viz",
  svg: "SVG",
  asciiart: "ASCII Art",
  mobileapps: "Mobile Apps",
  pdf: "PDF",
  webapps: "Web Apps",
  fullstack: "Full Stack",
  androidnative: "Android Native",
  spreadsheet: "Spreadsheets",
  codetovideo: "Code to Video",
  "python-pptxslides": "PPTX Slides (Python)",
  agenticgamedev: "Agentic Game Dev",
  blender3d: "Blender 3D",
  htmlslides: "HTML Slides",
  godotgamedev: "Godot Game Dev",
  graphicdesign: "Graphic Design",
  imageediting: "Image Editing",
};

interface BenchMeta {
  key: string;
  name: string;
  group: string;
  category: string;
  unit: string;
  sourceUrl: string;
}
const catalogue = new Map<string, BenchMeta>();
const scores = new Map<string, { model: string; value: number; winRate: number | null }[]>(); // benchmark key -> scores
const addScore = (meta: BenchMeta, model: string, value: number, winRate: number | null = null) => {
  catalogue.set(meta.key, meta);
  const list = scores.get(meta.key) ?? [];
  if (!list.some((s) => s.model === model)) list.push({ model, value, winRate });
  scores.set(meta.key, list);
};

for (const m of models) {
  const b = m.benchEntry?.benchmarks;
  if (!b) continue;
  const id = `${m.lab}/${m.slug}`;
  for (const [srcKey, value] of Object.entries(b.artificial_analysis ?? {})) {
    const def = AA_KEYS[srcKey];
    if (def && value != null)
      addScore({ ...def, group: "Artificial Analysis", unit: "index", sourceUrl: "https://artificialanalysis.ai" }, id, value);
  }
  const modelArena: number[] = [];
  for (const d of b.design_arena ?? []) {
    const cat = d.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (d.arena === "models") modelArena.push(d.elo);
    addScore(
      {
        key: `arena-${cat}`,
        name: ARENA_NAMES[cat] ?? titleCase(cat),
        group: "Design Arena",
        category: d.arena === "agents" ? "design-agents" : "design",
        unit: "elo",
        sourceUrl: "https://www.designarena.ai",
      },
      id,
      d.elo,
      d.win_rate ?? null,
    );
  }
  if (modelArena.length >= 4) {
    const mean = Math.round((modelArena.reduce((a, v) => a + v, 0) / modelArena.length) * 10) / 10;
    addScore(
      {
        key: "arena",
        name: "Design Arena (average)",
        group: "Design Arena",
        category: "design",
        unit: "elo",
        sourceUrl: "https://www.designarena.ai (derived: mean Elo over >= 4 model-arena categories)",
      },
      id,
      mean,
    );
  }
}

// keep benchmarks with >= 10 scored models; rank 1 = best, ties share a rank
for (const [key, list] of scores) {
  if (list.length < 10) {
    scores.delete(key);
    catalogue.delete(key);
    skip(`benchmark with < 10 scores dropped (${key})`);
  }
}
const ranked = new Map(
  [...scores].map(([key, list]) => {
    const ranks = competitionRanks(list.map((s) => s.value));
    return [key, list.map((s, i) => ({ ...s, rank: ranks[i] }))];
  }),
);
const intelligenceOf = new Map((ranked.get("intelligence") ?? []).map((s) => [s.model, s.value]));

// ---------- 7. write ----------

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" }),
});

async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}
const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

async function main() {
  const started = performance.now();

  // labs
  const labIds = new Map<string, string>();
  await inChunks([...labSlugs], 10, async (slug) => {
    const name = labName(slug);
    const lab = await db.lab.upsert({ where: { slug }, create: { slug, name }, update: { name }, select: { id: true } });
    labIds.set(slug, lab.id);
  });

  // providers (only those with >= 1 canonical listing)
  const providerIds = new Map<string, string>();
  await inChunks([...usedProviderIds], 10, async (slug) => {
    const p = sourceProviders.get(slug)!;
    const data = { name: p.name, apiUrl: p.api ?? null, docUrl: p.doc ?? null, labId: labIds.get(slug) ?? null };
    const row = await db.provider.upsert({ where: { slug }, create: { slug, ...data }, update: data, select: { id: true } });
    providerIds.set(slug, row.id);
  });

  // models. openrouterId is unique and can move between models when an alias or snapshot changes
  // (e.g. an OpenRouter-only model becomes joined to a canonical one), so clear it before re-assigning.
  await db.model.updateMany({ where: { openrouterId: { not: null } }, data: { openrouterId: null } });
  const modelIds = new Map<string, string>();
  await inChunks(models, 10, async (m) => {
    const labId = labIds.get(m.lab)!;
    const blended = m.prices.input != null && m.prices.output != null ? round6(blendedPrice(m.prices.input, m.prices.output)) : null;
    const intelligence = intelligenceOf.get(`${m.lab}/${m.slug}`) ?? null;
    const data = {
      name: m.name,
      description: m.description,
      type: m.type,
      family: m.family,
      releasedAt: m.releasedAt,
      knowledgeCutoff: m.knowledgeCutoff,
      deprecated: m.deprecated,
      contextWindow: m.contextWindow,
      maxOutputTokens: m.maxOutputTokens,
      inputModalities: m.inputModalities,
      outputModalities: m.outputModalities,
      reasoning: m.reasoning,
      toolCall: m.toolCall,
      structuredOutput: m.structuredOutput,
      vision: m.vision,
      openWeights: m.openWeights,
      inputPrice: m.prices.input,
      outputPrice: m.prices.output,
      cacheReadPrice: m.prices.cacheRead,
      cacheWritePrice: m.prices.cacheWrite,
      blendedPrice: blended,
      isFree: m.prices.input === 0 && m.prices.output === 0,
      providerCount: m.providerCount,
      intelligenceIndex: intelligence,
      valueScore: valueScore(intelligence, blended),
      openrouterId: m.openrouterId,
      searchKey: toSearchKey(m.lab, labName(m.lab), m.name, m.slug),
    };
    const row = await db.model.upsert({
      where: { labId_slug: { labId, slug: m.slug } },
      create: { labId, slug: m.slug, ...data },
      update: data,
      select: { id: true },
    });
    modelIds.set(`${m.lab}/${m.slug}`, row.id);
  });

  // benchmarks
  const benchmarkIds = new Map<string, string>();
  for (const meta of catalogue.values()) {
    const { key, ...data } = meta;
    const row = await db.benchmark.upsert({ where: { key }, create: meta, update: data, select: { id: true } });
    benchmarkIds.set(key, row.id);
  }

  // listings + scores: replace atomically
  const listingRows = models.flatMap((m) =>
    m.listings.map((r) => ({
      providerId: providerIds.get(r.providerId)!,
      modelId: modelIds.get(`${m.lab}/${m.slug}`)!,
      providerModelId: r.id,
      contextWindow: positive(r.limit?.context),
      inputLimit: positive(r.limit?.input),
      maxOutputTokens: positive(r.limit?.output),
      inputPrice: r.cost?.input ?? null,
      outputPrice: r.cost?.output ?? null,
      reasoningPrice: r.cost?.reasoning ?? null,
      cacheReadPrice: r.cost?.cache_read ?? null,
      cacheWritePrice: r.cost?.cache_write ?? null,
      reasoning: r.reasoning ?? null,
      toolCall: r.tool_call ?? null,
      structuredOutput: r.structured_output ?? null,
      temperature: r.temperature ?? null,
      status: r.status ?? null,
      sourceUpdatedAt: parsePartialDate(r.last_updated),
    })),
  );
  const scoreRows = [...ranked].flatMap(([key, list]) =>
    list.map((s) => ({ modelId: modelIds.get(s.model)!, benchmarkId: benchmarkIds.get(key)!, value: s.value, winRate: s.winRate, rank: s.rank })),
  );

  await db.$transaction(
    async (tx) => {
      await tx.providerModel.deleteMany();
      for (const part of chunk(listingRows, 1000)) await tx.providerModel.createMany({ data: part });
      await tx.benchmarkScore.deleteMany();
      for (const part of chunk(scoreRows, 1000)) await tx.benchmarkScore.createMany({ data: part });
      // remove rows that disappeared from the snapshots (keeps re-seeds after a refresh exact)
      await tx.model.deleteMany({ where: { id: { notIn: [...modelIds.values()] } } });
      await tx.benchmark.deleteMany({ where: { key: { notIn: [...catalogue.keys()] } } });
      await tx.provider.deleteMany({ where: { slug: { notIn: [...usedProviderIds] } } });
      await tx.lab.deleteMany({ where: { slug: { notIn: [...labSlugs] } } });
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  await report(performance.now() - started);
}

async function report(ms: number) {
  const [labs, modelCount, withOr, providers, listings, benchmarks, benchmarkScores, withIntel] = await Promise.all([
    db.lab.count(),
    db.model.count(),
    db.model.count({ where: { openrouterId: { not: null } } }),
    db.provider.count(),
    db.providerModel.count(),
    db.benchmark.count(),
    db.benchmarkScore.count(),
    db.model.count({ where: { intelligenceIndex: { not: null } } }),
  ]);
  const bands: [string, number, number, number][] = [
    ["Lab", labs, 40, 100],
    ["Model", modelCount, 600, 850],
    ["Model with openrouterId", withOr, 300, Infinity],
    ["Provider", providers, 200, 324],
    ["ProviderModel", listings, 7500, 8700],
    ["Benchmark", benchmarks, 15, Infinity],
    ["BenchmarkScore", benchmarkScores, 1500, Infinity],
    ["Models with intelligenceIndex", withIntel, 60, Infinity],
  ];

  console.log(`\nSeed finished in ${(ms / 1000).toFixed(1)} s\n`);
  console.log("Join (OpenRouter keys -> canonical models)");
  console.log(`  keys ${join.groups.size}, with candidates ${join.groups.size - join.unmatched.length}, ambiguous ${join.ambiguous.size} (unresolved ${join.unresolved.length}), unmatched ${join.unmatched.length}`);
  for (const [key, candidates] of join.ambiguous) console.log(`  ambiguous ${key} -> ${join.matched.get(key) ?? "UNJOINED"}  (of ${candidates.join(", ")})`);
  console.log(`  canonical models ${groups.size}, OpenRouter-only models ${orOnly.length}`);
  console.log("\nSkipped rows by reason");
  for (const [reason, n] of Object.entries(skipped).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${reason}`);
  console.log("\nTable counts vs sanity bands (docs/04)");
  let ok = true;
  for (const [name, n, min, max] of bands) {
    const pass = n >= min && n <= max;
    ok &&= pass;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name.padEnd(30)} ${String(n).padStart(6)}   expected ${min}..${max === Infinity ? "" : max}`);
  }
  if (!ok) {
    console.log("\nOne or more counts are outside the sanity bands: investigate before shipping.");
    process.exitCode = 1;
  }
}

main()
  .catch((err: unknown) => {
    console.error("db:seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
