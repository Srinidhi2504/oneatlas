import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows `limit` hits per window per key, then reports when to retry", () => {
    const check = createRateLimiter(2, 60_000);
    expect(check("a", 0)).toEqual({ ok: true });
    expect(check("a", 1_000)).toEqual({ ok: true });
    expect(check("a", 2_000)).toEqual({ ok: false, retryAfter: 58 });
    expect(check("b", 2_000)).toEqual({ ok: true }); // keys are independent
    expect(check("a", 60_001)).toEqual({ ok: true }); // first hit left the window
  });
});
