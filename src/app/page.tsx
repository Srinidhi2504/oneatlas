import { Suspense } from "react";
import { Explorer, type ExplorerInitial } from "@/components/explorer/Explorer";
import { loadExplorerState, toApiQuery, toFilterQuery } from "@/components/explorer/state";
import { StatsStrip } from "@/components/explorer/StatsStrip";
import { ModelTable } from "@/components/models/ModelTable";
import { Skeleton } from "@/components/ui/primitives";
import { modelFiltersSchema, modelListQuerySchema, paramsToObject } from "@/lib/schemas";
import { getFacets } from "@/server/services/catalog";
import { listModels } from "@/server/services/models";

// Static shell: heading + stats (cached) + skeleton. The URL-dependent part streams in under <Suspense>.
export default function ExplorerPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <div className="pt-8 pb-5">
        <h1 className="text-[28px] leading-9">Models</h1>
        <p className="mt-1.5 max-w-[68ch] text-muted">
          Search and filter every model across labs and API providers. Prices are per 1M tokens; open any model for its providers and benchmarks.
        </p>
      </div>
      <StatsStrip />
      <div className="mt-6">
        <Suspense fallback={<ExplorerSkeleton />}>
          <ExplorerData searchParams={searchParams} />
        </Suspense>
      </div>
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
