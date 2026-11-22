"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownUp, LayoutGrid, Rows3, SearchX, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { ModelCard, ModelCardSkeleton } from "@/components/models/ModelCard";
import { ModelTable } from "@/components/models/ModelTable";
import { Pagination } from "@/components/ui/Pagination";
import { Button, cardGrid, StateMessage } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import { defaultOrder, type ModelSort } from "@/lib/schemas";
import type { Capability, Facets, ModelListItem, Paginated } from "@/lib/types";
import { FilterPanel } from "./FilterPanel";
import { effectiveSort, explorerParsers, hasActiveFilters, toApiQuery, toFilterQuery, type ExplorerState } from "./state";

export interface ExplorerInitial {
  modelsQs: string;
  models: Paginated<ModelListItem> | null;
  facetsQs: string;
  facets: Facets | null;
}

/** A URL-state patch: null removes the param (back to its default). */
type Patch = { [K in keyof ExplorerState]?: ExplorerState[K] | null };

const QUICK_CHIPS:{ label: string; capability?: Capability; special?: "1m" | "deprecated" }[] = [
  { label: "Reasoning", capability: "reasoning" },
  { label: "Tool calling", capability: "tools" },
  { label: "Structured output", capability: "structured" },
  { label: "Vision", capability: "vision" },
  { label: "Open weights", capability: "open" },
  { label: "1M+ context", special: "1m" },
  { label: "Free", capability: "free" },
  { label: "Include deprecated", special: "deprecated" },
];

const SORT_OPTIONS: { value: ModelSort; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "providers", label: "Most providers" },
  { value: "intelligence", label: "Intelligence" },
  { value: "value", label: "Best value" },
  { value: "price", label: "Price" },
  { value: "context", label: "Context window" },
  { value: "released", label: "Release date" },
  { value: "name", label: "Name" },
];

export function Explorer({ initial }: { initial: ExplorerInitial }) {
  const [state, setState] = useQueryStates(explorerParsers, { history: "push", scroll: false });
  const apiQs = toApiQuery(state);
  const facetQs = toFilterQuery(state).toString();
  const { sort, order } = effectiveSort(state);

  const models = useQuery({
    queryKey: ["models", apiQs],
    queryFn: ({ signal }) => api.models(apiQs, signal).then((r) => ({ items: r.data, meta: r.meta! })),
    initialData: apiQs === initial.modelsQs && initial.models ? initial.models : undefined,
    placeholderData: keepPreviousData,
  });
  const facets = useQuery({
    queryKey: ["facets", facetQs],
    queryFn: ({ signal }) => api.facets(facetQs, signal).then((r) => r.data),
    initialData: facetQs === initial.facetsQs && initial.facets ? initial.facets : undefined,
    placeholderData: keepPreviousData,
  });

  // search input: local state, pushed to the URL after 250 ms of quiet typing
  const [q, setQ] = useState(state.q);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (q === state.q) return;
    const t = setTimeout(() => setState({ q: q || null, page: null }, { history: "replace" }), 250);
    return () => clearTimeout(t);
  }, [q, state.q, setState]);
  // keep the box in sync when the URL changes from elsewhere (back button, "Clear all")
  const lastUrlQ = useRef(state.q);
  useEffect(() => {
    if (state.q !== lastUrlQ.current) {
      lastUrlQ.current = state.q;
      setQ(state.q);
    }
  }, [state.q]);

  // "/" focuses search (unless the user is already typing somewhere)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !t.closest("input, textarea, select, [contenteditable=true]")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const resultsRef = useRef<HTMLDivElement>(null);
  const update = (patch: Patch) => setState({ ...patch, page: null }); // any filter change resets page
  const toggleCap = (c: Capability) =>
    update({ capability: state.capability.includes(c) ? state.capability.filter((x) => x !== c) : [...state.capability, c] });
  const chipActive = (chip: (typeof QUICK_CHIPS)[number]) =>
    chip.capability ? state.capability.includes(chip.capability) : chip.special === "1m" ? (state.minContext ?? 0) >= 1_000_000 : state.includeDeprecated;
  const onChip = (chip: (typeof QUICK_CHIPS)[number]) => {
    if (chip.capability) toggleCap(chip.capability);
    else if (chip.special === "1m") update({ minContext: (state.minContext ?? 0) >= 1_000_000 ? null : 1_000_000 });
    else update({ includeDeprecated: !state.includeDeprecated });
  };
  const chipCount = (chip: (typeof QUICK_CHIPS)[number]) =>
    chip.capability && facets.data && !chipActive(chip) ? facets.data.capabilities[chip.capability] : null;

  const onSort = (next: ModelSort) =>
    setState({ sort: next, order: next === sort ? (order === "asc" ? "desc" : "asc") : defaultOrder(next), page: null });
  const clearAll = () => {
    setQ("");
    setState({ q: null, lab: null, provider: null, type: null, capability: null, minContext: null, includeDeprecated: null, page: null });
  };
  const goPage = (page: number) => {
    setState({ page: page === 1 ? null : page });
    resultsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const data = models.data;
  const showSkeleton = models.isPending;
  const refreshing = models.isFetching && !models.isPending;
  const activeFilterCount = state.lab.length + state.provider.length + state.type.length;
  const filterPanel = (
    <FilterPanel
      facets={facets.data}
      type={state.type}
      lab={state.lab}
      provider={state.provider}
      onChange={(patch) => update(patch)}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-1 pb-8">{filterPanel}</div>
      </aside>

      <div className="min-w-0" ref={resultsRef} style={{ scrollMarginTop: 72 }}>
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-60">
            <label htmlFor="model-search" className="sr-only">
              Search models
            </label>
            <input
              ref={searchRef}
              id="model-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search models, e.g. gpt4o"
              className="h-9 w-full rounded-[var(--radius-control)] border border-border bg-bg pr-9 pl-3 text-sm placeholder:text-faint hover:border-border-strong focus:border-accent focus:outline-none"
              aria-keyshortcuts="/"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border px-1.5 text-[11px] text-faint sm:block">/</kbd>
          </div>

          <Dialog.Root>
            <Dialog.Trigger className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-border px-3 text-13 hover:border-border-strong lg:hidden">
              <SlidersHorizontal className="size-4" aria-hidden />
              Filters
              {activeFilterCount ? <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">{activeFilterCount}</span> : null}
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--fg)_28%,transparent)]" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(340px,90vw)] flex-col border-r border-border bg-bg" aria-describedby={undefined}>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <Dialog.Title className="text-sm font-semibold">Filters</Dialog.Title>
                  <Dialog.Close className="inline-flex size-8 items-center justify-center rounded text-muted hover:bg-surface-2" aria-label="Close filters">
                    <X className="size-4" aria-hidden />
                  </Dialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto p-4">{filterPanel}</div>
                <div className="border-t border-border p-3">
                  <Dialog.Close className="h-9 w-full rounded-[var(--radius-control)] bg-accent text-sm font-medium text-accent-fg">
                    Show {data ? formatInteger(data.meta.total) : ""} models
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <SelectMenu
            label="Sort"
            value={sort}
            onValueChange={(v) => setState({ sort: v, order: defaultOrder(v), page: null })}
            options={SORT_OPTIONS.filter((o) => o.value !== "relevance" || state.q.trim())}
          />
          <Button
            variant="secondary"
            size="md"
            className="w-9 px-0"
            onClick={() => setState({ order: order === "asc" ? "desc" : "asc", page: null })}
            aria-label={`Sort direction: ${order === "asc" ? "ascending" : "descending"}. Toggle`}
            title={order === "asc" ? "Ascending" : "Descending"}
          >
            <ArrowDownUp className={cn("transition-transform", order === "asc" && "rotate-180")} aria-hidden />
          </Button>

          <div className="hidden items-center rounded-[var(--radius-control)] border border-border p-0.5 sm:flex" role="group" aria-label="View">
            {(
              [
                ["table", Rows3, "Table"],
                ["cards", LayoutGrid, "Cards"],
              ] as const
            ).map(([v, Icon, label]) => {
              const active = (state.view ?? "table") === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setState({ view: v === "table" ? null : v, page: null })}
                  className={cn("inline-flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-13", active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* quick chips */}
        <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Quick filters">
          {QUICK_CHIPS.map((chip) => {
            const active = chipActive(chip);
            const count = chipCount(chip);
            return (
              <button
                key={chip.label}
                type="button"
                aria-pressed={active}
                onClick={() => onChip(chip)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-13 transition-colors",
                  active ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {chip.label}
                {count != null ? <span className="text-xs text-faint">{formatInteger(count)}</span> : null}
                {active ? <X className="size-3" aria-hidden /> : null}
              </button>
            );
          })}
        </div>

        <ActiveFilters state={state} facets={facets.data} update={update} clearAll={clearAll} />

        {/* results */}
        <h2 className="sr-only">Results</h2>
        <div className="relative mt-3">
          <div className="absolute inset-x-0 -top-2 h-0.5 overflow-hidden" aria-hidden>
            {refreshing ? <div className="h-full w-1/3 animate-progress bg-accent" /> : null}
          </div>
          <p className="sr-only" aria-live="polite">
            {data && !models.isFetching ? `${formatInteger(data.meta.total)} models found` : ""}
          </p>

          {models.isError && !data ? (
            <StateMessage
              icon={<TriangleAlert />}
              title="Couldn’t load models"
              action={<Button onClick={() => models.refetch()}>Retry</Button>}
              className="rounded-[var(--radius-panel)] border border-border"
            >
              {models.error.message}
            </StateMessage>
          ) : data && data.items.length === 0 ? (
            <StateMessage
              icon={<SearchX />}
              title="No models match these filters"
              action={
                <>
                  {hasActiveFilters(state) ? <Button onClick={clearAll}>Clear all filters</Button> : null}
                  {!state.includeDeprecated ? <Button variant="ghost" onClick={() => update({ includeDeprecated: true })}>Include deprecated</Button> : null}
                </>
              }
              className="rounded-[var(--radius-panel)] border border-border"
            >
              Remove a filter above, or try a shorter search such as “claude” or “llama”.
            </StateMessage>
          ) : state.view === "cards" ? (
            <div className={cn(cardGrid, refreshing && "opacity-60 transition-opacity")}>
              {showSkeleton ? Array.from({ length: 9 }, (_, i) => <ModelCardSkeleton key={i} />) : data!.items.map((m) => <ModelCard key={m.id} m={m} />)}
            </div>
          ) : (
            <>
              {/* default view: table from sm up, cards on phones (docs/06) */}
              <div className={cn(!state.view && "hidden sm:block")}>
                <ModelTable items={data?.items ?? []} loading={showSkeleton} dimmed={refreshing} sortState={{ sort, order }} onSort={onSort} />
              </div>
              {!state.view ? (
                <div className={cn("grid grid-cols-1 gap-3 sm:hidden", refreshing && "opacity-60")}>
                  {showSkeleton ? Array.from({ length: 4 }, (_, i) => <ModelCardSkeleton key={i} />) : data!.items.map((m) => <ModelCard key={m.id} m={m} />)}
                </div>
              ) : null}
            </>
          )}
          {models.isError && data ? (
            <p className="mt-2 text-13 text-danger" role="alert">
              Couldn’t refresh results: {models.error.message}{" "}
              <button type="button" className="underline" onClick={() => models.refetch()}>
                Retry
              </button>
            </p>
          ) : null}
        </div>

        {data && data.items.length ? <Pagination meta={data.meta} onPage={goPage} /> : null}
      </div>
    </div>
  );
}

function ActiveFilters({
  state,
  facets,
  update,
  clearAll,
}: {
  state: ExplorerState;
  facets: Facets | undefined;
  update: (patch: Patch) => void;
  clearAll: () => void;
}) {
  const labName = (s: string) => facets?.labs.find((l) => l.slug === s)?.name ?? s;
  const providerName = (s: string) => facets?.providers.find((p) => p.slug === s)?.name ?? s;
  const chips = [
    ...(state.q.trim() ? [{ key: "q", label: `“${state.q.trim()}”`, remove: () => update({ q: null }) }] : []),
    ...state.type.map((t) => ({ key: `type-${t}`, label: `Type: ${t}`, remove: () => update({ type: state.type.filter((x) => x !== t) }) })),
    ...state.lab.map((l) => ({ key: `lab-${l}`, label: `Lab: ${labName(l)}`, remove: () => update({ lab: state.lab.filter((x) => x !== l) }) })),
    ...state.provider.map((p) => ({ key: `provider-${p}`, label: `Provider: ${providerName(p)}`, remove: () => update({ provider: state.provider.filter((x) => x !== p) }) })),
  ];
  if (!chips.length && !hasActiveFilters(state)) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-control)] border border-border bg-surface pr-0.5 pl-2 text-13">
          {c.label}
          <button type="button" onClick={c.remove} className="inline-flex size-6 items-center justify-center rounded text-faint hover:bg-surface-2 hover:text-fg" aria-label={`Remove filter ${c.label}`}>
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <button type="button" onClick={clearAll} className="h-7 px-2 text-13 font-medium text-accent hover:underline">
        Clear all
      </button>
    </div>
  );
}
