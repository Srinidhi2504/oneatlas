/**
 * Sliding-window limiter: at most `limit` hits per `windowMs` per key. Returns seconds to wait when blocked.
 * ponytail: in memory, so it is per server instance and resets on cold starts; use Upstash/Vercel KV or the
 * Vercel firewall for a global limit if the endpoint is ever abused.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return { ok: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000) };
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.delete(hits.keys().next().value!); // bound memory
    return { ok: true };
  };
}
