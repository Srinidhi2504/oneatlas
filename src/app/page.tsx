import { Suspense } from "react";
import { HoverText } from "@/components/ui/HoverText";
import { Explorer, type ExplorerInitial } from "@/components/explorer/Explorer";
import { loadExplorerState, toApiQuery, toFilterQuery } from "@/components/explorer/state";
import { StatsStrip } from "@/components/explorer/StatsStrip";
import { Hero } from "@/components/hero/Hero";
import { ModelTable } from "@/components/models/ModelTable";
import { Skeleton } from "@/components/ui/primitives";
import { modelFiltersSchema, modelListQuerySchema, paramsToObject } from "@/lib/schemas";
import { getFacets } from "@/server/services/catalog";
import { listModels } from "@/server/services/models";

// Static shell: heading + stats (cached) + skeleton. The URL-dependent part streams in under <Suspense>.
export default function ExplorerPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Hero />
      <StatsStrip />
      <section id="explore" aria-labelledby="explore-title" className="mt-10 scroll-mt-20">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id="explore-title" className="text-xl">
            <HoverText text="Browse models" />
          </h2>
          <p className="hidden text-13 text-muted sm:block">Prices per 1M tokens. Open any model for its providers and benchmarks.</p>
        </div>
        <Suspense fallback={<ExplorerSkeleton />}>
          <ExplorerData searchParams={searchParams} />
        </Suspense>
      </section>
    </>
  );
}

/** Reads the URL, renders the first page on the server with the same services the API uses, hands it to the client. */
async function ExplorerData({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const state = loadExplorerState(await searchParams);
  const modelsQs = toApiQuery(state);
  const facetsQs = toFilterQuery(state).toString();
  const [models, facets] = await Promise.all([
    listModels(modelListQuerySchema.parse(paramsToObject(new URLSearchParams(modelsQs)))).catch(() => null),
    getFacets(modelFiltersSchema.parse(paramsToObject(new URLSearchParams(facetsQs)))).catch(() => null),
  ]);
  // on a server-side failure the client retries via the API and shows the error state if that fails too
  const initial: ExplorerInitial = { modelsQs, models, facetsQs, facets };
  return <Explorer initial={initial} />;
}

function ExplorerSkeleton() {
  return (
    <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6" aria-busy="true" aria-label="Loading models">
      <div className="hidden space-y-3 lg:block">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-4/5" />
        ))}
      </div>
      <div>
        <Skeleton className="h-9 w-full" />
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="mt-5">
          <ModelTable items={[]} loading />
        </div>
      </div>
    </div>
  );
}
