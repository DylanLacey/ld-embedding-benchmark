// src/embeddings/factory.ts
// The model foundry—where embedding instances are forged from configuration

import { HuggingFaceEmbedding } from "./huggingface.js";
import type { EmbeddingModel } from "./types.js";
import { getModelInfo } from "./types.js";
import type { Config } from "../config/index.js";

/**
 * Options for creating an embedding model instance.
 */
export interface CreateModelOptions {
	/** The model identifier (e.g., "multilingual-e5-large") */
	modelId: string;

	/** Override the default provider for this model */
	provider?: string;

	/** Override dimensions for variable-dimension models (OpenAI) */
	dimensions?: number;

	/**
	 * Configuration containing API tokens.
	 * If provided, tokens are read from config.
	 * If not provided, falls back to environment variables.
	 */
	config?: Config;
}

/**
 * Creates an embedding model instance based on the model ID and config.
 *
 * The factory determines the correct provider from the model registry,
 * then instantiates the appropriate embedding class with the right token.
 *
 * @example
 * ```typescript
 * const config = await loadConfig();
 * const model = createModelInstance({
 *   modelId: "multilingual-e5-large",
 *   config
 * });
 * ```
 */
export function createModelInstance(
	options: CreateModelOptions,
): EmbeddingModel {
	const {
		modelId,
		provider: overrideProvider,
		dimensions: overrideDimensions,
		config,
	} = options;

	const info = getModelInfo(modelId);
	const provider = overrideProvider ?? info.provider;
	const dimensions = overrideDimensions ?? info.dimensions;

	switch (provider) {
		case "huggingface": {
			// Get token from config if provided, otherwise let provider read env
			const token = config?.hfToken;
			return new HuggingFaceEmbedding(
				modelId,
				dimensions,
				info.supportsAsymmetric,
				token,
			);
		}

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
