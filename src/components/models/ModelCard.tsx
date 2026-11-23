"use client";
// Model card for the explorer's card view: price, context, capabilities, intelligence, add to compare.
import Link from "next/link";
import { Badge, LabAvatar, Skeleton } from "@/components/ui/primitives";
import { Tilt } from "@/components/ui/Tilt";
import { daysSince, formatScore, formatTokens } from "@/lib/format";
import type { ModelListItem } from "@/lib/types";
import { CapabilityBadges, PriceCell } from "./bits";
import { CompareButton } from "./compare";

export function ModelCard({ m }: { m: ModelListItem }) {
  return (
    <Tilt as="article" className="group flex min-h-[188px] flex-col rounded-[var(--radius-panel)] border border-border bg-bg p-4 hover:border-border-strong">
      <div className="flex items-start gap-3">
        <LabAvatar slug={m.lab.slug} name={m.lab.name} size={32} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm">
            {/* the whole card is clickable via the stretched link; the compare button sits above it */}
            <Link href={`/models/${m.id}`} className="after:absolute after:inset-0 after:rounded-[var(--radius-panel)] hover:text-accent">
              {m.name}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted">{m.lab.name}</p>
        </div>
        {daysSince(m.releasedAt) <= 30 ? <Badge tone="accent">New</Badge> : m.deprecated ? <Badge tone="warning">Deprecated</Badge> : null}
      </div>
      <dl className="mt-4 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 text-13">
        <div>
          <dt className="text-xs text-faint">Price /1M</dt>
          <dd className="mt-0.5">
            <PriceCell pricing={m.pricing} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-faint">Context</dt>
          <dd className="mt-0.5">{formatTokens(m.contextWindow)}</dd>
        </div>
        <div>
          <dt className="text-xs text-faint">Intelligence</dt>
          <dd className="mt-0.5">{m.intelligenceIndex != null ? formatScore(m.intelligenceIndex) : <span className="text-faint">N/A</span>}</dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
        <CapabilityBadges caps={m.capabilities} limit={2} />
        <div className="relative z-[1] shrink-0">
          <CompareButton entry={{ id: m.id, name: m.name, labName: m.lab.name }} />
        </div>
      </div>
    </Tilt>
  );
}

export function ModelCardSkeleton() {
  return (
    <div className="flex min-h-[188px] flex-col rounded-[var(--radius-panel)] border border-border p-4" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-[7px]" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
      <Skeleton className="mt-auto h-7 w-full" />
    </div>
  );
}

