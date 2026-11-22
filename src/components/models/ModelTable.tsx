"use client";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import { Badge, LabAvatar, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { daysSince, formatDate, formatInteger, formatScore, formatTokens } from "@/lib/format";
import type { ModelSort } from "@/lib/schemas";
import type { ModelListItem } from "@/lib/types";
import { CapabilityIcons, ModalityIcons, PriceCell } from "./bits";
import { CompareCheckbox } from "./compare";

export const ROW_HEIGHT = "h-14"; // 56px: skeleton rows use the same height, so loading never shifts layout

export interface SortState {
  sort: ModelSort;
  order: "asc" | "desc";
}

interface Column {
  key: string;
  label: string;
  sort?: ModelSort;
  align?: "right";
  className?: string;
}

const COLUMNS: Column[] = [
  { key: "context", label: "Context", sort: "context", align: "right" },
  { key: "modalities", label: "Modalities" },
  { key: "caps", label: "Capabilities" },
  { key: "price", label: "Price /1M", sort: "price", align: "right" },
  { key: "providers", label: "Providers", sort: "providers", align: "right" },
  { key: "intelligence", label: "Intelligence", sort: "intelligence", align: "right" },
  { key: "released", label: "Released", sort: "released", align: "right" },
];

const typeLabel = (t: string) => t[0].toUpperCase() + t.slice(1);

export function ModelTable({
  items,
  sortState,
  onSort,
  loading,
  dimmed,
  skeletonRows = 12,
  caption = "AI models",
}: {
  items: ModelListItem[];
  sortState?: SortState;
  onSort?: (sort: ModelSort) => void;
  loading?: boolean;
  dimmed?: boolean;
  skeletonRows?: number;
  caption?: string;
}) {
  const header = (label: string, sort?: ModelSort, align?: "right") => {
    const active = sortState && sort && sortState.sort === sort;
    const ariaSort = active ? (sortState.order === "asc" ? "ascending" : "descending") : sort ? "none" : undefined;
    const Icon = active ? (sortState.order === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        key={label}
        scope="col"
        aria-sort={ariaSort}
        className={cn("h-10 px-2 text-xs font-medium whitespace-nowrap text-muted", align === "right" ? "text-right" : "text-left")}
      >
        {sort && onSort ? (
          <button
            type="button"
            onClick={() => onSort(sort)}
            className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-fg", active && "text-fg")}
          >
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
    <div
      className="relative overflow-x-auto rounded-[var(--radius-panel)] border border-border"
      role="region"
      aria-label={`${caption} table, scrolls horizontally`}
      tabIndex={0}
    >
      <table className={cn("w-full min-w-[940px] border-collapse text-13 transition-opacity", dimmed && "opacity-60")}>
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-border">
            <th scope="col" className="sticky left-0 z-20 w-10 bg-surface px-1">
              <span className="sr-only">Compare</span>
            </th>
            <th scope="col" aria-sort={sortState?.sort === "name" ? (sortState.order === "asc" ? "ascending" : "descending") : onSort ? "none" : undefined} className="sticky left-10 z-20 h-10 w-[232px] min-w-[200px] bg-surface px-3 text-left text-xs font-medium text-muted">
              {onSort ? (
                <button type="button" onClick={() => onSort("name")} className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-fg", sortState?.sort === "name" && "text-fg")}>
                  Model
                  {sortState?.sort === "name" ? (sortState.order === "asc" ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : <ArrowUpDown className="size-3 opacity-40" aria-hidden />}
                </button>
              ) : (
                "Model"
              )}
            </th>
            {COLUMNS.map((c) => header(c.label, c.sort, c.align))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i} className={cn(ROW_HEIGHT, "border-b border-border last:border-b-0")}>
                  <td className="sticky left-0 bg-bg px-3">
                    <Skeleton className="size-4" />
                  </td>
                  <td className="sticky left-10 bg-bg px-3">
                    <span className="flex items-center gap-2.5">
                      <Skeleton className="size-7 rounded-[7px]" />
                      <span className="space-y-1.5">
                        <Skeleton className="h-3 w-36" />
                        <Skeleton className="h-2.5 w-20" />
                      </span>
                    </span>
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-2">
                      <Skeleton className={cn("h-3", c.align === "right" ? "ml-auto w-12" : "w-16")} />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((m) => <Row key={m.id} m={m} />)}
        </tbody>
      </table>
    </div>
  );
}

function Row({ m }: { m: ModelListItem }) {
  const isNew = daysSince(m.releasedAt) <= 30;
  return (
    <tr className={cn(ROW_HEIGHT, "group border-b border-border last:border-b-0 hover:bg-surface")}>
      <td className="sticky left-0 z-[1] bg-bg px-1 text-center group-hover:bg-surface">
        <CompareCheckbox entry={{ id: m.id, name: m.name, labName: m.lab.name }} />
      </td>
      <th scope="row" className="sticky left-10 z-[1] max-w-[232px] bg-bg px-3 text-left font-normal group-hover:bg-surface">
        <span className="flex items-center gap-2.5">
          <LabAvatar slug={m.lab.slug} name={m.lab.name} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <Link href={`/models/${m.id}`} className="min-w-0 truncate font-medium text-fg hover:text-accent hover:underline hover:underline-offset-2">
                {m.name}
              </Link>
              {isNew ? <Badge tone="accent">New</Badge> : null}
              {m.deprecated ? <Badge tone="warning">Deprecated</Badge> : null}
              {m.type !== "text" ? <Badge>{typeLabel(m.type)}</Badge> : null}
            </span>
            <span className="block truncate text-xs text-muted">{m.lab.name}</span>
          </span>
        </span>
      </th>
      <td className="px-2 text-right leading-tight">
        <span className="block">{formatTokens(m.contextWindow)}</span>
        <span className="block text-xs text-faint">{m.maxOutputTokens ? `${formatTokens(m.maxOutputTokens)} out` : "N/A"}</span>
      </td>
      <td className="px-2">
        <ModalityIcons input={m.inputModalities} output={m.outputModalities} />
      </td>
      <td className="px-2">
        <CapabilityIcons caps={m.capabilities} />
      </td>
      <td className="px-2 text-right">
        <PriceCell pricing={m.pricing} />
      </td>
      <td className="px-2 text-right">{m.providerCount ? formatInteger(m.providerCount) : <span className="text-faint">0</span>}</td>
      <td className="px-2 text-right">{m.intelligenceIndex != null ? formatScore(m.intelligenceIndex) : <span className="text-faint">N/A</span>}</td>
      <td className="px-2 text-right whitespace-nowrap text-muted">{formatDate(m.releasedAt)}</td>
    </tr>
  );
}
