// src/config/schema.ts
// The shape of truth — what credentials look like when they arrive
import { z } from "zod";

/**
 * Configuration schema for embedding4ld.
 *
 * All fields are optional at the schema level because:
 * 1. Different commands need different subsets
 * 2. Values come from multiple sources (CLI, env, files)
 * 3. Validation of "required for this command" happens at runtime
 *
 * The schema validates shape, not completeness.
 */
export const configSchema = z.object({
  // ─────────────────────────────────────────────────────────────
  // Neon Management API credentials
  // Used by: init, destroy, branch commands
  // ─────────────────────────────────────────────────────────────

  /** Neon API key from console.neon.tech — unlocks the management API */
  neonApiKey: z.string().optional(),

  /** Neon project ID — the target of our vector operations */
  neonProjectId: z.string().optional(),

  // ─────────────────────────────────────────────────────────────
  // Database connection
  // Used by: migrate, embed, benchmark commands
  // ─────────────────────────────────────────────────────────────

  /**
   * Direct database URL — postgres://user:pass@host/db
   * When provided, overrides URL construction from project ID.
   * Useful for connecting to specific branches or external databases.
   */
  databaseUrl: z.string().url().optional(),

  // ─────────────────────────────────────────────────────────────
  // Embedding provider tokens
  // Only one needed — depends on which model you're using
  // ─────────────────────────────────────────────────────────────

  /** HuggingFace Inference API token — for multilingual-e5, LaBSE, etc. */
  hfToken: z.string().optional(),

  /** OpenAI API key — for text-embedding-3-small/large */
  openaiApiKey: z.string().optional(),

  /** Cohere API key — for embed-multilingual-v3 */
  cohereApiKey: z.string().optional(),
});

/** The shape of a fully-merged config (all sources combined) */
export type Config = z.infer<typeof configSchema>;

/**
 * Environment variable mappings.
 * Maps config keys to their corresponding env var names.
 * Used by sources.ts to read from process.env.
 */
export const ENV_VAR_MAP: Record<keyof Config, string> = {
  neonApiKey: "NEON_API_KEY",
  neonProjectId: "NEON_PROJECT_ID",
  databaseUrl: "DATABASE_URL",
  hfToken: "HF_TOKEN",
  openaiApiKey: "OPENAI_API_KEY",
  cohereApiKey: "COHERE_API_KEY",
};

/**
 * CLI flag mappings.
 * Maps config keys to their Commander flag names (kebab-case).
 * Used by cli.ts to wire up global options.
 */
export const CLI_FLAG_MAP: Record<keyof Config, string> = {
  neonApiKey: "neon-api-key",
  neonProjectId: "neon-project-id",
  databaseUrl: "database-url",
  hfToken: "hf-token",
  openaiApiKey: "openai-api-key",
  cohereApiKey: "cohere-api-key",
};
