// Embedding model interface and registry
// The cartography of vector space—each model a different lens on meaning

export interface EmbeddingModel {
  readonly provider: string;
  readonly modelId: string;
  readonly dimensions: number;

  embed(text: string, type?: "query" | "document"): Promise<number[]>;
  embedBatch(texts: string[], type?: "query" | "document"): Promise<number[][]>;
}

export interface ModelRegistryEntry {
  provider: "huggingface" | "openai" | "cohere";
  dimensions: number;
  supportsAsymmetric?: boolean;
}

export const MODEL_REGISTRY: Record<string, ModelRegistryEntry> = {
  // HuggingFace multilingual models—the polyglots
  "multilingual-e5-large": {
    provider: "huggingface",
    dimensions: 1024,
    supportsAsymmetric: true,
  },
  LaBSE: { provider: "huggingface", dimensions: 768 },
  "paraphrase-multilingual-MiniLM-L12-v2": {
    provider: "huggingface",
    dimensions: 384,
  },
  "BGE-M3": {
    provider: "huggingface",
    dimensions: 1024,
    supportsAsymmetric: true,
  },

  // OpenAI—the incumbent giants
  "text-embedding-3-small": { provider: "openai", dimensions: 1536 },
  "text-embedding-3-large": { provider: "openai", dimensions: 3072 },

  // Cohere—the semantic specialists
  "embed-multilingual-v3.0": {
    provider: "cohere",
    dimensions: 1024,
    supportsAsymmetric: true,
  },
};

export function getModelInfo(modelId: string): ModelRegistryEntry {
  const entry = MODEL_REGISTRY[modelId];
  if (!entry) {
    throw new Error(
      `Unknown model: ${modelId}. Available: ${Object.keys(MODEL_REGISTRY).join(", ")}`
    );
  }
  return entry;
}
