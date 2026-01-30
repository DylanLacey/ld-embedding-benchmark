// src/config.ts
// Backward compatibility shim — gradually migrate away from this
// TODO: Remove this file once all imports updated to use ./config/index.js

import { loadConfig, requireConfig, type Config } from "./config/index.js";
import { readConfig, type StoredConfig } from "./paths.js";

/**
 * @deprecated Use loadConfig() from './config/index.js' instead
 *
 * Legacy env object for backward compatibility.
 * Reads directly from process.env — no config file merging.
 */
export const env = {
  hfToken: process.env.HF_TOKEN ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  cohereApiKey: process.env.COHERE_API_KEY ?? "",
} as const;

/**
 * @deprecated Use loadConfig() from './config/index.js' instead
 *
 * Gets Neon config from user config file.
 * Throws if not configured.
 */
export function getNeonConfig(): StoredConfig {
  const storedConfig = readConfig();
  if (!storedConfig.databaseUrl) {
    throw new Error("Neon not configured. Run 'embedding4ld init' first.");
  }
  return storedConfig;
}

/**
 * @deprecated Use requireConfig() from './config/index.js' instead
 *
 * Validates that required env vars are present.
 */
export function validateEnv(required: (keyof typeof env)[]): void {
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

// Re-export new config for gradual migration
export { loadConfig, requireConfig, type Config };
