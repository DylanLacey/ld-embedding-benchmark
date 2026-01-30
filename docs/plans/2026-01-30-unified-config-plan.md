# Unified Configuration System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable all credentials to be provided via CLI flags, environment variables, or config files with clear priority chain.

**Architecture:** c12 handles file discovery and merging across project/user configs. Zod validates the merged config shape. Commander wires CLI flags that override everything. The existing paths.ts provides constants; new config/ module replaces config.ts.

**Tech Stack:** c12 (config loading), Zod (validation), Commander.js (CLI), TypeScript

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install c12 and zod**

Run: `pnpm add c12 zod`

**Step 2: Verify installation**

Run: `pnpm list c12 zod`
Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add c12 and zod for unified config"
```

---

### Task 2: Create config schema

**Files:**
- Create: `src/config/schema.ts`

**Step 1: Create the schema file**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/config/schema.ts
git commit -m "feat(config): add Zod schema with env/CLI mappings"
```

---

### Task 3: Create config sources loader

**Files:**
- Create: `src/config/sources.ts`

**Step 1: Create the c12 loader**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/config/sources.ts
git commit -m "feat(config): add c12-based config source loader"
```

---

### Task 4: Create config index with validation helpers

**Files:**
- Create: `src/config/index.ts`

**Step 1: Create the main config module**

```typescript
// src/config/index.ts
// The gatekeeper — your one-stop shop for configuration
import pc from "picocolors";
import { loadConfigFromSources, type LoadConfigOptions } from "./sources.js";
import { ENV_VAR_MAP, CLI_FLAG_MAP, type Config } from "./schema.js";

// Re-export types for convenience
export type { Config } from "./schema.js";
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/config/index.ts
git commit -m "feat(config): add main config loader with validation helpers"
```

---

### Task 5: Update existing config.ts to use new module

**Files:**
- Modify: `src/config.ts:1-28`

**Step 1: Replace config.ts with re-exports**

The old config.ts is imported by several files. Replace it with re-exports from the new module for backward compatibility.

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/config.ts
git commit -m "refactor(config): add backward compatibility shim"
```

---

### Task 6: Wire global CLI options

**Files:**
- Modify: `src/cli.ts:32-40`

**Step 1: Add global credential options to program**

Add global options right after the program definition (around line 32-40). These options will be available to all commands.

```typescript
// After program definition, before hook:
program
  .name("embedding4ld")
  .description("Embedding benchmark for multi-linguistic grammar retrieval")
  .version("1.0.0")
  // ─────────────────────────────────────────────────────────────
  // Global credential options — available to all commands
  // CLI flags override env vars override config files
  // ─────────────────────────────────────────────────────────────
  .option("--neon-api-key <key>", "Neon API key")
  .option("--neon-project-id <id>", "Neon project ID")
  .option("--database-url <url>", "Database connection URL")
  .option("--hf-token <token>", "HuggingFace API token")
  .option("--openai-api-key <key>", "OpenAI API key")
  .option("--cohere-api-key <key>", "Cohere API key")
  .hook("preAction", () => {
    console.log(BANNER);
  });
```

**Step 2: Add import and helper function**

At the top of cli.ts, add the new config import:

```typescript
import { loadConfig, requireConfig, type Config } from "./config/index.js";
```

Add a helper to extract CLI overrides from program options:

```typescript
/**
 * Extracts credential overrides from Commander's global options.
 * Maps kebab-case flags to camelCase config keys.
 */
function getCliOverrides(opts: Record<string, unknown>): Partial<Config> {
  return {
    neonApiKey: opts.neonApiKey as string | undefined,
    neonProjectId: opts.neonProjectId as string | undefined,
    databaseUrl: opts.databaseUrl as string | undefined,
    hfToken: opts.hfToken as string | undefined,
    openaiApiKey: opts.openaiApiKey as string | undefined,
    cohereApiKey: opts.cohereApiKey as string | undefined,
  };
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): add global credential flags"
```

---

### Task 7: Update embed command to use new config

**Files:**
- Modify: `src/cli.ts:122-145` (embed command)
- Modify: `src/embed-grammar.ts` (update to accept config)

**Step 1: Read current embed-grammar.ts**

First understand the current interface.

**Step 2: Update embed command in cli.ts**

```typescript
// ─────────────────────────────────────────────────────────────
// embed — the vectorisation ceremony
// ─────────────────────────────────────────────────────────────
program
  .command("embed <model>")
  .description("Embed all grammar constructs for a model")
  .option("-b, --branch <name>", "Neon branch name", "main")
  .option("-f, --force", "Re-embed even if vectors exist")
  .action(async (modelId: string, opts, cmd) => {
    // Load config with CLI overrides from global options
    const globalOpts = cmd.optsWithGlobals();
    const config = await loadConfig({ cliOverrides: getCliOverrides(globalOpts) });

    // Resolve branch URL if not on main
    const branchUrl =
      opts.branch && opts.branch !== "main"
        ? await getBranchUrl(opts.branch)
        : undefined;

    const result = await embedGrammarConstructs({
      modelId,
      config,
      ...(branchUrl && { branchUrl }),
      force: opts.force,
    });

    console.log(pc.green(`\n✿ Embedded: ${result.embedded}`));
    if (result.skipped > 0) {
      console.log(pc.yellow(`  Skipped: ${result.skipped}`));
    }
  });
```

**Step 3: Update embed-grammar.ts to accept config**

Read the file first, then update the interface and implementation to accept a Config object instead of reading env directly.

**Step 4: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/cli.ts src/embed-grammar.ts
git commit -m "feat(embed): use unified config system"
```

---

### Task 8: Update benchmark command to use new config

**Files:**
- Modify: `src/cli.ts:147-193` (benchmark command)
- Modify: `src/benchmark-runner.ts` (update to accept config)

**Step 1: Update benchmark command in cli.ts**

```typescript
// ─────────────────────────────────────────────────────────────
// benchmark — the proving grounds
// ─────────────────────────────────────────────────────────────
program
  .command("benchmark <model>")
  .description("Run benchmark queries against a model")
  .option("-b, --branch <name>", "Neon branch name", "main")
  .action(async (modelId: string, opts, cmd) => {
    // Load config with CLI overrides from global options
    const globalOpts = cmd.optsWithGlobals();
    const config = await loadConfig({ cliOverrides: getCliOverrides(globalOpts) });

    // Resolve branch URL if not on main
    const branchUrl =
      opts.branch && opts.branch !== "main"
        ? await getBranchUrl(opts.branch)
        : undefined;

    const result = await runBenchmark({
      modelId,
      config,
      ...(branchUrl && { branchUrl }),
      branchName: opts.branch,
    });

    // ... rest of the output formatting stays the same
  });
```

**Step 2: Update benchmark-runner.ts to accept config**

Update the interface and implementation to accept a Config object.

**Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/cli.ts src/benchmark-runner.ts
git commit -m "feat(benchmark): use unified config system"
```

---

### Task 9: Update migrate command to use new config

**Files:**
- Modify: `src/cli.ts:110-118` (migrate command)
- Modify: `src/migrate-to-neon.ts` (update to accept config)

**Step 1: Update migrate command**

```typescript
// ─────────────────────────────────────────────────────────────
// migrate — the great journey
// ─────────────────────────────────────────────────────────────
program
  .command("migrate")
  .description("Migrate grammar data from SQLite to Neon")
  .action(async (_opts, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    const config = await loadConfig({ cliOverrides: getCliOverrides(globalOpts) });
    await migrateGrammarToNeon({ config });
  });
```

**Step 2: Update migrate-to-neon.ts**

Update to accept config parameter.

**Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/cli.ts src/migrate-to-neon.ts
git commit -m "feat(migrate): use unified config system"
```

---

### Task 10: Update init command to offer config file choice

**Files:**
- Modify: `src/commands/init.ts`

**Step 1: Update init to save credentials**

The init command should offer to save credentials to either project config or user config. Update it to write to the appropriate location based on user choice.

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/init.ts
git commit -m "feat(init): save credentials to config files"
```

---

### Task 11: Update remaining commands (status, branch, destroy)

**Files:**
- Modify: `src/commands/status.ts`
- Modify: `src/commands/branch.ts`
- Modify: `src/commands/destroy.ts`
- Modify: `src/cli.ts` (update command wiring)

**Step 1: Update each command to use new config**

Each command that needs Neon credentials should load config and validate required keys.

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/*.ts src/cli.ts
git commit -m "feat(commands): migrate all commands to unified config"
```

---

### Task 12: Update embeddings providers to use config

**Files:**
- Modify: `src/embeddings/huggingface.ts`
- Modify: `src/embeddings/factory.ts` (if exists)
- Modify: `src/embeddings/index.ts`

**Step 1: Update HuggingFace provider**

Remove direct env access, accept token as constructor parameter.

**Step 2: Update factory/index**

Update createModelInstance to accept config and pass tokens to providers.

**Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/embeddings/*.ts
git commit -m "feat(embeddings): accept config instead of reading env directly"
```

---

### Task 13: Remove old config.ts shim

**Files:**
- Delete: `src/config.ts` (the shim)
- Modify: All files that import from `./config.js` to use `./config/index.js`

**Step 1: Find all imports of old config**

Run: `grep -r "from.*['\"]\.\/config\.js['\"]" src/`

**Step 2: Update each import**

Change `from "./config.js"` to `from "./config/index.js"`

**Step 3: Delete the shim**

```bash
rm src/config.ts
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove config.ts shim, complete migration"
```

---

### Task 14: Manual testing

**Step 1: Test with env vars only**

```bash
export HF_TOKEN=test-token
pnpm cli list-models
```
Expected: Models listed (doesn't need token, just verifies CLI works)

**Step 2: Test with .embedding4ldrc**

Create a test project config:
```bash
echo '{"hfToken": "from-project-config"}' > .embedding4ldrc
```

**Step 3: Test CLI override**

```bash
pnpm cli embed multilingual-e5-large --hf-token override-token
```
Expected: Should use the override token (will fail auth but confirms flag parsing)

**Step 4: Test error message**

```bash
unset HF_TOKEN
rm .embedding4ldrc
pnpm cli embed multilingual-e5-large
```
Expected: Friendly error box showing missing HF_TOKEN

**Step 5: Clean up and commit**

```bash
rm -f .embedding4ldrc
git add -A
git commit -m "test: verify unified config system works"
```

---

## Summary

14 tasks covering:
1. Dependencies (c12, zod)
2. Schema definition
3. Config source loader (c12)
4. Main config module with helpers
5. Backward compatibility shim
6. Global CLI options
7-9. Command updates (embed, benchmark, migrate)
10. Init command enhancement
11. Remaining commands
12. Embedding providers
13. Remove shim
14. Manual testing
