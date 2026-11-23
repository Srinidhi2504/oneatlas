"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Trophy, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { ScoreBar, PriceCell } from "@/components/models/bits";
import { isPastEnd, Pagination, PastEnd } from "@/components/ui/Pagination";
import { Button, LabAvatar, Panel, StateMessage } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatInteger, formatTokens } from "@/lib/format";
import { MEDAL, TONE } from "@/lib/tones";
import { Podium } from "./Podium";
import { rankingApiQuery, rankingParsers, serializeRankingFilters } from "./state";
import { CAPABILITIES, MODEL_TYPES, type Capability, type ListMeta, type Rankings } from "@/lib/types";

export type RankingsPage = Rankings & { meta: ListMeta };

const CAP_LABEL: Record<Capability, string> = {
  reasoning: "Reasoning",
  tools: "Tool calling",
  structured: "Structured output",
  vision: "Vision",
  open: "Open weights",
  free: "Free",
};

export interface BoardLink {
  key: string;
  label: string;
  group?: string;
}

export function RankingsView({
  board,
  initial,
  initialQs,
  coreBoards,
  benchmarkBoards,
  labs,
}: {
  board: string;
  initial: RankingsPage | null;
  initialQs: string;
  coreBoards: BoardLink[];
  benchmarkBoards: BoardLink[];
  labs: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [state, setState] = useQueryStates(rankingParsers, { history: "push", scroll: false });
  const qs = rankingApiQuery(state);
  const query = useQuery({
    queryKey: ["rankings", board, qs],
    queryFn: ({ signal }): Promise<RankingsPage> => api.rankings(board, qs, signal).then((r) => ({ ...r.data, meta: r.meta! })),
    initialData: qs === initialQs && initial ? initial : undefined,
    placeholderData: keepPreviousData,
  });
  const filterQs = serializeRankingFilters({ ...state, page: null });
  const data = query.data;
  const isBenchmark = !coreBoards.some((b) => b.key === board);

  const barFor = (value: number | string) => {
    if (typeof value !== "number" || !data?.best) return null;
    // lower-is-better boards (cheapest): the best (smallest) value gets the full bar
    return data.board.higherIsBetter ? { value, best: data.best } : { value: data.best, best: value };
  };

  return (
    <div className="space-y-5">
      {/* board tabs */}
      <nav aria-label="Leaderboards" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-border">
          {coreBoards.map((b) => {
            const active = b.key === board;
            return (
              <li key={b.key}>
                <Link
                  href={`/rankings/${b.key}${filterQs}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px flex h-10 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors",
                    active ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg",
                  )}
                >
                  {b.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <SelectMenu
          label="Benchmark"
          value={isBenchmark ? board : "none"}
          onValueChange={(v) => v !== "none" && router.push(`/rankings/${v}${filterQs}`)}
          options={[{ value: "none", label: "Pick a benchmark" }, ...benchmarkBoards.map((b) => ({ value: b.key, label: b.group === "Design Arena" ? `${b.label} (Design Arena)` : b.label }))]}
          className="max-w-full"
        />
        <SelectMenu
          label="Lab"
          value={state.lab[0] ?? "all"}
          onValueChange={(v) => setState({ lab: v === "all" ? null : [v], page: null })}
          options={[{ value: "all", label: "All labs" }, ...labs.map((l) => ({ value: l.slug, label: l.name }))]}
        />
        <SelectMenu
          label="Type"
          value={state.type[0] ?? "all"}
          onValueChange={(v) => setState({ type: v === "all" ? null : [v as (typeof MODEL_TYPES)[number]], page: null })}
          options={[{ value: "all", label: "All types" }, ...MODEL_TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))]}
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Capability filters">
        {CAPABILITIES.map((c) => {
          const active = state.capability.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => setState({ capability: active ? state.capability.filter((x) => x !== c) : [...state.capability, c], page: null })}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-13 transition-colors",
                active ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {CAP_LABEL[c]}
            </button>
          );
        })}
      </div>

      {data ? (
        <div className="max-w-[72ch] text-13 text-muted">
          <span className="font-medium text-fg">{data.board.label}.</span> {data.board.description}
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative min-w-0">
          <div className="absolute inset-x-0 -top-2 h-0.5 overflow-hidden" aria-hidden>
            {query.isFetching && data ? <div className="h-full w-1/3 animate-progress bg-accent" /> : null}
          </div>
          {query.isError && !data ? (
            <Panel>
              <StateMessage icon={<TriangleAlert />} title="Couldn’t load this leaderboard" action={<Button onClick={() => query.refetch()}>Retry</Button>}>
                {query.error.message}
              </StateMessage>
            </Panel>
          ) : data && isPastEnd(data.meta, data.rows.length) ? (
            <Panel>
              <PastEnd meta={data.meta} onPage={(p) => setState({ page: p === 1 ? null : p })} />
            </Panel>
          ) : data && !data.rows.length ? (
            <Panel>
              <StateMessage icon={<Trophy />} title="No ranked models for these filters" action={<Button onClick={() => setState({ lab: null, type: null, capability: null, page: null })}>Clear filters</Button>}>
                Only models with a known {data.board.measure.toLowerCase()} appear on this board.
              </StateMessage>
            </Panel>
          ) : data ? (
            <>
              {data.meta.page === 1 ? (
                <div key={`${board}:${qs}`} className="mb-6 px-2 pt-4">
                  <Podium rows={data.rows} />
                </div>
              ) : null}
              <div className={cn("relative overflow-x-auto rounded-[var(--radius-panel)] border border-border transition-opacity", query.isFetching && "opacity-60")} role="region" aria-label="Leaderboard, scrolls horizontally" tabIndex={0}>
                <table className="w-full min-w-[640px] border-collapse text-13">
                  <caption className="sr-only">{data.board.label} leaderboard</caption>
                  <thead className="bg-surface">
                    <tr className="border-b border-border text-xs text-muted">
                      <th scope="col" className="h-10 w-14 px-3 text-right font-medium">Rank</th>
                      <th scope="col" className="h-10 px-3 text-left font-medium">Model</th>
                      <th scope="col" className="h-10 w-[34%] px-3 text-left font-medium">{data.board.measure}</th>
                      <th scope="col" className="h-10 px-3 text-right font-medium">Price /1M</th>
                      <th scope="col" className="h-10 px-3 text-right font-medium">Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => {
                      const bar = barFor(r.value);
                      return (
                        <tr key={r.model.id} className="h-14 border-b border-border last:border-b-0 hover:bg-surface">
                          <td className={cn("px-3 text-right font-semibold", r.rank <= 3 ? TONE[MEDAL[r.rank]].text : "text-muted")}>{r.rank}</td>
                          <th scope="row" className="px-3 text-left font-normal">
                            <span className="flex items-center gap-2.5">
                              <LabAvatar slug={r.model.lab.slug} name={r.model.lab.name} />
                              <span className="min-w-0">
                                <Link href={`/models/${r.model.id}`} className="block truncate font-medium hover:text-accent">
                                  {r.model.name}
                                </Link>
                                <span className="block truncate text-xs text-muted">{r.model.lab.name}</span>
                              </span>
                            </span>
                          </th>
                          <td className="px-3">
                            <span className="flex items-center gap-3">
                              <span className="w-20 shrink-0 font-semibold">{r.valueLabel}</span>
                              {bar ? <ScoreBar value={bar.value} best={bar.best} label={`${r.model.name}: ${r.valueLabel}`} /> : null}
                            </span>
                          </td>
                          <td className="px-3 text-right">
                            <PriceCell pricing={r.model.pricing} />
                          </td>
                          <td className="px-3 text-right text-muted">{formatTokens(r.model.contextWindow)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination meta={data.meta} onPage={(p) => setState({ page: p === 1 ? null : p })} />
            </>
          ) : null}
        </div>

        <aside aria-labelledby="labtop" className="reveal-3d">
          <Panel className="p-4">
            <h2 id="labtop" className="text-sm">
              Labs in the top 100
            </h2>
            <p className="mt-0.5 text-xs text-faint">Models each lab places in the first 100 of this board</p>
            <ol className="mt-3 space-y-1.5">
              {(data?.labTop ?? []).slice(0, 12).map((l) => {
                const max = data!.labTop[0].count;
                return (
                  <li key={l.lab.slug}>
                    <button
                      type="button"
                      onClick={() => setState({ lab: [l.lab.slug], page: null })}
                      className="group w-full rounded-[var(--radius-control)] px-1.5 py-1 text-left hover:bg-surface-2"
                      aria-label={`Filter to ${l.lab.name} ${l.count} models in the top 100`}
                    >
                      <span className="flex items-baseline justify-between text-13">
                        <span className="truncate group-hover:text-accent">{l.lab.name}</span>
                        <span className="font-medium">{formatInteger(l.count)}</span>
                      </span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-[2px] bg-bar-track">
                        <span className="block h-full bg-bar" style={{ width: `${(l.count / max) * 100}%` }} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
