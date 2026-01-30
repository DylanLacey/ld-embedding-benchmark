// src/config/index.ts
// The gatekeeper — your one-stop shop for configuration
import pc from "picocolors";
import { loadConfigFromSources, type LoadConfigOptions } from "./sources.js";
import { ENV_VAR_MAP, CLI_FLAG_MAP, type Config } from "./schema.js";

// Re-export types for convenience
export type { Config } from "./schema.js";
export type { LoadConfigOptions } from "./sources.js";
export { configSchema, ENV_VAR_MAP, CLI_FLAG_MAP } from "./schema.js";

/**
 * Loads configuration from all sources.
 *
 * This is the main entry point — call this in your command action.
 *
 * @example
 * ```typescript
 * program.command('embed')
 *   .option('--hf-token <token>', 'HuggingFace token')
 *   .action(async (opts) => {
 *     const config = await loadConfig({ cliOverrides: opts });
 *     // Use config.hfToken, config.databaseUrl, etc.
 *   });
 * ```
 */
export async function loadConfig(options?: LoadConfigOptions): Promise<Config> {
  return loadConfigFromSources(options);
}

/**
 * Formats a friendly error box for missing credentials.
 * Makes the fix obvious — no guessing required.
 */
function formatMissingCredentialsError(
  commandName: string,
  missingKeys: (keyof Config)[]
): string {
  const lines: string[] = [];

  // Build the items list
  const items = missingKeys.map((key) => {
    const envVar = ENV_VAR_MAP[key];
    const cliFlag = CLI_FLAG_MAP[key];
    return `    • ${envVar} (or --${cliFlag})`;
  });

  // Calculate box width
  const maxLineLength = Math.max(
    `  Missing credentials for '${commandName}' command  `.length,
    ...items.map((i) => i.length + 4)
  );
  const width = Math.max(maxLineLength, 50);

  // Build the box
  lines.push(pc.red(`┌${"─".repeat(width)}┐`));
  lines.push(pc.red(`│  Missing credentials for '${commandName}' command`.padEnd(width) + "│"));
  lines.push(pc.red(`├${"─".repeat(width)}┤`));
  lines.push(pc.red(`│`.padEnd(width + 1) + "│"));
  lines.push(pc.red(`│  Required:`.padEnd(width + 1) + "│"));

  for (const item of items) {
    lines.push(pc.red(`│${item.padEnd(width)}│`));
  }

  lines.push(pc.red(`│`.padEnd(width + 1) + "│"));
  lines.push(pc.red(`│  Provide via:`.padEnd(width + 1) + "│"));
  lines.push(pc.red(`│    1. Environment variable`.padEnd(width + 1) + "│"));
  lines.push(pc.red(`│    2. .embedding4ldrc in project root`.padEnd(width + 1) + "│"));
  lines.push(pc.red(`│    3. ~/.embedding_test/config.json`.padEnd(width + 1) + "│"));
  lines.push(pc.red(`│    4. CLI flag`.padEnd(width + 1) + "│"));
  lines.push(pc.red(`│`.padEnd(width + 1) + "│"));
  lines.push(pc.red(`└${"─".repeat(width)}┘`));

  return lines.join("\n");
}

/**
 * Validates that required config keys are present.
 * Throws a friendly error if any are missing.
 *
 * Call this in your command action after loading config.
 *
 * @example
 * ```typescript
 * const config = await loadConfig({ cliOverrides: opts });
 * requireConfig(config, ['hfToken', 'databaseUrl'], 'embed');
 * // Now TypeScript knows config.hfToken and config.databaseUrl are defined
 * ```
 */
export function requireConfig<K extends keyof Config>(
  config: Config,
  keys: K[],
  commandName: string
): asserts config is Config & Required<Pick<Config, K>> {
  const missing = keys.filter((key) => !config[key]);

  if (missing.length > 0) {
    console.error(formatMissingCredentialsError(commandName, missing));
    process.exit(1);
  }
}

/**
 * Gets a single config value, throwing if not present.
 * Useful for inline access with type narrowing.
 *
 * @example
 * ```typescript
 * const token = getRequiredConfig(config, 'hfToken', 'embed');
 * // token is string, not string | undefined
 * ```
 */
export function getRequiredConfig<K extends keyof Config>(
  config: Config,
  key: K,
  commandName: string
): NonNullable<Config[K]> {
  const value = config[key];

  if (!value) {
    console.error(formatMissingCredentialsError(commandName, [key]));
    process.exit(1);
  }

  return value as NonNullable<Config[K]>;
}
