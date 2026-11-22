// Flat snapshot paths -> a folder tree for the /code viewer (folders first, then files, each alphabetical).
import type { Tone } from "@/lib/tones";

export interface TreeFile {
  path: string;
  lines: number;
  summary: string | null;
}
export interface TreeNode {
  name: string;
  path: string;
  file?: TreeFile;
  children?: TreeNode[];
}

export function buildTree(files: TreeFile[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;
      let child = node.children!.find((c) => c.name === part && !!c.file === isFile);
      if (!child) {
        child = isFile ? { name: part, path, file: f } : { name: part, path, children: [] };
        node.children!.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name));
    nodes.forEach((n) => n.children && sort(n.children));
  };
  sort(root.children!);
  return root.children!;
}

/** "src/app/models/x.ts" -> ["src", "src/app", "src/app/models"]: the folders to expand to reveal a file. */
export const ancestors = (path: string) => path.split("/").slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join("/"));

/** Badge text + colour for a file type in the tree and tabs. */
export function fileBadge(path: string): { label: string; tone: Tone | "muted" } {
  const name = path.split("/").pop() ?? "";
  if (name.startsWith(".env")) return { label: "ENV", tone: "rose" };
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const map: Record<string, { label: string; tone: Tone | "muted" }> = {
    ts: { label: "TS", tone: "blue" },
    mts: { label: "TS", tone: "blue" },
    tsx: { label: "TSX", tone: "teal" },
    js: { label: "JS", tone: "amber" },
    mjs: { label: "JS", tone: "amber" },
    css: { label: "CSS", tone: "violet" },
    json: { label: "{}", tone: "amber" },
    md: { label: "MD", tone: "muted" },
    sql: { label: "SQL", tone: "coral" },
    prisma: { label: "DB", tone: "green" },
    toml: { label: "TOML", tone: "muted" },
  };
  return map[ext] ?? { label: ext.slice(0, 3).toUpperCase() || "TXT", tone: "muted" };
}
