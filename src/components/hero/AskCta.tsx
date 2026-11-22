"use client";
import { MessageSquareCode } from "lucide-react";
import { openAsk } from "@/components/ask/AskPanel";
import { buttonClass } from "@/components/ui/primitives";

export function AskCta() {
  return (
    <button type="button" onClick={() => openAsk()} className={buttonClass("ghost", "md", "h-10 px-4 text-fg")}>
      <MessageSquareCode aria-hidden />
      Ask how it’s built
    </button>
  );
}
