# 06 Frontend specification

Stack: Next.js 16 App Router, React 19, Tailwind 4, TanStack Query 5, nuqs 2. Add `lucide-react` (icons) and `recharts` (one chart, stretch) only when a task needs them. API contract: `05`. Caching rules: `03`/`CLAUDE.md`.

## Routes

| Route | Content | Data |
|-------|---------|------|
| `/` | Explorer: stats strip, search, filters, chips, table/cards, sort, pagination | `/models`, `/facets`, `/stats` |
| `/models/[lab]/[slug]` | Detail page | `getModel` |
| `/compare?ids=` | Comparison table | `/compare` |
| `/rankings` -> redirect `/rankings/reach`; `/rankings/[board]` | Leaderboards | `/rankings/{board}` |
| `/benchmarks` | Score matrix; best per column highlighted | `/benchmarks`, `/benchmarks/matrix` |
| `/labs`, `/labs/[slug]` | Lab directory and lab page | `/labs`, `/labs/{lab}` |
| `/providers`, `/providers/[slug]` | Provider directory and page | `/providers`, `/providers/{p}` |
| `/code?path=&line=` | Editor-style source viewer: tree, tabs, search, `Ctrl+P` quick open, line links | `codeTree()` (server), `/code/file`, `/code/search` |
| `not-found`, `error`, `loading` | Branded states | none |

Header: logo, nav (Models, Rankings, Benchmarks, Labs, Providers), search trigger (`Ctrl/Cmd+K`), Compare badge with count. Footer: data attributions, last-updated.

## Explorer (`/`)

- **Stats strip** (from `/stats`): models, labs, providers, listings + capability coverage meters (Tool calling, Reasoning, Vision, Open weights).
- **Controls:** search box (debounced 250 ms, `/` focuses it); chips (Reasoning, Tool calling, Structured output, Vision, Open weights, 1M+ context, Free, Include deprecated); selects/popovers for Lab, Provider, Type with counts from `/facets`; sort select + direction; **Table / Cards** toggle; "Clear all".
- **State = URL** via nuqs `useQueryStates` using the same keys as the API (`q, lab, provider, type, capability, minContext, sort, order, page, view`). Changing any filter resets `page` to 1.
- **Table columns:** [compare checkbox] Model (lab avatar + name + lab) · Type · Context · Max output · Modalities (icons) · Capabilities (icon badges) · Price in/out per 1M (+ blended in tooltip) · Providers · Intelligence · Released. Clickable headers sort (aria-sort). Sticky header, horizontal scroll on small screens, first column sticky.
- **Cards:** name, lab, price in/out, context, 3 capability badges, intelligence, "Add to compare".
- **Pagination:** page numbers + prev/next + "Showing 1 to 24 of 731"; `pageSize` 24 (cards) / 50 (table).
- **Compare tray:** floating bar at the bottom when >= 1 selected (names, remove, "Compare (n)" disabled below 2, max 4 with a toast-free inline message). Persisted in `localStorage` (guarded with try/catch), mirrored to `?ids=` on `/compare`.
- **Empty state:** "No models match" + the active filters as removable chips + "Clear all". **Error state:** message + Retry. **Loading:** skeleton rows with the exact row height (no layout shift) while `isPending`; `isFetching` with `keepPreviousData` shows a thin progress bar and dims rows.

## Detail page

Sections in order: header (name, lab link, type badge, "Deprecated" badge, Add to compare) -> stat tiles (Context, Max output, Input $, Output $, Providers, Intelligence) -> description -> **Specs & capabilities** (flags as labelled yes/no rows, modalities chips, family, released, knowledge cutoff, open weights) -> **Pricing** (table: input, output, cache read, cache write; note "lowest provider price" from `providerPriceRange`) + **Cost calculator** (stretch: sliders for monthly input/output tokens -> monthly cost at the reference price and the cheapest provider) -> **Benchmarks** (each result as label + value + bar relative to the benchmark's best + "#rank of N"; Design Arena grouped table with Elo, win rate, rank) -> **Rank chips** (`ranks`) linking to the matching board -> **Providers** table (all listings, sortable by price, columns per `ProviderListing`) -> "More from {lab}" (4 newest).
`generateMetadata` gives each model its own title/description (`"{name} by {lab}: pricing, context, benchmarks"`).

## Compare page

Columns = models (2 to 4, remove button each), rows grouped: **Overview** (lab, type, released), **Pricing** (input, output, blended, cache read/write), **Context** (window, max output), **Capabilities** (flags, modalities), **Benchmarks** (each key, rank). Best cell per numeric row highlighted (and an accessible "best" label, not colour alone). Toggle "Show differences only". Share = copy URL. Empty (<2 ids): picker prompting to select models via search. Mobile: horizontally scrollable table with sticky first column.

## Rankings

Left rail or top tabs: boards (Reach, Intelligence, Value, Cheapest, Context, Newest) + benchmark picker (grouped: Artificial Analysis, Design Arena). Filters: Lab, Type, capability chips. Table: Rank · Model · Lab · value (with relative **score bar** = value / best value) · price · context. "Labs in the top 100" panel from `labTop`. Stretch: price-vs-intelligence scatter (Recharts, log x-axis, labelled frontier models, with a text table fallback for a11y).

## Benchmarks page

Matrix from `/benchmarks/matrix`: sticky model column; benchmark columns chosen via a multi-select (default per API); best per column highlighted + "(highest)" sr-only text; filter by lab/type; sorted by the first selected column; clicking a column header sets the sort/leaderboard link.

## Labs and providers

Labs: card grid (avatar, name, model count, open-weights count, latest release) with search + sort. Lab page: stats, models list (reuse `ModelTable`, default sort newest), "Served by" provider chips. Providers: searchable list/grid with model counts; provider page: header (links to docs/API), paginated table of supported models with the provider's own prices (reuse price cell).

## Global search (Cmd/Ctrl+K)

Native `<dialog>`; input debounced 150 ms -> `/search`; grouped results (Models, Labs, Providers) with keyboard navigation (up/down/enter/esc), focus trap via `showModal()`, announces result count (`aria-live="polite"`). Opens from header button and shortcut; also reachable on mobile through the header icon.

## Components (build once, reuse)

`ui/`: Button, Badge, Chip (toggle), Input, Select, Card, Skeleton, Table primitives, Pagination, EmptyState, ErrorState, Avatar (lab initials on a deterministic hue; **no external logos**).
`models/`: ModelTable, ModelCard, FilterBar, SortSelect, CapabilityBadges, ModalityIcons, PriceCell, ScoreBar, CompareTray + `useCompareList` hook, ProviderTable, BenchmarkList.
`layout/`: Header, Footer, CommandPalette, ThemeColorMeta (if needed).
Formatting helpers in `src/lib/format.ts` using `Intl.NumberFormat`: `formatTokens(1048576) -> "1M"`, `formatPrice(0.075) -> "$0.075"`, `0 -> "Free"`, `null -> "N/A"` with an explanatory title, compact numbers, `Intl.DateTimeFormat` dates.

## Design system (Tailwind 4 tokens in `globals.css` `@theme`)

Neutral surface scale + one accent. Define CSS variables for `background, foreground, muted, muted-foreground, border, card, accent, accent-foreground, success, warning, danger` with **light and dark** values via `prefers-color-scheme`. Replace the scaffold's Arial `body` rule with the Geist font already wired in `layout.tsx`. 8px spacing grid, `rounded-lg` cards, 1px borders (no heavy shadows), tabular numerals for numbers (`tabular-nums`), max content width 1280px with 16px gutters on mobile.

## Responsive and accessibility rules

- Check at **375, 768, 1280 px**. Filters collapse into a "Filters" sheet below `md`. Tables scroll horizontally inside a labelled region; cards become the default view below `sm`.
- Semantic landmarks (`header, nav, main, footer`), skip-to-content link, visible focus rings, all controls keyboard reachable, icon-only buttons have `aria-label`, colour never the only signal (best/deprecated/free have text), table headers use `scope` and `aria-sort`, contrast >= 4.5:1, respects `prefers-reduced-motion`.
- Images: none required; avatars are generated. Set `<html lang="en">`.

## Performance

Server-render list pages; client JS limited to interactive islands (`FilterBar`, `ModelTable` sorting/paging, `CommandPalette`, compare tray). Lazy-load the chart. Use `next/link` prefetch on rows. Avoid shipping the whole catalogue to the client: only the current page.
