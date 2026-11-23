"use client";
// A model's provider listings: each provider's own prices, limits and flags, sortable.
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Minus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDate, formatPrice, formatTokens } from "@/lib/format";
import type { ProviderListing } from "@/lib/types";

type Key = "provider" | "input" | "output" | "context";
const value = (l: ProviderListing, k: Key): number | string | null =>
  k === "provider" ? l.provider.name.toLowerCase() : k === "input" ? l.pricing.input : k === "output" ? l.pricing.output : l.contextWindow;

function Flag({ on, label }: { on: boolean | null; label: string }) {
  if (on == null) return <span className="text-faint" title={`${label}: not stated`}>?</span>;
  return on ? (
    <Check className="mx-auto size-3.5 text-success" aria-label={`${label}: yes`} />
  ) : (
    <Minus className="mx-auto size-3.5 text-faint" aria-label={`${label}: no`} />
  );
}

/** Every listing of a model with that provider's own prices. Sorted client-side (the full list is already here). */
export function ProviderTable({ listings }: { listings: ProviderListing[] }) {
  const [sort, setSort] = useState<{ key: Key; asc: boolean }>({ key: "input", asc: true });
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 12;
  const minInput = Math.min(...listings.map((l) => l.pricing.input ?? Infinity));
  const rows = [...listings].sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1; // nulls last
    const d = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
    return sort.asc ? d : -d;
  });

  const th = (label: string, key?: Key, right = true) => {
    const active = key && sort.key === key;
    const Icon = active ? (sort.asc ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th scope="col" aria-sort={key ? (active ? (sort.asc ? "ascending" : "descending") : "none") : undefined} className={cn("h-9 px-2.5 text-xs font-medium whitespace-nowrap text-muted", right ? "text-right" : "text-left")}>
        {key ? (
          <button type="button" onClick={() => setSort({ key, asc: active ? !sort.asc : key !== "context" })} className={cn("inline-flex items-center gap-1 hover:text-fg", active && "text-fg")}>
            {label}
            <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden />
          </button>
        ) : (
          label
        )}
      </th>
    );
  };

  return (
    <div className="relative overflow-x-auto rounded-[var(--radius-panel)] border border-border" role="region" aria-label="Provider listings, scrolls horizontally" tabIndex={0}>
      <table className="w-full min-w-[900px] border-collapse text-13">
        <caption className="sr-only">Providers serving this model, with their own prices per 1M tokens</caption>
        <thead className="bg-surface">
          <tr className="border-b border-border">
            {th("Provider", "provider", false)}
            {th("API model id", undefined, false)}
            {th("Context", "context")}
            {th("Max output")}
            {th("Input", "input")}
            {th("Output", "output")}
            {th("Cache read")}
            {th("Cache write")}
            <th scope="col" className="h-9 px-2 text-center text-xs font-medium text-muted">Tools</th>
            <th scope="col" className="h-9 px-2 text-center text-xs font-medium text-muted">JSON</th>
            {th("Updated")}
          </tr>
        </thead>
        <tbody>
          {(showAll ? rows : rows.slice(0, LIMIT)).map((l) => (
            <tr key={`${l.provider.slug}:${l.providerModelId}`} className="h-11 border-b border-border last:border-b-0 hover:bg-surface">
              <th scope="row" className="px-2.5 text-left font-medium whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                  <Link href={`/providers/${l.provider.slug}`} className="hover:text-accent hover:underline">
                    {l.provider.name}
                  </Link>
                  {l.status ? <Badge tone={l.status === "deprecated" ? "warning" : "neutral"}>{l.status}</Badge> : null}
                </span>
              </th>
              <td className="max-w-[220px] truncate px-2.5 font-mono text-xs text-muted" title={l.providerModelId}>
                {l.providerModelId}
              </td>
              <td className="px-2.5 text-right">{formatTokens(l.contextWindow)}</td>
              <td className="px-2.5 text-right text-muted">{formatTokens(l.maxOutputTokens)}</td>
              <td className="px-2.5 text-right">
                <span className={cn(l.pricing.input === minInput && "font-semibold text-accent")}>{formatPrice(l.pricing.input)}</span>
                {l.pricing.input === minInput && listings.length > 1 ? <span className="sr-only"> (lowest)</span> : null}
              </td>
              <td className="px-2.5 text-right">{formatPrice(l.pricing.output)}</td>
              <td className="px-2.5 text-right text-muted">{formatPrice(l.pricing.cacheRead)}</td>
              <td className="px-2.5 text-right text-muted">{formatPrice(l.pricing.cacheWrite)}</td>
              <td className="px-2 text-center">
                <Flag on={l.flags.toolCall} label="Tool calling" />
              </td>
              <td className="px-2 text-center">
                <Flag on={l.flags.structuredOutput} label="Structured output" />
              </td>
              <td className="px-2.5 text-right whitespace-nowrap text-muted">{formatDate(l.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > LIMIT ? (
        <div className="sticky left-0 border-t border-border bg-surface px-3 py-2">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-13 font-medium text-accent hover:underline" aria-expanded={showAll}>
            {showAll ? "Show fewer" : `Show all ${rows.length} listings`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
