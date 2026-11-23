"use client";
// A lab's model list with client-side sorting (the full list is already on the page).
import { useState } from "react";
import { ModelTable, type SortState } from "@/components/models/ModelTable";
import { defaultOrder, type ModelSort } from "@/lib/types";
import type { ModelListItem } from "@/lib/types";

const VALUE: Partial<Record<ModelSort, (m: ModelListItem) => number | string | null>> = {
  name: (m) => m.name.toLowerCase(),
  price: (m) => m.pricing.blended,
  context: (m) => m.contextWindow,
  released: (m) => m.releasedAt,
  intelligence: (m) => m.intelligenceIndex,
  providers: (m) => m.providerCount,
};

/** A lab's full model list (already on the page), sorted in memory; nulls always last. */
export function LabModels({ models }: { models: ModelListItem[] }) {
  const [sort, setSort] = useState<SortState>({ sort: "released", order: "desc" });
  const get = VALUE[sort.sort] ?? VALUE.released!;
  const rows = [...models].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
    const d = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
    return sort.order === "asc" ? d : -d;
  });
  return (
    <ModelTable
      items={rows}
      caption="Models from this lab"
      sortState={sort}
      onSort={(s) => setSort((cur) => ({ sort: s, order: cur.sort === s ? (cur.order === "asc" ? "desc" : "asc") : defaultOrder(s) }))}
    />
  );
}
