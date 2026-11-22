import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import type { ListMeta } from "@/lib/types";

/** 1 … 4 5 [6] 7 8 … 31 */
export function pageWindow(page: number, total: number): (number | "gap")[] {
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["gap" as const, p] : [p]));
}

const cell = "inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-control)] px-2 text-13 transition-colors";

/** Works with links (server-rendered pages) or a callback (client lists). */
export function Pagination({
  meta,
  noun = "models",
  onPage,
  hrefFor,
}: {
  meta: ListMeta;
  noun?: string;
  onPage?: (page: number) => void;
  hrefFor?: (page: number) => string;
}) {
  const { page, pageSize, total, totalPages } = meta;
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);

  const item = (p: number, content: ReactNode, label: string, opts: { current?: boolean; disabled?: boolean } = {}) => {
    const className = cn(
      cell,
      opts.current ? "bg-fg font-medium text-bg" : "text-muted hover:bg-surface-2 hover:text-fg",
      opts.disabled && "pointer-events-none opacity-40",
    );
    if (hrefFor && !opts.disabled)
      return (
        <a key={label} href={hrefFor(p)} className={className} aria-label={label} aria-current={opts.current ? "page" : undefined}>
          {content}
        </a>
      );
    return (
      <button key={label} type="button" className={className} onClick={() => onPage?.(p)} disabled={opts.disabled} aria-label={label} aria-current={opts.current ? "page" : undefined}>
        {content}
      </button>
    );
  };

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 py-4 sm:flex-row">
      <p className="text-13 text-muted">
        Showing {formatInteger(from)} to {formatInteger(to)} of {formatInteger(total)} {noun}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          {item(page - 1, <ChevronLeft className="size-4" aria-hidden />, "Previous page", { disabled: page <= 1 })}
          {pageWindow(page, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-faint" aria-hidden>
                …
              </span>
            ) : (
              item(p, p, `Page ${p}`, { current: p === page })
            ),
          )}
          {item(page + 1, <ChevronRight className="size-4" aria-hidden />, "Next page", { disabled: page >= totalPages })}
        </div>
      ) : null}
    </nav>
  );
}
