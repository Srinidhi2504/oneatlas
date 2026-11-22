import { describe, expect, it } from "vitest";
import { blendedPrice, perTokenToPerMillion, valueScore } from "./pricing";

describe("pricing", () => {
  it("matches the OneAtlas reference numbers", () => {
    expect(blendedPrice(4, 20)).toBe(8);
    expect(valueScore(59.1, 8)?.toFixed(1)).toBe("7.4");
  });
  it("has no value score for free or unscored models", () => {
    expect(valueScore(50, 0)).toBeNull();
    expect(valueScore(null, 8)).toBeNull();
  });
  it("converts per-token strings to per-1M without float noise", () => {
    expect(perTokenToPerMillion("0.000000075")).toBe(0.075);
    expect(perTokenToPerMillion("0.000003")).toBe(3);
    expect(perTokenToPerMillion("0")).toBe(0);
  });
});
