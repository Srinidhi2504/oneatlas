import type { Metadata } from "next";
import { Suspense } from "react";
import { LabsDirectory } from "@/components/directory/Directories";
import { PageHeader, Skeleton } from "@/components/ui/primitives";
import { listLabs } from "@/server/services/directory";

export const metadata: Metadata = { title: "AI labs", description: "Every AI lab in the catalog with model counts, open-weights models and latest releases." };

export default async function LabsPage() {
  const labs = await listLabs(undefined, "models"); // cached: part of the static shell
  return (
    <>
      <PageHeader title="Labs" description="The companies and research groups that build the models, with their latest release." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-[var(--radius-panel)]" />}>
        <LabsDirectory labs={labs} />
      </Suspense>
    </>
  );
}
