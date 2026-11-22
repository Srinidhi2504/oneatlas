"use client";
// /code: browse the whole codebase like an editor. Data = the build-time source snapshot (GET /api/v1/code/file|search).
// URL holds the open file and line (?path=&line=), so every view is shareable; tabs are per visit.
import * as Dialog from "@radix-ui/react-dialog";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { Check, ChevronRight, Files, Link2, PanelLeft, Search, X } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/cn";
import { TONE } from "@/lib/tones";
import { highlight, languageOf } from "./highlight";
import { ancestors, buildTree, fileBadge, type TreeFile, type TreeNode } from "./tree";

const DEFAULT_FILE = "README.md";

interface FileData {
  path: string;
  lines: number;
  content: string;
}
interface SearchData {
  files: number;
  total: number;
  hits: { path: string; line: number; text: string }[];
}

function FileIcon({ path, className }: { path: string; className?: string }) {
  const b = fileBadge(path);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-[15px] min-w-[22px] shrink-0 items-center justify-center rounded-[3px] px-0.5 font-mono text-[8.5px] leading-none font-bold",
        b.tone === "muted" ? "bg-surface-2 text-muted" : [TONE[b.tone].soft, TONE[b.tone].text],
        className,
      )}
    >
      {b.label}
    </span>
  );
}

export function CodeExplorer({ files }: { files: TreeFile[] }) {
  const [{ path: urlPath, line }, setUrl] = useQueryStates({ path: parseAsString, line: parseAsInteger }, { history: "replace", scroll: false });
  const active = urlPath && files.some((f) => f.path === urlPath) ? urlPath : DEFAULT_FILE;
  const tree = useMemo(() => buildTree(files), [files]);
  const [tabs, setTabs] = useState<string[]>([active]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["src", "src/server", "src/app", ...ancestors(active)]));
  const [panel, setPanel] = useState<"files" | "search">("files");
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [quickOpen, setQuickOpen] = useState(false);

  const open = (path: string, at?: number) => {
    setTabs((t) => (t.includes(path) ? t : [...t, path].slice(-8)));
    setExpanded((e) => new Set([...e, ...ancestors(path)]));
    setUrl({ path, line: at ?? null });
    setSidebarOpen(false);
  };
  const closeTab = (path: string) => {
    const rest = tabs.filter((t) => t !== path);
    setTabs(rest.length ? rest : [DEFAULT_FILE]);
    if (path === active) setUrl({ path: rest[rest.length - 1] ?? DEFAULT_FILE, line: null });
  };
  // a file opened from the URL (shared link, back button) joins the tabs
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTabs((t) => (t.includes(active) ? t : [...t, active].slice(-8)));
  }, [active]);

  // Ctrl/Cmd+P: go to file (only on this page)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuickOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const file = useQuery<FileData>({
    queryKey: ["code-file", active],
    queryFn: ({ signal }) => apiGet<FileData>("/code/file", new URLSearchParams({ path: active }), signal).then((r) => r.data),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
  const lang = languageOf(active);
  const lines = useMemo(() => (file.data ? highlight(file.data.content, lang.lang) : []), [file.data, lang.lang]);
  const totalLines = file.data?.lines ?? files.find((f) => f.path === active)?.lines ?? 0;

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3 text-[11px] font-semibold text-muted">
        {panel === "files" ? `Explorer (${files.length} files)` : "Search the codebase"}
        <button type="button" onClick={() => setSidebarOpen(false)} className="inline-flex size-6 items-center justify-center rounded hover:bg-surface-2 md:hidden" aria-label="Close sidebar">
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
      {panel === "files" ? (
        <nav aria-label="Files" className="min-h-0 flex-1 overflow-y-auto py-1">
          <TreeList
            nodes={tree}
            depth={0}
            active={active}
            expanded={expanded}
            toggle={(p) =>
              setExpanded((e) => {
                const n = new Set(e);
                if (n.has(p)) n.delete(p);
                else n.add(p);
                return n;
              })
            }
            onOpen={(p) => open(p)}
          />
        </nav>
      ) : (
        <SearchPanel onOpen={open} />
      )}
    </div>
  );

  return (
    <div className="enter flex h-[calc(100dvh-13rem)] min-h-[540px] flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border bg-bg shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]">
      {/* title bar */}
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <span aria-hidden className="hidden items-center gap-1.5 sm:flex">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </span>
        <button type="button" onClick={() => setSidebarOpen(true)} className="inline-flex size-7 items-center justify-center rounded text-muted hover:bg-surface-2 md:hidden" aria-label="Open file explorer">
          <PanelLeft className="size-4" aria-hidden />
        </button>
        <span className="min-w-0 flex-1 truncate text-center font-mono text-xs text-muted">oneatlas / {active}</span>
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          className="hidden h-7 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-bg px-2.5 text-xs text-faint hover:border-border-strong sm:inline-flex"
          aria-keyshortcuts="Control+P Meta+P"
        >
          <Search className="size-3.5" aria-hidden />
          Go to file
          <kbd className="rounded border border-border px-1 text-[10px]">Ctrl P</kbd>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* activity bar */}
        <div className="hidden w-11 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-2 md:flex" role="tablist" aria-label="Sidebar">
          {(
            [
              ["files", Files, "Explorer"],
              ["search", Search, "Search"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={panel === key}
              onClick={() => setPanel(key)}
              title={label}
              aria-label={label}
              className={cn(
                "relative inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] transition-colors",
                panel === key ? "text-fg before:absolute before:inset-y-1.5 before:-left-1 before:w-0.5 before:rounded before:bg-accent" : "text-faint hover:text-fg",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
            </button>
          ))}
        </div>

        {/* sidebar: fixed column from md, drawer below */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-[color-mix(in_srgb,var(--surface)_55%,var(--bg))] md:block">{sidebar}</aside>
        {sidebarOpen ? (
          <div className="absolute inset-0 z-20 flex md:hidden">
            <aside className="w-[82%] max-w-[320px] border-r border-border bg-bg shadow-xl">
              <div className="flex gap-1 border-b border-border p-1.5">
                {(["files", "search"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setPanel(k)} className={cn("h-7 flex-1 rounded text-xs capitalize", panel === k ? "bg-surface-2 font-medium" : "text-muted")}>
                    {k}
                  </button>
                ))}
              </div>
              <div className="h-[calc(100%-41px)]">{sidebar}</div>
            </aside>
            <button type="button" className="flex-1 bg-[color-mix(in_srgb,var(--fg)_20%,transparent)]" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
          </div>
        ) : null}

        {/* editor */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 overflow-x-auto border-b border-border bg-surface" role="tablist" aria-label="Open files">
            {tabs.map((t) => {
              const isActive = t === active;
              return (
                <div
                  key={t}
                  role="tab"
                  aria-selected={isActive}
                  className={cn(
                    "group relative flex shrink-0 items-center gap-1.5 border-r border-border pr-1 pl-3 text-xs",
                    isActive ? "bg-bg text-fg after:absolute after:inset-x-0 after:top-0 after:h-0.5 after:bg-accent" : "text-muted hover:bg-bg/60",
                  )}
                  onAuxClick={(e) => e.button === 1 && closeTab(t)}
                >
                  <button type="button" onClick={() => open(t)} className="flex h-9 items-center gap-1.5">
                    <FileIcon path={t} />
                    {t.split("/").pop()}
                  </button>
                  <button
                    type="button"
                    onClick={() => closeTab(t)}
                    className={cn("inline-flex size-5 items-center justify-center rounded hover:bg-surface-2", !isActive && "opacity-0 group-hover:opacity-100")}
                    aria-label={`Close ${t}`}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
          <Breadcrumb path={active} line={line} summary={files.find((f) => f.path === active)?.summary ?? null} />
          <CodeBody path={active} lines={lines} loading={file.isPending} error={file.isError ? file.error.message : null} selected={line} onSelect={(n) => setUrl({ line: n })} dimmed={file.isFetching && !file.isPending} />
          <div className="flex h-6 shrink-0 items-center gap-4 overflow-hidden bg-accent px-3 font-mono text-[11px] whitespace-nowrap text-accent-fg">
            <span>{lang.label}</span>
            <span>{totalLines} lines</span>
            {line ? <span>Ln {line}</span> : null}
            <span className="hidden sm:inline">UTF-8</span>
            <span className="hidden sm:inline">LF</span>
            <span className="ml-auto">Read-only snapshot</span>
          </div>
        </div>
      </div>

      <QuickOpen open={quickOpen} onOpenChange={setQuickOpen} files={files} onPick={(p) => open(p)} />
    </div>
  );
}

function TreeList({
  nodes,
  depth,
  active,
  expanded,
  toggle,
  onOpen,
}: {
  nodes: TreeNode[];
  depth: number;
  active: string;
  expanded: Set<string>;
  toggle: (path: string) => void;
  onOpen: (path: string) => void;
}) {
  return (
    <ul role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Project files" : undefined}>
      {nodes.map((n) => {
        const pad = { paddingLeft: 8 + depth * 12 };
        if (n.file) {
          const isActive = n.path === active;
          return (
            <li key={n.path} role="treeitem" aria-selected={isActive}>
              <button
                type="button"
                onClick={() => onOpen(n.path)}
                title={n.file.summary ? `${n.path}\n${n.file.summary}` : n.path}
                className={cn("flex h-[26px] w-full items-center gap-1.5 pr-2 text-left text-[12.5px]", isActive ? "bg-accent-soft font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
                style={pad}
              >
                <span className="w-3 shrink-0" />
                <FileIcon path={n.path} />
                <span className="truncate">{n.name}</span>
              </button>
            </li>
          );
        }
        const isOpen = expanded.has(n.path);
        return (
          <li key={n.path} role="treeitem" aria-expanded={isOpen} aria-selected={false}>
            <button type="button" onClick={() => toggle(n.path)} className="flex h-[26px] w-full items-center gap-1 pr-2 text-left text-[12.5px] text-fg hover:bg-surface-2" style={pad}>
              <ChevronRight className={cn("size-3 shrink-0 text-faint transition-transform duration-150", isOpen && "rotate-90")} aria-hidden />
              <span className="truncate font-medium">{n.name}</span>
            </button>
            {isOpen ? <TreeList nodes={n.children!} depth={depth + 1} active={active} expanded={expanded} toggle={toggle} onOpen={onOpen} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Breadcrumb({ path, line, summary }: { path: string; line: number | null; summary: string | null }) {
  const [copied, setCopied] = useState(false);
  const parts = path.split("/");
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-xs">
      <nav aria-label="File path" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden whitespace-nowrap text-muted">
        {parts.map((p, i) => (
          <Fragment key={i}>
            {i > 0 ? <ChevronRight className="size-3 shrink-0 text-faint" aria-hidden /> : null}
            <span className={cn("shrink-0", i === parts.length - 1 && "font-medium text-fg")}>{p}</span>
          </Fragment>
        ))}
        {summary ? <span className="ml-3 hidden min-w-0 truncate text-faint lg:inline">{summary}</span> : null}
      </nav>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
        className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-faint hover:bg-surface-2 hover:text-fg"
      >
        {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Link2 className="size-3.5" aria-hidden />}
        <span aria-live="polite" className="sr-only sm:not-sr-only">{copied ? "Copied" : line ? `Copy link to line ${line}` : "Copy link"}</span>
      </button>
    </div>
  );
}

function CodeBody({
  path,
  lines,
  loading,
  error,
  selected,
  onSelect,
  dimmed,
}: {
  path: string;
  lines: ReturnType<typeof highlight>;
  loading: boolean;
  error: string | null;
  selected: number | null;
  onSelect: (line: number) => void;
  dimmed: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLDivElement>(null);
  // jump to the selected line when a file loads; otherwise start at the top
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    // scroll the code pane only (scrollIntoView would also scroll the page)
    box.scrollTop = selected && target.current ? target.current.offsetTop - box.clientHeight / 2 : 0;
    // only when the file itself changes (or first arrives), not on every line click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, lines.length]);

  if (error) return <div className="flex-1 p-6 text-13 text-danger">{error}</div>;
  if (loading)
    return (
      <div className="flex-1 space-y-2 p-4" aria-busy="true" aria-label="Loading file">
        {[62, 40, 78, 55, 30, 70, 48, 66].map((w, i) => (
          <span key={i} className="block h-3 animate-shimmer rounded bg-surface-2" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  const gutter = String(lines.length).length;
  return (
    <div ref={scroller} className={cn("relative min-h-0 flex-1 overflow-auto transition-opacity", dimmed && "opacity-60")} role="region" aria-label={`Contents of ${path}`} tabIndex={0}>
      <pre className="min-w-max py-2 font-mono text-13 leading-6">
        {lines.map((tokens, i) => {
          const n = i + 1;
          const hit = n === selected;
          return (
            <div key={n} ref={hit ? target : undefined} className={cn("group flex", hit ? "bg-[color-mix(in_srgb,var(--c-amber)_14%,transparent)]" : "hover:bg-surface")}>
              <button
                type="button"
                onClick={() => onSelect(n)}
                tabIndex={-1} // a tab stop per line would trap keyboard users; the region itself is focusable
                className={cn("sticky left-0 shrink-0 bg-inherit pr-4 pl-3 text-right select-none", hit ? "text-c-amber" : "text-faint group-hover:text-muted")}
                style={{ width: `${gutter + 3}ch` }}
                aria-label={`Line ${n}`}
              >
                {n}
              </button>
              <code className="pr-6 whitespace-pre">
                {tokens.length ? tokens.map((t, j) => (t.t === "plain" ? <Fragment key={j}>{t.v}</Fragment> : <span key={j} className={`tok-${t.t}`}>{t.v}</span>)) : " "}
              </code>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function highlightTerms(text: string, q: string): ReactNode {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="rounded-[2px] bg-[color-mix(in_srgb,var(--c-amber)_30%,transparent)] text-fg">{part}</mark> : part));
}

function SearchPanel({ onOpen }: { onOpen: (path: string, line: number) => void }) {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);
  const search = useQuery<SearchData>({
    queryKey: ["code-search", q],
    queryFn: ({ signal }) => apiGet<SearchData>("/code/search", new URLSearchParams({ q }), signal).then((r) => r.data),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  });
  const groups = useMemo(() => {
    const m = new Map<string, SearchData["hits"]>();
    for (const h of search.data?.hits ?? []) m.set(h.path, [...(m.get(h.path) ?? []), h]);
    return [...m];
  }, [search.data]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="p-2">
        <label htmlFor="code-search" className="sr-only">
          Search all files
        </label>
        <input
          id="code-search"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search, e.g. cacheTag"
          className="h-8 w-full rounded-[var(--radius-control)] border border-border bg-bg px-2.5 text-13 placeholder:text-faint focus:border-accent focus:outline-none"
        />
        <p className="mt-1.5 px-0.5 text-[11px] text-faint" aria-live="polite">
          {q.length < 2 ? "Type at least 2 characters. All words must be on the same line." : search.data ? `${search.data.total} results in ${search.data.files} files${search.data.total > search.data.hits.length ? ` (first ${search.data.hits.length})` : ""}` : "Searching…"}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {groups.map(([path, hits]) => (
          <div key={path} className="mb-1">
            <p className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium">
              <FileIcon path={path} />
              <span className="truncate">{path.split("/").pop()}</span>
              <span className="truncate text-[11px] font-normal text-faint">{path.split("/").slice(0, -1).join("/")}</span>
            </p>
            {hits.map((h) => (
              <button key={h.line} type="button" onClick={() => onOpen(h.path, h.line)} className="flex w-full gap-2 py-0.5 pr-2 pl-7 text-left font-mono text-[11.5px] text-muted hover:bg-surface-2 hover:text-fg">
                <span className="w-7 shrink-0 text-right text-faint">{h.line}</span>
                <span className="truncate">{highlightTerms(h.text, q)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickOpen({ open, onOpenChange, files, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; files: TreeFile[]; onPick: (path: string) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--fg)_22%,transparent)]" />
        <Dialog.Content
          className="fixed top-[14vh] left-1/2 z-50 w-[calc(100%-32px)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-[var(--radius-panel)] border border-border bg-bg shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Go to file</Dialog.Title>
          <Command loop label="Go to file">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-faint" aria-hidden />
              <Command.Input placeholder="Type a file name…" className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-faint" />
            </div>
            <Command.List className="max-h-[360px] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-13 text-muted">No file matches.</Command.Empty>
              {files.map((f) => (
                <Command.Item
                  key={f.path}
                  value={f.path}
                  onSelect={() => {
                    onPick(f.path);
                    onOpenChange(false);
                  }}
                  className="flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-13 data-[selected=true]:bg-surface-2"
                >
                  <FileIcon path={f.path} />
                  <span className="truncate font-medium">{f.path.split("/").pop()}</span>
                  <span className="truncate text-xs text-faint">{f.path.split("/").slice(0, -1).join("/")}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-faint">{f.lines} lines</span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
