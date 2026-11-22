"use client";
import * as Popover from "@radix-ui/react-popover";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import type { SearchResult } from "@/lib/types";

/** "Add model" popover: type to search /api/v1/search, pick with keyboard or mouse. */
export function ModelPicker({ onPick, exclude = [], label = "Add model", variant = "secondary" }: { onPick: (m: SearchResult["models"][number]) => void; exclude?: string[]; label?: string; variant?: "primary" | "secondary" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 150);
    return () => clearTimeout(t);
  }, [query]);
  const { data, isFetching } = useQuery<SearchResult>({
    queryKey: ["search", q],
    queryFn: ({ signal }) => api.search(q, signal).then((r) => r.data),
    enabled: open && q.length > 0,
    placeholderData: keepPreviousData,
  });
  const models = (q && data ? data.models : []).filter((m) => !exclude.includes(m.id));

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={buttonClass(variant, "md")}>
        <Plus aria-hidden />
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-[var(--radius-panel)] border border-border bg-bg shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
          <Command shouldFilter={false} loop label="Find a model to compare">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-faint" aria-hidden />
              <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder="Search models…" className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-faint" />
              {isFetching ? <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden /> : null}
            </div>
            <Command.List className="max-h-72 overflow-y-auto p-1.5">
              {!q ? <p className="px-2.5 py-4 text-center text-13 text-muted">Type a model name, e.g. “sonnet” or “gpt4o”.</p> : null}
              {q && data && !models.length ? <p className="px-2.5 py-4 text-center text-13 text-muted">No models match “{q}”.</p> : null}
              {models.map((m) => (
                <Command.Item
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    onPick(m);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-13 data-[selected=true]:bg-surface-2"
                >
                  <span className="truncate">{m.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-faint">{m.labName}</span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
