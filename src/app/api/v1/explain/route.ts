import { connection } from "next/server";
import { explainRequestSchema } from "@/lib/schemas";
import { explain, isConfigured, type ExplainEvent } from "@/server/explain/assistant";
import { fail, ok, toErrorResponse } from "@/server/http";
import { createRateLimiter } from "@/server/rate-limit";

// Each question costs model tokens: 12 per 10 minutes per client address is plenty for a person, not for a script.
const limit = createRateLimiter(12, 10 * 60_000);

/** GET /api/v1/explain -> { live }: whether Live (Claude) mode is available on this deployment. Never cached. */
export async function GET() {
  await connection(); // read the environment at request time, not at build time
  return ok({ live: isConfigured() }, undefined, { cache: false });
}

/**
 * POST /api/v1/explain  { messages: [{ role, content }] }
 * Streams newline-delimited JSON events (ExplainEvent): text deltas, tool steps ("Read src/..."), then done or error.
 * The only non-GET, non-cached endpoint: answers depend on the conversation (docs/03 decision log).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "INVALID_QUERY", "Body must be JSON: { messages: [{ role, content }] }.");
  }
  const parsed = explainRequestSchema.safeParse(body);
  if (!parsed.success) return toErrorResponse(parsed.error);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const allowed = limit(ip);
  if (!allowed.ok) {
    const res = fail(429, "RATE_LIMITED", `Too many questions. Try again in ${allowed.retryAfter} s.`);
    res.headers.set("Retry-After", String(allowed.retryAfter));
    return res;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ExplainEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client went away: the abort signal stops the model call */
        }
      };
      await explain(parsed.data.messages, emit, req.signal);
      try {
        controller.close();
      } catch {
        /* already closed by a disconnect */
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
