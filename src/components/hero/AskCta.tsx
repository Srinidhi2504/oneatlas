"use client";
// Hero button that opens the "Ask the code" panel.
import { MessageSquareCode } from "lucide-react";
import { openAsk } from "@/components/ask/ask-events";
import { buttonClass } from "@/components/ui/primitives";

export function AskCta() {
  return (
    <button type="button" onClick={() => openAsk()} className={buttonClass("ghost", "md", "h-10 px-4 text-fg")}>
      <MessageSquareCode aria-hidden />
      Ask how it’s built
    </button>
  );
}
