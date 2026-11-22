// Leaderboards (docs/04 "Rankings", docs/05 /rankings/{board}). The same ranked lists feed the model detail rank chips,
// so a model page and its leaderboard can never disagree.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate, formatInteger, formatPrice, formatScore, formatTokens } from "@/lib/format";
import { competitionRanks } from "@/lib/ranking";
import type { RankingsQuery } from "@/lib/schemas";
import { CORE_BOARDS, type BoardInfo, type CoreBoard, type RankPosition, type Rankings } from "@/lib/types";
import { NotFoundError } from "../errors";
import { isoDate, listMeta, num } from "../mappers";
import { buildModelWhere, type ModelFilterInput } from "../model-where";
import { catalogCache, listItemsById, paginate } from "./common";

type Field = "providerCount" | "intelligenceIndex" | "valueScore" | "blendedPrice" | "contextWindow" | "releasedAt";

interface CoreBoardDef extends BoardInfo {
  field: Field;
  where: Prisma.ModelWhereInput;
}

export const BOARDS: Record<CoreBoard, CoreBoardDef> = {
  reach: {
    key: "reach",
    label: "Most available",
    measure: "Providers",
    unit: "providers",
    higherIsBetter: true,
    description: "Models served by the most API providers: a proxy for adoption and vendor choice.",
    field: "providerCount",
    where: { providerCount: { gte: 1 } },
  },
  intelligence: {
    key: "intelligence",
    label: "Intelligence",
    measure: "Intelligence Index",
    unit: "index",
    higherIsBetter: true,
    description: "Artificial Analysis Intelligence Index: a composite of reasoning, knowledge, math and coding evaluations.",
    field: "intelligenceIndex",
    where: { intelligenceIndex: { not: null } },
  },
  value: {
    key: "value",
    label: "Best value",
    measure: "Intelligence per $",
    unit: "pts/$",
    higherIsBetter: true,
    description: "Intelligence Index divided by blended price per 1M tokens. Higher means more capability per dollar.",
    field: "valueScore",
    where: { valueScore: { not: null } },
  },
  cheapest: {
    key: "cheapest",
    label: "Cheapest",
    measure: "Blended price",
    unit: "$/1M",
    higherIsBetter: false,
    description: "Lowest blended price, (3 × input + output) / 4 per 1M tokens. Free models are excluded; use the Free filter on Models.",
    field: "blendedPrice",
    where: { blendedPrice: { gt: 0 } },
  },
  context: {
    key: "context",
    label: "Longest context",
    measure: "Context window",
    unit: "tokens",
    higherIsBetter: true,
    description: "Largest context window in tokens.",
    field: "contextWindow",
    where: { contextWindow: { not: null } },
  },
  newest: {
    key: "newest",
    label: "Newest",
    measure: "Release date",
    unit: "date",
    higherIsBetter: true,
    description: "Most recently released models.",
    field: "releasedAt",
    where: { releasedAt: { not: null } },
  },
};

export const isCoreBoard = (board: string): board is CoreBoard => (CORE_BOARDS as readonly string[]).includes(board);

export interface RankedEntry {
  id: string;
  value: number | string; // string only for the date board
  rank: number;
  lab: { slug: string; name: string };
}

type RankFilters = Pick<ModelFilterInput, "lab" | "type" | "capability">;

/**
 * Every eligible model for a board, ranked within the filtered set (competition ranking: ties share a rank).
 * Deprecated models are excluded from all leaderboards (docs/03 log).
 * ponytail: ranks in memory over <= ~1k light rows per board; at 100x use RANK() OVER in SQL or a materialised view.
 */
export async function rankedEntries(board: string, filters: RankFilters): Promise<{ info: BoardInfo; entries: RankedEntry[] } | null> {
  "use cache";
  catalogCache();
  const modelWhere = buildModelWhere({ ...filters, includeDeprecated: false });

  if (isCoreBoard(board)) {
    const def = BOARDS[board];
    const order = def.higherIsBetter ? "desc" : "asc";
    const rows = await db.model.findMany({
      where: { AND: [modelWhere, def.where] },
      select: {
        id: true,
        providerCount: true,
        intelligenceIndex: true,
        valueScore: true,
        blendedPrice: true,
        contextWindow: true,
        releasedAt: true,
        lab: { select: { slug: true, name: true } },
      },
      orderBy: [{ [def.field]: order }, { id: "asc" }],
    });
    const raw = rows.map((r) => r[def.field]); // never null: def.where excludes nulls
    const numeric = raw.map((v) => (v instanceof Date ? v.getTime() : (num(v) ?? 0)));
    const ranks = competitionRanks(numeric, def.higherIsBetter);
    const { key, label, measure, unit, higherIsBetter, description } = def; // BoardInfo without the query internals
    return {
      info: { key, label, measure, unit, higherIsBetter, description },
      entries: rows.map((r, i) => ({
        id: r.id,
        value: raw[i] instanceof Date ? isoDate(raw[i] as Date)! : numeric[i],
        rank: ranks[i],
        lab: r.lab,
      })),
    };
  }

  const benchmark = await db.benchmark.findUnique({ where: { key: board } });
  if (!benchmark) return null;
  const scores = await db.benchmarkScore.findMany({
    where: { benchmarkId: benchmark.id, model: modelWhere },
    select: { value: true, model: { select: { id: true, lab: { select: { slug: true, name: true } } } } },
    orderBy: [{ value: benchmark.higherIsBetter ? "desc" : "asc" }, { modelId: "asc" }],
  });
  const ranks = competitionRanks(
    scores.map((s) => s.value),
    benchmark.higherIsBetter,
  );
  return {
    info: {
      key: benchmark.key,
      label: benchmark.name,
      measure: benchmark.unit === "elo" ? "Elo" : "Score",
      unit: benchmark.unit,
      higherIsBetter: benchmark.higherIsBetter,
      description: `${benchmark.group} · ${benchmark.name}${benchmark.unit === "elo" ? " (Elo rating from head-to-head votes)" : ""}.`,
    },
    entries: scores.map((s, i) => ({ id: s.model.id, value: s.value, rank: ranks[i], lab: s.model.lab })),
  };
}

export function valueLabel(info: BoardInfo, value: number | string): string {
  if (typeof value === "string") return formatDate(value);
  switch (info.unit) {
    case "providers":
      return `${formatInteger(value)} ${value === 1 ? "provider" : "providers"}`;
    case "$/1M":
      return formatPrice(value);
    case "tokens":
      return formatTokens(value);
    case "pts/$":
      return value.toFixed(1);
    case "elo":
      return formatScore(value, "elo");
    default:
      return formatScore(value);
  }
}

type RankingsPage = Rankings & { meta: ReturnType<typeof listMeta> };

// Errors thrown inside 'use cache' lose their class when they cross the cache boundary, so cached loaders return
// null and the exported wrapper turns that into a NotFoundError (-> 404).
export async function getRankings(board: string, query: RankingsQuery): Promise<RankingsPage> {
  const result = await loadRankings(board, query);
  if (!result) throw new NotFoundError(`Unknown board "${board}".`);
  return result;
}

async function loadRankings(board: string, query: RankingsQuery): Promise<RankingsPage | null> {
  "use cache";
  catalogCache();
  const ranked = await rankedEntries(board, { lab: query.lab, type: query.type, capability: query.capability });
  if (!ranked) return null;
  const { info, entries } = ranked;
  const pageEntries = paginate(entries, query.page, query.pageSize);
  const byId = await listItemsById(pageEntries.map((e) => e.id));

  const labCounts = new Map<string, { lab: { slug: string; name: string }; count: number }>();
  for (const e of entries.slice(0, 100)) {
    const cur = labCounts.get(e.lab.slug) ?? { lab: e.lab, count: 0 };
    cur.count++;
    labCounts.set(e.lab.slug, cur);
  }

  return {
    board: info,
    rows: pageEntries.flatMap((e) => {
      const model = byId.get(e.id);
      return model ? [{ rank: e.rank, model, value: e.value, valueLabel: valueLabel(info, e.value) }] : [];
    }),
    labTop: [...labCounts.values()].sort((a, b) => b.count - a.count || a.lab.name.localeCompare(b.lab.name)),
    best: typeof entries[0]?.value === "number" ? entries[0].value : null,
    meta: listMeta(query.page, query.pageSize, entries.length),
  };
}

/** Rank chips for the model detail page: position on each core board (unfiltered), or null when not eligible. */
export async function coreRanksFor(modelId: string): Promise<Record<CoreBoard, RankPosition>> {
  const boards = await Promise.all(CORE_BOARDS.map((b) => rankedEntries(b, {})));
  return Object.fromEntries(
    CORE_BOARDS.map((b, i) => {
      const entries = boards[i]?.entries ?? [];
      const entry = entries.find((e) => e.id === modelId);
      return [b, entry ? { rank: entry.rank, of: entries.length } : null];
    }),
  ) as Record<CoreBoard, RankPosition>;
}
