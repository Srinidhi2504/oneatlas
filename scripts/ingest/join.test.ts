import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isSkippableOpenRouterId, joinIds, joinKey } from "./join";

describe("joinKey", () => {
  it("applies the lab alias map", () => {
    expect(joinKey("qwen", "qwen3-max")).toBe("alibaba/qwen3max");
    expect(joinKey("z-ai", "glm-5.3")).toBe(joinKey("zhipuai", "glm-5.3"));
    expect(joinKey("x-ai", "grok-5")).toBe("xai/grok5");
    expect(joinKey("mistralai", "mistral-large")).toBe("mistral/mistrallarge");
    expect(joinKey("meta-llama", "llama-4")).toBe("meta/llama4");
    expect(joinKey("bytedance", "seed-2")).toBe("bytedance-seed/seed2");
    expect(joinKey("ibm-granite", "granite-4.2-8b")).toBe("ibm/granite428b");
  });
  it("drops variants, trailing dates and punctuation", () => {
    expect(joinKey("openai", "gpt-4o:free")).toBe("openai/gpt4o");
    expect(joinKey("openai", "gpt-4o-2024-08-06")).toBe("openai/gpt4o");
    expect(joinKey("anthropic", "claude-sonnet-4-5-20250929")).toBe("anthropic/claudesonnet45");
    expect(joinKey("anthropic", "claude-sonnet-4.5")).toBe("anthropic/claudesonnet45");
  });
  it("keeps version numbers that are not dates", () => {
    expect(joinKey("deepseek", "deepseek-v3.1")).toBe("deepseek/deepseekv31");
    expect(joinKey("openai", "gpt-4o")).not.toBe(joinKey("openai", "gpt-4"));
  });
  it("skips OpenRouter aliases and routers", () => {
    expect(isSkippableOpenRouterId("~anthropic/claude-latest")).toBe(true);
    expect(isSkippableOpenRouterId("openrouter/auto")).toBe(true);
    expect(isSkippableOpenRouterId("anthropic/claude-opus-5.5")).toBe(false);
  });
});

describe("joinIds", () => {
  it("prefers the exact id when several canonical ids share a key", () => {
    const r = joinIds(["acme/model-1", "acme/model1"], ["acme/model1"]);
    expect(r.ambiguous.size).toBe(1);
    expect(r.matched.get("acme/model1")).toBe("acme/model1");
  });
  it("falls back to the unique shortest slug, else leaves it unjoined", () => {
    expect(joinIds(["acme/m-1", "acme/m.1-"], ["acme/m1"]).matched.get("acme/m1")).toBe("acme/m-1");
    const tied = joinIds(["acme/m-1", "acme/m.1"], ["acme/m1"]);
    expect(tied.unresolved).toEqual(["acme/m1"]);
    expect(tied.matched.size).toBe(0);
  });
  it("orders variants after the plain entry", () => {
    const r = joinIds(["acme/x"], ["acme/x:free", "acme/x"]);
    expect(r.groups.get("acme/x")).toEqual(["acme/x", "acme/x:free"]);
  });

  // Baseline measured against the committed snapshots. docs/02 reported 357 keys / 74 unmatched because that
  // measurement still counted the 7 "openrouter/*" router ids (auto, fusion, free, ...), which docs/04 says to skip.
  // If a snapshot refresh moves these, update the numbers here and in docs/04 together.
  it("reproduces the baseline join numbers on the committed snapshots", () => {
    const md = JSON.parse(readFileSync("data/snapshots/modelsdev.json", "utf8")) as Record<
      string,
      { models: Record<string, { canonical_model_id?: string }> }
    >;
    const canonical = new Set<string>();
    for (const p of Object.values(md))
      for (const r of Object.values(p.models)) if (r.canonical_model_id) canonical.add(r.canonical_model_id);
    const or = JSON.parse(readFileSync("data/snapshots/openrouter-models.json", "utf8")) as { data: { id: string }[] };

    const r = joinIds([...canonical], or.data.map((e) => e.id));
    expect(r.groups.size).toBe(350);
    expect(r.groups.size - r.unmatched.length).toBe(284); // 283 + ibm-granite/granite-4.2-8b via the alias
    expect(r.ambiguous.size).toBe(5);
    expect(r.unresolved).toEqual([]);
    expect(r.unmatched.length).toBe(66);
    expect(r.matched.get("openai/gpt4o")).toBe("openai/gpt-4o");
    expect(r.matched.get("anthropic/claudesonnet45")).toBe("anthropic/claude-sonnet-4-5");
  });
});
