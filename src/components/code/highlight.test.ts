// Tests for the in-house syntax highlighter: token types per language and lossless round-trips.
import { describe, expect, it } from "vitest";
import { highlight, languageOf } from "./highlight";

const types = (line: { t: string; v: string }[]) => line.filter((x) => x.t !== "plain" && x.t !== "punct").map((x) => `${x.t}:${x.v}`);

describe("highlight", () => {
  it("colours TypeScript keywords, strings, functions, types and comments", () => {
    const [line] = highlight(`export const db = create("x"); // note`, "js");
    expect(types(line)).toEqual(["keyword:export", "keyword:const", "fn:create", 'string:"x"', "comment:// note"]);
    expect(types(highlight("let n: Paginated<T> = 42", "js")[0])).toEqual(["keyword:let", "type:Paginated", "type:T", "number:42"]);
  });

  it("keeps a block comment's colour across lines and line count intact", () => {
    const lines = highlight("/* a\nb */\nconst x = 1;", "js");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual([{ t: "comment", v: "/* a" }]);
    expect(lines[1]).toEqual([{ t: "comment", v: "b */" }]);
    expect(lines[2][0]).toEqual({ t: "keyword", v: "const" });
  });

  it("handles JSX tags and attributes", () => {
    expect(types(highlight(`<Link href="/x" className={a}>`, "tsx")[0])).toEqual(["tag:<Link", "attr:href", 'string:"/x"', "attr:className", "tag:>"]);
  });

  it("covers CSS, JSON, SQL and Prisma", () => {
    expect(types(highlight(".a { color: var(--fg); }", "css")[0])).toEqual(["attr:color", "fn:var", "type:--fg"]);
    expect(types(highlight(`{"name": "x", "n": 1, "ok": true}`, "json")[0])).toEqual(['attr:"name"', 'string:"x"', 'attr:"n"', "number:1", 'attr:"ok"', "keyword:true"]);
    expect(types(highlight(`CREATE INDEX "Model_idx" ON "Model"`, "sql")[0].map((t) => ({ ...t, v: t.v })))).toContain('type:"Model_idx"');
    expect(types(highlight("model Lab {\n  slug String @unique\n}", "prisma")[1])).toEqual(["type:String", "attr:@unique"]);
  });

  it("maps extensions to languages", () => {
    expect(languageOf("src/app/page.tsx")).toEqual({ lang: "tsx", label: "TypeScript JSX" });
    expect(languageOf("prisma/schema.prisma").lang).toBe("prisma");
    expect(languageOf("README.md").lang).toBe("md");
    expect(languageOf("x.unknown").lang).toBe("text");
    expect(highlight("plain\ntext", "text")).toEqual([[{ t: "plain", v: "plain" }], [{ t: "plain", v: "text" }]]);
  });
});
