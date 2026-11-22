"use client";
import { Check, GitCompareArrows, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { COMPARE_MAX, useCompareList, type CompareEntry } from "@/lib/compare-store";

/** Row/card checkbox. Disabled with an explanation when the tray is full. */
export function CompareCheckbox({ entry }: { entry: CompareEntry }) {
  const { has, isFull, toggle } = useCompareList();
  const checked = has(entry.id);
  const disabled = !checked && isFull;
  return (
    <label
      className={cn("inline-flex size-8 cursor-pointer items-center justify-center rounded-[var(--radius-control)] hover:bg-surface-2", disabled && "cursor-not-allowed opacity-40")}
      title={disabled ? `Compare holds up to ${COMPARE_MAX} models` : undefined}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={() => toggle(entry)}
        aria-label={`${checked ? "Remove" : "Add"} ${entry.name} ${checked ? "from" : "to"} compare`}
      />
      <span
        aria-hidden
        className="flex size-4 items-center justify-center rounded-[4px] border border-border-strong bg-bg text-accent-fg transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
    </label>
  );
}

/** Text button variant for cards and the detail page header. */
export function CompareButton({ entry, size = "sm" }: { entry: CompareEntry; size?: "sm" | "md" }) {
  const { has, isFull, toggle } = useCompareList();
  const checked = has(entry.id);
  const disabled = !checked && isFull;
  return (
    <button
      type="button"
      onClick={() => toggle(entry)}
      disabled={disabled}
      aria-pressed={checked}
      title={disabled ? `Compare holds up to ${COMPARE_MAX} models` : undefined}
      className={buttonClass(checked ? "primary" : "secondary", size)}
    >
      {checked ? <Check aria-hidden /> : <Plus aria-hidden />}
      {checked ? "In compare" : "Add to compare"}
    </button>
  );
}

/** Floating bar while at least one model is selected (hidden on /compare itself). */
export function CompareTray() {
  const { items, remove, clear } = useCompareList();
  const pathname = usePathname();
  if (!items.length || pathname?.startsWith("/compare")) return null;
  const href = `/compare?ids=${items.map((i) => i.id).join(",")}`;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div
        role="region"
        aria-label="Compare selection"
        className="pointer-events-auto flex w-full max-w-[880px] flex-wrap items-center gap-2 rounded-[var(--radius-panel)] border border-border-strong bg-bg p-2 pl-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]"
      >
        <GitCompareArrows className="size-4 text-accent" aria-hidden />
        <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {items.map((i) => (
            <li key={i.id} className="flex h-7 max-w-[200px] items-center gap-1 rounded-[var(--radius-control)] border border-border bg-surface pr-0.5 pl-2 text-13">
              <span className="truncate">{i.name}</span>
              <button
                type="button"
                onClick={() => remove(i.id)}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded text-faint hover:bg-surface-2 hover:text-fg"
                aria-label={`Remove ${i.name} from compare`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <span className="text-xs text-muted" aria-live="polite">
          {items.length < 2 ? "Pick one more to compare" : items.length >= COMPARE_MAX ? `${COMPARE_MAX} of ${COMPARE_MAX}: remove one to add another` : `${items.length} of ${COMPARE_MAX}`}
        </span>
        <button type="button" onClick={clear} className={buttonClass("ghost", "sm")}>
          Clear
        </button>
        {items.length >= 2 ? (
          <Link href={href} className={buttonClass("primary", "sm")}>
            Compare {items.length}
          </Link>
        ) : (
          <button type="button" disabled className={buttonClass("primary", "sm")}>
            Compare {items.length}
          </button>
        )}
      </div>
    </div>
  );
}
