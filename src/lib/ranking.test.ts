import { describe, expect, it } from "vitest";
import { competitionRanks, paretoFrontier } from "./ranking";

describe("ranking", () => {
  it("shares ranks on ties (1, 2, 2, 4)", () => {
    expect(competitionRanks([10, 20, 20, 5])).toEqual([3, 1, 1, 4]);
  });
  it("keeps only models smarter than every cheaper model", () => {
    const pts = [
      { id: "a", price: 1, score: 20 },
      { id: "b", price: 2, score: 15 }, // dominated by a
      { id: "c", price: 3, score: 40 },
      { id: "d", price: 3, score: 30 }, // same price as c, dumber
      { id: "e", price: 10, score: 60 },
    ];
    expect(paretoFrontier(pts).map((p) => p.id)).toEqual(["a", "c", "e"]);
    expect(paretoFrontier([])).toEqual([]);
  });
});
