// src/config/sources.ts
// The gatherer — collects config from all corners of the filesystem
import { loadConfig as c12LoadConfig } from "c12";
import { config as loadDotenv } from "dotenv";
import { CONFIG_DIR } from "../paths.js";
import { configSchema, ENV_VAR_MAP, type Config } from "./schema.js";

// Load .env file early — before anything reads process.env
loadDotenv();

/**
 * Reads config values from environment variables.
 * Only includes keys that are actually set (not empty strings).
 */
function readEnvConfig(): Partial<Config> {
  const result: Partial<Config> = {};

  for (const [key, envVar] of Object.entries(ENV_VAR_MAP)) {
    const value = process.env[envVar];
    if (value) {
      // TypeScript needs help knowing key is keyof Config
      result[key as keyof Config] = value;
    }
  }

  return result;
}

/**
 * Options for loading configuration.
 */
export interface LoadConfigOptions {
  /** CLI flag overrides — highest priority */
  cliOverrides?: Partial<Config>;

  /** Working directory for project config discovery */
  cwd?: string;
}

/**
 * Loads and merges configuration from all sources.
 *
 * Priority (highest to lowest):
 * 1. CLI flags (cliOverrides parameter)
 * 2. Environment variables (process.env via ENV_VAR_MAP)
 * 3. Project config (.embedding4ldrc in cwd or ancestors)
 * 4. User config (~/.embedding_test/config.json)
 *
 * Later sources fill gaps; earlier sources win conflicts.
 *
 * @example
 * ```typescript
 * // In a CLI command action:
 * const config = await loadConfigFromSources({
 *   cliOverrides: { hfToken: opts.hfToken }
 * });
 * ```
 */
export async function loadConfigFromSources(
  options: LoadConfigOptions = {}
): Promise<Config> {
  const { cliOverrides = {}, cwd = process.cwd() } = options;

  // ─────────────────────────────────────────────────────────────
  // Layer 1: User config (~/.embedding_test/config.json)
  // The personal defaults — your credentials, your rules
  // ─────────────────────────────────────────────────────────────
  const { config: userConfig } = await c12LoadConfig<Partial<Config>>({
    name: "config",           // looks for config.json
    configFile: "config",     // explicit: config.json
    cwd: CONFIG_DIR,          // ~/.embedding_test/
    dotenv: false,            // we handle dotenv ourselves
    defaults: {},
  });

  // ─────────────────────────────────────────────────────────────
  // Layer 2: Project config (.embedding4ldrc in project root)
  // Per-project overrides — different project, different database
  // ─────────────────────────────────────────────────────────────
  const { config: projectConfig } = await c12LoadConfig<Partial<Config>>({
    name: "embedding4ld",     // looks for .embedding4ldrc, embedding4ld.config.ts, etc.
    cwd,                      // start from working directory
    dotenv: false,            // we handle dotenv ourselves
    defaults: {},
  });

  // ─────────────────────────────────────────────────────────────
  // Layer 3: Environment variables
  // The CI/CD favourite — no files, just exports
  // ─────────────────────────────────────────────────────────────
  const envConfig = readEnvConfig();

  // ─────────────────────────────────────────────────────────────
  // Merge: user < project < env < cli
  // Each layer can override keys from layers below
  // ─────────────────────────────────────────────────────────────
  const merged: Partial<Config> = {
    ...userConfig,      // lowest priority
    ...projectConfig,   // overrides user
    ...envConfig,       // overrides project
    ...cliOverrides,    // highest priority (CLI flags)
  };

  // ─────────────────────────────────────────────────────────────
  // Validate shape (not completeness — that's the command's job)
  // ─────────────────────────────────────────────────────────────
  const result = configSchema.safeParse(merged);

  if (!result.success) {
    // Schema validation failed — malformed config somewhere
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  return result.data;
}
