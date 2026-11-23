// Tests that the explorer's URL state maps to the same API query the server renders (no refetch after hydration).
import { describe, expect, it } from "vitest";
import { modelListQuerySchema, paramsToObject } from "@/lib/schemas";
import { effectiveSort, loadExplorerState, toApiQuery } from "./state";

describe("explorer URL state", () => {
  it("builds a canonical API query, so server and client share one cache key", () => {
    const a = loadExplorerState(new URLSearchParams("lab=openai,anthropic&capability=vision,tools"));
    const b = loadExplorerState(new URLSearchParams("capability=tools,vision&lab=anthropic,openai"));
    expect(toApiQuery(a)).toBe(toApiQuery(b));
  });

  it("produces queries the API schema accepts", () => {
    const s = loadExplorerState(new URLSearchParams("q=claude&type=text,image&minContext=1000000&view=cards&page=2"));
    const parsed = modelListQuerySchema.safeParse(paramsToObject(new URLSearchParams(toApiQuery(s))));
    expect(parsed.success && parsed.data).toMatchObject({ q: "claude", sort: "relevance", page: 2, pageSize: 24, minContext: 1_000_000 });
  });

  it("drops junk instead of failing the page", () => {
    const s = loadExplorerState(new URLSearchParams("type=foo,text&lab=../x,OpenAI&sort=nope"));
    expect(toApiQuery(s)).toContain("lab=openai&type=text");
    expect(effectiveSort(s)).toEqual({ sort: "providers", order: "desc" });
  });
});
