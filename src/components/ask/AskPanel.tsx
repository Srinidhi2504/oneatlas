"use client";
// "Ask the code": a chat panel where Claude explains this codebase by reading it (POST /api/v1/explain, streamed).
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowUp, Check, Copy, MessageSquareCode, RotateCcw, Square, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import type { ExplainEvent } from "@/server/explain/assistant";
import { Markdown, type Citation } from "./Markdown";

export const ASK_OPEN_EVENT = "oneatlas:ask-open";
/** Open the panel from anywhere (command palette, buttons), optionally with a question to send. */
export const openAsk = (question?: string) => window.dispatchEvent(new CustomEvent(ASK_OPEN_EVENT, { detail: { question } }));

interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: string[];
  status?: "streaming" | "done" | "error";
  error?: string;
}

const STORAGE_KEY = "oneatlas:ask";
const STARTERS = [
  "Walk me through what happens when I change a filter on the Models page, from the URL to the database and back.",
  "How are models.dev and OpenRouter joined into one catalog, and how is ambiguity handled?",
  "How does caching work, and how is it invalidated after a re-seed?",
  "What happens when the API receives an invalid query or an unknown model?",
];

interface Source {
  path: string;
  totalLines: number;
  start: number;
  target: number;
  lines: string[];
}

export function AskPanel() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState<{ loading: boolean; error?: string; data?: Source; cite: Citation } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const restored = useRef(false);

  // restore / persist the conversation for this tab (storage can throw: private mode, blocked site data)
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as Turn[];
      if (Array.isArray(saved)) setTurns(saved.filter((t) => t.status !== "streaming"));
    } catch {
      /* start empty */
    }
  }, []);
  useEffect(() => {
    if (busy) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-20)));
    } catch {
      /* not persisted */
    }
  }, [turns, busy]);

  // keep the newest content in view while streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      setDraft("");
      setSource(null);
      const history = [...turns.filter((t) => t.status !== "error" && t.content.trim()), { role: "user" as const, content: q }]
        .map((t) => ({ role: t.role, content: t.content }))
        .slice(-19);
      while (history.length && history[0].role !== "user") history.shift();
      setTurns((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "", steps: [], status: "streaming" }]);
      setBusy(true);
      setStatus("Reading the code…");

      const update = (fn: (t: Turn) => Turn) =>
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = fn(next[next.length - 1]);
          return next;
        });

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/v1/explain", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? `Request failed (${res.status}).`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const e = JSON.parse(line) as ExplainEvent;
            if (e.type === "text") update((t) => ({ ...t, content: t.content + e.text }));
            else if (e.type === "tool") {
              setStatus(e.label);
              update((t) => ({ ...t, steps: [...(t.steps ?? []), e.label] }));
            } else if (e.type === "error") update((t) => ({ ...t, status: "error", error: e.message }));
            else if (e.type === "done") update((t) => ({ ...t, status: "done" }));
          }
        }
        update((t) => (t.status === "streaming" ? { ...t, status: t.content.trim() ? "done" : "error", error: t.content.trim() ? undefined : "No answer came back. Try again." } : t));
        setStatus("Answer ready");
      } catch (err) {
        if (controller.signal.aborted) {
          update((t) => ({ ...t, status: t.content.trim() ? "done" : "error", error: t.content.trim() ? undefined : "Stopped." }));
          setStatus("Stopped");
        } else {
          update((t) => ({ ...t, status: "error", error: err instanceof Error ? err.message : "Something went wrong." }));
          setStatus("The answer failed");
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, turns],
  );

  // open (and optionally ask) from the command palette or any button
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<{ question?: string }>).detail?.question;
      if (q) void ask(q);
    };
    window.addEventListener(ASK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASK_OPEN_EVENT, onOpen);
  }, [ask]);

  /** Re-ask the last question: drop the failed pair, send it again. */
  const retryLast = () => {
    const question = turns[turns.length - 2]?.content;
    setTurns((prev) => prev.slice(0, -2));
    if (question) void ask(question);
  };

  const openSource = async (cite: Citation) => {
    setSource({ loading: true, cite });
    try {
      const res = await fetch(`/api/v1/explain/source?${new URLSearchParams({ path: cite.path, line: String(cite.line), ...(cite.end ? { end: String(cite.end) } : {}) })}`);
      const body = (await res.json()) as { data?: Source; error?: { message: string } };
      if (!res.ok || !body.data) throw new Error(body.error?.message ?? "Couldn’t load the file.");
      setSource({ loading: false, data: body.data, cite });
    } catch (err) {
      setSource({ loading: false, error: err instanceof Error ? err.message : "Couldn’t load the file.", cite });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(draft);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label="Ask the code: Claude explains how this app works"
      >
        <MessageSquareCode className="size-4" aria-hidden />
        <span className="hidden xl:inline">Ask the code</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--fg)_22%,transparent)]" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-bg shadow-[0_0_60px_-20px_rgba(0,0,0,0.35)] sm:w-[540px]"
          aria-describedby="ask-desc"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <header className="flex items-start gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-sm font-semibold">Ask the code</Dialog.Title>
              <p id="ask-desc" className="text-xs text-muted">
                Claude reads this app’s source to answer how it works. Citations open the file.
              </p>
            </div>
            {turns.length && !busy ? (
              <button
                type="button"
                onClick={() => {
                  setTurns([]);
                  setSource(null);
                  setStatus("Conversation cleared");
                }}
                className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Clear
              </button>
            ) : null}
            <Dialog.Close className="inline-flex size-8 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </header>

          <p className="sr-only" role="status" aria-live="polite">
            {status}
          </p>

          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-4">
              {turns.length === 0 ? (
                <div className="pt-2">
                  <p className="text-sm text-muted">Ask anything about how OneAtlas is built. Some places to start:</p>
                  <ul className="mt-3 space-y-1.5">
                    {STARTERS.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => void ask(s)}
                          className="w-full rounded-[var(--radius-control)] border border-border px-3 py-2.5 text-left text-13 leading-snug transition-colors hover:border-border-strong hover:bg-surface"
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-faint">Answers come from a snapshot of this repository’s source and docs, taken at build time.</p>
                </div>
              ) : (
                <ol className="space-y-6">
                  {turns.map((t, i) => (
                    <li key={i}>
                      {t.role === "user" ? (
                        <UserTurn text={t.content} />
                      ) : (
                        <AssistantTurn turn={t} onCite={openSource} onRetry={i === turns.length - 1 && !busy ? retryLast : undefined} />
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            {source ? <SourceViewer source={source} onClose={() => setSource(null)} /> : null}
          </div>

          <form
            className="border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(draft);
            }}
          >
            <div className="flex items-end gap-2 rounded-[var(--radius-panel)] border border-border bg-bg p-1.5 focus-within:border-accent">
              <label htmlFor="ask-input" className="sr-only">
                Your question about the code
              </label>
              <textarea
                id="ask-input"
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={2000}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={onKeyDown}
                placeholder="How does the explorer search work?"
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-faint"
              />
              {busy ? (
                <button type="button" onClick={() => abortRef.current?.abort()} className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-fg text-bg" aria-label="Stop answering">
                  <Square className="size-3.5" fill="currentColor" aria-hidden />
                </button>
              ) : (
                <button type="submit" disabled={!draft.trim()} className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-accent text-accent-fg disabled:opacity-40" aria-label="Send question">
                  <ArrowUp className="size-4" aria-hidden />
                </button>
              )}
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-faint">Enter to send, Shift+Enter for a new line. Powered by Claude; answers can be wrong, so check the cited code.</p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UserTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-[var(--radius-panel)] rounded-br-[3px] bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}

/** The route Claude took through the code: waypoints on a line while working, folded into a summary once answered. */
function Trail({ steps, live }: { steps: string[]; live: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (!steps.length && !live) return null;
  const show = live || expanded;
  return (
    <div className="mb-3">
      {!live ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="text-xs text-muted hover:text-fg">
          Traced through {steps.length} {steps.length === 1 ? "step" : "steps"} {expanded ? "(hide)" : "(show)"}
        </button>
      ) : null}
      {show ? (
        <ol className="relative mt-1.5 space-y-1 border-l border-accent/40 pl-3.5" aria-label="Steps taken to answer">
          {steps.map((s, i) => (
            <li key={i} className="relative text-xs text-muted">
              <span aria-hidden className="absolute top-[5px] -left-[18.5px] size-[7px] rounded-full border border-accent bg-bg" />
              <span className="font-mono text-[11.5px]">{s}</span>
            </li>
          ))}
          {live ? (
            <li className="relative text-xs text-faint">
              <span aria-hidden className="absolute top-[5px] -left-[18.5px] size-[7px] animate-pulse rounded-full bg-accent" />
              {steps.length ? "Reading…" : "Planning where to look…"}
            </li>
          ) : null}
        </ol>
      ) : null}
    </div>
  );
}

function AssistantTurn({ turn, onCite, onRetry }: { turn: Turn; onCite: (c: Citation) => void; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);
  const live = turn.status === "streaming";
  const answering = live && turn.content.trim().length > 0;
  return (
    <div>
      <Trail steps={turn.steps ?? []} live={live && !answering} />
      {turn.content.trim() ? <Markdown text={turn.content.trim()} onCite={onCite} /> : null}
      {live && answering ? <span aria-hidden className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-accent" /> : null}
      {turn.status === "error" ? (
        <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] px-3 py-2 text-13">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <span className="flex-1">{turn.error}</span>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="shrink-0 font-medium text-accent hover:underline">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {turn.status === "done" && turn.content.trim() ? (
        <div className="mt-2 flex gap-1">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(turn.content.trim());
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard blocked */
              }
            }}
            className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-xs text-faint hover:bg-surface-2 hover:text-fg"
          >
            {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            <span aria-live="polite">{copied ? "Copied" : "Copy answer"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SourceViewer({ source, onClose }: { source: { loading: boolean; error?: string; data?: Source; cite: Citation }; onClose: () => void }) {
  const targetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // block body on purpose: newer browsers return a Promise from scrollIntoView, and an effect must return nothing
    targetRef.current?.scrollIntoView({ block: "center" });
  }, [source.data]);
  const d = source.data;
  return (
    <section aria-label={`Source: ${source.cite.path}`} className="absolute inset-0 flex flex-col bg-bg">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button type="button" onClick={onClose} className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to answer
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={source.cite.path}>
          {source.cite.path}
          {d ? `:${d.target}${source.cite.end && source.cite.end > d.target ? `-${source.cite.end}` : ""}` : ""}
        </span>
        {d ? <span className="shrink-0 text-[11px] text-faint">{d.totalLines} lines</span> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {source.loading ? (
          <p className="p-4 text-13 text-muted">Opening {source.cite.path}…</p>
        ) : source.error ? (
          <p className="p-4 text-13 text-danger">{source.error}</p>
        ) : d ? (
          <pre className="py-2 font-mono text-[12px] leading-5">
            {d.lines.map((text, i) => {
              const n = d.start + i;
              const hit = n >= d.target && n <= (source.cite.end ?? d.target);
              return (
                <div key={n} ref={n === d.target ? targetRef : undefined} className={cn("flex", hit && "bg-accent-soft")}>
                  <span className={cn("w-12 shrink-0 pr-3 text-right select-none", hit ? "text-accent" : "text-faint")}>{n}</span>
                  <code className="pr-4 whitespace-pre">{text || " "}</code>
                </div>
              );
            })}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
