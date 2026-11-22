// Display formatting shared by server (ranking labels) and UI. Pure functions on Intl, no locale surprises: en-US.

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US");

const trim = (x: number, digits: number) => String(Number(x.toFixed(digits)));

/** Token counts in decimal units: 1000000 -> "1M", 1048576 -> "1.05M", 131072 -> "131K", 1500 -> "1.5K". null -> "N/A". */
export function formatTokens(n: number | null | undefined): string {
  if (n == null) return "N/A";
  if (n >= 1_000_000) return `${trim(n / 1_000_000, 2)}M`;
  if (n >= 1_000) return `${trim(n / 1_000, n < 10_000 ? 1 : 0)}K`;
  return String(n);
}

/** USD per 1M tokens: 0 -> "Free", 0.075 -> "$0.075", 3 -> "$3.00", 1.19516 -> "$1.20", null -> "N/A". */
export function formatPrice(n: number | null | undefined): string {
  if (n == null) return "N/A";
  if (n === 0) return "Free";
  if (n < 0.01) return `$${Number(n.toPrecision(2))}`;
  if (n < 0.1) return `$${trim(n, 3)}`;
  return `$${n.toFixed(2)}`;
}

/** Monthly cost in dollars with sensible precision: 0.004 -> "<$0.01", 12.5 -> "$12.50", 12345 -> "$12,345". */
export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "N/A";
  if (n === 0) return "$0";
  if (n < 0.01) return "<$0.01";
  if (n >= 1000) return `$${integer.format(Math.round(n))}`;
  return `$${n.toFixed(2)}`;
}

export const formatCompact = (n: number | null | undefined) => (n == null ? "N/A" : compact.format(n));
export const formatInteger = (n: number | null | undefined) => (n == null ? "N/A" : integer.format(n));

/** Scores: index -> one decimal ("59.1"), elo -> integer ("1,491"). */
export function formatScore(n: number | null | undefined, unit: string = "index"): string {
  if (n == null) return "N/A";
  return unit === "elo" ? integer.format(Math.round(n)) : n.toFixed(1);
}

const dateFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", timeZone: "UTC" });

/** "2026-05-01" -> "May 1, 2026"; null -> "N/A". Dates are UTC calendar dates, so format in UTC. */
export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : "N/A");
/** "2025-05-01" -> "May 2025" (knowledge cutoffs are month-precision). */
export const formatMonth = (iso: string | null | undefined) => (iso ? monthFmt.format(new Date(`${iso}T00:00:00Z`)) : "N/A");

/** Days between an ISO date and `now` (for "New" badges). */
export const daysSince = (iso: string | null | undefined, now = Date.now()) =>
  iso ? Math.floor((now - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000) : Infinity;

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${formatInteger(n)} ${n === 1 ? word : pluralWord}`;
