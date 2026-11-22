import { describe, expect, it } from "vitest";
import { CITATION, parseBlocks, safeHref } from "./Markdown";

describe("assistant markdown", () => {
  it("parses headings, paragraphs, lists and code fences", () => {
    const blocks = parseBlocks("## Flow\nFirst line\ncontinues.\n\n1. Parse\n2. Query\n   more\n- a\n```ts\nconst x = 1;\n```");
    expect(blocks).toEqual([
      { kind: "heading", level: 2, text: "Flow" },
      { kind: "para", text: "First line continues." },
      { kind: "list", ordered: true, items: ["Parse", "Query more"] },
      { kind: "list", ordered: false, items: ["a"] },
      { kind: "code", lang: "ts", text: "const x = 1;" },
    ]);
  });

  it("renders a half-streamed code fence as code so far", () => {
    expect(parseBlocks("Text\n```ts\nconst a")).toEqual([
      { kind: "para", text: "Text" },
      { kind: "code", lang: "ts", text: "const a" },
    ]);
  });

  it("recognises file citations, including Next route folders", () => {
    expect("src/lib/db.ts:12".match(CITATION)?.slice(1, 3)).toEqual(["src/lib/db.ts", "12"]);
    expect("src/app/models/[lab]/[slug]/page.tsx:40-58".match(CITATION)?.[1]).toBe("src/app/models/[lab]/[slug]/page.tsx");
    expect("docs/03-architecture.md".match(CITATION)?.[1]).toBe("docs/03-architecture.md");
    expect("listModels()".match(CITATION)).toBeNull();
    expect("use cache".match(CITATION)).toBeNull();
  });
});

describe("safeHref", () => {
  it("allows http(s) and same-site paths only", () => {
    expect(safeHref("https://models.dev")).toBe(true);
    expect(safeHref("/models/openai/gpt-5")).toBe(true);
    expect(safeHref("javascript:alert(1)")).toBe(false);
    expect(safeHref(" JavaScript:alert(1)")).toBe(false);
    expect(safeHref("data:text/html,<script>")).toBe(false);
    expect(safeHref("//evil.example")).toBe(false);
  });
});
