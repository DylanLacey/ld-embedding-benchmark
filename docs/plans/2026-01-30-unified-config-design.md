# Unified Configuration System Design

## Goal

Enable all credentials to be provided via CLI flags, environment variables, or config files, with a clear priority chain and helpful error messages when credentials are missing.

## Config Sources & Priority

From highest to lowest priority (later sources fill gaps, earlier sources win conflicts):

1. **CLI flags** — `--hf-token <token>` — immediate, explicit override
2. **Environment variables** — `HF_TOKEN` — standard for CI/CD and containers
3. **Project config** — `.embedding4ldrc` in project root — per-project settings
4. **User config** — `~/.embedding_test/config.json` — personal defaults
5. **Defaults** — hardcoded fallbacks (none for credentials)

## Architecture

```
src/
├── config/
│   ├── index.ts        # Main export: loadConfig(), getConfig()
│   ├── schema.ts       # Config shape + validation (Zod)
│   └── sources.ts      # c12 setup + merge logic
├── paths.ts            # Keep for CONFIG_DIR constant only
```

### Config Values (6 credentials)

| Key | Env Var | CLI Flag | Purpose |
|-----|---------|----------|---------|
| neonApiKey | NEON_API_KEY | --neon-api-key | Neon Management API access |
| neonProjectId | NEON_PROJECT_ID | --neon-project-id | Links to specific Neon project |
| databaseUrl | DATABASE_URL | --database-url | Direct DB connection (overrides project-based URL) |
| hfToken | HF_TOKEN | --hf-token | HuggingFace Inference API |
| openaiApiKey | OPENAI_API_KEY | --openai-api-key | OpenAI embeddings |
| cohereApiKey | COHERE_API_KEY | --cohere-api-key | Cohere embeddings |

## Integration with Commands

Each command:
1. **Declares required config keys** — Commands specify which credentials they need
2. **Inherits global options** — Commander's `createOption()` with env var fallback
3. **Validates at runtime** — Fail fast with clear message if required credentials missing

```typescript
// Example pattern in src/cli.ts:
import { loadConfig } from './config/index.js';

program
  .command('embed')
  .option('--hf-token <token>', 'HuggingFace API token', process.env.HF_TOKEN)
  .action(async (options) => {
    const config = await loadConfig({ cliOverrides: options });
    // Model-specific validation happens in embedding factory
  });
```

**Key principle:** Config module merges and validates shape. Commands validate completeness for their specific needs.

## Error Handling

Validation errors display helpful, boxed messages:

```
┌─────────────────────────────────────────────────┐
│  Missing credentials for 'embed' command        │
├─────────────────────────────────────────────────┤
│                                                 │
│  Model 'multilingual-e5-large' needs:           │
│    • HF_TOKEN (or --hf-token)                   │
│                                                 │
│  Provide via:                                   │
│    1. Environment variable                      │
│    2. .embedding4ldrc in project root           │
│    3. ~/.embedding_test/config.json             │
│    4. CLI flag: --hf-token <token>              │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Migration Path

**Phase 1:** Add new config module alongside existing `src/config.ts`

**Phase 2:** Update commands one-by-one to use new loader

**Phase 3:** Remove old `src/config.ts` once all commands migrated

**Backward compatibility:** New system reads same env vars, so existing `.env` files continue working.

## Tech Stack

- **c12** — UnJS smart configuration loader (handles file discovery, merging)
- **Zod** — Schema validation with TypeScript inference
- **Commander.js** — Existing CLI framework (wire global options)
