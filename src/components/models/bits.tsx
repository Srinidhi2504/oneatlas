"use client";
// Small model-level display pieces shared by tables, cards, detail and compare.
import { AudioLines, Braces, Brain, Eye, FileText, Image as ImageIcon, LockOpen, Type, Video, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import { Tip } from "@/components/ui/Tip";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { Modality, ModelListItem, Pricing } from "@/lib/types";

type Caps = ModelListItem["capabilities"];
export const CAPABILITY_META: { key: keyof Caps; label: string; short: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "reasoning", label: "Reasoning", short: "Reasoning", icon: Brain },
  { key: "toolCall", label: "Tool calling", short: "Tools", icon: Wrench },
  { key: "structuredOutput", label: "Structured output (JSON)", short: "JSON", icon: Braces },
  { key: "vision", label: "Vision (image input)", short: "Vision", icon: Eye },
  { key: "openWeights", label: "Open weights", short: "Open", icon: LockOpen },
];

/** Icon row; absent capabilities render as faint placeholders so columns line up. Text alternative via sr-only list. */
export function CapabilityIcons({ caps }: { caps: Caps }) {
  const present = CAPABILITY_META.filter((c) => caps[c.key]);
  return (
    <span className="flex items-center gap-1">
      <span className="sr-only">{present.length ? present.map((c) => c.label).join(", ") : "No listed capabilities"}</span>
      {CAPABILITY_META.map((c) =>
        caps[c.key] ? (
          <Tip key={c.key} label={c.label}>
            <span tabIndex={-1} className="inline-flex size-5 items-center justify-center rounded-[4px] bg-accent-soft text-accent" aria-hidden>
              <c.icon className="size-3" />
            </span>
          </Tip>
        ) : (
          <span key={c.key} aria-hidden className="inline-flex size-5 items-center justify-center text-border-strong">
            <span className="size-1 rounded-full bg-current" />
          </span>
        ),
      )}
    </span>
  );
}

/** Labelled capability badges (cards, detail header). */
export function CapabilityBadges({ caps, limit }: { caps: Caps; limit?: number }) {
  const present = CAPABILITY_META.filter((c) => caps[c.key]).slice(0, limit);
  if (!present.length) return <span className="text-xs text-faint">No listed capabilities</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {present.map((c) => (
        <span key={c.key} className="inline-flex h-5 items-center gap-1 rounded-[4px] bg-accent-soft px-1.5 text-xs font-medium text-accent">
          <c.icon className="size-3" aria-hidden />
          {c.short}
        </span>
      ))}
    </span>
  );
}

const MODALITY_ICON: Record<Modality, ComponentType<{ className?: string }>> = {
  text: Type,
  image: ImageIcon,
  audio: AudioLines,
  video: Video,
  pdf: FileText,
};

export function ModalityIcons({ input, output }: { input: Modality[]; output: Modality[] }) {
  const label = `Input: ${input.join(", ") || "unknown"}. Output: ${output.join(", ") || "unknown"}`;
  return (
    <Tip label={label}>
      <span tabIndex={-1} className="inline-flex items-center gap-0.5 text-muted" aria-label={label} role="img">
        {input.map((m) => {
          const Icon = MODALITY_ICON[m];
          return <Icon key={m} className="size-3.5" />;
        })}
        <span className="px-0.5 text-faint">→</span>
        {output.map((m) => {
          const Icon = MODALITY_ICON[m];
          return <Icon key={m} className="size-3.5" />;
        })}
      </span>
    </Tip>
  );
}

export function ModalityChips({ list }: { list: Modality[] }) {
  if (!list.length) return <span className="text-faint">Unknown</span>;
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {list.map((m) => {
        const Icon = MODALITY_ICON[m];
        return (
          <span key={m} className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-border px-1.5 text-xs capitalize">
            <Icon className="size-3.5 text-faint" aria-hidden />
            {m === "pdf" ? "PDF" : m}
          </span>
        );
      })}
    </span>
  );
}

/** "$4.00 / $20.00" with a "Free" badge and the blended price in a tooltip. */
export function PriceCell({ pricing, className }: { pricing: Pricing; className?: string }) {
  if (pricing.isFree)
    return <span className="inline-flex h-5 items-center rounded-[4px] bg-accent-soft px-1.5 text-xs font-semibold text-accent">Free</span>;
  if (pricing.input == null && pricing.output == null) return <span className="text-faint" title="No price published">N/A</span>;
  const label = pricing.blended != null ? `Blended ${formatPrice(pricing.blended)} per 1M tokens (3:1 input:output)` : "Blended price unavailable";
  return (
    <Tip label={label}>
      <span tabIndex={-1} className={cn("whitespace-nowrap", className)}>
        <span className="text-fg">{formatPrice(pricing.input)}</span>
        <span className="px-1 text-faint">/</span>
        <span className="text-muted">{formatPrice(pricing.output)}</span>
      </span>
    </Tip>
  );
}

/**
 * Relative score bar drawn like a map scale bar: a ticked track with a filled segment.
 * `value / best` sets the length; the number is rendered next to it, so colour is never the only signal.
 */
export function ScoreBar({ value, best, className, label }: { value: number; best: number; className?: string; label?: string }) {
  const pct = best > 0 ? Math.max(2, Math.min(100, (value / best) * 100)) : 0;
  return (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={best}
      aria-valuenow={value}
      aria-label={label}
      className={cn("relative block h-2 w-full overflow-hidden rounded-[2px] bg-bar-track", className)}
    >
      <span className="absolute inset-y-0 left-0 bg-bar transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      {/* quarter ticks over track and fill */}
      <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(25%-1.5px),var(--bg)_calc(25%-1.5px),var(--bg)_25%)]" />
    </span>
  );
}
