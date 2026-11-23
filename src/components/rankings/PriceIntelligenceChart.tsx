"use client";
// Price vs intelligence chart wrapper: mounts the Recharts scatter only near the viewport, with a table fallback.
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Panel, Skeleton, StateMessage } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { formatPrice, formatScore } from "@/lib/format";
import { paretoFrontier } from "@/lib/ranking";

export interface ChartPoint {
  id: string;
  name: string;
  lab: string;
  price: number;
  score: number;
}

// Recharts is ~100 kB: load it only when this section renders, never in the initial page bundle.
const ScatterPlot = dynamic(() => import("./ScatterPlot").then((m) => m.ScatterPlot), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full rounded-[var(--radius-panel)]" />,
});

/** Mounts the chart only when it comes within 300px of the viewport: Recharts and its data stay off the critical path. */
export function PriceIntelligenceChart() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref}>{near ? <ChartBody /> : <Skeleton className="h-[420px] w-full rounded-[var(--radius-panel)]" />}</div>;
}

function ChartBody() {
  const query = useQuery({
    queryKey: ["rankings", "value", "chart"],
    // the "value" board is exactly the set of models with both an intelligence score and a positive price
    queryFn: ({ signal }) => api.rankings("value", "pageSize=100", signal).then((r) => r.data),
  });

  if (query.isError)
    return (
      <Panel>
        <StateMessage title="Couldn’t load the chart data" action={<Button onClick={() => query.refetch()}>Retry</Button>}>
          {query.error.message}
        </StateMessage>
      </Panel>
    );
  if (!query.data) return <Skeleton className="h-[420px] w-full rounded-[var(--radius-panel)]" />;

  const points: ChartPoint[] = query.data.rows
    .filter((r) => r.model.pricing.blended && r.model.intelligenceIndex != null)
    .map((r) => ({ id: r.model.id, name: r.model.name, lab: r.model.lab.name, price: r.model.pricing.blended!, score: r.model.intelligenceIndex! }));
  const frontier = paretoFrontier(points);

  return (
    <div className="space-y-3">
      <Panel className="p-3 sm:p-4">
        <ScatterPlot points={points} frontier={frontier} />
      </Panel>
      <details className="rounded-[var(--radius-panel)] border border-border">
        <summary className="cursor-pointer px-4 py-2.5 text-13 font-medium text-muted hover:text-fg">
          View the {frontier.length} frontier models as a table
        </summary>
        <div className="relative overflow-x-auto border-t border-border">
          <table className="w-full min-w-[420px] text-13">
            <caption className="sr-only">Models on the price and intelligence frontier, cheapest first</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="px-4 py-2 text-left font-medium">Model</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Blended price /1M</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Intelligence</th>
              </tr>
            </thead>
            <tbody>
              {frontier.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-2 text-left font-normal">
                    <Link href={`/models/${p.id}`} className="hover:text-accent">
                      {p.name}
                    </Link>
                    <span className="ml-1.5 text-xs text-faint">{p.lab}</span>
                  </th>
                  <td className="px-4 py-2 text-right">{formatPrice(p.price)}</td>
                  <td className="px-4 py-2 text-right">{formatScore(p.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
