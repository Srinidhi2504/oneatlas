// Tests for price math: blended price, value score, monthly cost and cheapest listing.
import { describe, expect, it } from "vitest";
import { blendedPrice, cheapestListing, monthlyCost, perTokenToPerMillion, valueScore } from "./pricing";

describe("pricing", () => {
  it("matches the OneAtlas reference numbers", () => {
    expect(blendedPrice(4, 20)).toBe(8);
    expect(valueScore(59.1, 8)?.toFixed(1)).toBe("7.4");
  });
  it("has no value score for free or unscored models", () => {
    expect(valueScore(50, 0)).toBeNull();
    expect(valueScore(null, 8)).toBeNull();
  });
  it("computes monthly cost and the cheapest listing for a token mix", () => {
    expect(monthlyCost(4, 20, 10, 2)).toBe(80); // 10M in x $4 + 2M out x $20
    expect(monthlyCost(null, 20, 10, 2)).toBeNull();
    expect(monthlyCost(null, 20, 0, 2)).toBe(40); // input price irrelevant when no input tokens
    const listings = [
      { id: "a", pricing: { input: 3, output: 15 } },
      { id: "b", pricing: { input: 1, output: 30 } },
      { id: "c", pricing: { input: null, output: 1 } },
    ];
    expect(cheapestListing(listings, 10, 1)?.listing.id).toBe("b"); // input-heavy: 40 vs 45
    expect(cheapestListing(listings, 1, 10)?.listing.id).toBe("a"); // output-heavy: 153 vs 301
    expect(cheapestListing([], 1, 1)).toBeNull();
  });
  it("converts per-token strings to per-1M without float noise", () => {
    expect(perTokenToPerMillion("0.000000075")).toBe(0.075);
    expect(perTokenToPerMillion("0.000003")).toBe(3);
    expect(perTokenToPerMillion("0")).toBe(0);
  });
});
