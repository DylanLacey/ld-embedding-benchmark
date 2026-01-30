# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

embedding4ld is an embedding benchmarking framework for evaluating multilingual language models on Japanese grammar point retrieval tasks (JLPT N1-N5). It uses Neon PostgreSQL with pgvector for distributed experiments via copy-on-write branching.

## Commands

```bash
# Development
pnpm cli                    # Run CLI via tsx
pnpm build                  # Compile TypeScript to dist/

# Data pipeline
pnpm scrape                 # Scrape grammar data from web (Playwright)
pnpm migrate:neon           # Migrate grammar.db → Neon PostgreSQL
pnpm seed:queries           # Populate benchmark test queries

# Tests
pnpm test:e2e               # Run end-to-end tests

# CLI (after build, or via `pnpm cli`)
embedding4ld init -k <api-key> -o <org-id>     # Create Neon project
embedding4ld migrate                           # Import grammar data
embedding4ld branch create embed/<model>       # Create experiment branch
embedding4ld embed <model> --branch <branch>   # Generate embeddings
embedding4ld benchmark <model> --branch <branch>  # Run retrieval evaluation
embedding4ld list-models                       # Show available models
embedding4ld list-runs                         # Show benchmark history
embedding4ld status                            # Show config & branches
embedding4ld destroy                           # Delete Neon project
```

## Architecture

```
┌─────────────────┐     ┌────────────────────────────────────┐
│  Local SQLite   │     │     Neon PostgreSQL (pgvector)     │
├─────────────────┤     ├────────────────────────────────────┤
│ data/grammar.db │────▶│ main/                              │
│ (scraped data)  │     │ ├── grammar_points, examples       │
├─────────────────┤     │ └── (no embeddings)                │
│ data/benchmark.db│     │                                    │
│ (queries, runs, │     │ embed/<model>/                     │
│  metrics)       │     │ └── grammar_embeddings (vectors)   │
└─────────────────┘     └────────────────────────────────────┘
```

**Branching strategy**: Main branch holds canonical grammar data without embeddings. Each `embed/<model>` branch forks from main and stores that model's vectors. Ablation experiments (`ablation/`, `dims/`, `inventory/`) fork from embed branches. See `docs/neon-branching-strategy.md` for workflows.

**Data flow**: Scraper → SQLite → Neon main → branch → embed → benchmark → metrics stored locally

### Key modules

| Module | Purpose |
|--------|---------|
| `src/config/` | Unified config: CLI flags → env vars → `.embedding4ldrc` → `~/.embedding_test/config.json` |
| `src/commands/` | CLI command handlers (init, destroy, status, branch) |
| `src/embeddings/` | Provider adapters (HuggingFace, OpenAI, Cohere) with factory pattern |
| `src/embed-grammar.ts` | Vectorisation orchestration (batches of 10) |
| `src/benchmark-runner.ts` | Retrieval evaluation against ground truth |
| `src/metrics.ts` | IR metrics: Recall@K, MRR, Hit@K, NDCG |
| `src/neon-api.ts` | Neon Management API wrapper for branching |

### Embedding models

HuggingFace (HF_TOKEN): `multilingual-e5-large`, `LaBSE`, `paraphrase-multilingual-MiniLM-L12-v2`, `BGE-M3`
OpenAI (OPENAI_API_KEY): `text-embedding-3-small`, `text-embedding-3-large`
Cohere (COHERE_API_KEY): `embed-multilingual-v3.0`

Asymmetric models (e5, BGE, Cohere) use different query/document prefixes—handled in `src/embeddings/huggingface.ts`.

## Configuration

Priority order (highest wins): CLI flags → environment variables → config files

| Config Key | Env Var | CLI Flag |
|------------|---------|----------|
| `neonApiKey` | `NEON_API_KEY` | `--neon-api-key` |
| `neonOrgId` | `NEON_ORG_ID` | `--neon-org-id` |
| `neonProjectId` | `NEON_PROJECT_ID` | `--neon-project-id` |
| `databaseUrl` | `DATABASE_URL` | `--database-url` |
| `hfToken` | `HF_TOKEN` | `--hf-token` |
| `openaiApiKey` | `OPENAI_API_KEY` | `--openai-api-key` |
| `cohereApiKey` | `COHERE_API_KEY` | `--cohere-api-key` |

Config files: `.embedding4ldrc` (project) or `~/.embedding_test/config.json` (user), loaded via c12.

## Code Style Notes

- Poetic/whimsical comments (_why-adjacent): "The grand conductor", "The proving grounds"
- Charmbracelet aesthetic: ASCII boxes, ora spinners, picocolors
- Zod for runtime validation throughout

## Admin UI (`apps/admin/`)

SvelteKit app for managing test datasets. See `docs/plans/2026-01-30-admin-ui-design.md`.

### Commands

```bash
pnpm admin              # Dev server
pnpm admin:build        # Production build
pnpm --filter admin test           # Unit + integration tests
pnpm --filter admin test:coverage  # With coverage report
pnpm --filter admin lint           # Biome check
```

### Mandatory Checks

**Before committing (enforced by Lefthook):**
- `biome check` must pass (no lint errors)
- All tests must pass

**Before merging:**
- All tests pass (`pnpm --filter admin test`)
- Coverage thresholds met (80% statements/branches/functions/lines)

### Tech Stack

- SvelteKit 2 + Svelte 5
- Tailwind CSS v4 + daisyUI (synthwave theme)
- Drizzle ORM (SQLite)
- Vitest + Playwright
- Biome (lint + format)
