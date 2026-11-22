import { BookOpen, ChevronRight, Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadProviderState, providerModelsQuery } from "@/components/directory/provider-state";
import { ProviderModels, type ProviderListingsPage } from "@/components/directory/ProviderModels";
import { Badge, buttonClass, Skeleton } from "@/components/ui/primitives";
import { formatInteger } from "@/lib/format";
import { paramsToObject, providerModelsQuerySchema } from "@/lib/schemas";
import { NotFoundError } from "@/server/errors";
import { getProvider, topDirectorySlugs } from "@/server/services/directory";

export async function generateStaticParams() {
  return (await topDirectorySlugs(50)).providers.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/providers/[slug]">): Promise<Metadata> {
  try {
    const { provider } = await getProvider((await params).slug, { sort: "name", page: 1, pageSize: 1 });
    return { title: `${provider.name}: models and prices`, description: `${provider.modelCount} models served by ${provider.name}, with its own per-token prices.` };
  } catch {
    return { title: "Provider not found" };
  }
}

export default function ProviderPage({ params, searchParams }: PageProps<"/providers/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="mt-8 h-[480px] w-full rounded-[var(--radius-panel)]" />}>
      <ProviderView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProviderView({ params, searchParams }: Pick<PageProps<"/providers/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  const qs = providerModelsQuery(loadProviderState(await searchParams));
  let data;
  try {
    data = await getProvider(slug, providerModelsQuerySchema.parse(paramsToObject(new URLSearchParams(qs))));
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const { provider, listings } = data;
  const initial: ProviderListingsPage = listings;
  return (
    <div className="pb-8">
      <nav aria-label="Breadcrumb" className="pt-6 text-13 text-muted">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/providers" className="hover:text-fg">
              Providers
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li aria-current="page" className="text-fg">
            {provider.name}
          </li>
        </ol>
      </nav>
      <header className="flex flex-col gap-4 pt-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] leading-9">{provider.name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-muted">
            {formatInteger(provider.modelCount)} models in {formatInteger(provider.listingCount)} API listings
            {provider.lab ? (
              <Badge tone="accent">
                First-party API of{" "}
                <Link href={`/labs/${provider.lab.slug}`} className="underline underline-offset-2">
                  {provider.lab.name}
                </Link>
              </Badge>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          {provider.docUrl ? (
            <a href={provider.docUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <BookOpen aria-hidden />
              Docs
            </a>
          ) : null}
          {provider.apiUrl ? (
            <a href={provider.apiUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary")} title={provider.apiUrl}>
              <Globe aria-hidden />
              API base URL
            </a>
          ) : null}
        </div>
      </header>
      <ProviderModels slug={provider.slug} initial={initial} initialQs={qs} />
    </div>
  );
}
