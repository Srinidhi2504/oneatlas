import { ChevronRight, Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { CostCalculator } from "@/components/compare/CostCalculator";
import { ModalityChips, ScoreBar } from "@/components/models/bits";
import { CompareButton } from "@/components/models/compare";
import { ModelCard } from "@/components/models/ModelCard";
import { ProviderTable } from "@/components/models/ProviderTable";
import { CopyLinkButton } from "@/components/ui/CopyLinkButton";
import { Odometer } from "@/components/ui/Odometer";
import { Badge, cardGrid, LabAvatar, Panel, SectionTitle, Skeleton, Spec, StateMessage } from "@/components/ui/primitives";
import { formatDate, formatInteger, formatMonth, formatPrice, formatScore, formatTokens } from "@/lib/format";
import { TONE, TYPE_TONE } from "@/lib/tones";
import { CORE_BOARDS, type BenchmarkResult, type ModelDetail } from "@/lib/types";
import { NotFoundError } from "@/server/errors";
import { getModel, latestFromLab, topModelIds } from "@/server/services/models";
import { BOARDS } from "@/server/services/rankings";

/** Prerender the 50 most-served models at build; every other model renders on first visit (then cached). */
export async function generateStaticParams() {
  return topModelIds(50);
}

async function loadModel(lab: string, slug: string): Promise<ModelDetail | null> {
  try {
    return await getModel(lab, slug);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export async function generateMetadata({ params }: PageProps<"/models/[lab]/[slug]">): Promise<Metadata> {
  const { lab, slug } = await params;
  const m = await loadModel(lab, slug);
  if (!m) return { title: "Model not found" };
  const price = m.pricing.input != null ? ` ${formatPrice(m.pricing.input)} input and ${formatPrice(m.pricing.output)} output per 1M tokens.` : "";
  return {
    title: `${m.name} by ${m.lab.name}: pricing, context, benchmarks`,
    description: `${m.name} from ${m.lab.name}. ${formatTokens(m.contextWindow)} context.${price} Compare ${m.providerCount} providers.`,
  };
}

export default function ModelPage({ params }: PageProps<"/models/[lab]/[slug]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ModelView params={params} />
    </Suspense>
  );
}

async function ModelView({ params }: Pick<PageProps<"/models/[lab]/[slug]">, "params">) {
  const { lab, slug } = await params;
  const m = await loadModel(lab, slug);
  if (!m) notFound();
  const more = await latestFromLab(m.lab.slug, m.slug);
  const aa = m.benchmarks.filter((b) => b.group !== "Design Arena");
  const arena = m.benchmarks.filter((b) => b.group === "Design Arena");
  const entry = { id: m.id, name: m.name, labName: m.lab.name };

  return (
    <article className="pb-8">
      <nav aria-label="Breadcrumb" className="pt-6 text-13 text-muted">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/" className="hover:text-fg">
              Models
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li>
            <Link href={`/labs/${m.lab.slug}`} className="hover:text-fg">
              {m.lab.name}
            </Link>
          </li>
          <ChevronRight className="size-3.5 text-faint" aria-hidden />
          <li aria-current="page" className="truncate text-fg">
            {m.name}
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-4 pt-4 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <LabAvatar slug={m.lab.slug} name={m.lab.name} size={44} className="mt-0.5" />
          <div className="min-w-0">
            <h1 className="enter text-[28px] leading-9 break-words">{m.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-13 text-muted">
              <span>
                by{" "}
                <Link href={`/labs/${m.lab.slug}`} className="font-medium text-fg hover:text-accent">
                  {m.lab.name}
                </Link>
              </span>
              <Badge className={`border-transparent ${TONE[TYPE_TONE[m.type]].soft} ${TONE[TYPE_TONE[m.type]].text}`}>{m.type[0].toUpperCase() + m.type.slice(1)}</Badge>
              {m.capabilities.openWeights ? <Badge tone="accent">Open weights</Badge> : null}
              {m.deprecated ? <Badge tone="warning">Deprecated</Badge> : null}
              <span className="font-mono text-xs text-faint">{m.id}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <CopyLinkButton />
          <CompareButton entry={entry} size="md" />
        </div>
      </header>

      {/* stat tiles */}
      <dl className="enter grid grid-cols-2 overflow-hidden rounded-[var(--radius-panel)] border border-border sm:grid-cols-3 lg:grid-cols-6" style={{ ["--stagger" as string]: 1 }}>
        {[
          ["Context", formatTokens(m.contextWindow), "tokens"],
          ["Max output", formatTokens(m.maxOutputTokens), "tokens"],
          ["Input", m.pricing.isFree ? "Free" : formatPrice(m.pricing.input), "per 1M tokens"],
          ["Output", m.pricing.isFree ? "Free" : formatPrice(m.pricing.output), "per 1M tokens"],
          ["Providers", formatInteger(m.providerCount), m.providerCount === 1 ? "API listing source" : "serving it"],
          ["Intelligence", m.intelligenceIndex != null ? formatScore(m.intelligenceIndex) : "N/A", m.ranks.intelligence ? `#${m.ranks.intelligence.rank} of ${m.ranks.intelligence.of}` : "not scored yet"],
        ].map(([label, value, hint]) => (
          <div key={label} className="-mt-px -ml-px border-t border-l border-border px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 text-xl font-semibold tracking-tight">
              <Odometer value={value} />
            </dd>
            <dd className="text-xs text-faint">{hint}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-10">
          {m.description ? (
            <section aria-labelledby="about">
              <SectionTitle id="about">About</SectionTitle>
              <p className="max-w-[72ch] leading-relaxed text-muted">{m.description}</p>
            </section>
          ) : null}

          <section aria-labelledby="benchmarks" className="reveal-3d">
            <SectionTitle id="benchmarks" aside={m.benchmarks.length ? "Bar length is relative to the best score on each benchmark" : undefined}>
              Benchmarks
            </SectionTitle>
            {m.benchmarks.length ? (
              <div className="space-y-6">
                {aa.length ? <BenchmarkBars results={aa} /> : null}
                {arena.length ? <ArenaTable results={arena} /> : null}
              </div>
            ) : (
              <Panel>
                <StateMessage title="No benchmark scores yet">
                  Artificial Analysis and Design Arena have not published results for this model. Compare it on price and context instead.
                </StateMessage>
              </Panel>
            )}
          </section>

          {m.pricing.input != null || m.listings.length ? <CostCalculator models={[m]} /> : null}

          <section aria-labelledby="providers" className="reveal-3d">
            <SectionTitle
              id="providers"
              aside={
                m.providerPriceRange.minInput != null
                  ? `Input from ${formatPrice(m.providerPriceRange.minInput)} to ${formatPrice(m.providerPriceRange.maxInput)}`
                  : undefined
              }
            >
              Providers ({formatInteger(m.listings.length)} listings)
            </SectionTitle>
            {m.listings.length ? (
              <ProviderTable listings={m.listings} />
            ) : (
              <Panel>
                <StateMessage title="No provider listings">
                  This model comes from OpenRouter’s catalog only, so per-provider prices are not available. Its reference price is OpenRouter’s.
                </StateMessage>
              </Panel>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <section aria-labelledby="pricing">
            <SectionTitle id="pricing">Pricing</SectionTitle>
            <Panel className="px-4">
              <dl>
                <Spec label="Input">{formatPrice(m.pricing.input)}</Spec>
                <Spec label="Output">{formatPrice(m.pricing.output)}</Spec>
                <Spec label="Cache read">{formatPrice(m.pricing.cacheRead)}</Spec>
                <Spec label="Cache write">{formatPrice(m.pricing.cacheWrite)}</Spec>
                <Spec label="Blended (3:1)">{formatPrice(m.pricing.blended)}</Spec>
              </dl>
            </Panel>
            <p className="mt-2 text-xs text-faint">
              USD per 1M tokens. Reference price: the lab’s own API, else OpenRouter, else the median across providers.
              {m.providerPriceRange.minInput != null && m.pricing.input != null && m.providerPriceRange.minInput < m.pricing.input
                ? ` Cheapest provider input: ${formatPrice(m.providerPriceRange.minInput)}.`
                : ""}
            </p>
          </section>

          <section aria-labelledby="specs" className="reveal-3d">
            <SectionTitle id="specs">Specs and capabilities</SectionTitle>
            <Panel className="px-4">
              <dl>
                <YesNo label="Reasoning" on={m.capabilities.reasoning} />
                <YesNo label="Tool calling" on={m.capabilities.toolCall} />
                <YesNo label="Structured output" on={m.capabilities.structuredOutput} />
                <YesNo label="Vision" on={m.capabilities.vision} />
                <YesNo label="Open weights" on={m.capabilities.openWeights} />
                <Spec label="Input">
                  <ModalityChips list={m.inputModalities} />
                </Spec>
                <Spec label="Output">
                  <ModalityChips list={m.outputModalities} />
                </Spec>
                {m.family ? <Spec label="Family">{m.family}</Spec> : null}
                <Spec label="Released">{formatDate(m.releasedAt)}</Spec>
                <Spec label="Knowledge cutoff">{formatMonth(m.knowledgeCutoff)}</Spec>
              </dl>
            </Panel>
          </section>

          <section aria-labelledby="ranks" className="reveal-3d">
            <SectionTitle id="ranks">Rankings</SectionTitle>
            <ul className="grid grid-cols-2 gap-2">
              {CORE_BOARDS.map((b) => {
                const r = m.ranks[b];
                return (
                  <li key={b}>
                    {r ? (
                      <Link href={`/rankings/${b}`} className="block rounded-[var(--radius-control)] border border-border px-3 py-2 hover:border-border-strong hover:bg-surface">
                        <span className="block text-xs text-muted">{BOARDS[b].label}</span>
                        <span className="font-semibold">#{formatInteger(r.rank)}</span>
                        <span className="text-xs text-faint"> of {formatInteger(r.of)}</span>
                      </Link>
                    ) : (
                      <span className="block rounded-[var(--radius-control)] border border-dashed border-border px-3 py-2">
                        <span className="block text-xs text-muted">{BOARDS[b].label}</span>
                        <span className="text-13 text-faint">Not ranked</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      {more.length ? (
        <section aria-labelledby="more" className="reveal-3d mt-12">
          <SectionTitle id="more" aside={<Link href={`/labs/${m.lab.slug}`} className="font-medium text-accent hover:underline">All {m.lab.name} models</Link>}>
            More from {m.lab.name}
          </SectionTitle>
          <div className={`${cardGrid} xl:grid-cols-4`}>
            {more.map((x) => (
              <ModelCard key={x.id} m={x} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function YesNo({ label, on }: { label: string; on: boolean }) {
  return (
    <Spec label={label}>
      <span className={on ? "inline-flex items-center gap-1 text-success" : "inline-flex items-center gap-1 text-faint"}>
        {on ? <Check className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
        {on ? "Yes" : "No"}
      </span>
    </Spec>
  );
}

function BenchmarkBars({ results }: { results: BenchmarkResult[] }) {
  return (
    <Panel className="divide-y divide-border">
      {results.map((b) => (
        <div key={b.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-[200px_minmax(0,1fr)_120px]">
          <Link href={`/rankings/${b.key}`} className="truncate text-13 font-medium hover:text-accent">
            {b.name}
          </Link>
          <span className="text-right text-13 sm:order-last">
            <span className="font-semibold">{formatScore(b.value, b.unit)}</span>
            <span className="text-xs text-faint">
              {" "}
              #{b.rank} of {b.ofTotal}
            </span>
          </span>
          <ScoreBar value={b.value} best={b.best} label={`${b.name}: ${formatScore(b.value, b.unit)}, best ${formatScore(b.best, b.unit)}`} className="col-span-2 sm:col-span-1" />
        </div>
      ))}
    </Panel>
  );
}

function ArenaTable({ results }: { results: BenchmarkResult[] }) {
  return (
    <div className="relative overflow-x-auto rounded-[var(--radius-panel)] border border-border" role="region" aria-label="Design Arena results" tabIndex={0}>
      <table className="w-full min-w-[520px] text-13">
        <caption className="px-4 pt-3 pb-1 text-left text-xs font-medium text-muted">Design Arena: head-to-head human votes, Elo rating</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="h-9 px-4 text-left text-xs font-medium text-muted">Category</th>
            <th scope="col" className="h-9 px-3 text-right text-xs font-medium text-muted">Elo</th>
            <th scope="col" className="h-9 px-3 text-right text-xs font-medium text-muted">Win rate</th>
            <th scope="col" className="h-9 w-[30%] px-3 text-left text-xs font-medium text-muted">Relative</th>
            <th scope="col" className="h-9 px-4 text-right text-xs font-medium text-muted">Rank</th>
          </tr>
        </thead>
        <tbody>
          {results.map((b) => (
            <tr key={b.key} className="h-10 border-b border-border last:border-b-0">
              <th scope="row" className="px-4 text-left font-normal">
                <Link href={`/rankings/${b.key}`} className="hover:text-accent">
                  {b.name}
                </Link>
                {b.category === "design-agents" ? <span className="ml-1.5 text-xs text-faint">agents</span> : null}
              </th>
              <td className="px-3 text-right font-medium">{formatScore(b.value, "elo")}</td>
              <td className="px-3 text-right text-muted">{b.winRate != null ? `${b.winRate.toFixed(1)}%` : "N/A"}</td>
              <td className="px-3">
                <ScoreBar value={b.value} best={b.best} tone="coral" label={`${b.name} Elo relative to best`} />
              </td>
              <td className="px-4 text-right whitespace-nowrap">
                #{b.rank} <span className="text-xs text-faint">of {b.ofTotal}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailSkeleton(): ReactNode {
  return (
    <div className="pt-6" aria-busy="true" aria-label="Loading model">
      <Skeleton className="h-3.5 w-48" />
      <div className="flex items-center gap-3.5 pt-6 pb-6">
        <Skeleton className="size-11 rounded-[7px]" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
      <Skeleton className="h-[78px] w-full rounded-[var(--radius-panel)]" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-80 rounded-[var(--radius-panel)]" />
        <Skeleton className="h-80 rounded-[var(--radius-panel)]" />
      </div>
    </div>
  );
}
