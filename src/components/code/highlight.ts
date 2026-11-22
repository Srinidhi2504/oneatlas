// A small syntax highlighter for the /code viewer: one regex per language, scanned left to right, then split into lines.
// Good enough to read code comfortably (keywords, strings, comments, numbers, functions, types, JSX tags), no dependency.
// Multi-line tokens (block comments, template strings) are tokenised on the whole file, so they colour correctly across lines.

export type TokenType = "comment" | "string" | "keyword" | "number" | "fn" | "type" | "tag" | "attr" | "punct" | "plain";
export interface Token {
  t: TokenType;
  v: string;
}

const JS_KEYWORDS =
  "import|from|export|default|const|let|var|function|return|if|else|for|while|do|of|in|new|class|extends|interface|type|async|await|try|catch|finally|throw|switch|case|break|continue|typeof|keyof|as|satisfies|null|undefined|true|false|this|void|readonly|enum|implements|private|public|static|yield|delete|instanceof";
const SQL_KEYWORDS =
  "select|from|where|and|or|not|insert|into|values|update|set|delete|create|table|index|unique|primary|key|foreign|references|on|alter|add|column|drop|if|exists|extension|using|gin|default|constraint|cascade|null|text|integer|boolean|double|precision|timestamp|date|decimal|desc|asc|group|by|order|join|as|count|distinct|int";

type Rule = [TokenType, string];
const LANGS: Record<string, Rule[]> = {
  js: [
    ["comment", String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`],
    ["string", String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + "`(?:\\\\[\\s\\S]|[^`\\\\])*`"],
    ["keyword", String.raw`\b(?:${JS_KEYWORDS})\b`],
    ["number", String.raw`\b(?:0x[\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b`],
    ["fn", String.raw`\b[a-zA-Z_$][\w$]*(?=\s*\()`],
    ["type", String.raw`\b[A-Z][\w$]*\b`],
    ["punct", String.raw`[{}()[\];,.<>/=+\-*!?:&|%^~]`],
  ],
  tsx: [
    ["comment", String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`],
    ["string", String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|` + "`(?:\\\\[\\s\\S]|[^`\\\\])*`"],
    ["tag", String.raw`<\/?[A-Za-z][\w.:-]*|\/?>`],
    ["keyword", String.raw`\b(?:${JS_KEYWORDS})\b`],
    ["number", String.raw`\b(?:0x[\da-fA-F]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)\b`],
    ["attr", String.raw`\b[a-zA-Z][\w-]*(?==[^=])`],
    ["fn", String.raw`\b[a-zA-Z_$][\w$]*(?=\s*\()`],
    ["type", String.raw`\b[A-Z][\w$]*\b`],
    ["punct", String.raw`[{}()[\];,.<>/=+\-*!?:&|%^~]`],
  ],
  css: [
    ["comment", String.raw`\/\*[\s\S]*?\*\/`],
    ["string", String.raw`"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'`],
    ["keyword", String.raw`@[\w-]+`],
    ["type", String.raw`--[\w-]+`],
    ["attr", String.raw`[\w-]+(?=\s*:(?!:))`],
    ["number", String.raw`-?\b\d*\.?\d+(?:px|em|rem|%|ms|s|deg|vh|vw|dvh|fr)?\b`],
    ["fn", String.raw`[\w-]+(?=\()`],
    ["punct", String.raw`[{}()[\];,.:>+~*]`],
  ],
  json: [
    ["attr", String.raw`"(?:\\.|[^"\\\n])*"(?=\s*:)`],
    ["string", String.raw`"(?:\\.|[^"\\\n])*"`],
    ["keyword", String.raw`\b(?:true|false|null)\b`],
    ["number", String.raw`-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b`],
    ["punct", String.raw`[{}[\],:]`],
  ],
  sql: [
    ["comment", String.raw`--[^\n]*`],
    ["string", String.raw`'(?:''|[^'])*'`],
    ["type", String.raw`"(?:[^"])*"`],
    ["keyword", String.raw`\b(?:${SQL_KEYWORDS})\b`],
    ["number", String.raw`\b\d+(?:\.\d+)?\b`],
    ["punct", String.raw`[(),;.=]`],
  ],
  prisma: [
    ["comment", String.raw`\/\/[^\n]*`],
    ["string", String.raw`"(?:\\.|[^"\\\n])*"`],
    ["keyword", String.raw`\b(?:model|enum|generator|datasource)\b`],
    ["attr", String.raw`@@?[\w.]+`],
    ["type", String.raw`\b[A-Z][\w]*\b`],
    ["number", String.raw`\b\d+(?:\.\d+)?\b`],
    ["punct", String.raw`[{}()[\],?=:]`],
  ],
  md: [
    ["keyword", String.raw`^#{1,6} [^\n]*`],
    ["string", String.raw`^\s*` + "```[^\\n]*|`[^`\\n]+`"],
    ["type", String.raw`\*\*[^*\n]+\*\*`],
    ["fn", String.raw`\[[^\]\n]+\]\([^)\n]+\)`],
    ["punct", String.raw`^\s*(?:[-*]|\d+\.)\s|^\|.*\|$`],
  ],
};

const COMPILED: Record<string, { re: RegExp; types: TokenType[] }> = {};
function compile(lang: string) {
  if (!COMPILED[lang]) {
    const rules = LANGS[lang];
    COMPILED[lang] = { re: new RegExp(rules.map(([, src]) => `(${src})`).join("|"), "gm"), types: rules.map(([t]) => t) };
  }
  return COMPILED[lang];
}

/** File extension -> highlighter language and a human label for the status bar. */
export function languageOf(path: string): { lang: keyof typeof LANGS | "text"; label: string } {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "tsx" || ext === "jsx") return { lang: "tsx", label: "TypeScript JSX" };
  if (["ts", "mts", "cts", "js", "mjs", "cjs"].includes(ext)) return { lang: "js", label: ext.includes("j") ? "JavaScript" : "TypeScript" };
  if (ext === "css") return { lang: "css", label: "CSS" };
  if (ext === "json") return { lang: "json", label: "JSON" };
  if (ext === "sql") return { lang: "sql", label: "SQL" };
  if (ext === "prisma") return { lang: "prisma", label: "Prisma" };
  if (ext === "md") return { lang: "md", label: "Markdown" };
  return { lang: "text", label: "Plain text" };
}

/** Tokenise a whole file, then split into lines (a token spanning lines is cut at each newline, keeping its colour). */
export function highlight(code: string, lang: string): Token[][] {
  const lines: Token[][] = [[]];
  const push = (t: TokenType, v: string) => {
    const parts = v.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ t, v: part });
    });
  };
  if (!LANGS[lang]) {
    push("plain", code);
    return lines;
  }
  const { re, types } = compile(lang);
  re.lastIndex = 0;
  let last = 0;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    if (m[0] === "") {
      re.lastIndex++; // zero-width match (e.g. ^ anchors): step past it
      continue;
    }
    if (m.index > last) push("plain", code.slice(last, m.index));
    const group = m.findIndex((g, i) => i > 0 && g !== undefined);
    push(types[group - 1], m[0]);
    last = m.index + m[0].length;
  }
  if (last < code.length) push("plain", code.slice(last));
  return lines;
}
