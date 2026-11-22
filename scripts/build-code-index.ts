// Snapshot the project's own source + docs into src/generated/code-index.json for the "Ask the code" assistant.
// Runs on install, dev and build (package.json), so the deployed index always matches the deployed code.
// Only git-visible files (tracked or untracked-but-not-ignored) under the allow-list: never .env, data snapshots, generated code.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { ANCHOR, KNOWLEDGE } from "../src/components/ask/knowledge";

const INCLUDE = /^(src|scripts|e2e|prisma|docs)\/|^(README\.md|CLAUDE\.md|package\.json|next\.config\.ts|prisma7\.config\.ts|playwright\.config\.ts|vitest\.config\.mts|tsconfig\.json|\.env\.example)$/;
const EXCLUDE = /^src\/generated\/|\.(ico|svg|png|jpg)$|^docs\/CLAUDE-CODE-PROMPT\.md$|(^|\/)\.env(?!\.example)/;
const MAX_FILE_BYTES = 200_000;

/** First line of the file's leading comment: a one-line purpose for the project map. */
export function leadingComment(text: string): string | null {
  for (const raw of text.split("\n").slice(0, 8)) {
    const line = raw.trim();
    if (!line || line === '"use client";' || line === "'use client';") continue;
    const m = line.match(/^(?:\/\/|\/\*\*?|\*|#|--)\s*(.+?)\s*(?:\*\/)?$/);
    if (m && !/^eslint|^@ts-|^prettier/.test(m[1])) return m[1].slice(0, 140);
    return null; // first real line is code: no summary
  }
  return null;
}

function trackedFiles(): string[] {
  try {
    return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
  } catch {
    // no git metadata (some CI/deploy builds): walk the same allow-listed folders instead
    const dirs = ["src", "scripts", "e2e", "prisma", "docs"].filter((d) => existsSync(d));
    const nested = dirs.flatMap((d) => readdirSync(d, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => `${e.parentPath}/${e.name}`.replace(/\\/g, "/")));
    return [...nested, ...readdirSync(".").filter((f) => INCLUDE.test(f))];
  }
}

function main() {
  const files = trackedFiles()
    .filter((p) => INCLUDE.test(p) && !EXCLUDE.test(p))
    .sort()
    .flatMap((path) => {
      const content = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
      if (Buffer.byteLength(content) > MAX_FILE_BYTES) return [];
      return [{ path, lines: content.split("\n").length, summary: leadingComment(content), content }];
    });
  mkdirSync("src/generated", { recursive: true });
  // deterministic output (sorted, no timestamp): the system prompt built from it stays byte-stable for prompt caching
  writeFileSync("src/generated/code-index.json", JSON.stringify({ files }));
  const bytes = files.reduce((n, f) => n + f.content.length, 0);
  console.log(`code index: ${files.length} files, ${Math.round(bytes / 1024)} KB -> src/generated/code-index.json`);

  // Resolve the prepared answers' {{path|text}} anchors to line numbers. A missing file or text fails the build:
  // the prepared answers must never cite code that has moved or disappeared.
  const anchors: Record<string, number> = {};
  const missing: string[] = [];
  for (const entry of KNOWLEDGE) {
    for (const m of entry.answer.matchAll(ANCHOR)) {
      const [, path, needle] = m;
      const file = files.find((f) => f.path === path);
      const line = file ? file.content.split("\n").findIndex((l) => l.includes(needle)) + 1 : 0;
      if (line > 0) anchors[`${path}|${needle}`] = line;
      else missing.push(`[${entry.id}] ${path} | ${needle}`);
    }
  }
  writeFileSync("src/generated/ask-anchors.json", JSON.stringify(anchors));
  if (missing.length) {
    console.error(`Prepared answers cite code that no longer exists:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`ask anchors: ${Object.keys(anchors).length} citations resolved -> src/generated/ask-anchors.json`);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/build-code-index.ts")) main();
