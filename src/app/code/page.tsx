// /code: the whole codebase in an editor-style viewer, plus a ZIP download of the full repository.
// Fully static: the file tree and archive details are read from build-time snapshots; file contents load on demand.
import type { Metadata } from "next";
import { Download, GitBranch } from "lucide-react";
import { Suspense } from "react";
import { CodeExplorer } from "@/components/code/CodeExplorer";
import { HoverText } from "@/components/ui/HoverText";
import { buttonClass, Skeleton } from "@/components/ui/primitives";
import { formatInteger } from "@/lib/format";
import { REPO_URL, SOURCE_ZIP_URL } from "@/lib/site";
import { codeTree, sourceArchive } from "@/server/code-index";

export const metadata: Metadata = {
  title: "Source code",
  description: "Browse the complete OneAtlas codebase in an editor-style viewer, or download it as a ZIP: file tree, syntax highlighting, search and shareable line links.",
};

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

export default function CodePage() {
  const files = codeTree(); // the file list is part of the static shell; contents load per file
  const lines = files.reduce((n, f) => n + f.lines, 0);
  const archive = sourceArchive();
  return (
    <>
      <div className="flex flex-col gap-4 pt-6 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="enter text-[28px] leading-9">
            <HoverText text="Source code" />
          </h1>
          <p className="enter mt-1 max-w-[70ch] text-muted" style={{ ["--stagger" as string]: 1 }}>
            The whole codebase, {formatInteger(files.length)} files and {formatInteger(lines)} lines, exactly as deployed. Click a line number to share a link to it.
            {archive?.commit ? (
              <>
                {" "}
                Snapshot of commit{" "}
                <a href={`${REPO_URL}/commit/${archive.commit}`} className="font-mono text-[13px] text-accent hover:underline" rel="noopener noreferrer" target="_blank">
                  {archive.commit.slice(0, 7)}
                </a>
                .
              </>
            ) : null}
          </p>
        </div>
        <div className="enter flex shrink-0 flex-wrap items-center gap-2" style={{ ["--stagger" as string]: 2 }}>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "md", "h-10 px-3.5")}>
            <GitBranch className="size-4" aria-hidden />
            View on GitHub
          </a>
          {archive ? (
            // a plain <a download>: the browser saves the static file directly, no JavaScript involved
            <a href={SOURCE_ZIP_URL} download="oneatlas-source.zip" className={buttonClass("primary", "md", "h-10 px-4")}>
              <Download className="size-4" aria-hidden />
              Download ZIP
              <span className="text-xs font-normal opacity-80">
                {kb(archive.bytes)}, {formatInteger(archive.files)} files
              </span>
            </a>
          ) : null}
        </div>
      </div>
      <Suspense fallback={<Skeleton className="h-[calc(100dvh-13rem)] min-h-[540px] w-full rounded-[var(--radius-panel)]" />}>
        <CodeExplorer files={files} />
      </Suspense>
    </>
  );
}
