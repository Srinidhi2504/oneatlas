import type { Metadata } from "next";
import { Suspense } from "react";
import { ProvidersDirectory } from "@/components/directory/Directories";
import { PageHeader, Skeleton } from "@/components/ui/primitives";
import { listLabs, listProviders } from "@/server/services/directory";

export const metadata: Metadata = { title: "API providers", description: "Every API provider in the catalog and how many models each one serves." };

export default async function ProvidersPage() {
  const [providers, labs] = await Promise.all([listProviders(undefined, "models"), listLabs(undefined, "name")]);
  return (
    <>
      <PageHeader title="Providers" description="Clouds, gateways and first-party APIs that serve models, ranked by how many models they offer." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[var(--radius-panel)]" />}>
        <ProvidersDirectory providers={providers} labNames={Object.fromEntries(labs.map((l) => [l.slug, l.name]))} />
      </Suspense>
    </>
  );
}
