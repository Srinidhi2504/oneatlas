import type { Metadata } from "next";
import { HoverText } from "@/components/ui/HoverText";
import { Suspense } from "react";
import { CodeExplorer } from "@/components/code/CodeExplorer";
import { Skeleton } from "@/components/ui/primitives";
import { formatInteger } from "@/lib/format";
import { codeTree } from "@/server/code-index";

export const metadata: Metadata = {
  title: "Source code",
  description: "Browse the complete OneAtlas codebase in an editor-style viewer: file tree, syntax highlighting, search and shareable line links.",
};

export default function CodePage() {
  const files = codeTree(); // the file list is part of the static shell; contents load per file
  const lines = files.reduce((n, f) => n + f.lines, 0);
  return (
    <>
      <div className="flex flex-col gap-1 pt-6 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="enter text-[28px] leading-9">
            <HoverText text="Source code" />
          </h1>
          <p className="enter mt-1 max-w-[70ch] text-muted" style={{ ["--stagger" as string]: 1 }}>
            The whole codebase, {formatInteger(files.length)} files and {formatInteger(lines)} lines, exactly as deployed. Click a line number to share a link to it.
          </p>
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-[calc(100dvh-13rem)] min-h-[540px] w-full rounded-[var(--radius-panel)]" />}>
        <CodeExplorer files={files} />
      </Suspense>
    </>
  );
}
