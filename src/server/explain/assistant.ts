// "Ask the code": Claude explains this codebase by reading it. A bounded, streaming tool loop over the code index:
// the model searches and reads files (read-only, in-memory), then answers with `path:line` citations.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { codeIndex } from "../code-index";
import { listFiles, projectMap, readFile, searchCode, type IndexedFile } from "./code-tools";

const MODEL = "claude-opus-5-5";
const MAX_ROUNDS = 6; // tool rounds per question; the last round must answer (tool_choice "none")
const MAX_TOKENS = 16_000; // deliberate cap per round for a public demo endpoint

export type ExplainEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; label: string }
  | { type: "done"; rounds: number }
  | { type: "error"; message: string };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// ---------- prompt (byte-stable: no dates or ids, so tools + system are served from the prompt cache) ----------

let cachedSystem: string | null = null;
function systemPrompt(files: IndexedFile[]): string {
  if (cachedSystem) return cachedSystem;
  const doc = (p: string) => files.find((f) => f.path === p)?.content ?? "";
  cachedSystem = `You are the built-in guide to the OneAtlas codebase, shown in a chat panel inside the running app. People ask how the product works; you answer by reading the real source with your tools and explaining it end to end.

How to answer:
- Ground every claim in code you have read in this conversation. Cite locations as \`path:line\` or \`path:start-end\` (exact paths from the project map); the UI turns them into links that open the source.
- For "how does X work" questions, follow the flow through the layers in the order a request travels (UI component, client fetch, route handler, Zod schema, service, Prisma/Postgres, mapper, response) and name the functions involved. Mention the design decision behind a choice when docs/03-architecture.md records one.
- Use search_code to locate things and read_file with line ranges to confirm them; a few targeted reads beat reading whole files.
- Structure: one or two sentences that answer directly, then numbered steps or short sections, then the key files. Keep code excerpts short (under about 15 lines) and only when they make the point.
- If something is not in the code, say so rather than guessing. If a question is unrelated to this codebase, say briefly what you can help with.

Project map (every file in the snapshot, with its own one-line description where it has one):
${projectMap(files)}

README.md:
${doc("README.md")}

docs/03-architecture.md (architecture and decision log):
${doc("docs/03-architecture.md")}`;
  return cachedSystem;
}

// ---------- tools ----------

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_code",
    description:
      "Case-insensitive search over every file in the project snapshot. All whitespace-separated terms must appear on the same line. Returns matching lines as path:line: text, files with the most matches first. Use it to find where something is defined or used.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words or an identifier, e.g. 'cacheTag' or 'export function listModels'" },
        path_prefix: { type: "string", description: "Optional folder to limit the search, e.g. 'src/server/'" },
      },
      required: ["query"],
    },
    eager_input_streaming: true,
  },
  {
    name: "read_file",
    description:
      "Read a file from the project snapshot with line numbers. At most 300 lines per call; pass start_line/end_line to read a specific range (1-based, inclusive).",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Exact path from the project map, e.g. 'src/server/services/models.ts'" },
        start_line: { type: "integer", minimum: 1 },
        end_line: { type: "integer", minimum: 1 },
      },
      required: ["path"],
    },
    eager_input_streaming: true,
  },
  {
    name: "list_files",
    description: "List files (with line counts) whose path starts with a prefix, e.g. 'src/app/api/'.",
    input_schema: { type: "object", properties: { prefix: { type: "string" } }, required: ["prefix"] },
    eager_input_streaming: true,
  },
];

const SearchInput = z.object({ query: z.string().min(1).max(200), path_prefix: z.string().max(200).optional() });
const ReadInput = z.object({ path: z.string().min(1).max(300), start_line: z.number().int().min(1).optional(), end_line: z.number().int().min(1).optional() });
const ListInput = z.object({ prefix: z.string().max(200) });

/** Validate (eager input streaming means the API no longer does) and run one tool call; returns a result + a UI label. */
function runTool(files: IndexedFile[], name: string, input: unknown): { result: string; label: string; isError?: boolean } {
  if (name === "search_code") {
    const p = SearchInput.safeParse(input);
    if (!p.success) return { result: JSON.stringify({ INVALID_JSON: JSON.stringify(input) }), label: "Search (invalid input)", isError: true };
    return { result: searchCode(files, p.data.query, p.data.path_prefix), label: `Searched for “${p.data.query}”${p.data.path_prefix ? ` in ${p.data.path_prefix}` : ""}` };
  }
  if (name === "read_file") {
    const p = ReadInput.safeParse(input);
    if (!p.success) return { result: JSON.stringify({ INVALID_JSON: JSON.stringify(input) }), label: "Read (invalid input)", isError: true };
    const range = p.data.start_line ? ` lines ${p.data.start_line}-${p.data.end_line ?? p.data.start_line + 299}` : "";
    return { result: readFile(files, p.data.path, p.data.start_line, p.data.end_line), label: `Read ${p.data.path}${range}` };
  }
  if (name === "list_files") {
    const p = ListInput.safeParse(input);
    if (!p.success) return { result: JSON.stringify({ INVALID_JSON: JSON.stringify(input) }), label: "List (invalid input)", isError: true };
    return { result: listFiles(files, p.data.prefix), label: `Listed ${p.data.prefix || "all files"}` };
  }
  return { result: `Unknown tool ${name}`, label: name, isError: true };
}

// ---------- the loop ----------

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError)
    return "The assistant’s API key is invalid or lacks access. Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "The assistant is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.BadRequestError) return "The request was rejected. Try a shorter question or clear the conversation.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn’t reach the model. Check the connection and try again.";
  if (err instanceof Anthropic.APIError) return `The model service returned an error (${err.status ?? "unknown"}). Try again shortly.`;
  return "Something went wrong while answering. Try again.";
}

export const isConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function explain(history: ChatTurn[], emit: (e: ExplainEvent) => void, signal: AbortSignal): Promise<void> {
  if (!isConfigured()) {
    emit({ type: "error", message: "The code assistant isn’t configured on this deployment (ANTHROPIC_API_KEY is not set)." });
    return;
  }
  let files: IndexedFile[];
  try {
    files = codeIndex();
  } catch {
    emit({ type: "error", message: "The code index is missing. Run `npm run codeindex` and restart." });
    return;
  }

  const client = new Anthropic();
  const system = systemPrompt(files);
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  let retries = 0;

  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const stream = client.beta.messages.stream(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          // server-side fallback: if Opus declines on a safety classifier, the API re-runs on a fallback model
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "medium" },
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }], // tools + system: cached prefix
          cache_control: { type: "ephemeral" }, // also cache the growing conversation between tool rounds
          tools: TOOLS,
          tool_choice: round === MAX_ROUNDS ? { type: "none" } : { type: "auto" },
          messages,
        },
        { signal },
      );
      stream.on("text", (text) => emit({ type: "text", text }));

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        retries = 0;
      } catch (err) {
        // an unparseable streamed tool input or a dropped connection: re-issue the turn (API errors are final)
        if (err instanceof Anthropic.APIError || signal.aborted || retries++ >= 2) throw err;
        continue;
      }

      if (message.stop_reason === "refusal") {
        emit({ type: "error", message: "The model declined to answer this. Try rephrasing the question about the code." });
        return;
      }
      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (message.stop_reason === "max_tokens") {
        emit({ type: "text", text: "\n\n_(Answer cut off at the length limit. Ask a narrower follow-up.)_" });
        break;
      }
      if (message.stop_reason !== "tool_use" || !toolUses.length) break;

      // keep every block (thinking included) unchanged: the next round must see this turn exactly as produced
      messages.push({ role: "assistant", content: message.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((use) => {
        const { result, label, isError } = runTool(files, use.name, use.input);
        emit({ type: "tool", name: use.name, label });
        return { type: "tool_result", tool_use_id: use.id, content: result, ...(isError ? { is_error: true } : {}) };
      });
      messages.push({ role: "user", content: results }); // all results in one message (keeps parallel calls working)
      emit({ type: "text", text: "\n\n" }); // separate any preamble from the next round's text
    }
    emit({ type: "done", rounds: messages.filter((m) => m.role === "assistant").length + 1 });
  } catch (err) {
    if (signal.aborted) return; // the visitor pressed Stop or left: nothing to report
    console.error("[explain] failed:", err);
    emit({ type: "error", message: friendlyError(err) });
  }
}
