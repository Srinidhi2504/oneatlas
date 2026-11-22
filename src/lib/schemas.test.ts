import { describe, expect, it } from "vitest";
import {
  compareQuerySchema,
  matrixQuerySchema,
  modelListQuerySchema,
  paramsToObject,
  rankingsQuerySchema,
  searchQuerySchema,
} from "./schemas";

const parse = (qs: string) => modelListQuerySchema.safeParse(paramsToObject(new URLSearchParams(qs)));

describe("modelListQuerySchema", () => {
  it("applies defaults", () => {
    const r = parse("");
    expect(r.success && r.data).toMatchObject({ page: 1, pageSize: 24, sort: "providers", order: "desc", includeDeprecated: false });
  });
  it("parses CSV params, lower-cases and dedupes them", () => {
    const r = parse("lab=OpenAI,anthropic,openai&capability=tools,vision&type=text");
    expect(r.success && r.data.lab).toEqual(["openai", "anthropic"]);
    expect(r.success && r.data.capability).toEqual(["tools", "vision"]);
    expect(r.success && r.data.type).toEqual(["text"]);
  });
  it("joins repeated params like a CSV", () => {
    const r = parse("lab=openai&lab=google");
    expect(r.success && r.data.lab).toEqual(["openai", "google"]);
  });
  it("treats empty values as absent", () => {
    const r = parse("q=&lab=&minContext=");
    expect(r.success && r.data).toMatchObject({ q: undefined, lab: undefined, minContext: undefined });
  });
  it("defaults to relevance with a query and per-sort order", () => {
    expect(parse("q=gpt4o").data).toMatchObject({ sort: "relevance", order: "desc" });
    expect(parse("sort=price").data).toMatchObject({ sort: "price", order: "asc" });
    expect(parse("sort=name&order=desc").data).toMatchObject({ sort: "name", order: "desc" });
    expect(parse("sort=relevance").data).toMatchObject({ sort: "providers" });
  });
  it("coerces numbers and booleans", () => {
    expect(parse("minContext=1000000&maxPrice=2.5&includeDeprecated=true&page=3").data).toMatchObject({
      minContext: 1_000_000,
      maxPrice: 2.5,
      includeDeprecated: true,
      page: 3,
    });
    expect(parse("includeDeprecated=false").data?.includeDeprecated).toBe(false);
  });
  it("rejects out-of-bounds and bad enums", () => {
    expect(parse("pageSize=1000").success).toBe(false);
    expect(parse("page=0").success).toBe(false);
    expect(parse("type=foo").success).toBe(false);
    expect(parse("capability=telepathy").success).toBe(false);
    expect(parse("sort=random").success).toBe(false);
    expect(parse("minContext=abc").success).toBe(false);
    expect(parse("lab=../etc").success).toBe(false);
    expect(parse(`q=${"x".repeat(81)}`).success).toBe(false);
  });
  it("ignores unknown params", () => {
    expect(parse("utm_source=x").success).toBe(true);
  });
});

describe("other schemas", () => {
  it("compare needs 2 to 4 lab/slug ids", () => {
    expect(compareQuerySchema.safeParse({ ids: "a/b,c/d" }).success).toBe(true);
    expect(compareQuerySchema.safeParse({ ids: "a/b" }).success).toBe(false);
    expect(compareQuerySchema.safeParse({ ids: "a/b,c/d,e/f,g/h,i/j" }).success).toBe(false);
    expect(compareQuerySchema.safeParse({ ids: "a/b,nope" }).success).toBe(false);
    expect(compareQuerySchema.safeParse({}).success).toBe(false);
  });
  it("search needs a query and bounds the limit", () => {
    expect(searchQuerySchema.safeParse({ q: "" }).success).toBe(false);
    expect(searchQuerySchema.parse({ q: "claude" }).limit).toBe(8);
    expect(searchQuerySchema.safeParse({ q: "x", limit: "21" }).success).toBe(false);
  });
  it("rankings and matrix use their own page sizes", () => {
    expect(rankingsQuerySchema.parse({}).pageSize).toBe(50);
    expect(matrixQuerySchema.safeParse({ keys: Array.from({ length: 13 }, (_, i) => `k${i}`).join(",") }).success).toBe(false);
  });
});
