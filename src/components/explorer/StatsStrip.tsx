// Catalog totals and capability coverage meters above the explorer.
import Link from "next/link";
import { Odometer } from "@/components/ui/Odometer";
import { formatInteger } from "@/lib/format";
import { TONE, type Tone } from "@/lib/tones";
import { getStats } from "@/server/services/catalog";

/** Catalog size + capability coverage. Cached server read: part of the static shell, no client JS. */
export async function StatsStrip() {
  const s = await getStats();
  const counts = [
    { label: "Models", value: s.models, href: "/" },
    { label: "Labs", value: s.labs, href: "/labs" },
    { label: "Providers", value: s.providers, href: "/providers" },
    { label: "API listings", value: s.listings, href: "/providers" },
  ];
  const coverage = [
    { label: "Tool calling", share: s.coverage.toolCall, tone: "amber" },
    { label: "Reasoning", share: s.coverage.reasoning, tone: "violet" },
    { label: "Vision", share: s.coverage.vision, tone: "coral" },
    { label: "Open weights", share: s.coverage.openWeights, tone: "green" },
  ] satisfies { label: string; share: number; tone: Tone }[];
  return (
    <section aria-label="Catalog overview" className="enter grid overflow-hidden rounded-[var(--radius-panel)] border border-border lg:grid-cols-[auto_1fr]">
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        {counts.map((c, i) => (
          <div key={c.label} className={`border-border px-4 py-3 ${i % 2 ? "border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} sm:border-l sm:first:border-l-0`}>
            <dt className="text-xs text-muted">{c.label}</dt>
            <dd className="text-xl font-semibold tracking-tight">
              <Link href={c.href} className="hover:text-accent">
                <Odometer value={formatInteger(c.value)} />
              </Link>
            </dd>
          </div>
        ))}
      </dl>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border bg-surface px-4 py-3 sm:grid-cols-4 lg:border-t-0 lg:border-l">
        {coverage.map((c) => (
          <div key={c.label}>
            <dt className="flex items-baseline justify-between text-xs text-muted">
              {c.label}
              <span className={`font-medium ${TONE[c.tone].text}`}>{Math.round(c.share * 100)}%</span>
            </dt>
            <dd className="mt-1.5">
              <span role="meter" aria-label={`${c.label} coverage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(c.share * 100)} className="relative block h-1.5 overflow-hidden rounded-[2px] bg-bar-track">
                <span className="bar-fill absolute inset-y-0 left-0" style={{ width: `${c.share * 100}%`, background: TONE[c.tone].color }} />
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
