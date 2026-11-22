"use client";
// Faceted filters with live counts from /api/v1/facets. Native checkboxes in fieldsets: accessible by default.
import { Search } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { formatInteger } from "@/lib/format";
import type { Facets, ModelType } from "@/lib/types";

const TYPE_LABEL: Record<ModelType, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  embedding: "Embedding",
  speech: "Speech",
  transcription: "Transcription",
  rerank: "Reranking",
  realtime: "Realtime",
};

interface Props {
  facets: Facets | undefined;
  type: ModelType[];
  lab: string[];
  provider: string[];
  onChange: (patch: { type?: ModelType[]; lab?: string[]; provider?: string[] }) => void;
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function FilterPanel({ facets, type, lab, provider, onChange }: Props) {
  return (
    <div className="space-y-6">
      <CheckGroup
        legend="Type"
        options={(facets?.types ?? []).map((t) => ({ value: t.value, label: TYPE_LABEL[t.value], count: t.count }))}
        selected={type}
        onToggle={(v) => onChange({ type: toggle(type, v as ModelType) })}
        loading={!facets}
      />
      <SearchableGroup
        legend="Lab"
        options={(facets?.labs ?? []).map((l) => ({ value: l.slug, label: l.name, count: l.count }))}
        selected={lab}
        onToggle={(v) => onChange({ lab: toggle(lab, v) })}
        loading={!facets}
      />
      <SearchableGroup
        legend="Provider"
        options={(facets?.providers ?? []).map((p) => ({ value: p.slug, label: p.name, count: p.count }))}
        selected={provider}
        onToggle={(v) => onChange({ provider: toggle(provider, v) })}
        loading={!facets}
        note="Top 50 providers for the current filters"
      />
    </div>
  );
}

interface Option {
  value: string;
  label: string;
  count: number;
}

function CheckRow({ option, checked, onToggle }: { option: Option; checked: boolean; onToggle: () => void }) {
  const disabled = !checked && option.count === 0;
  return (
    <label className={cn("flex h-8 cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-1.5 text-13 hover:bg-surface-2", disabled && "cursor-default opacity-45 hover:bg-transparent")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} className="size-3.5 shrink-0 accent-[var(--accent)]" />
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      <span className="shrink-0 text-xs text-faint">{formatInteger(option.count)}</span>
    </label>
  );
}

function GroupSkeleton() {
  return (
    <div className="space-y-2 px-1.5 py-1" aria-hidden>
      {[70, 55, 80, 45].map((w) => (
        <span key={w} className="block h-3 animate-shimmer rounded bg-surface-2" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

function CheckGroup({ legend, options, selected, onToggle, loading }: { legend: string; options: Option[]; selected: string[]; onToggle: (v: string) => void; loading: boolean }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-muted">{legend}</legend>
      {loading ? (
        <GroupSkeleton />
      ) : options.length ? (
        options.map((o) => <CheckRow key={o.value} option={o} checked={selected.includes(o.value)} onToggle={() => onToggle(o.value)} />)
      ) : (
        <p className="px-1.5 py-1 text-13 text-faint">None for the current filters</p>
      )}
    </fieldset>
  );
}

function SearchableGroup({
  legend,
  options,
  selected,
  onToggle,
  loading,
  note,
}: {
  legend: string;
  options: Option[];
  selected: string[];
  onToggle: (v: string) => void;
  loading: boolean;
  note?: string;
}) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(false);
  const inputId = useId();
  const f = filter.trim().toLowerCase();
  // selected options always stay visible, even if the counts would push them out of the list
  const matching = options.filter((o) => !f || o.label.toLowerCase().includes(f) || o.value.includes(f));
  const pinned = matching.filter((o) => selected.includes(o.value));
  const rest = matching.filter((o) => !selected.includes(o.value));
  const limit = expanded || f ? rest.length : Math.max(0, 8 - pinned.length);
  const shown = [...pinned, ...rest.slice(0, limit)];
  const missingSelected = selected.filter((s) => !options.some((o) => o.value === s));

  return (
    // fieldsets default to min-inline-size: min-content, so a long provider name would widen the sidebar
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-muted">{legend}</legend>
      <div className="relative mb-1">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
        <label htmlFor={inputId} className="sr-only">
          Filter {legend.toLowerCase()} list
        </label>
        <input
          id={inputId}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Find a ${legend.toLowerCase()}`}
          className="h-8 w-full rounded-[var(--radius-control)] border border-border bg-bg pr-2 pl-7 text-13 placeholder:text-faint hover:border-border-strong focus:border-accent focus:outline-none"
        />
      </div>
      {loading ? (
        <GroupSkeleton />
      ) : (
        <div className={cn(expanded && "max-h-72 overflow-y-auto")}>
          {missingSelected.map((s) => (
            <CheckRow key={s} option={{ value: s, label: s, count: 0 }} checked onToggle={() => onToggle(s)} />
          ))}
          {shown.map((o) => (
            <CheckRow key={o.value} option={o} checked={selected.includes(o.value)} onToggle={() => onToggle(o.value)} />
          ))}
          {!shown.length && !missingSelected.length ? (
            <p className="px-1.5 py-1 text-13 text-faint">{f ? `No match for “${filter}”` : "None for the current filters"}</p>
          ) : null}
        </div>
      )}
      {!f && rest.length > limit ? (
        <button type="button" onClick={() => setExpanded(true)} className="mt-1 px-1.5 text-13 font-medium text-accent hover:underline">
          Show all {formatInteger(options.length)}
        </button>
      ) : null}
      {expanded && note ? <p className="mt-1 px-1.5 text-xs text-faint">{note}</p> : null}
    </fieldset>
  );
}
