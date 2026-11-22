import { describe, expect, it } from "vitest";
import { ancestors, buildTree, fileBadge } from "./tree";

const f = (path: string) => ({ path, lines: 1, summary: null });

describe("code tree", () => {
  it("nests paths with folders first, alphabetically", () => {
    const tree = buildTree([f("src/lib/db.ts"), f("README.md"), f("src/app/page.tsx"), f("src/lib/api.ts"), f("docs/01.md")]);
    expect(tree.map((n) => n.name)).toEqual(["docs", "src", "README.md"]);
    const src = tree[1];
    expect(src.children!.map((n) => n.name)).toEqual(["app", "lib"]);
    expect(src.children![1].children!.map((n) => n.path)).toEqual(["src/lib/api.ts", "src/lib/db.ts"]);
    expect(src.children![1].children![1].file?.path).toBe("src/lib/db.ts");
  });

  it("lists the folders that reveal a file", () => {
    expect(ancestors("src/app/models/[lab]/page.tsx")).toEqual(["src", "src/app", "src/app/models", "src/app/models/[lab]"]);
    expect(ancestors("README.md")).toEqual([]);
  });

  it("badges files by type", () => {
    expect(fileBadge("src/a.tsx")).toEqual({ label: "TSX", tone: "teal" });
    expect(fileBadge("prisma/schema.prisma")).toEqual({ label: "DB", tone: "green" });
    expect(fileBadge(".env.example").label).toBe("ENV");
    expect(fileBadge("LICENSE").label).toBe("TXT");
  });
});
