"use client";
// Compare table: grouped rows, best value per row (labelled, not colour only), differences-only toggle, add/remove models.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, GitCompareArrows, Minus, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ScoreBar } from "@/components/models/bits";
import { ModelPicker } from "@/components/models/ModelPicker";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { Badge, Button, LabAvatar, Panel, Skeleton, StateMessage } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { COMPARE_MAX, replaceCompareList, useCompareList } from "@/lib/compare-store";
import { formatDate, formatInteger, formatPrice, formatScore, formatTokens } from "@/lib/format";
import type { CompareResult, ModelDetail } from "@/lib/types";
import { CostCalculator } from "./CostCalculator";

type Better = "high" | "low";
interface RowDef {
  group: string;
  label: string;
  /** numeric value used for "best" and difference detection; null = unknown */
  num?: (m: ModelDetail) => number | null;
  /** comparable key for "differences only" when there is no number */
  key?: (m: ModelDetail) => string;
  render: (m: ModelDetail, best: boolean) => ReactNode;
  better?: Better;
}

const yesNo = (on: boolean) =>
  on ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check className="size-3.5" aria-hidden />
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-faint">
      <Minus className="size-3.5" aria-hidden />
      No
    </span>
  );

const capRow = (label: string, pick: (m: ModelDetail) => boolean): RowDef => ({
  group: "Capabilities",
  label,
  key: (m) => String(pick(m)),
  render: (m) => yesNo(pick(m)),
});

const priceRow = (label: string, pick: (m: ModelDetail) => number | null): RowDef => ({
  group: "Pricing (USD per 1M tokens)",
  label,
  num: pick,
  better: "low",
  render: (m) => formatPrice(pick(m)),
});

const BASE_ROWS: RowDef[] = [
  { group: "Overview", label: "Lab", key: (m) => m.lab.slug, render: (m) => <Link className="hover:text-accent" href={`/labs/${m.lab.slug}`}>{m.lab.name}</Link> },
  { group: "Overview", label: "Type", key: (m) => m.type, render: (m) => m.type[0].toUpperCase() + m.type.slice(1) },
  { group: "Overview", label: "Released", key: (m) => m.releasedAt ?? "", render: (m) => formatDate(m.releasedAt) },
  { group: "Overview", label: "Providers", num: (m) => m.providerCount, better: "high", render: (m) => formatInteger(m.providerCount) },
  priceRow("Input", (m) => m.pricing.input),
  priceRow("Output", (m) => m.pricing.output),
  priceRow("Blended (3:1)", (m) => m.pricing.blended),
  priceRow("Cache read", (m) => m.pricing.cacheRead),
  priceRow("Cache write", (m) => m.pricing.cacheWrite),
  { group: "Context", label: "Context window", num: (m) => m.contextWindow, better: "high", render: (m) => formatTokens(m.contextWindow) },
  { group: "Context", label: "Max output", num: (m) => m.maxOutputTokens, better: "high", render: (m) => formatTokens(m.maxOutputTokens) },
  capRow("Reasoning", (m) => m.capabilities.reasoning),
  capRow("Tool calling", (m) => m.capabilities.toolCall),
  capRow("Structured output", (m) => m.capabilities.structuredOutput),
  capRow("Vision", (m) => m.capabilities.vision),
  capRow("Open weights", (m) => m.capabilities.openWeights),
  { group: "Capabilities", label: "Input", key: (m) => m.inputModalities.join(","), render: (m) => m.inputModalities.join(", ") || "N/A" },
  { group: "Capabilities", label: "Output", key: (m) => m.outputModalities.join(","), render: (m) => m.outputModalities.join(", ") || "N/A" },
];

function benchmarkRows(data: CompareResult): RowDef[] {
  return data.benchmarkKeys.map((key) => {
    const meta = data.models.flatMap((m) => m.benchmarks).find((b) => b.key === key)!;
    const pick = (m: ModelDetail) => m.benchmarks.find((b) => b.key === key) ?? null;
    return {
      group: "Benchmarks",
      label: meta.name + (meta.group === "Design Arena" ? " (Design Arena)" : ""),
      num: (m) => pick(m)?.value ?? null,
      better: "high",
      render: (m) => {
        const b = pick(m);
        if (!b) return <span className="text-faint">Not scored</span>;
        return (
          <span className="block w-full max-w-[220px]">
            <span className="flex items-baseline justify-between gap-2">
              <span>{formatScore(b.value, b.unit)}</span>
              <span className="text-xs text-faint">
                #{b.rank} of {b.ofTotal}
              </span>
            </span>
            <ScoreBar value={b.value} best={b.best} className="mt-1" label={`${meta.name} relative to the best model`} />
          </span>
        );
      },
    };
  });
}

/** Index of the best numeric value per row (ties: all of them); none when fewer than 2 values are known. */
function bestIndexes(row: RowDef, models: ModelDetail[]): Set<number> {
  if (!row.num || !row.better) return new Set();
  const values = models.map((m) => row.num!(m));
  // a free (0) price is a real best; unknowns never win
  const known = values.filter((v): v is number => v != null);
  if (known.length < 2) return new Set();
  const target = row.better === "high" ? Math.max(...known) : Math.min(...known);
  if (known.every((v) => v === target)) return new Set();
  return new Set(values.flatMap((v, i) => (v === target ? [i] : [])));
}

export function CompareView({ initial, initialIds }: { initial: CompareResult | null; initialIds: string[] }) {
  const [ids, setIds] = useQueryState("ids", parseAsArrayOf(parseAsString).withDefault([]).withOptions({ history: "push" }));
  const [diffOnly, setDiffOnly] = useState(false);
  const store = useCompareList();
  const valid = ids.length >= 2 && ids.length <= COMPARE_MAX;
  const key = ids.join(",");

  const query = useQuery({
    queryKey: ["compare", key],
    queryFn: ({ signal }) => api.compare(ids, signal).then((r) => r.data),
    enabled: valid,
    initialData: key === initialIds.join(",") && initial ? initial : undefined,
    placeholderData: keepPreviousData,
  });

  // the URL is the source of truth on this page: mirror it into the tray selection
  const data = valid ? query.data : undefined;
  useEffect(() => {
    if (data) replaceCompareList(data.models.map((m) => ({ id: m.id, name: m.name, labName: m.lab.name })));
  }, [data]);

  const rows = useMemo(() => (data ? [...BASE_ROWS, ...benchmarkRows(data)] : []), [data]);

  const remove = (id: string) => setIds(ids.filter((x) => x !== id).length ? ids.filter((x) => x !== id) : null);
  const add = (id: string) => setIds([...ids.filter((x) => x !== id), id].slice(0, COMPARE_MAX));

  if (!valid) {
    const fromTray = store.items.map((i) => i.id);
    return (
      <Panel>
        <StateMessage
          icon={<GitCompareArrows />}
          title={ids.length > COMPARE_MAX ? `Compare up to ${COMPARE_MAX} models at a time` : "Pick 2 to 4 models to compare"}
          action={
            <>
              {fromTray.length >= 2 ? <Button variant="primary" onClick={() => setIds(fromTray)}>Compare your {fromTray.length} selected models</Button> : null}
              <ModelPicker exclude={ids} onPick={(m) => add(m.id)} label={ids.length ? "Add another model" : "Add a model"} variant={fromTray.length >= 2 ? "secondary" : "primary"} />
            </>
          }
        >
          {ids.length === 1 ? (
            <>Selected so far: <span className="font-medium text-fg">{ids[0]}</span>. Add one more.</>
          ) : (
            <>Search for models here, or tick the checkbox next to models in the explorer. The comparison URL is shareable.</>
          )}
        </StateMessage>
      </Panel>
    );
  }

  if (query.isError && !data)
    return (
      <Panel>
        <StateMessage
          icon={<TriangleAlert />}
          title="Couldn’t load this comparison"
          action={
            <>
              <Button onClick={() => query.refetch()}>Retry</Button>
              <Button variant="ghost" onClick={() => setIds(null)}>Start over</Button>
            </>
          }
        >
          {query.error.message}
        </StateMessage>
      </Panel>
    );

  if (!data) return <CompareSkeleton cols={ids.length} />;

  const models = data.models;
  const visible = rows.filter((r) => {
    if (!diffOnly) return true;
    const keys = models.map((m) => (r.num ? String(r.num(m)) : r.key ? r.key(m) : ""));
    return new Set(keys).size > 1;
  });
  const groups = [...new Set(visible.map((r) => r.group))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-border px-3 text-13 hover:border-border-strong">
          <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} className="size-3.5 accent-[var(--accent)]" />
          Show differences only
        </label>
        {models.length < COMPARE_MAX ? <ModelPicker exclude={ids} onPick={(m) => add(m.id)} /> : null}
        <div className="ml-auto">
          <CopyLinkButton label="Copy share link" />
        </div>
      </div>

      <div className={cn("relative overflow-x-auto rounded-[var(--radius-panel)] border border-border transition-opacity", query.isFetching && "opacity-70")} role="region" aria-label="Comparison table, scrolls horizontally" tabIndex={0}>
        {/* phones: narrower label + model columns so two models fit side by side at 375 px */}
        <table className="w-full border-collapse text-13 [--cmp-col:122px] [--cmp-label:100px] sm:[--cmp-col:200px] sm:[--cmp-label:180px]" style={{ minWidth: `calc(var(--cmp-label) + ${models.length} * var(--cmp-col))` }}>
          <caption className="sr-only">Side-by-side comparison of {models.map((m) => m.name).join(", ")}. Best values are marked “best”.</caption>
          <thead>
            <tr className="border-b border-border bg-surface">
              <th scope="col" className="sticky left-0 z-10 w-[var(--cmp-label)] bg-surface px-3 py-3 text-left text-xs font-medium text-muted sm:px-4">
                {models.length} models
              </th>
              {models.map((m) => (
                <th key={m.id} scope="col" className="min-w-[var(--cmp-col)] px-3 py-3 text-left align-top font-normal sm:px-4">
                  <div className="flex items-start gap-2.5">
                    <span className="hidden sm:block">
                      <LabAvatar slug={m.lab.slug} name={m.lab.name} size={32} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/models/${m.id}`} className="block font-semibold hover:text-accent">
                        {m.name}
                      </Link>
                      <span className="text-xs text-muted">{m.lab.name}</span>
                      {m.deprecated ? <Badge tone="warning" className="ml-1.5">Deprecated</Badge> : null}
                    </div>
                    <button type="button" onClick={() => remove(m.id)} className="inline-flex size-7 shrink-0 items-center justify-center rounded text-faint hover:bg-surface-2 hover:text-fg" aria-label={`Remove ${m.name} from comparison`}>
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g}>
              <tr>
                <th colSpan={models.length + 1} scope="colgroup" className="sticky left-0 bg-bg px-3 pt-5 pb-2 text-left text-xs font-semibold text-fg sm:px-4">
                  {g}
                </th>
              </tr>
              {visible
                .filter((r) => r.group === g)
                .map((r) => {
                  const best = bestIndexes(r, models);
                  return (
                    <tr key={r.label} className="border-t border-border">
                      <th scope="row" className="sticky left-0 z-[1] bg-bg px-3 py-2.5 text-left font-normal text-muted sm:px-4">
                        {r.label}
                      </th>
                      {models.map((m, i) => (
                        <td key={m.id} className={cn("px-3 py-2.5 align-middle sm:px-4", best.has(i) && "bg-accent-soft font-semibold text-accent")}>
                          <span className="flex items-center gap-2">
                            {r.render(m, best.has(i))}
                            {best.has(i) ? (
                              <span className="rounded-[4px] border border-accent/30 px-1 text-[10px] leading-4 font-semibold tracking-wide text-accent">
                                best
                              </span>
                            ) : null}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          ))}
        </table>
        {diffOnly && !visible.length ? <p className="p-6 text-center text-muted">These models are identical on every compared attribute.</p> : null}
      </div>

      <CostCalculator models={models} />
    </div>
  );
}

function CompareSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-2 rounded-[var(--radius-panel)] border border-border p-4" aria-busy="true" aria-label="Loading comparison">
      {Array.from({ length: 10 }, (_, r) => (
        <div key={r} className="flex gap-4">
          <Skeleton className="h-5 w-[160px]" />
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
