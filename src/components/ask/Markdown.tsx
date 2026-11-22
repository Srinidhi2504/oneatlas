"use client";
// Minimal, safe Markdown for assistant answers: headings, paragraphs, lists, fenced code, `code`, **bold**, links.
// Builds React elements (never innerHTML). Inline code that looks like a file location becomes a citation chip.
import { Fragment, type ReactNode } from "react";

/** `src/lib/db.ts`, `src/lib/db.ts:12`, `src/lib/db.ts:12-30` (brackets allowed for Next route folders). */
export const CITATION = /^([\w@.\-/[\]]+\.[a-z]{1,5})(?::(\d+)(?:-(\d+))?)?$/i;

export interface Citation {
  path: string;
  line: number;
  end?: number; // last line of a range citation (path:12-30)
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "para"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; lang: string; text: string };

/** Line-based block parser; tolerant of a half-streamed answer (an unclosed fence renders as code so far). */
export function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (para.length) blocks.push({ kind: "para", text: para.join(" ") });
    if (list) blocks.push({ kind: "list", ...list });
    para = [];
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+-]*)/);
    if (fence) {
      flush();
      const body: string[] = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i]);
      blocks.push({ kind: "code", lang: fence[1], text: body.join("\n") });
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
    } else if (bullet || numbered) {
      const ordered = !!numbered;
      if (para.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (!line.trim()) {
      flush();
    } else if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += " " + line.trim(); // continuation of a list item
    } else {
      if (list) flush();
      para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

/** Inline spans: `code` (citations), **bold**, [text](https://...). Everything else is plain text. */
function inline(text: string, onCite: (c: Citation) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const cite = m[1].match(CITATION);
      out.push(
        cite ? (
          <button
            key={k++}
            type="button"
            onClick={() => onCite({ path: cite[1], line: Number(cite[2] ?? 1), end: cite[3] ? Number(cite[3]) : undefined })}
            className="mx-0.5 inline rounded-[4px] border border-accent/25 bg-accent-soft px-1 py-px font-mono text-[12px] text-accent hover:border-accent/60 hover:underline"
            title={`Open ${m[1]}`}
          >
            {m[1]}
          </button>
        ) : (
          <code key={k++} className="rounded-[4px] bg-surface-2 px-1 py-px font-mono text-[12px]">
            {m[1]}
          </code>
        ),
      );
    } else if (m[2] !== undefined) {
      out.push(<strong key={k++} className="font-semibold">{m[2]}</strong>);
    } else {
      out.push(
        <a key={k++} href={m[4]} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
          {m[3]}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, onCite }: { text: string; onCite: (c: Citation) => void }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === "heading")
          return (
            <p key={i} role="heading" aria-level={Math.min(6, b.level + 2)} className="pt-1 font-semibold text-fg">
              {inline(b.text, onCite)}
            </p>
          );
        if (b.kind === "code")
          return (
            <pre key={i} className="overflow-x-auto rounded-[var(--radius-control)] border border-border bg-surface p-3 font-mono text-[12px] leading-5">
              <code>{b.text}</code>
            </pre>
          );
        if (b.kind === "list") {
          const List = b.ordered ? "ol" : "ul";
          return (
            <List key={i} className={b.ordered ? "list-decimal space-y-1.5 pl-5" : "list-disc space-y-1.5 pl-5"}>
              {b.items.map((item, j) => (
                <li key={j} className="pl-0.5 marker:text-faint">
                  {inline(item, onCite)}
                </li>
              ))}
            </List>
          );
        }
        return <p key={i}>{inline(b.text, onCite).map((n, j) => <Fragment key={j}>{n}</Fragment>)}</p>;
      })}
    </div>
  );
}
