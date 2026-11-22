"use client";
import { ExternalLink, SearchX } from "lucide-react";
import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Badge, Button, LabAvatar, Panel, StateMessage } from "@/components/ui/primitives";
import { SelectMenu } from "@/components/ui/SelectMenu";
import { formatDate, formatInteger, plural } from "@/lib/format";
import type { LabSummary, ProviderSummary } from "@/lib/types";

function SearchBox({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  return (
    <div className="min-w-0 flex-1 basis-60">
      <label htmlFor="dir-search" className="sr-only">
        {label}
      </label>
      <input
        id="dir-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 text-sm placeholder:text-faint hover:border-border-strong focus:border-accent focus:outline-none"
      />
    </div>
  );
}

const matches = (q: string, ...fields: (string | null)[]) => {
  const n = q.trim().toLowerCase();
  return !n || fields.some((f) => f?.toLowerCase().includes(n));
};

/** 91 labs: filtered and sorted in memory (instant), state in the URL so it is shareable. */
export function LabsDirectory({ labs }: { labs: LabSummary[] }) {
  const [{ q, sort }, set] = useQueryStates(
    { q: parseAsString.withDefault(""), sort: parseAsStringLiteral(["models", "name", "latest"] as const).withDefault("models") },
    { history: "replace" },
  );
  const shown = labs
    .filter((l) => matches(q, l.name, l.slug))
    .sort(
      sort === "name"
        ? (a, b) => a.name.localeCompare(b.name)
        : sort === "latest"
          ? (a, b) => (b.latestRelease?.releasedAt ?? "").localeCompare(a.latestRelease?.releasedAt ?? "")
          : (a, b) => b.modelCount - a.modelCount || a.name.localeCompare(b.name),
    );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SearchBox value={q} onChange={(v) => set({ q: v || null })} label="Search labs" placeholder="Search labs, e.g. Mistral" />
        <SelectMenu
          label="Sort"
          value={sort}
          onValueChange={(v) => set({ sort: v === "models" ? null : v })}
          options={[
            { value: "models", label: "Most models" },
            { value: "latest", label: "Latest release" },
            { value: "name", label: "Name" },
          ]}
        />
      </div>
      <p className="text-13 text-muted" aria-live="polite">
        {plural(shown.length, "lab")}
      </p>
      {shown.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((l) => (
            <li key={l.slug}>
              <Link href={`/labs/${l.slug}`} className="flex h-full flex-col rounded-[var(--radius-panel)] border border-border p-4 transition-colors hover:border-border-strong hover:bg-surface">
                <span className="flex items-center gap-3">
                  <LabAvatar slug={l.slug} name={l.name} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{l.name}</span>
                    <span className="block text-xs text-muted">
                      {plural(l.modelCount, "model")}
                      {l.openWeightsCount ? `, ${formatInteger(l.openWeightsCount)} open` : ""}
                    </span>
                  </span>
                </span>
                <span className="mt-3 block border-t border-border pt-2.5 text-xs text-faint">
                  {l.latestRelease ? (
                    <>
                      Latest: <span className="text-fg">{l.latestRelease.name}</span>, {formatDate(l.latestRelease.releasedAt)}
                    </>
                  ) : (
                    "No release dates published"
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Panel>
          <StateMessage icon={<SearchX />} title={`No labs match “${q}”`} action={<Button onClick={() => set({ q: null })}>Clear search</Button>} />
        </Panel>
      )}
    </div>
  );
}

/** 307 providers as a dense table: name, models served, first-party badge, docs link. */
export function ProvidersDirectory({ providers, labNames }: { providers: ProviderSummary[]; labNames: Record<string, string> }) {
  const [{ q, sort }, set] = useQueryStates(
    { q: parseAsString.withDefault(""), sort: parseAsStringLiteral(["models", "name"] as const).withDefault("models") },
    { history: "replace" },
  );
  const shown = providers
    .filter((p) => matches(q, p.name, p.slug))
    .sort(sort === "name" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.modelCount - a.modelCount || a.name.localeCompare(b.name));
  const max = Math.max(1, ...providers.map((p) => p.modelCount));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <SearchBox value={q} onChange={(v) => set({ q: v || null })} label="Search providers" placeholder="Search providers, e.g. Bedrock" />
        <SelectMenu
          label="Sort"
          value={sort}
          onValueChange={(v) => set({ sort: v === "models" ? null : v })}
          options={[
            { value: "models", label: "Most models" },
            { value: "name", label: "Name" },
          ]}
        />
      </div>
      <p className="text-13 text-muted" aria-live="polite">
        {plural(shown.length, "provider")}
      </p>
      {shown.length ? (
        <div className="relative overflow-x-auto rounded-[var(--radius-panel)] border border-border" role="region" aria-label="Providers table" tabIndex={0}>
          <table className="w-full min-w-[560px] border-collapse text-13">
            <caption className="sr-only">API providers and the number of models each serves</caption>
            <thead className="bg-surface">
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="h-10 px-4 text-left font-medium">Provider</th>
                <th scope="col" className="h-10 w-[40%] px-4 text-left font-medium">Models served</th>
                <th scope="col" className="h-10 px-4 text-right font-medium">Docs</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.slug} className="h-12 border-b border-border last:border-b-0 hover:bg-surface">
                  <th scope="row" className="px-4 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <Link href={`/providers/${p.slug}`} className="font-medium hover:text-accent">
                        {p.name}
                      </Link>
                      {p.labSlug ? <Badge tone="accent">First-party: {labNames[p.labSlug] ?? p.labSlug}</Badge> : null}
                    </span>
                  </th>
                  <td className="px-4">
                    <span className="flex items-center gap-3">
                      <span className="w-10 shrink-0 text-right font-medium">{formatInteger(p.modelCount)}</span>
                      <span className="block h-1.5 flex-1 overflow-hidden rounded-[2px] bg-bar-track" aria-hidden>
                        <span className="block h-full bg-bar" style={{ width: `${(p.modelCount / max) * 100}%` }} />
                      </span>
                    </span>
                  </td>
                  <td className="px-4 text-right">
                    {p.docUrl ? (
                      <a href={p.docUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted hover:text-accent" aria-label={`${p.name} documentation (opens in a new tab)`}>
                        Docs <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-faint">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Panel>
          <StateMessage icon={<SearchX />} title={`No providers match “${q}”`} action={<Button onClick={() => set({ q: null })}>Clear search</Button>} />
        </Panel>
      )}
    </div>
  );
}
