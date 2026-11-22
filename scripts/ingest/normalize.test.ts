import { describe, expect, it } from "vitest";
import { toSearchKey } from "@/lib/search-key";
import {
  competitionRanks,
  mapModelsDevType,
  mapOpenRouterType,
  median,
  modelsDevRowSchema,
  normalizeModalities,
  orPriceToPerMillion,
  parsePartialDate,
  splitOpenRouterName,
} from "./normalize";

describe("normalisers", () => {
  it("converts OpenRouter per-token prices and rejects router placeholders", () => {
    expect(orPriceToPerMillion("0.000003")).toBe(3);
    expect(orPriceToPerMillion("0")).toBe(0);
    expect(orPriceToPerMillion("-1")).toBeNull();
    expect(orPriceToPerMillion(undefined)).toBeNull();
    expect(orPriceToPerMillion("abc")).toBeNull();
  });

  it("parses full and partial dates as UTC", () => {
    expect(parsePartialDate("2025-05-31")?.toISOString()).toBe("2025-05-31T00:00:00.000Z");
    expect(parsePartialDate("2025-05")?.toISOString()).toBe("2025-05-01T00:00:00.000Z");
    expect(parsePartialDate("2025")?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(parsePartialDate("2025-02-31")).toBeNull();
    expect(parsePartialDate("soon")).toBeNull();
    expect(parsePartialDate(null)).toBeNull();
  });

  it("normalises modalities", () => {
    expect(normalizeModalities(["Text", "file", "image", "text", "smell"])).toEqual(["text", "image", "pdf"]);
    expect(normalizeModalities(undefined)).toEqual([]);
  });

  it("maps model types", () => {
    expect(mapModelsDevType(undefined)).toBe("TEXT");
    expect(mapModelsDevType("chat")).toBe("TEXT");
    expect(mapModelsDevType("reranking")).toBe("RERANK");
    expect(mapModelsDevType("embedding")).toBe("EMBEDDING");
    expect(mapModelsDevType("something-new")).toBe("TEXT");
    expect(mapOpenRouterType(["text", "image"])).toBe("IMAGE");
    expect(mapOpenRouterType(["audio"])).toBe("SPEECH");
    expect(mapOpenRouterType(["text"])).toBe("TEXT");
  });

  it("builds search keys that match punctuation-free queries", () => {
    expect(toSearchKey("openai", "OpenAI", "GPT-4o", "gpt-4o")).toContain("gpt4o");
    expect(toSearchKey("Claude Son")).toBe("claudeson");
    expect(toSearchKey(null, "A.B")).toBe("ab");
  });

  it("computes medians and competition ranks", () => {
    expect(median([3, null, 1, 2])).toBe(2);
    expect(median([1, 4])).toBe(2.5);
    expect(median([null])).toBeNull();
    expect(competitionRanks([50, 70, 70, 10])).toEqual([3, 1, 1, 4]);
    expect(competitionRanks([5, 1, 3], false)).toEqual([3, 1, 2]);
  });

  it("splits OpenRouter display names", () => {
    expect(splitOpenRouterName("Thinking Machines: Inkling 2 Mini")).toEqual({ lab: "Thinking Machines", model: "Inkling 2 Mini" });
    expect(splitOpenRouterName("Auto")).toEqual({ lab: null, model: "Auto" });
  });

  it("validates source rows and rejects bad ones", () => {
    expect(modelsDevRowSchema.safeParse({ id: "x", name: "X", cost: { input: 1, output: 2 } }).success).toBe(true);
    expect(modelsDevRowSchema.safeParse({ id: "x", name: "X", cost: { input: -1 } }).success).toBe(false);
    expect(modelsDevRowSchema.safeParse({ name: "no id" }).success).toBe(false);
  });
});
