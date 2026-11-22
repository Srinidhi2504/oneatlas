// The "Ask the code" assistant's tools: read-only lookups over the code index (scripts/build-code-index.ts).
// Pure functions over an in-memory list: paths are matched against the index, never resolved on disk,
// so a model-supplied path cannot reach anything outside the snapshot (no traversal, no .env).

export interface IndexedFile {
  path: string;
  lines: number;
  summary: string | null;
  content: string;
}

const MAX_READ_LINES = 300;
const MAX_SEARCH_HITS = 12;

/** "path (N lines): purpose" per file, grouped by top-level folder. Goes into the cached system prompt. */
export function projectMap(files: IndexedFile[]): string {
  return files.map((f) => `${f.path} (${f.lines} lines)${f.summary ? `: ${f.summary}` : ""}`).join("\n");
}

export function listFiles(files: IndexedFile[], prefix = ""): string {
  const hits = files.filter((f) => f.path.startsWith(prefix.replace(/^\.?\//, "")));
  return hits.length ? hits.map((f) => `${f.path} (${f.lines} lines)`).join("\n") : `No files under "${prefix}".`;
}

/**
 * Line-numbered excerpt. Lines are 1-based and inclusive; long ranges are capped so one call cannot flood the
 * context. Unknown paths get the closest suggestions instead of an error the model can't act on.
 */
export function readFile(files: IndexedFile[], path: string, startLine?: number, endLine?: number): string {
  const file = files.find((f) => f.path === path.replace(/^\.?\//, ""));
  if (!file) {
    const base = path.split("/").pop()?.toLowerCase() ?? "";
    const near = files.filter((f) => f.path.toLowerCase().includes(base)).slice(0, 5);
    return `File not found: ${path}.${near.length ? ` Did you mean: ${near.map((f) => f.path).join(", ")}?` : " Use list_files to see paths."}`;
  }
  const all = file.content.split("\n");
  const start = Math.max(1, Math.min(startLine ?? 1, all.length));
  const end = Math.min(all.length, endLine ?? start + MAX_READ_LINES - 1, start + MAX_READ_LINES - 1);
  const body = all
    .slice(start - 1, end)
    .map((line, i) => `${String(start + i).padStart(4)}  ${line}`)
    .join("\n");
  const more = end < all.length ? `\n[lines ${end + 1}-${all.length} not shown; call read_file again with start_line=${end + 1}]` : "";
  return `${file.path} lines ${start}-${end} of ${all.length}\n${body}${more}`;
}

/**
 * Case-insensitive search. Every whitespace-separated term must appear on the line (AND); results are ordered by
 * how many lines of the file match, so the most relevant file comes first.
 * ponytail: a linear scan of ~450 KB per call (a few ms); add an inverted index if the snapshot grows 100x.
 */
export function searchCode(files: IndexedFile[], query: string, pathPrefix = ""): string {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return "Empty query.";
  const perFile = files
    .filter((f) => f.path.startsWith(pathPrefix.replace(/^\.?\//, "")))
    .map((f) => ({
      path: f.path,
      hits: f.content
        .split("\n")
        .map((text, i) => ({ line: i + 1, text }))
        .filter(({ text }) => terms.every((t) => text.toLowerCase().includes(t))),
    }))
    .filter((f) => f.hits.length)
    .sort((a, b) => b.hits.length - a.hits.length || a.path.localeCompare(b.path));
  if (!perFile.length) return `No matches for "${query}". Try fewer or different terms.`;
  const out: string[] = [];
  for (const f of perFile) {
    for (const h of f.hits) {
      if (out.length >= MAX_SEARCH_HITS) break;
      out.push(`${f.path}:${h.line}: ${h.text.trim().slice(0, 160)}`);
    }
  }
  const total = perFile.reduce((n, f) => n + f.hits.length, 0);
  return `${total} matching lines in ${perFile.length} files${total > out.length ? ` (first ${out.length} shown)` : ""}:\n${out.join("\n")}`;
}

/** Lines around a citation (`path:42` or `path:42-60`) for the UI's source viewer; ranges are capped at 120 lines. */
export function sourceWindow(files: IndexedFile[], path: string, line: number, radius = 12, endLine?: number) {
  const file = files.find((f) => f.path === path);
  if (!file) return null;
  const all = file.content.split("\n");
  const target = Math.max(1, Math.min(line, all.length));
  const start = Math.max(1, target - radius);
  const end = Math.min(all.length, Math.max(target, Math.min(endLine ?? target, target + 120)) + radius);
  return { path: file.path, totalLines: all.length, start, target, lines: all.slice(start - 1, end) };
}
