// Build-time snapshots of the project itself. Runs on install, dev and build (package.json), so what the site shows
// always matches the deployed code. Outputs:
//   1. src/generated/code-index.json    allow-listed source + docs, read by "Ask the code" and the /code viewer
//   2. src/generated/ask-anchors.json   the prepared answers' {{path|text}} citations resolved to line numbers
//   3. public/oneatlas-source.zip       the whole repository as a download (+ src/generated/source-archive.json)
// Only git-visible files (tracked, or untracked but not ignored), so .env and other ignored files never get in.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { ANCHOR, KNOWLEDGE } from "../src/components/ask/knowledge";
import { createZip } from "./zip";

// What the code viewer and the assistant may read: source, tests, docs, config. Not data snapshots or lockfiles.
const INCLUDE = /^(src|scripts|e2e|prisma|docs)\/|^(README\.md|CLAUDE\.md|package\.json|next\.config\.ts|prisma7\.config\.ts|playwright\.config\.ts|vitest\.config\.mts|tsconfig\.json|vercel\.json|\.env\.example)$/;
const EXCLUDE = /^src\/generated\/|\.(ico|svg|png|jpg)$|^docs\/CLAUDE-CODE-PROMPT\.md$|(^|\/)\.env(?!\.example)/;
const MAX_FILE_BYTES = 200_000;

// Never shipped anywhere, even if a listing were to include them (belt and braces for the no-git fallback walk).
const DENY = /^(node_modules|\.next|\.git|\.vercel|test-results|playwright-report|coverage|src\/generated|public\/oneatlas-source\.zip)(\/|$)|(^|\/)\.env(?!\.example$)|\.tsbuildinfo$|^next-env\.d\.ts$/;
const ARCHIVE_PATH = "public/oneatlas-source.zip";

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

/** Every repository file: git's view when available, else a filesystem walk that skips the deny-listed folders. */
function repoFiles(): string[] {
  try {
    return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .filter((p) => p && !DENY.test(p));
  } catch {
    // no git metadata (Vercel and some CI builds check out the source without .git): walk the tree instead
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir || ".", { withFileTypes: true })) {
        const path = dir ? `${dir}/${e.name}` : e.name;
        if (DENY.test(path)) continue;
        if (e.isDirectory()) walk(path);
        else if (e.isFile()) out.push(path);
      }
    };
    walk("");
    return out.sort();
  }
}

/** The commit being built: Vercel exposes it as an env var (there is no .git there); locally, ask git. */
function currentCommit(): string | null {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

/** Zip the whole repository under a top-level oneatlas/ folder; public/ is served by the CDN, no function involved. */
function writeArchive(paths: string[]) {
  const zip = createZip(paths.map((p) => ({ path: `oneatlas/${p}`, data: readFileSync(p) })));
  mkdirSync("public", { recursive: true });
  writeFileSync(ARCHIVE_PATH, zip);
  // size + commit for the /code page's download button (separate file: code-index.json must stay byte-stable)
  const meta = { files: paths.length, bytes: zip.length, commit: currentCommit() };
  writeFileSync("src/generated/source-archive.json", JSON.stringify(meta));
  console.log(`source archive: ${paths.length} files, ${Math.round(zip.length / 1024)} KB -> ${ARCHIVE_PATH}`);
}

function main() {
  const all = repoFiles();
  const files = all
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

  writeArchive(all);

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
