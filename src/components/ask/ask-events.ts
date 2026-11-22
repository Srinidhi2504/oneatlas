// Plain module (no React, no panel code) so buttons anywhere can open "Ask the code" without bundling the panel.
export const ASK_OPEN_EVENT = "oneatlas:ask-open";

/** Open the panel from anywhere (command palette, buttons), optionally with a question to send. */
export const openAsk = (question?: string) => window.dispatchEvent(new CustomEvent(ASK_OPEN_EVENT, { detail: { question } }));
