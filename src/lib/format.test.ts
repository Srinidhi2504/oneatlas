// Tests for display formatting: prices, token counts, dates and integers.
import { describe, expect, it } from "vitest";
import { daysSince, formatDate, formatMoney, formatPrice, formatScore, formatTokens, plural } from "./format";

describe("format", () => {
  it("formats token counts", () => {
    expect(formatTokens(1_000_000)).toBe("1M");
    expect(formatTokens(1_048_576)).toBe("1.05M");
    expect(formatTokens(131_072)).toBe("131K");
    expect(formatTokens(1_500)).toBe("1.5K");
    expect(formatTokens(400)).toBe("400");
    expect(formatTokens(null)).toBe("N/A");
  });
  it("formats prices per 1M tokens", () => {
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(0.075)).toBe("$0.075");
    expect(formatPrice(0.0015)).toBe("$0.0015");
    expect(formatPrice(3)).toBe("$3.00");
    expect(formatPrice(1.19516)).toBe("$1.20");
    expect(formatPrice(null)).toBe("N/A");
  });
  it("formats money, scores, dates", () => {
    expect(formatMoney(0.004)).toBe("<$0.01");
    expect(formatMoney(12.5)).toBe("$12.50");
    expect(formatMoney(12345.4)).toBe("$12,345");
    expect(formatScore(59.12)).toBe("59.1");
    expect(formatScore(1491.4, "elo")).toBe("1,491");
    expect(formatDate("2026-05-01")).toBe("May 1, 2026");
    expect(formatDate(null)).toBe("N/A");
    expect(daysSince("2026-01-01", Date.parse("2026-01-11T12:00:00Z"))).toBe(10);
    expect(plural(1, "model")).toBe("1 model");
    expect(plural(1200, "model")).toBe("1,200 models");
  });
});
