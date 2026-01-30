# Admin UI Design

**Date:** 2026-01-30
**Status:** Approved

## Overview

A SvelteKit admin UI for managing embedding benchmark test datasets - grammar points, queries, and ground truth mappings. Personal research dashboard with no authentication required.

## Key Decisions

| Aspect | Choice |
|--------|--------|
| Purpose | Personal research dashboard, no auth |
| Primary function | Edit test datasets (queries + ground truth + grammar points) |
| Data authority | SQLite is source of truth, Neon is replica |
| Schema change | Add `languages` + `levels` tables for multilingual support |
| DB layer | Drizzle ORM (SQLite + Neon support, migrations) |
| UI framework | SvelteKit 2 + Svelte 5 |
| Styling | Tailwind CSS v4 + daisyUI (synthwave/retro themes) |
| Project structure | Monorepo with `apps/admin/` subdirectory |
| Linting | Biome (mandatory, enforced via pre-commit) |
| Testing | Vitest + @testing-library/svelte + Playwright, 80% coverage |
| Pre-commit | Lefthook |

## Data Model

### Schema Changes

Current `grammar.db` has hardcoded JLPT levels. Adding tables for multilingual fluency levels:

```sql
languages (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,     -- "ja", "zh", "ko"
  name TEXT NOT NULL,            -- "Japanese", "Chinese", "Korean"
  created_at, updated_at
)

levels (
  id INTEGER PRIMARY KEY,
  language_id INTEGER REFERENCES languages,
  code TEXT NOT NULL,            -- "N5", "HSK1", "TOPIK1"
  name TEXT NOT NULL,            -- "JLPT N5", "HSK Level 1"
  sort_order INTEGER,            -- for display ordering
  UNIQUE(language_id, code)
)
```

Modified `grammar_points` table:
- Change: `level TEXT` ("N1"-"N5")
- To: `level_id INTEGER REFERENCES levels`

Migration path:
1. Create new tables
2. Seed Japanese + JLPT N1-N5
3. Migrate existing grammar_points.level → level_id
4. Drop old level column

### Databases

| Database | Tables | Access |
|----------|--------|--------|
| `grammar.db` | `languages`, `levels`, `grammar_points`, `examples` | Read/write |
| `benchmark.db` | `benchmark_queries`, `benchmark_expected` | Read/write |

## Pages

```
/                       → Dashboard (stats overview)
/grammar                → Grammar list (search, filter, table)
/grammar/new            → Create grammar point
/grammar/[id]           → Edit grammar point + examples
/queries                → Query list
/queries/new            → Create query
/queries/[id]           → Edit query + ground truth picker
/settings/languages     → Manage languages & levels
```

## Project Structure

```
embedding4ld/
├── src/                    # Existing CLI
├── data/
│   ├── grammar.db          # Shared - authoritative grammar data
│   └── benchmark.db        # Shared - queries & ground truth
├── apps/
│   └── admin/
│       ├── package.json
│       ├── svelte.config.js
│       ├── tailwind.config.js
│       ├── drizzle.config.ts
│       ├── biome.json
│       ├── vitest.config.ts
│       ├── playwright.config.ts
│       ├── src/
│       │   ├── lib/
│       │   │   ├── server/db/
│       │   │   │   ├── schema/
│       │   │   │   │   ├── grammar.ts
│       │   │   │   │   └── benchmark.ts
│       │   │   │   ├── clients/
│       │   │   │   │   ├── grammar.ts
│       │   │   │   │   ├── benchmark.ts
│       │   │   │   │   └── neon.ts
│       │   │   │   └── migrations/
│       │   │   └── components/
│       │   │       ├── grammar/
│       │   │       │   ├── GrammarTable.svelte
│       │   │       │   ├── GrammarForm.svelte
│       │   │       │   ├── GrammarPreview.svelte
│       │   │       │   ├── ExampleList.svelte
│       │   │       │   └── GrammarPicker.svelte
│       │   │       ├── queries/
│       │   │       │   ├── QueryTable.svelte
│       │   │       │   ├── QueryForm.svelte
│       │   │       │   └── GroundTruthEditor.svelte
│       │   │       ├── settings/
│       │   │       │   └── LanguageLevelManager.svelte
│       │   │       └── ThemeSwitcher.svelte
│       │   └── routes/
│       │       ├── +layout.svelte
│       │       ├── +page.svelte
│       │       ├── grammar/
│       │       ├── queries/
│       │       └── settings/languages/
│       ├── e2e/
│       └── drizzle/
│           └── migrations/
├── lefthook.yml
└── package.json            # Root - workspace config
```

## Drizzle Schema

### `schema/grammar.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const languages = sqliteTable('languages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const levels = sqliteTable('levels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  languageId: integer('language_id').references(() => languages.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order'),
});

export const grammarPoints = sqliteTable('grammar_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(),
  japanese: text('japanese').notNull(),
  romaji: text('romaji'),
  meaning: text('meaning').notNull(),
  levelId: integer('level_id').references(() => levels.id),
  category: text('category'),
  formation: text('formation'),
  detailUrl: text('detail_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const examples = sqliteTable('examples', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  grammarPointId: integer('grammar_point_id').references(() => grammarPoints.id),
  japanese: text('japanese').notNull(),
  english: text('english'),
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
```

### `schema/benchmark.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const benchmarkQueries = sqliteTable('benchmark_queries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  queryText: text('query_text').notNull(),
  queryLanguage: text('query_language'),
  targetLanguage: text('target_language'),
  difficulty: text('difficulty'),
  isRanked: integer('is_ranked', { mode: 'boolean' }),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const benchmarkExpected = sqliteTable('benchmark_expected', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  queryId: integer('query_id').references(() => benchmarkQueries.id),
  grammarPointId: integer('grammar_point_id').notNull(),
  relevanceScore: integer('relevance_score'),
});
```

## SvelteKit Routes

### Data Loading Pattern

```typescript
// src/routes/grammar/+page.server.ts
import { grammarDb } from '$lib/server/db';
import { grammarPoints, levels, languages } from '$lib/server/db/schema/grammar';
import { eq } from 'drizzle-orm';

export async function load({ url }) {
  const levelFilter = url.searchParams.get('level');
  const search = url.searchParams.get('q');

  const points = await grammarDb
    .select()
    .from(grammarPoints)
    .leftJoin(levels, eq(grammarPoints.levelId, levels.id))
    .leftJoin(languages, eq(levels.languageId, languages.id))
    .orderBy(grammarPoints.japanese);

  return { points };
}
```

### Form Actions Pattern

```typescript
// src/routes/grammar/[id]/+page.server.ts
import { redirect } from '@sveltejs/kit';
import { grammarDb } from '$lib/server/db';
import { grammarPoints } from '$lib/server/db/schema/grammar';
import { eq } from 'drizzle-orm';

export const actions = {
  update: async ({ params, request }) => {
    const data = await request.formData();
    await grammarDb
      .update(grammarPoints)
      .set({
        japanese: data.get('japanese') as string,
        romaji: data.get('romaji') as string,
        meaning: data.get('meaning') as string,
        // ...
      })
      .where(eq(grammarPoints.id, Number(params.id)));
    return { success: true };
  },
  delete: async ({ params }) => {
    await grammarDb
      .delete(grammarPoints)
      .where(eq(grammarPoints.id, Number(params.id)));
    throw redirect(303, '/grammar');
  },
};
```

## UI Components

Using daisyUI with synthwave/retro themes.

### Tailwind Config

```javascript
// tailwind.config.js
export default {
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['synthwave', 'retro', 'cyberpunk', 'light'],
  },
};
```

### Grammar Picker Modal

For selecting grammar points when editing ground truth:

```
┌─────────────────────────────────────────────────┐
│  Select Grammar Point                        ✕  │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │ Search by Japanese, English, romaji     │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Filter: [Japanese ▾] [N3 ▾] [All categories ▾] │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ ▸ ために (tame ni) - in order to        │    │
│  │ ▸ ように (you ni) - so that             │    │
│  │ ▸ には (ni wa) - in order to [formal]   │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ─── Selected ───────────────────────────────   │
│  │ ために (tame ni)                             │
│  │ Relevance: ○ 1  ● 2  ○ 3                    │
│  └──────────────────────────────────────────    │
│                                                 │
│                          [Cancel]  [Add to GT]  │
└─────────────────────────────────────────────────┘
```

## Testing

### Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Vitest | Schema validation, utility functions |
| Component | Vitest + @testing-library/svelte | Component rendering, interactions |
| Integration | Vitest | Server load functions, form actions |
| E2E | Playwright | Full user flows |

### Coverage Thresholds

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### Test Structure

```
apps/admin/
├── src/
│   ├── lib/
│   │   ├── server/db/
│   │   │   └── __tests__/
│   │   │       ├── grammar.test.ts
│   │   │       └── benchmark.test.ts
│   │   └── components/
│   │       └── __tests__/
│   │           ├── GrammarForm.test.ts
│   │           └── GrammarPicker.test.ts
│   └── routes/
│       └── grammar/
│           └── __tests__/
│               └── page.server.test.ts
└── e2e/
    ├── grammar.spec.ts
    └── queries.spec.ts
```

## Pre-commit Hooks

Using Lefthook:

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint-cli:
      glob: "src/**/*.ts"
      run: pnpm biome check {staged_files}
    lint-admin:
      glob: "apps/admin/src/**/*.{ts,svelte}"
      run: pnpm --filter admin lint {staged_files}
    test-admin:
      glob: "apps/admin/src/**/*.{ts,svelte}"
      run: pnpm --filter admin test:affected
```

## Scripts

### Root `package.json`

```json
{
  "name": "embedding4ld",
  "workspaces": ["apps/*"],
  "scripts": {
    "cli": "tsx src/cli.ts",
    "admin": "pnpm --filter admin dev",
    "admin:build": "pnpm --filter admin build"
  }
}
```

### `apps/admin/package.json`

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "biome check src/",
    "lint:fix": "biome check --write src/",
    "format": "biome format --write src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:affected": "vitest related --run",
    "test:e2e": "playwright test"
  }
}
```

## Database Path Resolution

The admin app reads DBs relative to project root:

```typescript
const GRAMMAR_DB = process.env.GRAMMAR_DB_PATH
  ?? resolve(__dirname, '../../data/grammar.db');
const BENCHMARK_DB = process.env.BENCHMARK_DB_PATH
  ?? resolve(__dirname, '../../data/benchmark.db');
```

## Next Steps

1. Set up monorepo workspace structure
2. Scaffold SvelteKit app with Drizzle
3. Run schema migrations (add languages/levels)
4. Build core CRUD pages
5. Add ground truth picker
6. Set up testing infrastructure
7. Configure pre-commit hooks
