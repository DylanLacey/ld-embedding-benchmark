// src/config.ts
import { config } from "dotenv";
import { readConfig, type StoredConfig } from "./paths.js";

config();

// Embedding provider keys from environment
export const env = {
  hfToken: process.env.HF_TOKEN ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  cohereApiKey: process.env.COHERE_API_KEY ?? "",
} as const;

// Neon config from ~/.embedding_test/config.json
export function getNeonConfig(): StoredConfig {
  const storedConfig = readConfig();
  if (!storedConfig.databaseUrl) {
    throw new Error("Neon not configured. Run 'embedding4ld init' first.");
  }
  return storedConfig;
}

export function validateEnv(required: (keyof typeof env)[]): void {
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}
