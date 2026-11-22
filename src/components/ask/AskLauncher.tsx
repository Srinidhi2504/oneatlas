"use client";
import { MessageSquareCode } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ASK_OPEN_EVENT, openAsk } from "./ask-events";

// The panel (Markdown renderer, playback, source viewer) is ~60 kB: load it on first use, not on every page view.
const loadPanel = () => import("./AskPanel").then((m) => m.AskPanel);
const AskPanel = dynamic(loadPanel, { ssr: false });

/** Header button for "Ask the code". The first open (button, palette or hero CTA) mounts the lazy panel. */
export function AskLauncher() {
  const [first, setFirst] = useState<{ question?: string } | null>(null);

  useEffect(() => {
    if (first) return; // mounted: the panel listens for later opens itself
    const onOpen = (e: Event) => setFirst({ question: (e as CustomEvent<{ question?: string }>).detail?.question });
    window.addEventListener(ASK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ASK_OPEN_EVENT, onOpen);
  }, [first]);

  return (
    <>
      <button
        type="button"
        onClick={() => openAsk()}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        aria-label="Ask the code: how this app works"
        aria-haspopup="dialog"
      >
        <MessageSquareCode className="size-4" aria-hidden />
        <span className="hidden xl:inline">Ask the code</span>
      </button>
      {first ? <AskPanel initialQuestion={first.question} /> : null}
    </>
  );
}
