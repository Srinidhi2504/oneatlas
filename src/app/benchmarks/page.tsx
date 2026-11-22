import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MatrixView, type MatrixPage } from "@/components/benchmarks/MatrixView";
import { loadMatrixState, matrixApiQuery } from "@/components/benchmarks/state";
import { PageHeader, Skeleton } from "@/components/ui/primitives";
import { formatInteger, formatScore } from "@/lib/format";
import { matrixQuerySchema, paramsToObject } from "@/lib/schemas";
import { getMatrix, listBenchmarks } from "@/server/services/benchmarks";
import { listLabs } from "@/server/services/directory";

export const metadata: Metadata = {
  title: "Benchmarks",
  description: "Every benchmark score per model: Artificial Analysis indices and Design Arena Elo, best in each column highlighted.",
};

export default function BenchmarksPage({ searchParams }: PageProps<"/benchmarks">) {
  return (
    <>
      <PageHeader
        title="Benchmarks"
        description="Artificial Analysis capability indices and Design Arena Elo ratings from head-to-head human votes. Ranks are across every scored model."
      />
      <Catalogue />
      <section aria-labelledby="matrix" className="mt-10">
        <h2 id="matrix" className="mb-3 text-base">
          Score matrix
        </h2>
        <Suspense fallback={<Skeleton className="h-[560px] w-full rounded-[var(--radius-panel)]" />}>
          <Matrix searchParams={searchParams} />
        </Suspense>
      </section>
    </>
  );
}

/** Cached server read: part of the static shell. */
async function Catalogue() {
  const all = await listBenchmarks();
  const groups = [...new Set(all.map((b) => b.group))];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((g) => (
        <section key={g} aria-labelledby={`g-${g}`} className="reveal-3d overflow-hidden rounded-[var(--radius-panel)] border border-border">
          <h2 id={`g-${g}`} className="border-b border-border bg-surface px-4 py-2.5 text-sm">
            {g}
            <span className="ml-2 text-xs font-normal text-muted">{all.filter((b) => b.group === g).length} benchmarks</span>
          </h2>
          <ul className="max-h-[340px] divide-y divide-border overflow-y-auto">
            {all
              .filter((b) => b.group === g)
              .map((b) => (
                <li key={b.key}>
                  <Link href={`/rankings/${b.key}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 px-4 py-2 hover:bg-surface">
                    <span className="truncate text-13 font-medium">
                      {b.name}
                      {b.category === "design-agents" ? <span className="ml-1.5 text-xs font-normal text-faint">agents</span> : null}
                    </span>
                    <span className="text-xs text-faint">{formatInteger(b.scoredCount)} models</span>
                    {b.top ? (
                      <span className="col-span-2 truncate text-xs text-muted">
                        Leader: {b.top.model.name} ({formatScore(b.top.value, b.unit)})
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

async function Matrix({ searchParams }: Pick<PageProps<"/benchmarks">, "searchParams">) {
  const state = loadMatrixState(await searchParams);
  const qs = matrixApiQuery(state);
  const [initial, catalogue, labs] = await Promise.all([
    getMatrix(matrixQuerySchema.parse(paramsToObject(new URLSearchParams(qs)))).catch((): MatrixPage | null => null),
    listBenchmarks(),
    listLabs(undefined, "name"),
  ]);
  return <MatrixView initial={initial} initialQs={qs} catalogue={catalogue} labs={labs.map((l) => ({ slug: l.slug, name: l.name }))} />;
}
