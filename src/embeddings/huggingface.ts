// src/embeddings/huggingface.ts
// HuggingFace Inference API—where the polyglot models dwell
import { HfInference } from "@huggingface/inference";
import type { EmbeddingModel } from "./types.js";

// Map friendly model IDs to their HuggingFace Hub paths
const HF_MODEL_MAP: Record<string, string> = {
  "multilingual-e5-large": "intfloat/multilingual-e5-large",
  LaBSE: "sentence-transformers/LaBSE",
  "paraphrase-multilingual-MiniLM-L12-v2":
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "BGE-M3": "BAAI/bge-m3",
};

/**
 * HuggingFace Inference API embedding provider.
 *
 * Supports asymmetric models (e5, BGE) that use different prefixes
 * for queries vs documents—a subtle but crucial distinction.
 */
export class HuggingFaceEmbedding implements EmbeddingModel {
  readonly provider = "huggingface";
  readonly modelId: string;
  readonly dimensions: number;

  private hf: HfInference;
  private hfModelId: string;
  private supportsAsymmetric: boolean;

  /**
   * Creates a HuggingFace embedding instance.
   *
   * @param modelId - The model identifier (e.g., "multilingual-e5-large")
   * @param dimensions - The embedding dimension count
   * @param supportsAsymmetric - Whether the model uses query/document prefixes
   * @param token - HuggingFace API token. If not provided, reads from HF_TOKEN env var.
   */
  constructor(
    modelId: string,
    dimensions: number,
    supportsAsymmetric = false,
    token?: string,
  ) {
    // Resolve token: parameter > env var > error
    const resolvedToken = token ?? process.env.HF_TOKEN;
    if (!resolvedToken) {
      throw new Error(
        "HuggingFace token required. Provide via config, --hf-token flag, or HF_TOKEN env var.",
      );
    }

    this.modelId = modelId;
    this.dimensions = dimensions;
    this.supportsAsymmetric = supportsAsymmetric;
    this.hfModelId = HF_MODEL_MAP[modelId] ?? modelId;
    this.hf = new HfInference(resolvedToken);
  }

  /**
   * Asymmetric models like e5 and BGE want different prefixes
   * for queries vs documents—a subtle but crucial distinction
   * in the retrieval dance.
   */
  private formatText(text: string, type?: "query" | "document"): string {
    if (!this.supportsAsymmetric || !type) return text;
    // e5 and BGE use prefixes for asymmetric retrieval
    if (this.modelId.includes("e5") || this.modelId.includes("BGE")) {
      return type === "query" ? `query: ${text}` : `passage: ${text}`;
    }
    return text;
  }

  async embed(text: string, type?: "query" | "document"): Promise<number[]> {
    const formattedText = this.formatText(text, type);
    const result = await this.hf.featureExtraction({
      model: this.hfModelId,
      inputs: formattedText,
    });
    // featureExtraction returns number[] | number[][] | number[][][] depending on model.
    // For single input, we expect number[]. Validate to catch shape mismatches early.
    if (!Array.isArray(result) || typeof result[0] !== "number") {
      throw new Error(
        `Unexpected embedding shape from ${this.hfModelId}. Expected number[], got nested structure.`
      );
    }
    return result as number[];
  }

  async embedBatch(
    texts: string[],
    type?: "query" | "document"
  ): Promise<number[][]> {
    const formattedTexts = texts.map((t) => this.formatText(t, type));
    const results = await this.hf.featureExtraction({
      model: this.hfModelId,
      inputs: formattedTexts,
    });
    // For batch input, we expect number[][]. Validate the shape.
    if (
      !Array.isArray(results) ||
      !Array.isArray(results[0]) ||
      typeof results[0]?.[0] !== "number"
    ) {
      throw new Error(
        `Unexpected embedding shape from ${this.hfModelId}. Expected number[][], got unexpected structure.`
      );
    }
    return results as number[][];
  }
}
