// One colour per meaning, used everywhere the same thing appears (chips, icons, badges, bars, the globe).
// Plain module (not "use client") so server and client components share it; Tailwind sees the literal class names.
import type { Capability, ModelType } from "./types";

export type Tone = "teal" | "blue" | "violet" | "amber" | "coral" | "green" | "rose";

export const TONE: Record<Tone, { text: string; soft: string; border: string; color: string }> = {
  teal: { text: "text-accent", soft: "bg-accent-soft", border: "border-accent/40", color: "var(--accent)" },
  blue: { text: "text-c-blue", soft: "bg-c-blue-soft", border: "border-c-blue/40", color: "var(--c-blue)" },
  violet: { text: "text-c-violet", soft: "bg-c-violet-soft", border: "border-c-violet/40", color: "var(--c-violet)" },
  amber: { text: "text-c-amber", soft: "bg-c-amber-soft", border: "border-c-amber/40", color: "var(--c-amber)" },
  coral: { text: "text-c-coral", soft: "bg-c-coral-soft", border: "border-c-coral/40", color: "var(--c-coral)" },
  green: { text: "text-c-green", soft: "bg-c-green-soft", border: "border-c-green/40", color: "var(--c-green)" },
  rose: { text: "text-c-rose", soft: "bg-c-rose-soft", border: "border-c-rose/40", color: "var(--c-rose)" },
};

/** capability flag on a model -> tone */
export const CAPABILITY_TONE = { reasoning: "violet", toolCall: "amber", structuredOutput: "blue", vision: "coral", openWeights: "green" } as const satisfies Record<string, Tone>;

/** capability filter key (API) -> tone, matching the flag colours above */
export const FILTER_TONE: Record<Capability, Tone> = { reasoning: "violet", tools: "amber", structured: "blue", vision: "coral", open: "green", free: "rose" };

export const TYPE_TONE: Record<ModelType, Tone> = {
  text: "teal",
  image: "coral",
  video: "violet",
  embedding: "blue",
  speech: "amber",
  transcription: "green",
  rerank: "rose",
  realtime: "blue",
};

/** Artificial Analysis indices in teal, Design Arena Elo in coral */
export const benchmarkTone = (group: string): Tone => (group === "Design Arena" ? "coral" : "teal");

/** podium / top-three ranks: gold, silver, bronze */
export const MEDAL: Record<number, Tone> = { 1: "amber", 2: "blue", 3: "coral" };
