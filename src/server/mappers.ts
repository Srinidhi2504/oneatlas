// Prisma rows -> API DTOs. The ONLY place Decimal becomes number and Date becomes "YYYY-MM-DD",
// so cached service results are plain JSON (a 'use cache' requirement) and the client never sees Prisma types.
import type { Prisma } from "@/generated/prisma/client";
import type { ListMeta, Modality, ModelListItem, ModelType } from "@/lib/types";

type DecimalLike = { toNumber(): number } | number | null;

export const num = (d: DecimalLike): number | null => (d == null ? null : typeof d === "number" ? d : d.toNumber());
export const isoDate = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/** Columns needed for a ModelListItem: list queries select only these (no description, no listings). */
export const modelListSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  releasedAt: true,
  contextWindow: true,
  maxOutputTokens: true,
  inputModalities: true,
  outputModalities: true,
  reasoning: true,
  toolCall: true,
  structuredOutput: true,
  vision: true,
  openWeights: true,
  inputPrice: true,
  outputPrice: true,
  cacheReadPrice: true,
  cacheWritePrice: true,
  blendedPrice: true,
  isFree: true,
  intelligenceIndex: true,
  providerCount: true,
  deprecated: true,
  lab: { select: { slug: true, name: true } },
} satisfies Prisma.ModelSelect;

export type ModelListRow = Prisma.ModelGetPayload<{ select: typeof modelListSelect }>;

export function toModelListItem(m: ModelListRow): ModelListItem {
  return {
    id: `${m.lab.slug}/${m.slug}`,
    slug: m.slug,
    name: m.name,
    lab: { slug: m.lab.slug, name: m.lab.name },
    type: m.type.toLowerCase() as ModelType,
    releasedAt: isoDate(m.releasedAt),
    contextWindow: m.contextWindow,
    maxOutputTokens: m.maxOutputTokens,
    inputModalities: m.inputModalities as Modality[],
    outputModalities: m.outputModalities as Modality[],
    capabilities: {
      reasoning: m.reasoning,
      toolCall: m.toolCall,
      structuredOutput: m.structuredOutput,
      vision: m.vision,
      openWeights: m.openWeights,
    },
    pricing: {
      input: num(m.inputPrice),
      output: num(m.outputPrice),
      cacheRead: num(m.cacheReadPrice),
      cacheWrite: num(m.cacheWritePrice),
      blended: num(m.blendedPrice),
      isFree: m.isFree,
    },
    intelligenceIndex: m.intelligenceIndex,
    providerCount: m.providerCount,
    deprecated: m.deprecated,
  };
}

export const listMeta = (page: number, pageSize: number, total: number): ListMeta => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
