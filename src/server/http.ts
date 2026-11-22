// Route-handler plumbing: success/error envelopes, cache headers, and one wrapper that maps every failure
// to the error contract in docs/05. Prisma/Postgres messages never reach the client.
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { paramsToObject } from "@/lib/schemas";
import type { ApiError, ListMeta } from "@/lib/types";
import { NotFoundError } from "./errors";

const CACHE_OK = "public, s-maxage=300, stale-while-revalidate=3600";

export function ok<T>(data: T, meta?: ListMeta, init?: { cache?: false }) {
  return Response.json(meta ? { data, meta } : { data }, {
    headers: { "Cache-Control": init?.cache === false ? "no-store" : CACHE_OK },
  });
}

export function fail(status: number, code: ApiError["error"]["code"], message: string, details?: unknown) {
  const body: ApiError = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function toErrorResponse(err: unknown) {
  if (err instanceof z.ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
    return fail(400, "INVALID_QUERY", "One or more query parameters are invalid.", details);
  }
  if (err instanceof NotFoundError) return fail(404, "NOT_FOUND", err.message);
  const requestId = crypto.randomUUID();
  console.error(`[api] request ${requestId} failed:`, err);
  return fail(500, "INTERNAL", `Something went wrong on our side. Reference: ${requestId}`);
}

/** Wrap a GET handler: any thrown ZodError / NotFoundError / unknown error becomes the matching envelope. */
export function handler<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      unstable_rethrow(err); // let Next's own control-flow errors (prerender interruption, notFound) pass through
      return toErrorResponse(err);
    }
  };
}

/** Query string -> plain object for the Zod schemas (repeated keys joined as CSV). */
export const queryOf = (req: Request) => paramsToObject(new URL(req.url).searchParams);
