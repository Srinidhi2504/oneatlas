// The project's own source snapshot (scripts/build-code-index.ts -> src/generated/code-index.json), read once per
// server instance. Shared by the "Ask the code" assistant and the /code viewer. Read-only; paths are matched against
// the snapshot, never resolved on disk, so nothing outside it (no .env, no data/) can be served.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { searchHits, sourceWindow, type IndexedFile } from "./explain/code-tools";

let cached: IndexedFile[] | null = null;
export function codeIndex(): IndexedFile[] {
  if (!cached) {
    const raw = readFileSync(join(process.cwd(), "src/generated/code-index.json"), "utf8");
    cached = (JSON.parse(raw) as { files: IndexedFile[] }).files;
  }
  return cached;
}

export interface CodeTreeEntry {
  path: string;
  lines: number;
  summary: string | null;
}

/** Every file with its size and purpose (no contents): the viewer's file tree. */
export const codeTree = (): CodeTreeEntry[] => codeIndex().map(({ path, lines, summary }) => ({ path, lines, summary }));

/** One file's full text, or null when it is not in the snapshot. */
export function codeFile(path: string): { path: string; lines: number; content: string } | null {
  const f = codeIndex().find((x) => x.path === path);
  return f ? { path: f.path, lines: f.lines, content: f.content } : null;
}

export const codeSearch = (query: string, limit = 60) => searchHits(codeIndex(), query, "", limit);
export const sourceExcerpt = (path: string, line: number, end?: number) => sourceWindow(codeIndex(), path, line, 12, end);

export interface SourceArchive {
  files: number;
  bytes: number;
  commit: string | null; // null when built without git and outside Vercel
}

/** Size and commit of public/oneatlas-source.zip (written next to the code index at build time), or null if missing. */
export function sourceArchive(): SourceArchive | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "src/generated/source-archive.json"), "utf8")) as SourceArchive;
  } catch {
    return null; // e.g. a dev server started before the first `npm run codeindex`
  }
}
