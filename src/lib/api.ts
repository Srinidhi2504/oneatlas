// Typed client for /api/v1 (browser side). Responses are trusted to match src/lib/types.ts (same repo, same contract),
// so there is no Zod here; an `error` envelope or a non-2xx status throws ApiRequestError.
import type {
  ApiError,
  CompareResult,
  Facets,
  ListMeta,
  Matrix,
  ModelListItem,
  ProviderDetail,
  ProviderModelRow,
  Rankings,
  SearchResult,
} from "./types";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export interface ApiResponse<T> {
  data: T;
  meta?: ListMeta;
}

export async function apiGet<T>(path: string, query?: string | URLSearchParams, signal?: AbortSignal): Promise<ApiResponse<T>> {
  const qs = query ? `?${String(query).replace(/^\?/, "")}` : "";
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}${qs}`, { signal, headers: { accept: "application/json" } });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiRequestError("Network error: check your connection and try again.", 0, "NETWORK");
  }
  const body = (await res.json().catch(() => null)) as (ApiResponse<T> & Partial<ApiError>) | null;
  if (!res.ok || !body || body.error) {
    throw new ApiRequestError(body?.error?.message ?? `Request failed (${res.status}).`, res.status, body?.error?.code ?? "INTERNAL");
  }
  return body;
}

export const api = {
  models: (qs: string, signal?: AbortSignal) => apiGet<ModelListItem[]>("/models", qs, signal),
  facets: (qs: string, signal?: AbortSignal) => apiGet<Facets>("/facets", qs, signal),
  search: (q: string, signal?: AbortSignal) => apiGet<SearchResult>("/search", new URLSearchParams({ q, limit: "8" }), signal),
  compare: (ids: string[], signal?: AbortSignal) => apiGet<CompareResult>("/compare", new URLSearchParams({ ids: ids.join(",") }), signal),
  rankings: (board: string, qs: string, signal?: AbortSignal) => apiGet<Rankings>(`/rankings/${encodeURIComponent(board)}`, qs, signal),
  matrix: (qs: string, signal?: AbortSignal) => apiGet<Matrix>("/benchmarks/matrix", qs, signal),
  provider: (slug: string, qs: string, signal?: AbortSignal) =>
    apiGet<{ provider: ProviderDetail; listings: ProviderModelRow[] }>(`/providers/${encodeURIComponent(slug)}`, qs, signal),
};
