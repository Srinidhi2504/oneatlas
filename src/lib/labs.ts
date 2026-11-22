// Lab identity rules shared by ingestion (scripts/ingest) and the app. See docs/04 "Join key".

/** OpenRouter uses different lab prefixes from models.dev for a few labs. Maps OpenRouter prefix -> our lab slug. */
export const LAB_ALIAS: Record<string, string> = {
  qwen: "alibaba",
  "z-ai": "zhipuai",
  "x-ai": "xai",
  mistralai: "mistral",
  "meta-llama": "meta",
  bytedance: "bytedance-seed",
  "ibm-granite": "ibm",
};

/** Display names where the source has none, or a noisy one ("MiniMax (minimax.io)"). Wins over every other source. */
export const LAB_NAMES: Record<string, string> = {
  minimax: "MiniMax",
  stepfun: "StepFun",
  liquid: "Liquid AI",
  xai: "xAI",
  openai: "OpenAI",
  microsoft: "Microsoft",
  tencent: "Tencent",
  amazon: "Amazon",
  voyageai: "Voyage AI",
  "bytedance-seed": "ByteDance Seed",
  inclusionai: "inclusionAI",
  "inference-net": "Inference.net",
  fireworks: "Fireworks AI",
  mixedbread: "Mixedbread",
  elevenlabs: "ElevenLabs",
  "arcee-ai": "Arcee AI",
  baai: "BAAI",
  ibm: "IBM",
  nousresearch: "Nous Research",
  "swiss-ai": "Swiss AI",
  aisingapore: "AI Singapore",
  "black-forest-labs": "Black Forest Labs",
  rekaai: "Reka AI",
  "aleph-alpha": "Aleph Alpha",
  lightonai: "LightOn",
  openbmb: "OpenBMB",
  allenai: "Ai2",
  essentialai: "Essential AI",
  opendatalab: "OpenDataLab",
  paddlepaddle: "PaddlePaddle",
  sdaia: "SDAIA",
  "sentence-transformers": "Sentence Transformers",
  thedrummer: "TheDrummer",
  sao10k: "Sao10K",
  cognitivecomputations: "Cognitive Computations",
  canopylabs: "Canopy Labs",
  "motif-technologies": "Motif Technologies",
  "anthracite-org": "Anthracite",
  "aion-labs": "Aion Labs",
  "nex-agi": "Nex AGI",
  quiverai: "QuiverAI",
  deepreinforce: "DeepReinforce",
};

export const labAlias = (prefix: string) => LAB_ALIAS[prefix] ?? prefix;

/** "black-forest-labs" -> "Black Forest Labs". Last-resort display name. */
export const titleCase = (slug: string) =>
  slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
