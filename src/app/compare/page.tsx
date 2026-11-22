import type { Metadata } from "next";
import { Suspense } from "react";
import { CompareView } from "@/components/compare/CompareView";
import { PageHeader, Skeleton } from "@/components/ui/primitives";
import { compareQuerySchema } from "@/lib/schemas";
import type { CompareResult } from "@/lib/types";
import { compareModels } from "@/server/services/models";

export const metadata: Metadata = {
  title: "Compare models",
  description: "Side-by-side pricing, context, capabilities and benchmarks for up to four AI models.",
};

export default function ComparePage({ searchParams }: PageProps<"/compare">) {
  return (
    <>
      <PageHeader title="Compare models" description="Up to four models side by side. The best value in each row is highlighted; the URL is shareable." />
      {/* fallback as tall as the viewport: the table streaming in must not push visible content (CLS) */}
      <Suspense fallback={<Skeleton className="min-h-[100dvh] w-full rounded-[var(--radius-panel)]" />}>
        <CompareData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** First paint from the same service as /api/v1/compare; later changes go through the API on the client. */
async function CompareData({ searchParams }: Pick<PageProps<"/compare">, "searchParams">) {
  const raw = (await searchParams).ids;
  const parsed = compareQuerySchema.safeParse({ ids: Array.isArray(raw) ? raw.join(",") : raw });
  let initial: CompareResult | null = null;
  if (parsed.success) initial = await compareModels(parsed.data.ids).catch(() => null);
  return <CompareView initial={initial} initialIds={parsed.success ? parsed.data.ids : []} />;
}
