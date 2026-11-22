"use client";
// "Ask the code". Two modes:
//  - Prepared (default, free): curated answers from ./knowledge, played back with a reading trail, streamed text,
//    build-time-resolved citations and follow-up questions. No model call, no cost.
//  - Live (when the deployment has ANTHROPIC_API_KEY): Claude reads the code through tools (POST /api/v1/explain).
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowUp, Check, Copy, List, RotateCcw, Sparkles, Square, TriangleAlert, X, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import type { ExplainEvent } from "@/server/explain/assistant";
import type { PreparedAnswer } from "./knowledge";
import { Markdown, type Citation } from "./Markdown";

import { ASK_OPEN_EVENT } from "./ask-events";

type Mode = "prepared" | "live";
interface Turn {
  role: "user" | "assistant";
  content: string;
  steps?: string[];
  status?: "streaming" | "done" | "error";
  error?: string;
  source?: Mode | "fallback";
  related?: string[]; // follow-up question ids
}
interface Kb {
  KNOWLEDGE: PreparedAnswer[];
  matchQuestion: (q: string) => { entry: PreparedAnswer } | null;
  suggestQuestions: (q: string, n?: number) => PreparedAnswer[];
  resolveAnchors: (text: string, anchors: Record<string, number>) => string;
  anchors: Record<string, number>;
}
interface Source {
  path: string;
  totalLines: number;
  start: number;
  target: number;
  lines: string[];
}

const STORAGE_KEY = "oneatlas:ask";
const STEP_MS = 420;
const CHUNK_MS = 18;

/** The prepared answers and their citation map load only when the panel first opens (kept out of page JS). */
async function loadKb(): Promise<Kb> {
  const [mod, anchors] = await Promise.all([import("./knowledge"), import("@/generated/ask-anchors.json").then((m) => m.default as Record<string, number>)]);
  return { ...mod, anchors };
}

/** Mounted by AskLauncher on first open, so it starts open (with the question that opened it, if any). */
export function AskPanel({ initialQuestion }: { initialQuestion?: string }) {
  const [open, setOpen] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<Mode>("prepared");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [kb, setKb] = useState<Kb | null>(null);
  const [browse, setBrowse] = useState(false);
  const [source, setSource] = useState<{ loading: boolean; error?: string; data?: Source; cite: Citation } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timers = useRef<number[]>([]);
  const finishPlayback = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const restored = useRef(false);
  const pending = useRef<string | null>(null);

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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns.slice(-24)));
    } catch {
      /* not persisted */
    }
  }, [turns, busy]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // first open: load the prepared answers and ask the server whether Live mode exists
  useEffect(() => {
    if (!open || kb) return;
    let cancelled = false;
    loadKb().then((k) => !cancelled && setKb(k));
    fetch("/api/v1/explain")
      .then((r) => r.json())
      .then((b: { data?: { live?: boolean } }) => !cancelled && setLiveAvailable(!!b.data?.live))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, kb]);

  // a new question always scrolls into view; while an answer streams, follow it only if the reader is at the bottom
  const turnCount = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const added = turns.length > turnCount.current;
    turnCount.current = turns.length;
    if (added) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const updateLast = (fn: (t: Turn) => Turn) =>
    setTurns((prev) => {
      const next = [...prev];
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  /** Play a prepared answer like a live one: trail steps first, then the text in small chunks. */
  const play = useCallback((entry: PreparedAnswer, k: Kb) => {
    const full = k.resolveAnchors(entry.answer, k.anchors);
    const tokens = full.match(/\S+\s*/g) ?? [full];
    setBusy(true);
    setStatus("Reading the code…");
    const done = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      updateLast((t) => ({ ...t, steps: entry.steps, content: full, status: "done" }));
      setBusy(false);
      setStatus("Answer ready");
      finishPlayback.current = null;
      inputRef.current?.focus();
    };
    finishPlayback.current = done;
    entry.steps.forEach((step, i) =>
      later(STEP_MS * (i + 1) + Math.random() * 120, () => {
        setStatus(step);
        updateLast((t) => ({ ...t, steps: [...(t.steps ?? []), step] }));
      }),
    );
    let pos = 0;
    const tick = () => {
      pos = Math.min(tokens.length, pos + 3);
      updateLast((t) => ({ ...t, content: tokens.slice(0, pos).join("") }));
      if (pos < tokens.length) later(CHUNK_MS, tick);
      else done();
    };
    later(STEP_MS * (entry.steps.length + 1) + 250, tick);
  }, []);

  const askLive = useCallback(async (q: string, history: { role: "user" | "assistant"; content: string }[]) => {
    setBusy(true);
    setStatus("Reading the code…");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/v1/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: q }] }),
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
          if (e.type === "text") updateLast((t) => ({ ...t, content: t.content + e.text }));
          else if (e.type === "tool") {
            setStatus(e.label);
            updateLast((t) => ({ ...t, steps: [...(t.steps ?? []), e.label] }));
          } else if (e.type === "error") updateLast((t) => ({ ...t, status: "error", error: e.message }));
          else if (e.type === "done") updateLast((t) => ({ ...t, status: "done" }));
        }
      }
      updateLast((t) => (t.status === "streaming" ? { ...t, status: t.content.trim() ? "done" : "error", error: t.content.trim() ? undefined : "No answer came back. Try again." } : t));
      setStatus("Answer ready");
    } catch (err) {
      if (controller.signal.aborted) updateLast((t) => ({ ...t, status: t.content.trim() ? "done" : "error", error: t.content.trim() ? undefined : "Stopped." }));
      else updateLast((t) => ({ ...t, status: "error", error: err instanceof Error ? err.message : "Something went wrong." }));
      setStatus(controller.signal.aborted ? "Stopped" : "The answer failed");
    } finally {
      abortRef.current = null;
      setBusy(false);
      inputRef.current?.focus();
    }
  }, []);

  const ask = useCallback(
    (question: string, opts: { id?: string; forceLive?: boolean } = {}) => {
      const q = question.trim();
      if (!q || busy) return;
      if (!kb && !opts.forceLive) {
        pending.current = q; // the prepared answers are still loading: ask as soon as they arrive
        return;
      }
      setDraft("");
      setSource(null);
      setBrowse(false);
      const live = opts.forceLive || (mode === "live" && liveAvailable);
      const history = turns
        .filter((t) => t.status !== "error" && t.content.trim() && t.source !== "fallback")
        .map((t) => ({ role: t.role, content: t.content }))
        .slice(-18);
      while (history.length && history[0].role !== "user") history.shift();

      if (live) {
        setTurns((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "", steps: [], status: "streaming", source: "live" }]);
        void askLive(q, history);
        return;
      }
      const entry = opts.id ? kb!.KNOWLEDGE.find((k) => k.id === opts.id) : kb!.matchQuestion(q)?.entry;
      if (entry) {
        setTurns((prev) => [...prev, { role: "user", content: q }, { role: "assistant", content: "", steps: [], status: "streaming", source: "prepared", related: entry.related }]);
        play(entry, kb!);
        return;
      }
      setTurns((prev) => [
        ...prev,
        { role: "user", content: q },
        {
          role: "assistant",
          status: "done",
          source: "fallback",
          related: kb!.suggestQuestions(q, 3).map((s) => s.id),
          content: `I don’t have a prepared answer for that one yet. Prepared answers are written and checked against the code, so they cover the questions people ask most. ${
            liveAvailable
              ? "You can send this question to Claude, which will read the code to answer it, or pick a close match below."
              : "Live AI is built in but switched off on this deployment to avoid API costs. These are the closest questions I can answer:"
          }`,
        },
      ]);
      setStatus("No prepared answer; suggestions shown");
    },
    [busy, kb, mode, liveAvailable, turns, askLive, play],
  );

  // a question sent before the prepared answers loaded
  useEffect(() => {
    if (kb && pending.current) {
      const q = pending.current;
      pending.current = null;
      ask(q);
    }
  }, [kb, ask]);

  // open (and optionally ask) from the command palette or any button
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<{ question?: string }>).detail?.question;
      if (q) ask(q);
    };
    window.addEventListener(ASK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASK_OPEN_EVENT, onOpen);
  }, [ask]);

  // the question that opened the panel for the first time (queued until the prepared answers load)
  const initialAsked = useRef(false);
  useEffect(() => {
    if (initialAsked.current || !initialQuestion) return;
    initialAsked.current = true;
    ask(initialQuestion);
  }, [initialQuestion, ask]);

  const stop = () => {
    if (finishPlayback.current) finishPlayback.current(); // prepared: show the full answer now
    else abortRef.current?.abort();
  };

  const retryLast = () => {
    const question = turns[turns.length - 2]?.content;
    setTurns((prev) => prev.slice(0, -2));
    if (question) ask(question);
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
      ask(draft);
    }
  };

  const questions = kb?.KNOWLEDGE ?? [];
  const byId = (id: string) => questions.find((q) => q.id === id);
  const liveOn = mode === "live" && liveAvailable;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--fg)_22%,transparent)]" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-bg shadow-[0_0_60px_-20px_rgba(0,0,0,0.35)] sm:w-[560px]"
          style={{ animation: "ask-slide 0.34s cubic-bezier(0.2, 0.7, 0.2, 1) both" }}
          aria-describedby="ask-desc"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <header className="flex items-start gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-sm font-semibold">Ask the code</Dialog.Title>
              <p id="ask-desc" className="text-xs text-muted">
                {liveOn ? "Claude reads this app’s source to answer. Citations open the file." : "Answers verified against the code. Citations open the exact lines."}
              </p>
            </div>
            <div className="flex items-center rounded-[var(--radius-control)] border border-border p-0.5" role="radiogroup" aria-label="Answer mode">
              {(["prepared", "live"] as const).map((m) => {
                const disabled = m === "live" && !liveAvailable;
                const active = m === "live" ? liveOn : !liveOn;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled || busy}
                    onClick={() => setMode(m)}
                    title={disabled ? "Live AI needs ANTHROPIC_API_KEY on the server. Ask “How does this assistant work?” for details." : undefined}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-[4px] px-2 text-xs transition-colors disabled:cursor-not-allowed",
                      active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg",
                      disabled && "opacity-50",
                    )}
                  >
                    {m === "prepared" ? <Zap className="size-3" aria-hidden /> : <Sparkles className="size-3" aria-hidden />}
                    {m === "prepared" ? "Prepared" : "Live"}
                  </button>
                );
              })}
            </div>
            {turns.length && !busy ? (
              <button
                type="button"
                onClick={() => {
                  setTurns([]);
                  setSource(null);
                  setStatus("Conversation cleared");
                }}
                className="inline-flex size-8 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg"
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <RotateCcw className="size-3.5" aria-hidden />
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
              {turns.length === 0 || browse ? (
                <Welcome questions={questions} liveAvailable={liveAvailable} onPick={(q) => ask(q.question, { id: q.id })} onBack={turns.length ? () => setBrowse(false) : undefined} />
              ) : (
                <ol className="space-y-6">
                  {turns.map((t, i) => (
                    <li key={i} className="enter">
                      {t.role === "user" ? (
                        <UserTurn text={t.content} />
                      ) : (
                        <AssistantTurn
                          turn={t}
                          onCite={openSource}
                          onRetry={i === turns.length - 1 && !busy && t.source === "live" ? retryLast : undefined}
                          followUps={i === turns.length - 1 && !busy ? (t.related ?? []).map(byId).filter((x): x is PreparedAnswer => !!x) : []}
                          onFollowUp={(q) => ask(q.question, { id: q.id })}
                          onAskLive={t.source === "fallback" && liveAvailable && i === turns.length - 1 ? () => ask(turns[i - 1].content, { forceLive: true }) : undefined}
                        />
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            {source ? <SourceViewer source={source} onClose={() => setSource(null)} onLeave={() => setOpen(false)} /> : null}
          </div>

          <form
            className="border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <div className="flex items-end gap-2 rounded-[var(--radius-panel)] border border-border bg-bg p-1.5 transition-colors focus-within:border-accent">
              {turns.length > 0 && !browse ? (
                <button
                  type="button"
                  onClick={() => setBrowse(true)}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-surface-2 hover:text-fg"
                  aria-label="Browse all questions"
                  title="Browse all questions"
                >
                  <List className="size-4" aria-hidden />
                </button>
              ) : null}
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
                placeholder="Ask how something works, e.g. “how does search handle gpt4o?”"
                className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-faint"
              />
              {busy ? (
                <button type="button" onClick={stop} className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-fg text-bg transition-transform active:scale-95" aria-label="Stop and show the answer">
                  <Square className="size-3.5" fill="currentColor" aria-hidden />
                </button>
              ) : (
                <button type="submit" disabled={!draft.trim()} className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-accent text-accent-fg transition-transform active:scale-95 disabled:opacity-40" aria-label="Send question">
                  <ArrowUp className="size-4" aria-hidden />
                </button>
              )}
            </div>
            <p className="mt-1.5 px-1 text-[11px] text-faint">
              Enter to send, Shift+Enter for a new line. {liveOn ? "Live answers come from Claude and can be wrong: check the cited code." : "Prepared answers are free and instant."}
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Welcome({ questions, liveAvailable, onPick, onBack }: { questions: PreparedAnswer[]; liveAvailable: boolean; onPick: (q: PreparedAnswer) => void; onBack?: () => void }) {
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const shown = questions.filter((q) => !f || q.question.toLowerCase().includes(f) || q.keywords.some((k) => k.includes(f)));
  return (
    <div className="enter">
      {onBack ? (
        <button type="button" onClick={onBack} className="mb-3 inline-flex h-8 items-center gap-1 rounded px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to the conversation
        </button>
      ) : (
        <div className="mb-4 rounded-[var(--radius-panel)] border border-border bg-surface p-3 text-13 leading-relaxed">
          <p className="font-medium text-fg">Hi! I explain how OneAtlas is built, from the database to the pixels.</p>
          <p className="mt-1 text-muted">
            Pick a question or type your own. Answers are written against the real code, and every{" "}
            <span className="rounded-[4px] bg-accent-soft px-1 font-mono text-[11.5px] text-accent">file:line</span> opens that code.{" "}
            {liveAvailable ? "Switch to Live to let Claude read the code for anything else." : "Live AI is built in too, switched off here to avoid API costs (ask “How does this assistant work?”)."}
          </p>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted">Most important first</p>
        <label className="sr-only" htmlFor="ask-filter">
          Filter questions
        </label>
        <input
          id="ask-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter questions"
          className="h-7 w-36 rounded-[var(--radius-control)] border border-border bg-bg px-2 text-xs placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>
      {questions.length === 0 ? (
        <div className="space-y-1.5" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="block h-10 animate-shimmer rounded-[var(--radius-control)] bg-surface-2" />
          ))}
        </div>
      ) : (
        <ol className="space-y-1.5">
          {shown.map((q, i) => (
            <li key={q.id} className="enter" style={{ ["--stagger" as string]: Math.min(i, 10) * 0.35 }}>
              <button
                type="button"
                onClick={() => onPick(q)}
                className="flex w-full items-start gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2.5 text-left text-13 leading-snug transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-border-strong hover:bg-surface active:translate-y-0"
              >
                <span className="w-5 shrink-0 pt-px text-right text-xs text-faint tabular-nums">{questions.indexOf(q) + 1}</span>
                <span className="flex-1">{q.question}</span>
              </button>
            </li>
          ))}
          {!shown.length ? <li className="px-1 py-2 text-13 text-muted">No question matches “{filter}”. Type it in the box below instead.</li> : null}
        </ol>
      )}
    </div>
  );
}

function UserTurn({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-[var(--radius-panel)] rounded-br-[3px] bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap">{text}</p>
    </div>
  );
}

/** The route taken through the code: waypoints on a line while working, folded into a summary once answered. */
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
            <li key={i} className="enter relative text-xs text-muted">
              <span aria-hidden className="pop-in absolute top-[5px] -left-[18.5px] size-[7px] rounded-full border border-accent bg-bg" />
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

function AssistantTurn({
  turn,
  onCite,
  onRetry,
  followUps,
  onFollowUp,
  onAskLive,
}: {
  turn: Turn;
  onCite: (c: Citation) => void;
  onRetry?: () => void;
  followUps: PreparedAnswer[];
  onFollowUp: (q: PreparedAnswer) => void;
  onAskLive?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const live = turn.status === "streaming";
  const answering = live && turn.content.trim().length > 0;
  return (
    <div>
      {turn.source !== "fallback" ? <Trail steps={turn.steps ?? []} live={live && !answering} /> : null}
      {turn.content.trim() ? <Markdown text={turn.content.trim()} onCite={onCite} /> : null}
      {answering ? <span aria-hidden className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-accent" /> : null}
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
      {onAskLive ? (
        <button type="button" onClick={onAskLive} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-control)] bg-accent px-3 text-13 font-medium text-accent-fg">
          <Sparkles className="size-3.5" aria-hidden />
          Ask Claude live (uses the API)
        </button>
      ) : null}
      {turn.status === "done" && turn.content.trim() && turn.source !== "fallback" ? (
        <div className="mt-2 flex items-center gap-2">
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
          <span className="text-[11px] text-faint">{turn.source === "live" ? "Live answer from Claude" : "Prepared answer, verified against the code"}</span>
        </div>
      ) : null}
      {followUps.length ? (
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-muted">{turn.source === "fallback" ? "Closest questions" : "Ask next"}</p>
          <ul className="flex flex-col gap-1.5">
            {followUps.map((q, i) => (
              <li key={q.id} className="enter" style={{ ["--stagger" as string]: i * 0.6 }}>
                <button
                  type="button"
                  onClick={() => onFollowUp(q)}
                  className="w-full rounded-[var(--radius-control)] border border-border px-3 py-2 text-left text-13 leading-snug transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-accent/50 hover:bg-accent-soft"
                >
                  {q.question}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SourceViewer({ source, onClose, onLeave }: { source: { loading: boolean; error?: string; data?: Source; cite: Citation }; onClose: () => void; onLeave: () => void }) {
  const targetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // block body on purpose: newer browsers return a Promise from scrollIntoView, and an effect must return nothing
    targetRef.current?.scrollIntoView({ block: "center" });
  }, [source.data]);
  const d = source.data;
  return (
    <section aria-label={`Source: ${source.cite.path}`} className="absolute inset-0 flex flex-col bg-bg" style={{ animation: "rise 0.22s ease-out both" }}>
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button type="button" onClick={onClose} className="inline-flex h-8 items-center gap-1 rounded px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to answer
        </button>
        <span className="min-w-0 flex-1 truncate font-mono text-xs" title={source.cite.path}>
          {source.cite.path}
          {d ? `:${d.target}${source.cite.end && source.cite.end > d.target ? `-${source.cite.end}` : ""}` : ""}
        </span>
        {d ? (
          <Link
            href={`/code?path=${encodeURIComponent(source.cite.path)}&line=${d.target}`}
            onClick={onLeave}
            className="shrink-0 rounded px-1.5 py-1 text-[11px] font-medium text-accent hover:bg-accent-soft"
          >
            Open in editor
          </Link>
        ) : null}
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
