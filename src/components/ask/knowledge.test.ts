import { describe, expect, it } from "vitest";
import { parseBlocks } from "./Markdown";
import { KNOWLEDGE, matchQuestion, resolveAnchors, suggestQuestions, UNORDERED } from "./knowledge";

const id = (q: string) => matchQuestion(q)?.entry.id ?? null;

describe("prepared answers", () => {
  it("is a well-formed, prioritised set", () => {
    const ids = KNOWLEDGE.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(KNOWLEDGE.length).toBeGreaterThanOrEqual(30);
    expect(UNORDERED).toEqual([]); // every prepared answer has a place in the priority order
    expect(ids[0]).toBe("overview");
    for (const k of KNOWLEDGE) {
      for (const r of k.related) expect(ids, `${k.id} -> ${r}`).toContain(r);
      expect(k.answer.length, k.id).toBeGreaterThan(600); // detailed, not one-liners
      expect(k.steps.length, k.id).toBeGreaterThan(0);
    }
  });

  it("matches the way people actually ask", () => {
    expect(id("what happens when i change a filter?")).toBe("request-flow");
    expect(id("how does search work with gpt4o")).toBe("search");
    expect(id("can I run this with ollama on my machine")).toBe("local-llm");
    expect(id("why isn't the AI live? is this claude?")).toBe("assistant");
    expect(id("how do you cache things")).toBe("caching");
    expect(id("where does the data come from")).toBe("data-join");
    expect(id("why not nestjs")).toBe("architecture");
    expect(id("how is the 3d globe made")).toBe("ui-3d");
    expect(id("what breaks at 100x")).toBe("scale");
    expect(id("is the seed idempotent")).toBe("seed");
    expect(id("how is the database schema designed")).toBe("schema");
    expect(id("is it secure against sql injection")).toBe("security");
    expect(id("why not redux")).toBe("state-management");
    expect(id("how do I deploy this to vercel")).toBe("deploy");
    expect(id("how does the code editor work")).toBe("code-viewer");
    expect(id("how does dark mode work")).toBe("design-system");
    expect(id("how does ctrl k work")).toBe("palette");
    expect(id("what are the numbers next to each lab filter")).toBe("facets");
    expect(id("did you use ai to write this")).toBe("ai-usage");
    expect(id("how would I add a new field")).toBe("extend");
    expect(id("what is prerendered and what streams")).toBe("rendering");
    expect(id("bananas and weather")).toBeNull();
  });

  it("suggests the closest questions for anything else", () => {
    expect(suggestQuestions("ranking value best").map((k) => k.id)[0]).toBe("rankings");
    expect(suggestQuestions("zzz")).toHaveLength(3);
  });

  it("resolves code anchors to citations", () => {
    const anchors = { "src/lib/db.ts|export const db": 34 };
    expect(resolveAnchors("see {{src/lib/db.ts|export const db}}.", anchors)).toBe("see `src/lib/db.ts:34`.");
    expect(resolveAnchors("{{src/lib/db.ts|export const db|+3}}", anchors)).toBe("`src/lib/db.ts:34-37`");
    expect(resolveAnchors("{{src/x.ts|gone}}", anchors)).toBe("`src/x.ts`");
  });

  it("renders Markdown tables", () => {
    expect(parseBlocks("| A | B |\n|---|---|\n| 1 | 2 |")).toEqual([{ kind: "table", header: ["A", "B"], rows: [["1", "2"]] }]);
  });
});
