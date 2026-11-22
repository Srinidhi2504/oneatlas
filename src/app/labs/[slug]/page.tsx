import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LabModels } from "@/components/directory/LabModels";
import { Odometer } from "@/components/ui/Odometer";
import { LabAvatar, SectionTitle, Skeleton } from "@/components/ui/primitives";
import { formatDate, formatInteger } from "@/lib/format";
import type { LabDetail } from "@/lib/types";
import { NotFoundError } from "@/server/errors";
import { getLab, topDirectorySlugs } from "@/server/services/directory";

export async function generateStaticParams() {
  return (await topDirectorySlugs(50)).labs.map((slug) => ({ slug }));
}

async function load(slug: string): Promise<LabDetail | null> {
  try {
    return await getLab(slug);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: PageProps<"/labs/[slug]">): Promise<Metadata> {
  const lab = await load((await params).slug);
  return lab
    ? { title: `${lab.name} models`, description: `${lab.stats.modelCount} models from ${lab.name}, served by ${lab.stats.providerCount} providers.` }
    : { title: "Lab not found" };
}

export default function LabPage({ params }: PageProps<"/labs/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="mt-8 h-[480px] w-full rounded-[var(--radius-panel)]" />}>
      <LabView params={params} />
    </Suspense>
  );
}

async function LabView({ params }: Pick<PageProps<"/labs/[slug]">, "params">) {
  const lab = await load((await params).slug);
  if (!lab) notFound();
  const tiles = [
    ["Models", formatInteger(lab.stats.modelCount)],
    ["Open weights", formatInteger(lab.stats.openWeightsCount)],
    ["Providers serving them", formatInteger(lab.stats.providerCount)],
    ["With intelligence score", formatInteger(lab.stats.benchmarkedCount)],
    ["Latest release", formatDate(lab.stats.latestReleaseAt)],
  ];
  return (
    <div className="pb-8">
      <nav aria-label="Breadcrumb" className="pt-6 text-13 text-muted">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/labs" className="hover:text-fg">
              Labs
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li aria-current="page" className="text-fg">
            {lab.name}
          </li>
        </ol>
      </nav>
      <header className="flex items-center gap-3.5 pt-4 pb-6">
        <LabAvatar slug={lab.slug} name={lab.name} size={44} />
        <h1 className="enter text-[28px] leading-9">{lab.name}</h1>
      </header>

      <dl className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-panel)] border border-border sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="-mt-px -ml-px border-t border-l border-border px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 text-xl font-semibold tracking-tight">
              <Odometer value={value} />
            </dd>
          </div>
        ))}
      </dl>

      {lab.providers.length ? (
        <section aria-labelledby="served-by" className="reveal-3d mt-8">
          <SectionTitle id="served-by" aside="Number of this lab’s models each provider serves">
            Served by
          </SectionTitle>
          <ul className="flex flex-wrap gap-1.5">
            {lab.providers.slice(0, 24).map((p) => (
              <li key={p.slug}>
                <Link href={`/providers/${p.slug}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-13 hover:border-border-strong hover:bg-surface">
                  {p.name}
                  <span className="text-xs text-faint">{p.count}</span>
                </Link>
              </li>
            ))}
            {lab.providers.length > 24 ? (
              <li className="inline-flex h-8 items-center px-2 text-13 text-muted">and {lab.providers.length - 24} more</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="lab-models" className="mt-8">
        <SectionTitle id="lab-models" aside="Newest first; click a column to sort">
          Models
        </SectionTitle>
        <LabModels models={lab.models} />
      </section>
    </div>
  );
}
