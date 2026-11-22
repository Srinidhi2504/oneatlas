// API DTOs: the contract in docs/05-api-spec.md. Shared by services (server), route handlers and the client.
// Every value is JSON-safe: Decimal -> number, Date -> "YYYY-MM-DD" string (done in src/server/mappers.ts).

export const MODEL_TYPES = ["text", "image", "video", "embedding", "speech", "transcription", "rerank", "realtime"] as const;
export type ModelType = (typeof MODEL_TYPES)[number];

export const MODALITIES = ["text", "image", "audio", "video", "pdf"] as const;
export type Modality = (typeof MODALITIES)[number];

export const CAPABILITIES = ["reasoning", "tools", "structured", "vision", "open", "free"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CORE_BOARDS = ["reach", "intelligence", "value", "cheapest", "context", "newest"] as const;
export type CoreBoard = (typeof CORE_BOARDS)[number];

export interface Pricing {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
  blended: number | null;
  isFree: boolean;
}

export interface ModelListItem {
  id: string; // "lab/slug"
  slug: string;
  name: string;
  lab: { slug: string; name: string };
  type: ModelType;
  releasedAt: string | null;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  inputModalities: Modality[];
  outputModalities: Modality[];
  capabilities: { reasoning: boolean; toolCall: boolean; structuredOutput: boolean; vision: boolean; openWeights: boolean };
  pricing: Pricing;
  intelligenceIndex: number | null;
  providerCount: number;
  deprecated: boolean;
}

export interface BenchmarkResult {
  key: string;
  name: string;
  group: string;
  category: string;
  unit: "index" | "elo";
  value: number;
  winRate: number | null;
  rank: number;
  ofTotal: number;
}

export interface ProviderListing {
  provider: { slug: string; name: string };
  providerModelId: string;
  contextWindow: number | null;
  inputLimit: number | null;
  maxOutputTokens: number | null;
  pricing: { input: number | null; output: number | null; reasoning: number | null; cacheRead: number | null; cacheWrite: number | null };
  flags: { reasoning: boolean | null; toolCall: boolean | null; structuredOutput: boolean | null; temperature: boolean | null };
  status: string | null;
  updatedAt: string | null;
}

export type RankPosition = { rank: number; of: number } | null;

export interface ModelDetail extends ModelListItem {
  description: string | null;
  family: string | null;
  knowledgeCutoff: string | null;
  benchmarks: BenchmarkResult[];
  listings: ProviderListing[];
  providerPriceRange: { minInput: number | null; maxInput: number | null };
  ranks: Record<CoreBoard, RankPosition>;
}

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: ListMeta;
}

export interface CompareResult {
  models: ModelDetail[];
  benchmarkKeys: string[];
}

export interface SearchResult {
  models: { id: string; name: string; labName: string; type: ModelType }[];
  labs: { slug: string; name: string; modelCount: number }[];
  providers: { slug: string; name: string; modelCount: number }[];
}

export interface FacetCount {
  slug: string;
  name: string;
  count: number;
}

export interface Facets {
  labs: FacetCount[];
  providers: FacetCount[];
  types: { value: ModelType; count: number }[];
  capabilities: Record<Capability, number>;
  inputModalities: { value: Modality; count: number }[];
  ranges: { maxContext: number | null; maxBlendedPrice: number | null };
}

export interface Stats {
  models: number;
  labs: number;
  providers: number;
  listings: number;
  openWeights: number;
  coverage: { toolCall: number; reasoning: number; vision: number; openWeights: number };
  updatedAt: string | null;
}

export interface LabSummary {
  slug: string;
  name: string;
  modelCount: number;
  openWeightsCount: number;
  latestRelease: { name: string; slug: string; releasedAt: string | null } | null;
}

export interface LabDetail {
  slug: string;
  name: string;
  stats: { modelCount: number; openWeightsCount: number; providerCount: number; benchmarkedCount: number; latestReleaseAt: string | null };
  models: ModelListItem[];
  providers: FacetCount[];
}

export interface ProviderSummary {
  slug: string;
  name: string;
  modelCount: number;
  labSlug: string | null;
  docUrl: string | null;
}

export interface ProviderModelRow {
  model: ModelListItem;
  providerModelId: string;
  pricing: { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null };
  contextWindow: number | null;
  maxOutputTokens: number | null;
  status: string | null;
}

export interface ProviderDetail {
  slug: string;
  name: string;
  apiUrl: string | null;
  docUrl: string | null;
  lab: { slug: string; name: string } | null;
  modelCount: number;
  listingCount: number;
}

export interface BoardInfo {
  key: string;
  label: string;
  measure: string;
  unit: string;
  higherIsBetter: boolean;
  description: string;
}

export interface RankingRow {
  rank: number;
  model: ModelListItem;
  value: number | string;
  valueLabel: string;
}

export interface Rankings {
  board: BoardInfo;
  rows: RankingRow[];
  labTop: { lab: { slug: string; name: string }; count: number }[];
  /** best measure value in the filtered set (for relative score bars); null for date boards */
  best: number | null;
}

export interface BenchmarkInfo {
  key: string;
  name: string;
  group: string;
  category: string;
  unit: "index" | "elo";
  higherIsBetter: boolean;
}

export interface BenchmarkSummary extends BenchmarkInfo {
  scoredCount: number;
  top: { model: { id: string; name: string }; value: number } | null;
}

export interface MatrixRow {
  model: ModelListItem;
  scores: Record<string, { value: number; rank: number } | null>;
  blendedPrice: number | null;
}

export interface Matrix {
  benchmarks: BenchmarkInfo[];
  rows: MatrixRow[];
  best: Record<string, number>;
}

export interface ApiError {
  error: { code: "INVALID_QUERY" | "NOT_FOUND" | "INTERNAL"; message: string; details?: unknown };
}
