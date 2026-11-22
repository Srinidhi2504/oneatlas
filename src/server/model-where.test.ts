import { escapeLike } from "@/lib/search-key";
import { describe, expect, it } from "vitest";
import { buildModelWhere, relevanceSort, without } from "./model-where";

describe("buildModelWhere", () => {
  it("hides deprecated models by default and nothing else", () => {
    expect(buildModelWhere({})).toEqual({ AND: [{ deprecated: false }] });
    expect(buildModelWhere({ includeDeprecated: true })).toEqual({});
  });

  it("normalises the search query to the searchKey form", () => {
    expect(buildModelWhere({ q: "GPT-4o", includeDeprecated: true })).toEqual({ AND: [{ searchKey: { contains: "gpt4o" } }] });
    // a query with no searchable characters matches nothing (same as /search), instead of every model
    expect(buildModelWhere({ q: "!!", includeDeprecated: true })).toEqual({ AND: [{ id: { in: [] } }] });
  });

  it("ORs values within a param and ANDs across params", () => {
    const where = buildModelWhere({
      lab: ["openai", "google"],
      provider: ["azure"],
      type: ["text", "image"],
      includeDeprecated: true,
    });
    expect(where).toEqual({
      AND: [
        { lab: { slug: { in: ["openai", "google"] } } },
        { listings: { some: { provider: { slug: { in: ["azure"] } } } } },
        { type: { in: ["TEXT", "IMAGE"] } },
      ],
    });
  });

  it("requires every listed capability", () => {
    expect(buildModelWhere({ capability: ["tools", "open", "free"], includeDeprecated: true })).toEqual({
      AND: [{ toolCall: true }, { openWeights: true }, { isFree: true }],
    });
  });

  it("maps modalities and numeric bounds", () => {
    expect(buildModelWhere({ inputModality: ["image"], minContext: 1_000_000, maxPrice: 2, includeDeprecated: true })).toEqual({
      AND: [{ inputModalities: { hasSome: ["image"] } }, { contextWindow: { gte: 1_000_000 } }, { blendedPrice: { lte: 2 } }],
    });
  });

  it("orders search results exact > prefix > contains > other, then by providers", () => {
    const rows = [
      { id: "a", name: "GPT-4o mini", providerCount: 50 },
      { id: "b", name: "OpenAI GPT-4o", providerCount: 5 },
      { id: "c", name: "GPT-4o", providerCount: 1 },
      { id: "d", name: "Something", providerCount: 99 }, // matched via lab/slug only
      { id: "e", name: "GPT-4o", providerCount: 80, deprecated: true },
    ];
    expect(relevanceSort(rows, "gpt4o").map((r) => r.id)).toEqual(["c", "e", "a", "b", "d"]);
  });

  it("drops a facet's own filter with without()", () => {
    const f = { lab: ["openai"], type: ["text" as const] };
    expect(without(f, "lab")).toEqual({ type: ["text"] });
    expect(f.lab).toEqual(["openai"]); // input untouched
  });
});

describe("symbol-only and wildcard queries", () => {
  it("a query with no letters or digits matches nothing", () => {
    expect(buildModelWhere({ q: "%" })).toEqual({ AND: [{ id: { in: [] } }, { deprecated: false }] });
  });
  it("escapes LIKE wildcards in raw name matches", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
