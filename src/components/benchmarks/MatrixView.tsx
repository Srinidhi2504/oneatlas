"use client";
import * as Popover from "@radix-ui/react-popover";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, Columns3, Table2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { isPastEnd, Pagination, PastEnd } from "@/components/ui/Pagination";
import { Button, buttonClass, LabAvatar, Panel, StateMessage } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPrice, formatScore } from "@/lib/format";
import { MODEL_TYPES, type BenchmarkSummary, type ListMeta, type Matrix } from "@/lib/types";
import { matrixApiQuery, matrixParsers } from "./state";

export type MatrixPage = Matrix & { meta: ListMeta };

export function MatrixView({
  initial,
  initialQs,
  catalogue,
  labs,
}: {
  initial: MatrixPage | null;
  initialQs: string;
  catalogue: BenchmarkSummary[];
  labs: { slug: string; name: string }[];
}) {
  const [state, setState] = useQueryStates(matrixParsers, { history: "push", scroll: false });
  const qs = matrixApiQuery(state);
  const query = useQuery({
    queryKey: ["matrix", qs],
    queryFn: ({ signal }): Promise<MatrixPage> => api.matrix(qs, signal).then((r) => ({ ...r.data, meta: r.meta! })),
    initialData: qs === initialQs && initial ? initial : undefined,
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const shownKeys = data?.benchmarks.map((b) => b.key) ?? [];

  const toggleKey = (key: string) => {
    const next = shownKeys.includes(key) ? shownKeys.filter((k) => k !== key) : [...shownKeys, key].slice(0, 12);
    setState({ keys: next.length ? next : null, page: null });
  };
  const sortBy = (key: string) => setState({ keys: [key, ...shownKeys.filter((k) => k !== key)], page: null });
  const groups = [...new Set(catalogue.map((b) => b.group))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Popover.Root>
          <Popover.Trigger className={buttonClass("secondary", "md")}>
            <Columns3 aria-hidden />
            Columns ({shownKeys.length})
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={6} className="z-50 max-h-[min(480px,70vh)] w-[min(340px,calc(100vw-32px))] overflow-y-auto rounded-[var(--radius-panel)] border border-border bg-bg p-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
              {groups.map((g) => (
                <fieldset key={g} className="mb-3 last:mb-0">
                  <legend className="mb-1 text-xs font-medium text-muted">{g}</legend>
                  {catalogue
                    .filter((b) => b.group === g)
                    .map((b) => {
                      const checked = shownKeys.includes(b.key);
                      const disabled = !checked && shownKeys.length >= 12;
                      return (
                        <label key={b.key} className={cn("flex h-8 cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-1.5 text-13 hover:bg-surface-2", disabled && "cursor-not-allowed opacity-45")}>
                          <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleKey(b.key)} className="size-3.5 accent-[var(--accent)]" />
                          <span className="flex-1 truncate">
                            {b.name}
                            {b.category === "design-agents" ? <span className="ml-1 text-xs text-faint">agents</span> : null}
                          </span>
                          <span className="text-xs text-faint">{b.scoredCount}</span>
                        </label>
                      );
                    })}
                </fieldset>
              ))}
              <button type="button" onClick={() => setState({ keys: null, page: null })} className="mt-1 px-1.5 text-13 font-medium text-accent hover:underline">
                Reset to default columns
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
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
        <p className="text-13 text-muted sm:ml-auto">Sorted by the first column. Click a column name to sort by it.</p>
      </div>

      {query.isError && !data ? (
        <Panel>
          <StateMessage icon={<TriangleAlert />} title="Couldn’t load the matrix" action={<Button onClick={() => query.refetch()}>Retry</Button>}>
            {query.error.message}
          </StateMessage>
        </Panel>
      ) : data && isPastEnd(data.meta, data.rows.length) ? (
        <Panel>
          <PastEnd meta={data.meta} onPage={(p) => setState({ page: p === 1 ? null : p })} />
        </Panel>
      ) : data && !data.rows.length ? (
        <Panel>
          <StateMessage icon={<Table2 />} title="No scored models for these filters" action={<Button onClick={() => setState({ lab: null, type: null, page: null })}>Clear filters</Button>}>
            None of the selected benchmarks has a score for a model matching the lab and type filters.
          </StateMessage>
        </Panel>
      ) : data ? (
        <>
          <div className={cn("relative max-h-[75vh] overflow-auto rounded-[var(--radius-panel)] border border-border transition-opacity", query.isFetching && "opacity-60")} role="region" aria-label="Benchmark score matrix, scrolls in both directions" tabIndex={0}>
            <table className="w-full border-collapse text-13" style={{ minWidth: 260 + data.benchmarks.length * 120 }}>
              <caption className="sr-only">Benchmark scores per model; the best score in each column is marked “highest”</caption>
              <thead className="sticky top-0 z-20 bg-surface">
                <tr className="border-b border-border">
                  <th scope="col" className="sticky left-0 z-30 h-12 w-[240px] bg-surface px-3 text-left text-xs font-medium text-muted">
                    Model
                  </th>
                  {data.benchmarks.map((b, i) => (
                    <th key={b.key} scope="col" aria-sort={i === 0 ? "descending" : undefined} className="h-12 min-w-[112px] px-3 text-right align-bottom text-xs font-medium text-muted">
                      <button type="button" onClick={() => sortBy(b.key)} className={cn("inline-flex items-center gap-1 pb-1 text-right hover:text-fg", i === 0 && "text-fg")} title={`${b.group}: sort by ${b.name}`}>
                        {i === 0 ? <ArrowDown className="size-3 shrink-0" aria-hidden /> : null}
                        <span className="line-clamp-2">{b.name}</span>
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="h-12 px-3 text-right align-bottom text-xs font-medium text-muted">
                    <span className="block pb-1">Blended /1M</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.model.id} className="h-12 border-b border-border last:border-b-0 hover:bg-surface">
                    <th scope="row" className="sticky left-0 z-10 bg-bg px-3 text-left font-normal">
                      <span className="flex items-center gap-2">
                        <LabAvatar slug={r.model.lab.slug} name={r.model.lab.name} size={24} />
                        <span className="min-w-0">
                          <Link href={`/models/${r.model.id}`} className="block max-w-[180px] truncate font-medium hover:text-accent">
                            {r.model.name}
                          </Link>
                        </span>
                      </span>
                    </th>
                    {data.benchmarks.map((b) => {
                      const s = r.scores[b.key];
                      const best = s != null && data.best[b.key] === s.value;
                      return (
                        <td key={b.key} className={cn("px-3 text-right", best && "bg-accent-soft font-semibold text-accent")}>
                          {s ? (
                            <>
                              {formatScore(s.value, b.unit)}
                              <span className={cn("ml-1 text-[11px] font-normal", best ? "text-accent" : "text-faint")}>#{s.rank}</span>
                              {best ? <span className="sr-only"> (highest)</span> : null}
                            </>
                          ) : (
                            <span className="text-faint" aria-label="not scored">
                              ·
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 text-right text-muted">{formatPrice(r.blendedPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} onPage={(p) => setState({ page: p === 1 ? null : p })} />
        </>
      ) : null}
    </div>
  );
}
