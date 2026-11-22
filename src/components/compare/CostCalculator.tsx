"use client";
import { Calculator } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { cheapestListing, monthlyCost } from "@/lib/pricing";
import type { ModelDetail } from "@/lib/types";

const PRESETS = [
  { label: "Chat app", input: 10, output: 2 },
  { label: "RAG", input: 50, output: 5 },
  { label: "Agent", input: 200, output: 40 },
];

/** Monthly cost for a token volume: at the reference price and at the cheapest provider. Pure client maths. */
export function CostCalculator({ models }: { models: ModelDetail[] }) {
  const [input, setInput] = useState(10);
  const [output, setOutput] = useState(2);
  const inId = useId();
  const outId = useId();
  const rows = models.map((m) => ({
    m,
    reference: monthlyCost(m.pricing.input, m.pricing.output, input, output),
    // $0 listings on a paid model are plan-bundled (e.g. coding subscriptions), not a usable per-token price
    cheapest: cheapestListing(m.pricing.isFree ? m.listings : m.listings.filter((l) => l.pricing.input !== 0 || l.pricing.output !== 0), input, output),
  }));
  const minRef = Math.min(...rows.map((r) => r.cheapest?.cost ?? r.reference ?? Infinity));

  const field = (id: string, label: string, value: number, set: (n: number) => void) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      <div className="flex h-9 items-center rounded-[var(--radius-control)] border border-border bg-bg pr-3 focus-within:border-accent hover:border-border-strong">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={100000}
          step="any"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => set(Math.max(0, Math.min(100000, Number(e.target.value) || 0)))}
          className="h-full w-full min-w-0 bg-transparent px-3 text-sm outline-none"
        />
        <span className="text-13 whitespace-nowrap text-faint">M tokens</span>
      </div>
    </div>
  );

  return (
    <Panel aria-labelledby="calc-title" className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="calc-title" className="flex items-center gap-2 text-base">
          <Calculator className="size-4 text-accent" aria-hidden />
          Monthly cost
        </h2>
        <div className="flex gap-1" role="group" aria-label="Usage presets">
          {PRESETS.map((p) => {
            const active = p.input === input && p.output === output;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setInput(p.input);
                  setOutput(p.output);
                }}
                className={cn("h-7 rounded-full border px-2.5 text-xs", active ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-fg")}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {field(inId, "Input tokens per month", input, setInput)}
        {field(outId, "Output tokens per month", output, setOutput)}
      </div>
      <div className="relative mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-13">
          <caption className="sr-only">Estimated monthly cost per model</caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th scope="col" className="py-2 text-left font-medium">Model</th>
              <th scope="col" className="py-2 text-right font-medium">Reference price</th>
              <th scope="col" className="py-2 text-right font-medium">Cheapest provider</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, reference, cheapest }) => {
              const best = (cheapest?.cost ?? reference) === minRef && rows.length > 1;
              return (
                <tr key={m.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="py-2.5 text-left font-medium">
                    {m.name}
                  </th>
                  <td className="py-2.5 text-right">{reference == null ? <span className="text-faint">Price unknown</span> : formatMoney(reference)}</td>
                  <td className={cn("py-2.5 text-right", best && "font-semibold text-accent")}>
                    {cheapest ? (
                      <>
                        {formatMoney(cheapest.cost)}
                        <span className="ml-1.5 text-xs font-normal text-faint">
                          via{" "}
                          <Link href={`/providers/${cheapest.listing.provider.slug}`} className="hover:text-fg hover:underline">
                            {cheapest.listing.provider.name}
                          </Link>
                        </span>
                        {best ? <span className="sr-only"> (lowest)</span> : null}
                      </>
                    ) : (
                      <span className="text-faint">No provider prices</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-faint">Estimates from list prices per 1M tokens; caching, batch discounts and long-context tiers are not included. $0 listings bundled into subscription plans are skipped.</p>
    </Panel>
  );
}
