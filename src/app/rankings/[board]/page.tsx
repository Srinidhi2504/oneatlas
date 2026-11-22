import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RankingsView, type RankingsPage } from "@/components/rankings/RankingsView";
import { loadRankingFilters, rankingApiQuery } from "@/components/rankings/state";
import { PriceIntelligenceChart } from "@/components/rankings/PriceIntelligenceChart";
import { PageHeader, Skeleton } from "@/components/ui/primitives";
import { paramsToObject, rankingsQuerySchema } from "@/lib/schemas";
import { CORE_BOARDS } from "@/lib/types";
import { NotFoundError } from "@/server/errors";
import { listBenchmarks } from "@/server/services/benchmarks";
import { listLabs } from "@/server/services/directory";
import { BOARDS, getRankings } from "@/server/services/rankings";

/** Every core board and benchmark board is known at build time. */
export async function generateStaticParams() {
  const benchmarks = await listBenchmarks();
  return [...CORE_BOARDS, ...benchmarks.map((b) => b.key)].map((board) => ({ board }));
}

export async function generateMetadata({ params }: PageProps<"/rankings/[board]">): Promise<Metadata> {
  const { board } = await params;
  const core = BOARDS[board as keyof typeof BOARDS];
  const bench = core ? null : (await listBenchmarks()).find((b) => b.key === board);
  const label = core?.label ?? bench?.name ?? "Rankings";
  return { title: `${label} leaderboard`, description: core?.description ?? `AI models ranked by ${label}.` };
}

export default function RankingsBoardPage({ params, searchParams }: PageProps<"/rankings/[board]">) {
  return (
    <>
      <PageHeader title="Rankings" description="Leaderboards by availability, intelligence, value, price, context and release date, plus every benchmark. Ranks are recomputed for the filters you pick." />
      <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-[var(--radius-panel)]" />}>
        <Board params={params} searchParams={searchParams} />
      </Suspense>
      <section aria-labelledby="scatter" className="mt-12">
        <h2 id="scatter" className="text-base">
          Price vs intelligence
        </h2>
        <p className="mt-1 mb-4 max-w-[72ch] text-13 text-muted">
          Every model with both an Intelligence Index and a known price. Up and to the left is better value; the line traces the cheapest model at each level of intelligence.
        </p>
        <PriceIntelligenceChart />
      </section>
    </>
  );
}

async function Board({ params, searchParams }: Pick<PageProps<"/rankings/[board]">, "params" | "searchParams">) {
  const { board } = await params;
  const filters = loadRankingFilters(await searchParams);
  const qs = rankingApiQuery(filters);
  let initial: RankingsPage | null = null;
  try {
    initial = await getRankings(board, rankingsQuerySchema.parse(paramsToObject(new URLSearchParams(qs))));
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    // anything else: the client retries through the API and shows its error state
  }
  const [benchmarks, labs] = await Promise.all([listBenchmarks(), listLabs(undefined, "name")]);
  return (
    <RankingsView
      board={board}
      initial={initial}
      initialQs={qs}
      coreBoards={CORE_BOARDS.map((b) => ({ key: b, label: BOARDS[b].label }))}
      benchmarkBoards={benchmarks.map((b) => ({ key: b.key, label: b.name, group: b.group }))}
      labs={labs.map((l) => ({ slug: l.slug, name: l.name }))}
    />
  );
}
