// Tests for the assistant's read-only code tools: file listing, reading, search and source windows.
import { describe, expect, it } from "vitest";
import { leadingComment } from "../../../scripts/build-code-index";
import { listFiles, projectMap, readFile, searchCode, sourceWindow, type IndexedFile } from "./code-tools";

const files: IndexedFile[] = [
  { path: "src/lib/db.ts", lines: 4, summary: "Prisma client", content: "// Prisma client\nimport x from 'y';\nexport const db = 1;\nconst cacheTag = 2;" },
  { path: "src/server/http.ts", lines: 3, summary: null, content: "export function ok() {}\nexport function fail() {}\n// cacheTag here and cacheTag there" },
  { path: "docs/03.md", lines: 2, summary: "Architecture", content: "# Architecture\nuse cache everywhere" },
];

describe("code tools", () => {
  it("builds a project map with purposes", () => {
    expect(projectMap(files)).toContain("src/lib/db.ts (4 lines): Prisma client");
    expect(projectMap(files)).toContain("src/server/http.ts (3 lines)\n");
  });

  it("lists by prefix", () => {
    expect(listFiles(files, "src/")).toBe("src/lib/db.ts (4 lines)\nsrc/server/http.ts (3 lines)");
    expect(listFiles(files, "nope/")).toMatch(/No files/);
  });

  it("reads numbered ranges and suggests near misses", () => {
    expect(readFile(files, "src/lib/db.ts", 2, 3)).toBe("src/lib/db.ts lines 2-3 of 4\n   2  import x from 'y';\n   3  export const db = 1;\n[lines 4-4 not shown; call read_file again with start_line=4]");
    expect(readFile(files, "./src/lib/db.ts")).toContain("lines 1-4 of 4");
    expect(readFile(files, "lib/db.ts")).toMatch(/File not found.*Did you mean: src\/lib\/db.ts/);
    expect(readFile(files, "../../.env")).toMatch(/File not found/); // only indexed paths exist
  });

  it("searches with AND terms, ranking files by hit count", () => {
    const r = searchCode(files, "cacheTag");
    expect(r.split("\n")[0]).toBe("2 matching lines in 2 files:");
    expect(searchCode(files, "export fail")).toContain("src/server/http.ts:2:");
    expect(searchCode(files, "use cache", "docs/")).toContain("docs/03.md:2:");
    expect(searchCode(files, "zzz")).toMatch(/No matches/);
  });

  it("returns a clamped source window for citations", () => {
    expect(sourceWindow(files, "src/lib/db.ts", 99, 1)).toMatchObject({ target: 4, start: 3, lines: ["export const db = 1;", "const cacheTag = 2;"] });
    expect(sourceWindow(files, "missing.ts", 1)).toBeNull();
    expect(sourceWindow(files, "src/lib/db.ts", 1, 0, 3)).toMatchObject({ start: 1, target: 1, lines: ["// Prisma client", "import x from 'y';", "export const db = 1;"] });
  });

  it("extracts a file's leading comment as its purpose", () => {
    expect(leadingComment('"use client";\n// Explorer state\nimport x')).toBe("Explorer state");
    expect(leadingComment("/** Thrown by services */\nexport class X {}")).toBe("Thrown by services");
    expect(leadingComment("import x from 'y';")).toBeNull();
    expect(leadingComment("// eslint-disable-next-line\nconst a = 1")).toBeNull();
  });
});
