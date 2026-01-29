# Neon Branching Strategy for Embedding Benchmarks

## Overview

Neon branches isolate embedding experiments without data duplication. Each branch is a copy-on-write fork — reads from parent until modified.

## Storage Split

| SQLite (local) | Neon (branched) |
|----------------|-----------------|
| benchmark_queries | grammar_points |
| benchmark_expected | examples |
| benchmark_runs | grammar_embeddings |
| benchmark_metrics | |
| embedding_models | |

Grammar data and vectors live in Neon. Benchmark harness stays local.

## Branch Hierarchy

```
main (canonical grammar data, no embeddings)
├── embed/multilingual-e5-large
│   ├── ablation/name-only
│   ├── ablation/examples-only
│   └── dims/512
├── embed/text-embedding-3-large
│   ├── dims/3072
│   ├── dims/1536
│   └── prefix/custom-task
├── embed/LaBSE
├── inventory/n5-only
│   └── embed/multilingual-e5-large
└── lang/japanese+spanish
    └── embed/multilingual-e5-large
```

## Branch Naming Convention

```
<category>/<variant>

Categories:
  embed/     - model-specific embeddings
  ablation/  - source type experiments
  dims/      - dimension reduction tests
  prefix/    - query prefix strategies
  inventory/ - grammar subset tests
  lang/      - language combination tests
  augment/   - synthetic data experiments
```

## Workflows

### Embed a new model

```bash
neon branch create --name embed/multilingual-e5-large --parent main
embedding4ld embed multilingual-e5-large --branch embed/multilingual-e5-large
```

### Run ablation study

```bash
# Fork from existing embeddings
neon branch create --name ablation/name-only --parent embed/multilingual-e5-large

# Delete unwanted source types
psql $BRANCH_URL -c "DELETE FROM grammar_embeddings WHERE source_type != 'name_meaning'"

# Benchmark
embedding4ld benchmark multilingual-e5-large --branch ablation/name-only
```

### Test dimension reduction (OpenAI)

```bash
neon branch create --name dims/1536 --parent main
embedding4ld embed text-embedding-3-large --branch dims/1536 --dimensions 1536
```

### Compare model versions

```bash
# Keep old embeddings
neon branch rename embed/text-embedding-3-large embed/text-embedding-3-large-v1

# Create fresh branch for new version
neon branch create --name embed/text-embedding-3-large-v2 --parent main
embedding4ld embed text-embedding-3-large --branch embed/text-embedding-3-large-v2

# Compare
embedding4ld compare --branches embed/text-embedding-3-large-v1,embed/text-embedding-3-large-v2
```

### Test grammar inventory slice

```bash
neon branch create --name inventory/n5-only --parent main
psql $BRANCH_URL -c "DELETE FROM grammar_points WHERE level != 'N5'"
psql $BRANCH_URL -c "DELETE FROM examples WHERE grammar_point_id NOT IN (SELECT id FROM grammar_points)"

neon branch create --name inventory/n5-only/embed/e5 --parent inventory/n5-only
embedding4ld embed multilingual-e5-large --branch inventory/n5-only/embed/e5
```

## CLI Branch Parameter

All commands accept `--branch`:

```bash
embedding4ld embed <model> --branch <branch-name>
embedding4ld benchmark <model> --branch <branch-name>
embedding4ld compare --branches <branch1>,<branch2>,...
```

Defaults to `embed/<model>` if not specified.

## Environment

```bash
NEON_PROJECT_ID=        # Neon project
NEON_API_KEY=           # For branch management
DATABASE_URL=           # Main branch connection string (template)
```

Branch URLs derived from main: `postgresql://...@<branch-id>.neon.tech/...`

## Cleanup

```bash
# List branches
neon branch list

# Delete experiment branch
neon branch delete ablation/name-only

# Reset branch to parent state
neon branch reset embed/multilingual-e5-large --parent main
```

## Vector Search with Grammar Data

Single query returns full construct:

```sql
SELECT
  gp.id,
  gp.japanese,
  gp.meaning,
  gp.level,
  ge.source_type,
  1 - (ge.embedding <=> $1) AS similarity
FROM grammar_embeddings ge
JOIN grammar_points gp ON gp.id = ge.grammar_point_id
WHERE ge.model_id = $2
ORDER BY ge.embedding <=> $1
LIMIT 10;
```

No round-trip to SQLite. JOIN works alongside pgvector operators.
