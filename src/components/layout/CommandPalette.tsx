"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Boxes, Building2, CornerDownLeft, Cpu, LayoutGrid, MessageSquareCode, Search, Server, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { openAsk } from "@/components/ask/ask-events";
import { api } from "@/lib/api";
import { formatInteger } from "@/lib/format";
import type { SearchResult } from "@/lib/types";

const PAGES = [
  { href: "/", label: "Models explorer", icon: LayoutGrid },
  { href: "/rankings/reach", label: "Rankings", icon: Trophy },
  { href: "/benchmarks", label: "Benchmarks", icon: Boxes },
  { href: "/labs", label: "Labs", icon: Building2 },
  { href: "/providers", label: "Providers", icon: Server },
  { href: "/compare", label: "Compare models", icon: Cpu },
];

const itemClass =
  "flex h-10 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm text-fg data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-faint";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Global search (Cmd/Ctrl+K): models, labs and providers from /api/v1/search, full keyboard navigation via cmdk. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 150);
  const { data, isFetching, isError } = useQuery<SearchResult>({
    queryKey: ["search", q],
    queryFn: ({ signal }) => api.search(q, signal).then((r) => r.data),
    enabled: open && q.length > 0,
    placeholderData: keepPreviousData,
  });

  const go = (href: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  };

  const results = q && data ? data : null;
  const count = results ? results.models.length + results.labs.length + results.providers.length : 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--fg)_28%,transparent)]" />
        <Dialog.Content
          className="fixed top-[12vh] left-1/2 z-50 w-[calc(100%-32px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-bg shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Search OneAtlas</Dialog.Title>
          <Command shouldFilter={false} loop label="Search models, labs and providers">
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-faint" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search models, labs, providers…"
                className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-faint"
              />
              {isFetching ? <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden /> : null}
            </div>
            <div aria-live="polite" className="sr-only">
              {results ? `${count} result${count === 1 ? "" : "s"}` : ""}
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
              {!q ? (
                <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-faint">
                  <Command.Item value="ask" onSelect={() => { onOpenChange(false); openAsk(); }} className={itemClass}>
                    <MessageSquareCode aria-hidden />
                    Ask the code how this app works
                  </Command.Item>
                  {PAGES.map((p) => (
                    <Command.Item key={p.href} value={p.href} onSelect={() => go(p.href)} className={itemClass}>
                      <p.icon aria-hidden />
                      {p.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {q ? (
                <Command.Group heading="Ask" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-faint">
                  <Command.Item
                    value="ask-the-code"
                    onSelect={() => {
                      onOpenChange(false);
                      setQuery("");
                      openAsk(query.trim());
                    }}
                    className={itemClass}
                  >
                    <MessageSquareCode aria-hidden />
                    <span className="truncate">Ask the code: “{query.trim()}”</span>
                  </Command.Item>
                </Command.Group>
              ) : null}
              {q && isError ? <p className="px-3 py-6 text-center text-muted">Search failed. Check your connection and try again.</p> : null}
              {results && count === 0 ? (
                <p className="px-3 py-6 text-center text-muted">
                  No models, labs or providers match “{q}”. Try a shorter query, e.g. “claude” or “gpt4o”.
                </p>
              ) : null}
              {results ? (
                <>
                  <ResultGroup heading="Models">
                    {results.models.map((m) => (
                      <Command.Item key={m.id} value={`model:${m.id}`} onSelect={() => go(`/models/${m.id}`)} className={itemClass}>
                        <Cpu aria-hidden />
                        <span className="truncate">{m.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-faint">{m.labName}</span>
                      </Command.Item>
                    ))}
                  </ResultGroup>
                  <ResultGroup heading="Labs">
                    {results.labs.map((l) => (
                      <Command.Item key={l.slug} value={`lab:${l.slug}`} onSelect={() => go(`/labs/${l.slug}`)} className={itemClass}>
                        <Building2 aria-hidden />
                        <span className="truncate">{l.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-faint">{formatInteger(l.modelCount)} models</span>
                      </Command.Item>
                    ))}
                  </ResultGroup>
                  <ResultGroup heading="Providers">
                    {results.providers.map((p) => (
                      <Command.Item key={p.slug} value={`provider:${p.slug}`} onSelect={() => go(`/providers/${p.slug}`)} className={itemClass}>
                        <Server aria-hidden />
                        <span className="truncate">{p.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-faint">{formatInteger(p.modelCount)} models</span>
                      </Command.Item>
                    ))}
                  </ResultGroup>
                </>
              ) : null}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-border bg-surface px-4 py-2 text-xs text-faint">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-bg px-1">↑</kbd>
                <kbd className="rounded border border-border bg-bg px-1">↓</kbd> to move
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-bg px-1">
                  <CornerDownLeft className="inline size-3" aria-label="Enter" />
                </kbd>
                to open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-bg px-1">esc</kbd> to close
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ResultGroup({ heading, children }: { heading: string; children: React.ReactNode[] }) {
  if (!children.length) return null;
  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-faint"
    >
      {children}
    </Command.Group>
  );
}
