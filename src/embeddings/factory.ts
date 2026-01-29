// src/embeddings/factory.ts
// The model foundry—where embedding instances are forged from configuration

import { HuggingFaceEmbedding } from "./huggingface.js";
import type { EmbeddingModel } from "./types.js";
import { getModelInfo } from "./types.js";

export interface CreateModelOptions {
	modelId: string;
	provider?: string;
	dimensions?: number; // Override for variable-dimension models (OpenAI)
}

export function createModelInstance(
	options: CreateModelOptions,
): EmbeddingModel {
	const {
		modelId,
		provider: overrideProvider,
		dimensions: overrideDimensions,
	} = options;

	const info = getModelInfo(modelId);
	const provider = overrideProvider ?? info.provider;
	const dimensions = overrideDimensions ?? info.dimensions;

	switch (provider) {
		case "huggingface":
			return new HuggingFaceEmbedding(
				modelId,
				dimensions,
				info.supportsAsymmetric,
			);

		case "openai":
			// TODO: Implement OpenAI provider
			throw new Error("OpenAI provider not yet implemented");

		case "cohere":
			// TODO: Implement Cohere provider
			throw new Error("Cohere provider not yet implemented");

		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}
