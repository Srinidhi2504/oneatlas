"use client";
// A provider's listings: search, sort and pagination through /api/v1/providers/{provider}, state in the URL.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import { isPastEnd, Pagination, PastEnd } from "@/components/ui/Pagination";
import { Badge, Button, LabAvatar, Panel, StateMessage } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPrice, formatTokens } from "@/lib/format";
import type { ListMeta, ProviderModelRow } from "@/lib/types";
import { providerModelsQuery, providerParsers } from "./provider-state";

export type ProviderListingsPage = { items: ProviderModelRow[]; meta: ListMeta };

/** Paginated models of one provider with that provider's own prices, from /api/v1/providers/{slug}. */
export function ProviderModels({ slug, initial, initialQs }: { slug: string; initial: ProviderListingsPage | null; initialQs: string }) {
  const [state, setState] = useQueryStates(providerParsers, { history: "push", scroll: false });
  const [q, setQ] = useState(state.q);
  useEffect(() => {
    if (q === state.q) return;
    const t = setTimeout(() => setState({ q: q || null, page: null }, { history: "replace" }), 250);
    return () => clearTimeout(t);
  }, [q, state.q, setState]);

  const qs = providerModelsQuery(state);
  const query = useQuery({
    queryKey: ["provider", slug, qs],
    queryFn: ({ signal }): Promise<ProviderListingsPage> => api.provider(slug, qs, signal).then((r) => ({ items: r.data.listings, meta: r.meta! })),
    initialData: qs === initialQs && initial ? initial : undefined,
    placeholderData: keepPreviousData,
  });
  const data = query.data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 flex-1 basis-60">
          <label htmlFor="provider-search" className="sr-only">
            Search this provider’s models
          </label>
          <input
            id="provider-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search this provider’s models"
            className="h-9 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 text-sm placeholder:text-faint hover:border-border-strong focus:border-accent focus:outline-none"
          />
        </div>
        <SelectMenu
          label="Sort"
          value={state.sort}
          onValueChange={(v) => setState({ sort: v === "name" ? null : v, page: null })}
          options={[
            { value: "name", label: "Model name" },
            { value: "price", label: "Input price" },
            { value: "context", label: "Context window" },
          ]}
        />
      </div>
      {query.isError && !data ? (
        <Panel>
          <StateMessage icon={<TriangleAlert />} title="Couldn’t load this provider’s models" action={<Button onClick={() => query.refetch()}>Retry</Button>}>
            {query.error.message}
          </StateMessage>
        </Panel>
      ) : data && isPastEnd(data.meta, data.items.length) ? (
        <Panel>
          <PastEnd meta={data.meta} noun="listings" onPage={(p) => setState({ page: p === 1 ? null : p })} />
        </Panel>
      ) : data && !data.items.length ? (
        <Panel>
          <StateMessage icon={<SearchX />} title={`No models match “${state.q}”`} action={<Button onClick={() => { setQ(""); setState({ q: null, page: null }); }}>Clear search</Button>} />
        </Panel>
      ) : data ? (
        <>
          <div className={cn("relative overflow-x-auto rounded-[var(--radius-panel)] border border-border transition-opacity", query.isFetching && "opacity-60")} role="region" aria-label="Provider models, scrolls horizontally" tabIndex={0}>
            <table className="w-full min-w-[760px] border-collapse text-13">
              <caption className="sr-only">Models served by this provider with its prices per 1M tokens</caption>
              <thead className="bg-surface">
                <tr className="border-b border-border text-xs text-muted">
                  <th scope="col" className="h-10 px-3 text-left font-medium">Model</th>
                  <th scope="col" className="h-10 px-3 text-left font-medium">API model id</th>
                  <th scope="col" className="h-10 px-3 text-right font-medium">Context</th>
                  <th scope="col" className="h-10 px-3 text-right font-medium">Input</th>
                  <th scope="col" className="h-10 px-3 text-right font-medium">Output</th>
                  <th scope="col" className="h-10 px-3 text-right font-medium">Cache read</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.providerModelId} className="h-12 border-b border-border last:border-b-0 hover:bg-surface">
                    <th scope="row" className="px-3 text-left font-normal">
                      <span className="flex items-center gap-2">
                        <LabAvatar slug={r.model.lab.slug} name={r.model.lab.name} size={24} />
                        <Link href={`/models/${r.model.id}`} className="max-w-[240px] truncate font-medium hover:text-accent">
                          {r.model.name}
                        </Link>
                        {r.status ? <Badge tone={r.status === "deprecated" ? "warning" : "neutral"}>{r.status}</Badge> : null}
                      </span>
                    </th>
                    <td className="max-w-[240px] truncate px-3 font-mono text-xs text-muted" title={r.providerModelId}>
                      {r.providerModelId}
                    </td>
                    <td className="px-3 text-right">{formatTokens(r.contextWindow)}</td>
                    <td className="px-3 text-right">{formatPrice(r.pricing.input)}</td>
                    <td className="px-3 text-right">{formatPrice(r.pricing.output)}</td>
                    <td className="px-3 text-right text-muted">{formatPrice(r.pricing.cacheRead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} noun="listings" onPage={(p) => setState({ page: p === 1 ? null : p })} />
        </>
      ) : null}
    </div>
  );
}
