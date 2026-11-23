"use client";
// Recharts scatter of log price vs intelligence with the value (Pareto) frontier traced and labelled.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CartesianGrid, LabelList, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { formatPrice, formatScore } from "@/lib/format";
import type { ChartPoint } from "./PriceIntelligenceChart";

const axisTick = { fill: "var(--muted)", fontSize: 12 };
const LOG_TICKS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100];

/** Frontier label: one line, no wrapping (Recharts' LabelList wraps to the point width otherwise). */
function FrontierLabel(props: { x?: number | string; y?: number | string; value?: React.ReactNode }) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  return (
    <text x={x} y={y - 9} textAnchor="middle" fill="var(--fg)" fontSize={11} fontWeight={500} paintOrder="stroke" stroke="var(--bg)" strokeWidth={3}>
      {props.value}
    </text>
  );
}

/** Log-price (x) vs Intelligence Index (y). Colours come from theme tokens, so it follows light/dark. */
export function ScatterPlot({ points, frontier }: { points: ChartPoint[]; frontier: ChartPoint[] }) {
  const router = useRouter();
  // labels collide on phones; there the frontier table below carries the names (chart is client-only: no hydration issue)
  const [wide] = useState(() => window.matchMedia("(min-width: 640px)").matches);
  const onFrontier = new Set(frontier.map((p) => p.id));
  const others = points.filter((p) => !onFrontier.has(p.id));
  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices) * 0.8;
  const hi = Math.max(...prices) * 1.25;
  const ticks = LOG_TICKS.filter((t) => t >= lo && t <= hi);
  const go = (p: unknown) => {
    const id = (p as { payload?: ChartPoint }).payload?.id;
    if (id) router.push(`/models/${id}`);
  };

  return (
    <div role="img" aria-label={`Scatter plot of ${points.length} models: blended price on a log scale against Intelligence Index. ${frontier.length} models form the value frontier; see the table below.`}>
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 24, right: 48, bottom: 28, left: 4 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
          <XAxis
            type="number"
            dataKey="price"
            scale="log"
            domain={[lo, hi]}
            ticks={ticks}
            allowDataOverflow
            tick={axisTick}
            tickFormatter={(v: number) => formatPrice(v)}
            stroke="var(--border-strong)"
            label={{ value: "Blended price per 1M tokens (log scale)", position: "insideBottom", offset: -18, fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="score"
            tick={axisTick}
            stroke="var(--border-strong)"
            width={44}
            domain={[0, (max: number) => Math.ceil((max + 5) / 10) * 10]}
            label={{ value: "Intelligence", angle: -90, position: "insideLeft", offset: 12, fill: "var(--muted)", fontSize: 12 }}
          />
          <ZAxis range={[46, 46]} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as ChartPoint | undefined;
              if (!p) return null;
              return (
                <div className="rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-xs shadow-md">
                  <p className="font-semibold text-fg">{p.name}</p>
                  <p className="text-muted">{p.lab}</p>
                  <p className="mt-1 text-fg">
                    {formatScore(p.score)} intelligence at {formatPrice(p.price)}
                  </p>
                </div>
              );
            }}
          />
          <Scatter data={others} fill="var(--faint)" fillOpacity={0.55} onClick={go} cursor="pointer" isAnimationActive={false} />
          <Scatter data={frontier} fill="var(--accent)" line={{ stroke: "var(--accent)", strokeWidth: 1.5 }} onClick={go} cursor="pointer" isAnimationActive={false}>
            {wide ? <LabelList dataKey="name" content={FrontierLabel} /> : null}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
