// Refresh the source snapshots. Usage: npm run ingest:fetch [-- <outDir>]   (default data/snapshots)
// Keyless. The seed never calls the network: it reads only what this script wrote (docs/03 D5).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCES = {
  "modelsdev.json": "https://models.dev/api.json",
  "openrouter-models.json": "https://openrouter.ai/api/v1/models",
} as const;

async function download(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  JSON.parse(text); // fail loudly on a truncated or HTML response before overwriting a good snapshot
  return text;
}

async function main() {
  const outDir = process.argv[2] ?? "data/snapshots";
  mkdirSync(outDir, { recursive: true });

  const [modelsDev, openRouter] = await Promise.all(Object.values(SOURCES).map(download));
  const md = JSON.parse(modelsDev) as Record<string, { models: Record<string, unknown> }>;
  const or = JSON.parse(openRouter) as { data: unknown[] };
  if (!Array.isArray(or.data)) throw new Error("OpenRouter response has no data[] array");

  writeFileSync(join(outDir, "modelsdev.json"), modelsDev);
  writeFileSync(join(outDir, "openrouter-models.json"), openRouter);

  const manifest = {
    fetchedAt: new Date().toISOString().slice(0, 10),
    note: "Written by scripts/ingest/fetch.ts; never hand-edit. The seed reads only these files.",
    sources: {
      "openrouter-models.json": { url: SOURCES["openrouter-models.json"], auth: "none", entries: or.data.length },
      "modelsdev.json": {
        url: SOURCES["modelsdev.json"],
        auth: "none",
        providers: Object.keys(md).length,
        modelRows: Object.values(md).reduce((n, p) => n + Object.keys(p.models ?? {}).length, 0),
      },
    },
  };
  writeFileSync(join(outDir, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote snapshots to ${outDir}:`, JSON.stringify(manifest.sources));
}

main().catch((err: unknown) => {
  console.error("ingest:fetch failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
