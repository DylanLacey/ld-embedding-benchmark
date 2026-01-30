# Admin UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a SvelteKit admin UI for managing grammar points, benchmark queries, and ground truth mappings.

**Architecture:** Monorepo with `apps/admin/` containing SvelteKit app. Drizzle ORM for type-safe SQLite access. daisyUI for synthwave-themed components. TDD with Vitest + Playwright.

**Tech Stack:** SvelteKit 2, Svelte 5, Tailwind v4, daisyUI, Drizzle ORM, better-sqlite3, Vitest, Playwright, Biome, Lefthook

---

## Phase 1: Project Scaffolding

### Task 1.1: Set up pnpm workspaces

**Files:**
- Modify: `package.json`

**Step 1: Update root package.json for workspaces**

```json
{
  "name": "embedding4ld",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "cli": "tsx src/cli.ts",
    "build": "tsc",
    "scrape": "tsx src/scrape.ts",
    "migrate:neon": "tsx src/migrate-to-neon.ts",
    "seed:queries": "tsx src/seed-benchmark-queries.ts",
    "test:e2e": "tsx src/test-e2e.ts",
    "admin": "pnpm --filter admin dev",
    "admin:build": "pnpm --filter admin build",
    "admin:test": "pnpm --filter admin test",
    "admin:lint": "pnpm --filter admin lint"
  },
  "dependencies": {
    "@huggingface/inference": "^4.13.10",
    "@neondatabase/serverless": "^1.0.2",
    "better-sqlite3": "^12.6.2",
    "c12": "^3.3.3",
    "cheerio": "^1.2.0",
    "cli-table3": "^0.6.5",
    "commander": "^14.0.2",
    "dotenv": "^17.2.3",
    "execa": "^9.6.1",
    "listr2": "^10.1.0",
    "ora": "^9.1.0",
    "picocolors": "^1.1.1",
    "playwright": "^1.58.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^25.1.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Create apps directory**

Run: `mkdir -p apps`

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: configure pnpm workspaces"
```

---

### Task 1.2: Scaffold SvelteKit app

**Files:**
- Create: `apps/admin/` (entire directory)

**Step 1: Create SvelteKit app**

Run:
```bash
cd apps
pnpm create svelte@latest admin
```

Select:
- Skeleton project
- TypeScript
- ESLint: No (using Biome)
- Prettier: No (using Biome)
- Playwright: Yes
- Vitest: Yes

**Step 2: Install dependencies**

Run:
```bash
cd apps/admin
pnpm install
```

**Step 3: Verify it runs**

Run: `pnpm dev`
Expected: Dev server starts at http://localhost:5173

**Step 4: Stop dev server and commit**

```bash
git add apps/admin
git commit -m "feat(admin): scaffold SvelteKit app"
```

---

### Task 1.3: Add Tailwind CSS v4 + daisyUI

**Files:**
- Create: `apps/admin/tailwind.config.js`
- Create: `apps/admin/postcss.config.js`
- Modify: `apps/admin/src/app.css`
- Modify: `apps/admin/package.json`

**Step 1: Install Tailwind and daisyUI**

Run:
```bash
cd apps/admin
pnpm add -D tailwindcss postcss autoprefixer daisyui
npx tailwindcss init -p
```

**Step 2: Configure Tailwind**

Create `apps/admin/tailwind.config.js`:
```javascript
import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: ['synthwave', 'retro', 'cyberpunk', 'light'],
  },
};
```

**Step 3: Create app.css**

Create `apps/admin/src/app.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Import CSS in layout**

Create `apps/admin/src/routes/+layout.svelte`:
```svelte
<script>
  import '../app.css';
  let { children } = $props();
</script>

<div data-theme="synthwave" class="min-h-screen">
  {@render children()}
</div>
```

**Step 5: Test Tailwind works**

Update `apps/admin/src/routes/+page.svelte`:
```svelte
<main class="container mx-auto p-8">
  <h1 class="text-4xl font-bold text-primary">Admin UI</h1>
  <button class="btn btn-primary mt-4">Test Button</button>
</main>
```

**Step 6: Run and verify**

Run: `pnpm dev`
Expected: Synthwave-themed page with styled button

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): add Tailwind CSS v4 + daisyUI"
```

---

### Task 1.4: Add Biome for linting

**Files:**
- Create: `apps/admin/biome.json`
- Modify: `apps/admin/package.json`

**Step 1: Install Biome**

Run:
```bash
cd apps/admin
pnpm add -D @biomejs/biome
```

**Step 2: Create Biome config**

Create `apps/admin/biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "files": {
    "include": ["src/**/*.ts", "src/**/*.svelte"]
  }
}
```

**Step 3: Add scripts to package.json**

Add to `apps/admin/package.json` scripts:
```json
{
  "scripts": {
    "lint": "biome check src/",
    "lint:fix": "biome check --write src/",
    "format": "biome format --write src/"
  }
}
```

**Step 4: Run lint**

Run: `pnpm lint`
Expected: No errors (or fix any that appear)

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): add Biome linting"
```

---

## Phase 2: Database Layer

### Task 2.1: Install Drizzle ORM

**Files:**
- Modify: `apps/admin/package.json`
- Create: `apps/admin/drizzle.config.ts`

**Step 1: Install Drizzle packages**

Run:
```bash
cd apps/admin
pnpm add drizzle-orm better-sqlite3
pnpm add -D drizzle-kit @types/better-sqlite3
```

**Step 2: Create Drizzle config**

Create `apps/admin/drizzle.config.ts`:
```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/db/schema/*.ts',
  out: './drizzle',
  dialect: 'sqlite',
});
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): add Drizzle ORM"
```

---

### Task 2.2: Create grammar schema

**Files:**
- Create: `apps/admin/src/lib/server/db/schema/grammar.ts`

**Step 1: Create schema file**

Create `apps/admin/src/lib/server/db/schema/grammar.ts`:
```typescript
import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

export const languages = sqliteTable('languages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const levels = sqliteTable(
  'levels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    languageId: integer('language_id').references(() => languages.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order'),
  },
  (table) => [unique().on(table.languageId, table.code)]
);

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
  grammarPointId: integer('grammar_point_id').references(() => grammarPoints.id, {
    onDelete: 'cascade',
  }),
  japanese: text('japanese').notNull(),
  english: text('english'),
  source: text('source'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(admin): add grammar Drizzle schema"
```

---

### Task 2.3: Create benchmark schema

**Files:**
- Create: `apps/admin/src/lib/server/db/schema/benchmark.ts`

**Step 1: Create schema file**

Create `apps/admin/src/lib/server/db/schema/benchmark.ts`:
```typescript
import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';

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

export const benchmarkExpected = sqliteTable(
  'benchmark_expected',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    queryId: integer('query_id').references(() => benchmarkQueries.id, {
      onDelete: 'cascade',
    }),
    grammarPointId: integer('grammar_point_id').notNull(),
    relevanceScore: integer('relevance_score'),
  },
  (table) => [unique().on(table.queryId, table.grammarPointId)]
);
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(admin): add benchmark Drizzle schema"
```

---

### Task 2.4: Create database clients

**Files:**
- Create: `apps/admin/src/lib/server/db/index.ts`

**Step 1: Create database client**

Create `apps/admin/src/lib/server/db/index.ts`:
```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { resolve } from 'node:path';
import * as grammarSchema from './schema/grammar';
import * as benchmarkSchema from './schema/benchmark';

const DATA_DIR = resolve(import.meta.dirname, '../../../../../data');

const grammarSqlite = new Database(
  process.env.GRAMMAR_DB_PATH ?? resolve(DATA_DIR, 'grammar.db')
);
const benchmarkSqlite = new Database(
  process.env.BENCHMARK_DB_PATH ?? resolve(DATA_DIR, 'benchmark.db')
);

export const grammarDb = drizzle(grammarSqlite, { schema: grammarSchema });
export const benchmarkDb = drizzle(benchmarkSqlite, { schema: benchmarkSchema });

export * from './schema/grammar';
export * from './schema/benchmark';
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(admin): add database clients"
```

---

### Task 2.5: Write database client tests

**Files:**
- Create: `apps/admin/src/lib/server/db/__tests__/clients.test.ts`

**Step 1: Create test file**

Create `apps/admin/src/lib/server/db/__tests__/clients.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { grammarDb, benchmarkDb } from '../index';
import { sql } from 'drizzle-orm';

describe('Database clients', () => {
  it('connects to grammar.db', () => {
    const result = grammarDb.get(sql`SELECT 1 as value`);
    expect(result).toEqual({ value: 1 });
  });

  it('connects to benchmark.db', () => {
    const result = benchmarkDb.get(sql`SELECT 1 as value`);
    expect(result).toEqual({ value: 1 });
  });
});
```

**Step 2: Run tests**

Run: `pnpm test`
Expected: 2 tests pass

**Step 3: Commit**

```bash
git add -A
git commit -m "test(admin): add database client tests"
```

---

## Phase 3: Schema Migration

### Task 3.1: Create migration for languages/levels tables

**Files:**
- Create: `apps/admin/drizzle/0001_add_languages_levels.sql`

**Step 1: Generate migration**

Run:
```bash
cd apps/admin
pnpm drizzle-kit generate
```

**Step 2: Review generated SQL**

Check `drizzle/` folder for generated migration.
If the migration looks correct, proceed.

**Step 3: Create seed script**

Create `apps/admin/scripts/seed-languages.ts`:
```typescript
import Database from 'better-sqlite3';
import { resolve } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname, '../../../data');
const db = new Database(resolve(DATA_DIR, 'grammar.db'));

// Create tables if not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS languages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_id INTEGER REFERENCES languages(id),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER,
    UNIQUE(language_id, code)
  );
`);

// Seed Japanese + JLPT levels
const now = Date.now();

const insertLang = db.prepare(`
  INSERT OR IGNORE INTO languages (code, name, created_at, updated_at)
  VALUES (?, ?, ?, ?)
`);

const insertLevel = db.prepare(`
  INSERT OR IGNORE INTO levels (language_id, code, name, sort_order)
  VALUES (?, ?, ?, ?)
`);

insertLang.run('ja', 'Japanese', now, now);

const jaId = db.prepare(`SELECT id FROM languages WHERE code = ?`).get('ja') as { id: number };

const jlptLevels = [
  { code: 'N5', name: 'JLPT N5', order: 5 },
  { code: 'N4', name: 'JLPT N4', order: 4 },
  { code: 'N3', name: 'JLPT N3', order: 3 },
  { code: 'N2', name: 'JLPT N2', order: 2 },
  { code: 'N1', name: 'JLPT N1', order: 1 },
];

for (const level of jlptLevels) {
  insertLevel.run(jaId.id, level.code, level.name, level.order);
}

console.log('Seeded Japanese + JLPT levels');
```

**Step 4: Run seed script**

Run: `pnpm tsx scripts/seed-languages.ts`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): add languages/levels migration and seed"
```

---

## Phase 4: Core Layout and Navigation

### Task 4.1: Create app layout with navigation

**Files:**
- Modify: `apps/admin/src/routes/+layout.svelte`
- Create: `apps/admin/src/lib/components/Nav.svelte`

**Step 1: Create Nav component**

Create `apps/admin/src/lib/components/Nav.svelte`:
```svelte
<script lang="ts">
  import { page } from '$app/stores';

  const navItems = [
    { href: '/', label: 'Dashboard' },
    { href: '/grammar', label: 'Grammar' },
    { href: '/queries', label: 'Queries' },
    { href: '/settings/languages', label: 'Languages' },
  ];
</script>

<nav class="navbar bg-base-200">
  <div class="flex-1">
    <a href="/" class="btn btn-ghost text-xl">embedding4ld</a>
  </div>
  <div class="flex-none">
    <ul class="menu menu-horizontal px-1">
      {#each navItems as item}
        <li>
          <a
            href={item.href}
            class:active={$page.url.pathname === item.href}
          >
            {item.label}
          </a>
        </li>
      {/each}
    </ul>
  </div>
</nav>
```

**Step 2: Update layout**

Update `apps/admin/src/routes/+layout.svelte`:
```svelte
<script>
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';
  let { children } = $props();
</script>

<div data-theme="synthwave" class="min-h-screen flex flex-col">
  <Nav />
  <main class="flex-1 container mx-auto p-6">
    {@render children()}
  </main>
</div>
```

**Step 3: Run and verify**

Run: `pnpm dev`
Expected: Navigation bar visible on all pages

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): add navigation layout"
```

---

### Task 4.2: Create dashboard page

**Files:**
- Modify: `apps/admin/src/routes/+page.svelte`
- Create: `apps/admin/src/routes/+page.server.ts`

**Step 1: Create server load function**

Create `apps/admin/src/routes/+page.server.ts`:
```typescript
import { grammarDb, benchmarkDb, grammarPoints, benchmarkQueries, levels } from '$lib/server/db';
import { count } from 'drizzle-orm';

export async function load() {
  const [grammarCount] = grammarDb.select({ count: count() }).from(grammarPoints).all();
  const [queryCount] = benchmarkDb.select({ count: count() }).from(benchmarkQueries).all();
  const levelCounts = grammarDb
    .select({ levelId: grammarPoints.levelId, count: count() })
    .from(grammarPoints)
    .groupBy(grammarPoints.levelId)
    .all();

  return {
    stats: {
      grammarPoints: grammarCount?.count ?? 0,
      queries: queryCount?.count ?? 0,
      byLevel: levelCounts,
    },
  };
}
```

**Step 2: Create dashboard page**

Update `apps/admin/src/routes/+page.svelte`:
```svelte
<script lang="ts">
  let { data } = $props();
</script>

<h1 class="text-3xl font-bold mb-8">Dashboard</h1>

<div class="stats shadow">
  <div class="stat">
    <div class="stat-title">Grammar Points</div>
    <div class="stat-value text-primary">{data.stats.grammarPoints}</div>
  </div>

  <div class="stat">
    <div class="stat-title">Benchmark Queries</div>
    <div class="stat-value text-secondary">{data.stats.queries}</div>
  </div>
</div>

{#if data.stats.byLevel.length > 0}
  <h2 class="text-2xl font-bold mt-8 mb-4">By Level</h2>
  <div class="overflow-x-auto">
    <table class="table">
      <thead>
        <tr>
          <th>Level</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        {#each data.stats.byLevel as row}
          <tr>
            <td>{row.levelId ?? 'Unassigned'}</td>
            <td>{row.count}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
```

**Step 3: Run and verify**

Run: `pnpm dev`
Expected: Dashboard shows stats

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): add dashboard page"
```

---

## Phase 5: Grammar CRUD

### Task 5.1: Create grammar list page

**Files:**
- Create: `apps/admin/src/routes/grammar/+page.svelte`
- Create: `apps/admin/src/routes/grammar/+page.server.ts`

**Step 1: Create server load function**

Create `apps/admin/src/routes/grammar/+page.server.ts`:
```typescript
import { grammarDb, grammarPoints, levels, languages, examples } from '$lib/server/db';
import { eq, like, or, count } from 'drizzle-orm';

export async function load({ url }) {
  const search = url.searchParams.get('q') ?? '';
  const levelFilter = url.searchParams.get('level');

  let query = grammarDb
    .select({
      id: grammarPoints.id,
      slug: grammarPoints.slug,
      japanese: grammarPoints.japanese,
      romaji: grammarPoints.romaji,
      meaning: grammarPoints.meaning,
      category: grammarPoints.category,
      levelCode: levels.code,
      languageCode: languages.code,
    })
    .from(grammarPoints)
    .leftJoin(levels, eq(grammarPoints.levelId, levels.id))
    .leftJoin(languages, eq(levels.languageId, languages.id))
    .$dynamic();

  if (search) {
    query = query.where(
      or(
        like(grammarPoints.japanese, `%${search}%`),
        like(grammarPoints.romaji, `%${search}%`),
        like(grammarPoints.meaning, `%${search}%`)
      )
    );
  }

  const points = query.orderBy(grammarPoints.japanese).all();

  const allLevels = grammarDb
    .select({ id: levels.id, code: levels.code, name: levels.name })
    .from(levels)
    .all();

  return { points, levels: allLevels, search };
}
```

**Step 2: Create list page**

Create `apps/admin/src/routes/grammar/+page.svelte`:
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';

  let { data } = $props();
  let search = $state(data.search);

  function handleSearch(e: Event) {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (search) {
      url.searchParams.set('q', search);
    } else {
      url.searchParams.delete('q');
    }
    goto(url.toString());
  }
</script>

<div class="flex justify-between items-center mb-6">
  <h1 class="text-3xl font-bold">Grammar Points</h1>
  <a href="/grammar/new" class="btn btn-primary">Add New</a>
</div>

<form onsubmit={handleSearch} class="mb-6">
  <div class="join">
    <input
      type="text"
      bind:value={search}
      placeholder="Search..."
      class="input input-bordered join-item"
    />
    <button type="submit" class="btn join-item">Search</button>
  </div>
</form>

<div class="overflow-x-auto">
  <table class="table table-zebra">
    <thead>
      <tr>
        <th>Level</th>
        <th>Japanese</th>
        <th>Romaji</th>
        <th>Meaning</th>
        <th>Category</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.points as point}
        <tr class="hover">
          <td>
            {#if point.levelCode}
              <span class="badge badge-primary">{point.levelCode}</span>
            {/if}
          </td>
          <td class="font-bold">{point.japanese}</td>
          <td class="opacity-70">{point.romaji ?? ''}</td>
          <td>{point.meaning}</td>
          <td>{point.category ?? ''}</td>
          <td>
            <a href="/grammar/{point.id}" class="btn btn-xs btn-ghost">Edit</a>
          </td>
        </tr>
      {:else}
        <tr>
          <td colspan="6" class="text-center opacity-50">No grammar points found</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

**Step 3: Run and verify**

Run: `pnpm dev`
Navigate to: http://localhost:5173/grammar
Expected: Table of grammar points (may be empty)

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): add grammar list page"
```

---

### Task 5.2: Create grammar form component

**Files:**
- Create: `apps/admin/src/lib/components/grammar/GrammarForm.svelte`

**Step 1: Create form component**

Create `apps/admin/src/lib/components/grammar/GrammarForm.svelte`:
```svelte
<script lang="ts">
  import type { levels } from '$lib/server/db';

  type Level = { id: number; code: string; name: string };
  type GrammarPoint = {
    id?: number;
    slug?: string;
    japanese?: string;
    romaji?: string;
    meaning?: string;
    levelId?: number | null;
    category?: string | null;
    formation?: string | null;
  };

  interface Props {
    point?: GrammarPoint;
    levels: Level[];
    action?: string;
  }

  let { point = {}, levels, action = '?/save' }: Props = $props();
</script>

<form method="POST" {action} class="space-y-4 max-w-2xl">
  <div class="form-control">
    <label class="label" for="slug">
      <span class="label-text">Slug</span>
    </label>
    <input
      type="text"
      id="slug"
      name="slug"
      value={point.slug ?? ''}
      required
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="japanese">
      <span class="label-text">Japanese</span>
    </label>
    <input
      type="text"
      id="japanese"
      name="japanese"
      value={point.japanese ?? ''}
      required
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="romaji">
      <span class="label-text">Romaji</span>
    </label>
    <input
      type="text"
      id="romaji"
      name="romaji"
      value={point.romaji ?? ''}
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="meaning">
      <span class="label-text">Meaning</span>
    </label>
    <input
      type="text"
      id="meaning"
      name="meaning"
      value={point.meaning ?? ''}
      required
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="levelId">
      <span class="label-text">Level</span>
    </label>
    <select id="levelId" name="levelId" class="select select-bordered">
      <option value="">-- Select Level --</option>
      {#each levels as level}
        <option value={level.id} selected={point.levelId === level.id}>
          {level.name}
        </option>
      {/each}
    </select>
  </div>

  <div class="form-control">
    <label class="label" for="category">
      <span class="label-text">Category</span>
    </label>
    <input
      type="text"
      id="category"
      name="category"
      value={point.category ?? ''}
      class="input input-bordered"
    />
  </div>

  <div class="form-control">
    <label class="label" for="formation">
      <span class="label-text">Formation</span>
    </label>
    <textarea
      id="formation"
      name="formation"
      class="textarea textarea-bordered"
      rows="3"
    >{point.formation ?? ''}</textarea>
  </div>

  <div class="flex gap-4">
    <button type="submit" class="btn btn-primary">Save</button>
    <a href="/grammar" class="btn btn-ghost">Cancel</a>
  </div>
</form>
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(admin): add GrammarForm component"
```

---

### Task 5.3: Create new grammar point page

**Files:**
- Create: `apps/admin/src/routes/grammar/new/+page.svelte`
- Create: `apps/admin/src/routes/grammar/new/+page.server.ts`

**Step 1: Create server file**

Create `apps/admin/src/routes/grammar/new/+page.server.ts`:
```typescript
import { redirect } from '@sveltejs/kit';
import { grammarDb, grammarPoints, levels } from '$lib/server/db';

export async function load() {
  const allLevels = grammarDb
    .select({ id: levels.id, code: levels.code, name: levels.name })
    .from(levels)
    .all();

  return { levels: allLevels };
}

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    const result = grammarDb
      .insert(grammarPoints)
      .values({
        slug: data.get('slug') as string,
        japanese: data.get('japanese') as string,
        romaji: (data.get('romaji') as string) || null,
        meaning: data.get('meaning') as string,
        levelId: data.get('levelId') ? Number(data.get('levelId')) : null,
        category: (data.get('category') as string) || null,
        formation: (data.get('formation') as string) || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: grammarPoints.id })
      .get();

    throw redirect(303, `/grammar/${result.id}`);
  },
};
```

**Step 2: Create page**

Create `apps/admin/src/routes/grammar/new/+page.svelte`:
```svelte
<script lang="ts">
  import GrammarForm from '$lib/components/grammar/GrammarForm.svelte';

  let { data } = $props();
</script>

<h1 class="text-3xl font-bold mb-6">New Grammar Point</h1>

<GrammarForm levels={data.levels} />
```

**Step 3: Run and verify**

Run: `pnpm dev`
Navigate to: http://localhost:5173/grammar/new
Expected: Form for creating new grammar point

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): add new grammar point page"
```

---

### Task 5.4: Create edit grammar point page

**Files:**
- Create: `apps/admin/src/routes/grammar/[id]/+page.svelte`
- Create: `apps/admin/src/routes/grammar/[id]/+page.server.ts`

**Step 1: Create server file**

Create `apps/admin/src/routes/grammar/[id]/+page.server.ts`:
```typescript
import { error, redirect } from '@sveltejs/kit';
import { grammarDb, grammarPoints, levels, examples } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export async function load({ params }) {
  const point = grammarDb
    .select()
    .from(grammarPoints)
    .where(eq(grammarPoints.id, Number(params.id)))
    .get();

  if (!point) {
    throw error(404, 'Grammar point not found');
  }

  const pointExamples = grammarDb
    .select()
    .from(examples)
    .where(eq(examples.grammarPointId, point.id))
    .all();

  const allLevels = grammarDb
    .select({ id: levels.id, code: levels.code, name: levels.name })
    .from(levels)
    .all();

  return { point, examples: pointExamples, levels: allLevels };
}

export const actions = {
  update: async ({ params, request }) => {
    const data = await request.formData();

    grammarDb
      .update(grammarPoints)
      .set({
        slug: data.get('slug') as string,
        japanese: data.get('japanese') as string,
        romaji: (data.get('romaji') as string) || null,
        meaning: data.get('meaning') as string,
        levelId: data.get('levelId') ? Number(data.get('levelId')) : null,
        category: (data.get('category') as string) || null,
        formation: (data.get('formation') as string) || null,
        updatedAt: new Date(),
      })
      .where(eq(grammarPoints.id, Number(params.id)))
      .run();

    return { success: true };
  },

  delete: async ({ params }) => {
    grammarDb.delete(grammarPoints).where(eq(grammarPoints.id, Number(params.id))).run();
    throw redirect(303, '/grammar');
  },
};
```

**Step 2: Create page**

Create `apps/admin/src/routes/grammar/[id]/+page.svelte`:
```svelte
<script lang="ts">
  import GrammarForm from '$lib/components/grammar/GrammarForm.svelte';

  let { data } = $props();
</script>

<div class="flex justify-between items-center mb-6">
  <h1 class="text-3xl font-bold">Edit: {data.point.japanese}</h1>
  <form method="POST" action="?/delete">
    <button type="submit" class="btn btn-error btn-outline" onclick="return confirm('Delete this grammar point?')">
      Delete
    </button>
  </form>
</div>

<GrammarForm point={data.point} levels={data.levels} action="?/update" />

<h2 class="text-2xl font-bold mt-8 mb-4">Examples ({data.examples.length})</h2>

{#if data.examples.length > 0}
  <div class="space-y-2">
    {#each data.examples as example}
      <div class="card bg-base-200">
        <div class="card-body p-4">
          <p class="font-bold">{example.japanese}</p>
          <p class="opacity-70">{example.english ?? ''}</p>
        </div>
      </div>
    {/each}
  </div>
{:else}
  <p class="opacity-50">No examples yet</p>
{/if}
```

**Step 3: Run and verify**

Run: `pnpm dev`
Create a grammar point, then edit it
Expected: Form populated with existing data, delete button works

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): add edit grammar point page"
```

---

## Phase 6: Queries CRUD

### Task 6.1: Create queries list page

**Files:**
- Create: `apps/admin/src/routes/queries/+page.svelte`
- Create: `apps/admin/src/routes/queries/+page.server.ts`

**Step 1: Create server load function**

Create `apps/admin/src/routes/queries/+page.server.ts`:
```typescript
import { benchmarkDb, benchmarkQueries, benchmarkExpected } from '$lib/server/db';
import { count, eq } from 'drizzle-orm';

export async function load() {
  const queries = benchmarkDb.select().from(benchmarkQueries).all();

  // Get expected counts per query
  const expectedCounts = benchmarkDb
    .select({
      queryId: benchmarkExpected.queryId,
      count: count(),
    })
    .from(benchmarkExpected)
    .groupBy(benchmarkExpected.queryId)
    .all();

  const countMap = new Map(expectedCounts.map((e) => [e.queryId, e.count]));

  const queriesWithCounts = queries.map((q) => ({
    ...q,
    expectedCount: countMap.get(q.id) ?? 0,
  }));

  return { queries: queriesWithCounts };
}
```

**Step 2: Create list page**

Create `apps/admin/src/routes/queries/+page.svelte`:
```svelte
<script lang="ts">
  let { data } = $props();
</script>

<div class="flex justify-between items-center mb-6">
  <h1 class="text-3xl font-bold">Benchmark Queries</h1>
  <a href="/queries/new" class="btn btn-primary">Add New</a>
</div>

<div class="overflow-x-auto">
  <table class="table table-zebra">
    <thead>
      <tr>
        <th>Query</th>
        <th>Difficulty</th>
        <th>Language</th>
        <th>Expected</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data.queries as query}
        <tr class="hover">
          <td class="max-w-md truncate">{query.queryText}</td>
          <td>
            {#if query.difficulty}
              <span class="badge badge-secondary">{query.difficulty}</span>
            {/if}
          </td>
          <td>{query.queryLanguage ?? ''}</td>
          <td>
            <span class="badge badge-outline">{query.expectedCount}</span>
          </td>
          <td>
            <a href="/queries/{query.id}" class="btn btn-xs btn-ghost">Edit</a>
          </td>
        </tr>
      {:else}
        <tr>
          <td colspan="5" class="text-center opacity-50">No queries found</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): add queries list page"
```

---

### Task 6.2: Create query form and pages

**Files:**
- Create: `apps/admin/src/routes/queries/new/+page.svelte`
- Create: `apps/admin/src/routes/queries/new/+page.server.ts`
- Create: `apps/admin/src/routes/queries/[id]/+page.svelte`
- Create: `apps/admin/src/routes/queries/[id]/+page.server.ts`

**Step 1: Create new query server**

Create `apps/admin/src/routes/queries/new/+page.server.ts`:
```typescript
import { redirect } from '@sveltejs/kit';
import { benchmarkDb, benchmarkQueries } from '$lib/server/db';

export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    const result = benchmarkDb
      .insert(benchmarkQueries)
      .values({
        queryText: data.get('queryText') as string,
        queryLanguage: (data.get('queryLanguage') as string) || null,
        targetLanguage: (data.get('targetLanguage') as string) || null,
        difficulty: (data.get('difficulty') as string) || null,
        isRanked: data.get('isRanked') === 'on',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: benchmarkQueries.id })
      .get();

    throw redirect(303, `/queries/${result.id}`);
  },
};
```

**Step 2: Create new query page**

Create `apps/admin/src/routes/queries/new/+page.svelte`:
```svelte
<h1 class="text-3xl font-bold mb-6">New Benchmark Query</h1>

<form method="POST" class="space-y-4 max-w-2xl">
  <div class="form-control">
    <label class="label" for="queryText">
      <span class="label-text">Query Text</span>
    </label>
    <textarea
      id="queryText"
      name="queryText"
      required
      class="textarea textarea-bordered"
      rows="3"
    ></textarea>
  </div>

  <div class="grid grid-cols-2 gap-4">
    <div class="form-control">
      <label class="label" for="queryLanguage">
        <span class="label-text">Query Language</span>
      </label>
      <input
        type="text"
        id="queryLanguage"
        name="queryLanguage"
        class="input input-bordered"
        placeholder="en"
      />
    </div>

    <div class="form-control">
      <label class="label" for="targetLanguage">
        <span class="label-text">Target Language</span>
      </label>
      <input
        type="text"
        id="targetLanguage"
        name="targetLanguage"
        class="input input-bordered"
        placeholder="ja"
      />
    </div>
  </div>

  <div class="form-control">
    <label class="label" for="difficulty">
      <span class="label-text">Difficulty</span>
    </label>
    <select id="difficulty" name="difficulty" class="select select-bordered">
      <option value="">-- Select --</option>
      <option value="direct">Direct</option>
      <option value="descriptive">Descriptive</option>
      <option value="situational">Situational</option>
      <option value="adversarial">Adversarial</option>
    </select>
  </div>

  <div class="form-control">
    <label class="label cursor-pointer justify-start gap-4">
      <input type="checkbox" name="isRanked" class="checkbox" />
      <span class="label-text">Ranked (graded relevance)</span>
    </label>
  </div>

  <div class="flex gap-4">
    <button type="submit" class="btn btn-primary">Create</button>
    <a href="/queries" class="btn btn-ghost">Cancel</a>
  </div>
</form>
```

**Step 3: Create edit query server**

Create `apps/admin/src/routes/queries/[id]/+page.server.ts`:
```typescript
import { error, redirect } from '@sveltejs/kit';
import {
  benchmarkDb,
  benchmarkQueries,
  benchmarkExpected,
  grammarDb,
  grammarPoints,
} from '$lib/server/db';
import { eq } from 'drizzle-orm';

export async function load({ params }) {
  const query = benchmarkDb
    .select()
    .from(benchmarkQueries)
    .where(eq(benchmarkQueries.id, Number(params.id)))
    .get();

  if (!query) {
    throw error(404, 'Query not found');
  }

  const expected = benchmarkDb
    .select()
    .from(benchmarkExpected)
    .where(eq(benchmarkExpected.queryId, query.id))
    .all();

  // Get grammar point details for expected
  const grammarPointIds = expected.map((e) => e.grammarPointId);
  const points =
    grammarPointIds.length > 0
      ? grammarDb.select().from(grammarPoints).all()
      : [];
  const pointMap = new Map(points.map((p) => [p.id, p]));

  const expectedWithDetails = expected.map((e) => ({
    ...e,
    grammarPoint: pointMap.get(e.grammarPointId),
  }));

  return { query, expected: expectedWithDetails };
}

export const actions = {
  update: async ({ params, request }) => {
    const data = await request.formData();

    benchmarkDb
      .update(benchmarkQueries)
      .set({
        queryText: data.get('queryText') as string,
        queryLanguage: (data.get('queryLanguage') as string) || null,
        targetLanguage: (data.get('targetLanguage') as string) || null,
        difficulty: (data.get('difficulty') as string) || null,
        isRanked: data.get('isRanked') === 'on',
        updatedAt: new Date(),
      })
      .where(eq(benchmarkQueries.id, Number(params.id)))
      .run();

    return { success: true };
  },

  delete: async ({ params }) => {
    benchmarkDb.delete(benchmarkQueries).where(eq(benchmarkQueries.id, Number(params.id))).run();
    throw redirect(303, '/queries');
  },

  removeExpected: async ({ request }) => {
    const data = await request.formData();
    const expectedId = Number(data.get('expectedId'));

    benchmarkDb.delete(benchmarkExpected).where(eq(benchmarkExpected.id, expectedId)).run();

    return { success: true };
  },
};
```

**Step 4: Create edit query page**

Create `apps/admin/src/routes/queries/[id]/+page.svelte`:
```svelte
<script lang="ts">
  let { data } = $props();
</script>

<div class="flex justify-between items-center mb-6">
  <h1 class="text-3xl font-bold">Edit Query</h1>
  <form method="POST" action="?/delete">
    <button
      type="submit"
      class="btn btn-error btn-outline"
      onclick="return confirm('Delete this query?')"
    >
      Delete
    </button>
  </form>
</div>

<form method="POST" action="?/update" class="space-y-4 max-w-2xl">
  <div class="form-control">
    <label class="label" for="queryText">
      <span class="label-text">Query Text</span>
    </label>
    <textarea
      id="queryText"
      name="queryText"
      required
      class="textarea textarea-bordered"
      rows="3"
    >{data.query.queryText}</textarea>
  </div>

  <div class="grid grid-cols-2 gap-4">
    <div class="form-control">
      <label class="label" for="queryLanguage">
        <span class="label-text">Query Language</span>
      </label>
      <input
        type="text"
        id="queryLanguage"
        name="queryLanguage"
        value={data.query.queryLanguage ?? ''}
        class="input input-bordered"
      />
    </div>

    <div class="form-control">
      <label class="label" for="targetLanguage">
        <span class="label-text">Target Language</span>
      </label>
      <input
        type="text"
        id="targetLanguage"
        name="targetLanguage"
        value={data.query.targetLanguage ?? ''}
        class="input input-bordered"
      />
    </div>
  </div>

  <div class="form-control">
    <label class="label" for="difficulty">
      <span class="label-text">Difficulty</span>
    </label>
    <select id="difficulty" name="difficulty" class="select select-bordered">
      <option value="">-- Select --</option>
      <option value="direct" selected={data.query.difficulty === 'direct'}>Direct</option>
      <option value="descriptive" selected={data.query.difficulty === 'descriptive'}>Descriptive</option>
      <option value="situational" selected={data.query.difficulty === 'situational'}>Situational</option>
      <option value="adversarial" selected={data.query.difficulty === 'adversarial'}>Adversarial</option>
    </select>
  </div>

  <div class="form-control">
    <label class="label cursor-pointer justify-start gap-4">
      <input type="checkbox" name="isRanked" class="checkbox" checked={data.query.isRanked} />
      <span class="label-text">Ranked (graded relevance)</span>
    </label>
  </div>

  <button type="submit" class="btn btn-primary">Save Changes</button>
</form>

<h2 class="text-2xl font-bold mt-8 mb-4">Ground Truth ({data.expected.length})</h2>

{#if data.expected.length > 0}
  <div class="space-y-2">
    {#each data.expected as exp}
      <div class="card bg-base-200">
        <div class="card-body p-4 flex-row justify-between items-center">
          <div>
            <p class="font-bold">{exp.grammarPoint?.japanese ?? 'Unknown'}</p>
            <p class="opacity-70">{exp.grammarPoint?.meaning ?? ''}</p>
            {#if exp.relevanceScore}
              <span class="badge badge-sm">Relevance: {exp.relevanceScore}</span>
            {/if}
          </div>
          <form method="POST" action="?/removeExpected">
            <input type="hidden" name="expectedId" value={exp.id} />
            <button type="submit" class="btn btn-sm btn-ghost">Remove</button>
          </form>
        </div>
      </div>
    {/each}
  </div>
{:else}
  <p class="opacity-50">No ground truth defined</p>
{/if}

<a href="/queries/{data.query.id}/add-expected" class="btn btn-secondary mt-4">
  Add Ground Truth
</a>
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): add query CRUD pages"
```

---

## Phase 7: Ground Truth Picker

### Task 7.1: Create grammar picker page

**Files:**
- Create: `apps/admin/src/routes/queries/[id]/add-expected/+page.svelte`
- Create: `apps/admin/src/routes/queries/[id]/add-expected/+page.server.ts`

**Step 1: Create server file**

Create `apps/admin/src/routes/queries/[id]/add-expected/+page.server.ts`:
```typescript
import { error, redirect } from '@sveltejs/kit';
import {
  benchmarkDb,
  benchmarkQueries,
  benchmarkExpected,
  grammarDb,
  grammarPoints,
  levels,
} from '$lib/server/db';
import { eq, like, or } from 'drizzle-orm';

export async function load({ params, url }) {
  const query = benchmarkDb
    .select()
    .from(benchmarkQueries)
    .where(eq(benchmarkQueries.id, Number(params.id)))
    .get();

  if (!query) {
    throw error(404, 'Query not found');
  }

  const search = url.searchParams.get('q') ?? '';
  const levelFilter = url.searchParams.get('level');

  let pointsQuery = grammarDb
    .select({
      id: grammarPoints.id,
      japanese: grammarPoints.japanese,
      romaji: grammarPoints.romaji,
      meaning: grammarPoints.meaning,
      levelCode: levels.code,
    })
    .from(grammarPoints)
    .leftJoin(levels, eq(grammarPoints.levelId, levels.id))
    .$dynamic();

  if (search) {
    pointsQuery = pointsQuery.where(
      or(
        like(grammarPoints.japanese, `%${search}%`),
        like(grammarPoints.romaji, `%${search}%`),
        like(grammarPoints.meaning, `%${search}%`)
      )
    );
  }

  if (levelFilter) {
    pointsQuery = pointsQuery.where(eq(levels.id, Number(levelFilter)));
  }

  const points = pointsQuery.limit(50).all();

  const allLevels = grammarDb
    .select({ id: levels.id, code: levels.code, name: levels.name })
    .from(levels)
    .all();

  return { query, points, levels: allLevels, search };
}

export const actions = {
  add: async ({ params, request }) => {
    const data = await request.formData();
    const grammarPointId = Number(data.get('grammarPointId'));
    const relevanceScore = data.get('relevanceScore')
      ? Number(data.get('relevanceScore'))
      : null;

    benchmarkDb
      .insert(benchmarkExpected)
      .values({
        queryId: Number(params.id),
        grammarPointId,
        relevanceScore,
      })
      .run();

    throw redirect(303, `/queries/${params.id}`);
  },
};
```

**Step 2: Create picker page**

Create `apps/admin/src/routes/queries/[id]/add-expected/+page.svelte`:
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let { data } = $props();
  let search = $state(data.search);
  let selectedPoint = $state<typeof data.points[0] | null>(null);
  let relevanceScore = $state<number | null>(null);

  function handleSearch(e: Event) {
    e.preventDefault();
    const url = new URL($page.url);
    if (search) {
      url.searchParams.set('q', search);
    } else {
      url.searchParams.delete('q');
    }
    goto(url.toString(), { replaceState: true });
  }

  function selectPoint(point: typeof data.points[0]) {
    selectedPoint = point;
  }
</script>

<h1 class="text-3xl font-bold mb-2">Add Ground Truth</h1>
<p class="opacity-70 mb-6">Query: {data.query.queryText}</p>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div>
    <form onsubmit={handleSearch} class="mb-4">
      <div class="join">
        <input
          type="text"
          bind:value={search}
          placeholder="Search grammar points..."
          class="input input-bordered join-item w-full"
        />
        <button type="submit" class="btn join-item">Search</button>
      </div>
    </form>

    <div class="space-y-2 max-h-96 overflow-y-auto">
      {#each data.points as point}
        <button
          type="button"
          class="card bg-base-200 w-full text-left hover:bg-base-300 transition-colors"
          class:ring-2={selectedPoint?.id === point.id}
          class:ring-primary={selectedPoint?.id === point.id}
          onclick={() => selectPoint(point)}
        >
          <div class="card-body p-3">
            <div class="flex justify-between items-start">
              <div>
                <p class="font-bold">{point.japanese}</p>
                <p class="text-sm opacity-70">{point.romaji}</p>
                <p class="text-sm">{point.meaning}</p>
              </div>
              {#if point.levelCode}
                <span class="badge badge-primary badge-sm">{point.levelCode}</span>
              {/if}
            </div>
          </div>
        </button>
      {:else}
        <p class="opacity-50 text-center py-4">No grammar points found</p>
      {/each}
    </div>
  </div>

  <div>
    {#if selectedPoint}
      <div class="card bg-base-300">
        <div class="card-body">
          <h2 class="card-title">{selectedPoint.japanese}</h2>
          <p class="opacity-70">{selectedPoint.romaji}</p>
          <p>{selectedPoint.meaning}</p>

          <form method="POST" action="?/add" class="mt-4 space-y-4">
            <input type="hidden" name="grammarPointId" value={selectedPoint.id} />

            {#if data.query.isRanked}
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Relevance Score</span>
                </label>
                <div class="flex gap-4">
                  {#each [1, 2, 3] as score}
                    <label class="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="relevanceScore"
                        value={score}
                        class="radio radio-primary"
                        bind:group={relevanceScore}
                      />
                      <span>{score}</span>
                    </label>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="card-actions">
              <button type="submit" class="btn btn-primary">Add to Ground Truth</button>
              <a href="/queries/{data.query.id}" class="btn btn-ghost">Cancel</a>
            </div>
          </form>
        </div>
      </div>
    {:else}
      <div class="card bg-base-200">
        <div class="card-body text-center opacity-50">
          Select a grammar point from the list
        </div>
      </div>
    {/if}
  </div>
</div>
```

**Step 3: Run and verify**

Run: `pnpm dev`
Navigate to a query, click "Add Ground Truth"
Expected: Picker with search and selection

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): add ground truth picker"
```

---

## Phase 8: Languages Settings

### Task 8.1: Create languages management page

**Files:**
- Create: `apps/admin/src/routes/settings/languages/+page.svelte`
- Create: `apps/admin/src/routes/settings/languages/+page.server.ts`

**Step 1: Create server file**

Create `apps/admin/src/routes/settings/languages/+page.server.ts`:
```typescript
import { grammarDb, languages, levels } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export async function load() {
  const allLanguages = grammarDb.select().from(languages).all();

  const allLevels = grammarDb.select().from(levels).orderBy(levels.sortOrder).all();

  const languagesWithLevels = allLanguages.map((lang) => ({
    ...lang,
    levels: allLevels.filter((l) => l.languageId === lang.id),
  }));

  return { languages: languagesWithLevels };
}

export const actions = {
  addLanguage: async ({ request }) => {
    const data = await request.formData();

    grammarDb
      .insert(languages)
      .values({
        code: data.get('code') as string,
        name: data.get('name') as string,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    return { success: true };
  },

  addLevel: async ({ request }) => {
    const data = await request.formData();

    grammarDb
      .insert(levels)
      .values({
        languageId: Number(data.get('languageId')),
        code: data.get('code') as string,
        name: data.get('name') as string,
        sortOrder: data.get('sortOrder') ? Number(data.get('sortOrder')) : null,
      })
      .run();

    return { success: true };
  },

  deleteLevel: async ({ request }) => {
    const data = await request.formData();
    const levelId = Number(data.get('levelId'));

    grammarDb.delete(levels).where(eq(levels.id, levelId)).run();

    return { success: true };
  },
};
```

**Step 2: Create page**

Create `apps/admin/src/routes/settings/languages/+page.svelte`:
```svelte
<script lang="ts">
  let { data } = $props();
  let showAddLanguage = $state(false);
  let addLevelFor = $state<number | null>(null);
</script>

<div class="flex justify-between items-center mb-6">
  <h1 class="text-3xl font-bold">Languages & Levels</h1>
  <button class="btn btn-primary" onclick={() => (showAddLanguage = !showAddLanguage)}>
    Add Language
  </button>
</div>

{#if showAddLanguage}
  <form method="POST" action="?/addLanguage" class="card bg-base-200 mb-6">
    <div class="card-body">
      <h2 class="card-title">New Language</h2>
      <div class="grid grid-cols-2 gap-4">
        <div class="form-control">
          <label class="label" for="code">
            <span class="label-text">Code</span>
          </label>
          <input
            type="text"
            id="code"
            name="code"
            required
            placeholder="ja"
            class="input input-bordered"
          />
        </div>
        <div class="form-control">
          <label class="label" for="name">
            <span class="label-text">Name</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            placeholder="Japanese"
            class="input input-bordered"
          />
        </div>
      </div>
      <div class="card-actions mt-4">
        <button type="submit" class="btn btn-primary">Add</button>
        <button type="button" class="btn btn-ghost" onclick={() => (showAddLanguage = false)}>
          Cancel
        </button>
      </div>
    </div>
  </form>
{/if}

<div class="space-y-6">
  {#each data.languages as lang}
    <div class="card bg-base-200">
      <div class="card-body">
        <div class="flex justify-between items-center">
          <h2 class="card-title">
            {lang.name}
            <span class="badge badge-neutral">{lang.code}</span>
          </h2>
          <button
            class="btn btn-sm btn-secondary"
            onclick={() => (addLevelFor = addLevelFor === lang.id ? null : lang.id)}
          >
            Add Level
          </button>
        </div>

        {#if addLevelFor === lang.id}
          <form method="POST" action="?/addLevel" class="mt-4 p-4 bg-base-300 rounded-lg">
            <input type="hidden" name="languageId" value={lang.id} />
            <div class="grid grid-cols-3 gap-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Code</span></label>
                <input type="text" name="code" required placeholder="N5" class="input input-bordered input-sm" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Name</span></label>
                <input type="text" name="name" required placeholder="JLPT N5" class="input input-bordered input-sm" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Sort Order</span></label>
                <input type="number" name="sortOrder" class="input input-bordered input-sm" />
              </div>
            </div>
            <div class="mt-4">
              <button type="submit" class="btn btn-sm btn-primary">Add Level</button>
            </div>
          </form>
        {/if}

        {#if lang.levels.length > 0}
          <div class="overflow-x-auto mt-4">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Order</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each lang.levels as level}
                  <tr>
                    <td><span class="badge badge-primary">{level.code}</span></td>
                    <td>{level.name}</td>
                    <td>{level.sortOrder ?? '-'}</td>
                    <td>
                      <form method="POST" action="?/deleteLevel" class="inline">
                        <input type="hidden" name="levelId" value={level.id} />
                        <button type="submit" class="btn btn-xs btn-ghost text-error">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="opacity-50 mt-4">No levels defined</p>
        {/if}
      </div>
    </div>
  {:else}
    <p class="opacity-50 text-center py-8">No languages configured</p>
  {/each}
</div>
```

**Step 3: Run and verify**

Run: `pnpm dev`
Navigate to: http://localhost:5173/settings/languages
Expected: Language and level management interface

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): add languages settings page"
```

---

## Phase 9: Testing & Pre-commit

### Task 9.1: Configure Vitest properly

**Files:**
- Modify: `apps/admin/vite.config.ts`

**Step 1: Update Vite config**

Update `apps/admin/vite.config.ts`:
```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/server/db/schema/**'],
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

**Step 2: Add test script**

Ensure `apps/admin/package.json` has:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore(admin): configure Vitest with coverage"
```

---

### Task 9.2: Add Lefthook pre-commit

**Files:**
- Create: `lefthook.yml`

**Step 1: Install Lefthook**

Run:
```bash
pnpm add -D lefthook
```

**Step 2: Create config**

Create `lefthook.yml` in project root:
```yaml
pre-commit:
  parallel: true
  commands:
    lint-admin:
      glob: "apps/admin/src/**/*.{ts,svelte}"
      run: pnpm --filter admin lint
    test-admin:
      glob: "apps/admin/src/**/*.{ts,svelte}"
      run: pnpm --filter admin test
```

**Step 3: Install hooks**

Run: `pnpm lefthook install`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: add Lefthook pre-commit hooks"
```

---

### Task 9.3: Update project CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add admin UI section**

Add to end of `CLAUDE.md`:
```markdown

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
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add admin UI section to CLAUDE.md"
```

---

## Completion Checklist

- [ ] Phase 1: Project scaffolding (workspaces, SvelteKit, Tailwind, Biome)
- [ ] Phase 2: Database layer (Drizzle schemas, clients, tests)
- [ ] Phase 3: Schema migration (languages/levels)
- [ ] Phase 4: Core layout and navigation
- [ ] Phase 5: Grammar CRUD (list, new, edit)
- [ ] Phase 6: Queries CRUD (list, new, edit)
- [ ] Phase 7: Ground truth picker
- [ ] Phase 8: Languages settings
- [ ] Phase 9: Testing & pre-commit hooks
