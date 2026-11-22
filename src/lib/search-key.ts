/**
 * Search normalisation shared by ingestion (Model.searchKey) and the API (query `q`).
 * Lowercase, keep [a-z0-9] only, so "GPT-4o", "gpt 4o" and "gpt4o" all become "gpt4o".
 */
export const toSearchKey = (...parts: (string | null | undefined)[]) =>
  parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Prisma's `contains` becomes ILIKE '%value%' without escaping, so "%" or "_" in user input would match everything. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");
