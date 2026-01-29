// src/embeddings/huggingface.ts
// HuggingFace Inference API—where the polyglot models dwell
import { HfInference } from "@huggingface/inference";
import type { EmbeddingModel } from "./types.js";
import { env, validateEnv } from "../config.js";

// Map friendly model IDs to their HuggingFace Hub paths
const HF_MODEL_MAP: Record<string, string> = {
  "multilingual-e5-large": "intfloat/multilingual-e5-large",
  LaBSE: "sentence-transformers/LaBSE",
  "paraphrase-multilingual-MiniLM-L12-v2":
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "BGE-M3": "BAAI/bge-m3",
};

export class HuggingFaceEmbedding implements EmbeddingModel {
  readonly provider = "huggingface";
  readonly modelId: string;
  readonly dimensions: number;

  private hf: HfInference;
  private hfModelId: string;
  private supportsAsymmetric: boolean;

  constructor(modelId: string, dimensions: number, supportsAsymmetric = false) {
    validateEnv(["hfToken"]);
    this.modelId = modelId;
    this.dimensions = dimensions;
    this.supportsAsymmetric = supportsAsymmetric;
    this.hfModelId = HF_MODEL_MAP[modelId] ?? modelId;
    this.hf = new HfInference(env.hfToken);
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
    return results as number[][];
  }
}
