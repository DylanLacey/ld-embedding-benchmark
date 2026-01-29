# Embedding Benchmark Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool to benchmark embedding models for multi-linguistic grammar retrieval, with Neon/pgvector for vector storage and SQLite for benchmark metadata.

**Architecture:** Grammar data lives in Neon (main branch), embeddings on experiment branches. SQLite stores benchmark queries, expected results, runs, and metrics. Pluggable embedding providers (HuggingFace first). CLI uses Charmbracelet aesthetics.

**Tech Stack:** TypeScript, better-sqlite3, @neondatabase/serverless, pgvector, @huggingface/inference, Commander.js, chalk/picocolors for styling (gum requires Go; we'll use Node equivalents).

---

## Phase 0: Neon Provisioning & Config Storage

### Task 0a: Config Directory Structure

**Files:**
- Create: `src/paths.ts`

**Step 1: Create paths module for config directory**

```typescript
// src/paths.ts
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export const CONFIG_DIR = path.join(os.homedir(), ".embedding_test");
export const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
export const README_FILE = path.join(CONFIG_DIR, "README.txt");

export interface StoredConfig {
  neonApiKey?: string;
  neonProjectId?: string;
  neonProjectName?: string;
  databaseUrl?: string;
  createdAt?: string;
}

const README_CONTENT = `═══════════════════════════════════════════════════════════════════
 ~/.embedding_test — Embedding Benchmark Configuration
═══════════════════════════════════════════════════════════════════

This directory stores configuration for the embedding4ld benchmark
tool. It contains credentials and state for your Neon database.

Files:
  config.json  — Neon project ID, API key, database URL
  README.txt   — This file

Commands:
  embedding4ld init      — Create Neon project and store credentials
  embedding4ld destroy   — Delete Neon project and remove this directory
  embedding4ld status    — Show current configuration

The config.json file contains sensitive credentials. Do not share it.
If you delete this directory, you'll need to run 'init' again.

Project: https://github.com/your-repo/embedding4ld
═══════════════════════════════════════════════════════════════════
`;

export function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(README_FILE, README_CONTENT);
  }
}

export function readConfig(): StoredConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  const content = fs.readFileSync(CONFIG_FILE, "utf-8");
  return JSON.parse(content);
}

export function writeConfig(config: StoredConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function deleteConfigDir(): void {
  if (fs.existsSync(CONFIG_DIR)) {
    fs.rmSync(CONFIG_DIR, { recursive: true });
  }
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}
```

**Step 2: Commit**

```bash
git add src/paths.ts
git commit -m "feat: add config directory management (~/.embedding_test)"
```

---

### Task 0b: Neon API Client

**Files:**
- Create: `src/neon-api.ts`

**Step 1: Create Neon Management API client**

```typescript
// src/neon-api.ts
import { readConfig, writeConfig, type StoredConfig } from "./paths.js";

const NEON_API_BASE = "https://console.neon.tech/api/v2";

interface NeonProject {
  id: string;
  name: string;
  created_at: string;
}

interface NeonBranch {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
}

interface NeonEndpoint {
  id: string;
  host: string;
  branch_id: string;
}

interface NeonConnectionUri {
  connection_uri: string;
}

async function neonFetch<T>(
  apiKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${NEON_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Neon API error (${response.status}): ${error}`);
  }

  return response.json();
}

export async function createNeonProject(
  apiKey: string,
  name: string
): Promise<{ project: NeonProject; connectionUri: string }> {
  const result = await neonFetch<{
    project: NeonProject;
    connection_uris: NeonConnectionUri[];
  }>(apiKey, "/projects", {
    method: "POST",
    body: JSON.stringify({
      project: { name },
    }),
  });

  return {
    project: result.project,
    connectionUri: result.connection_uris[0]?.connection_uri ?? "",
  };
}

export async function deleteNeonProject(apiKey: string, projectId: string): Promise<void> {
  await neonFetch(apiKey, `/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function listNeonBranches(
  apiKey: string,
  projectId: string
): Promise<NeonBranch[]> {
  const result = await neonFetch<{ branches: NeonBranch[] }>(
    apiKey,
    `/projects/${projectId}/branches`
  );
  return result.branches;
}

export async function createNeonBranch(
  apiKey: string,
  projectId: string,
  name: string,
  parentBranchId?: string
): Promise<{ branch: NeonBranch; connectionUri: string }> {
  const body: Record<string, unknown> = {
    branch: { name },
    endpoints: [{ type: "read_write" }],
  };

  if (parentBranchId) {
    body.branch = { name, parent_id: parentBranchId };
  }

  const result = await neonFetch<{
    branch: NeonBranch;
    connection_uris: NeonConnectionUri[];
  }>(apiKey, `/projects/${projectId}/branches`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    branch: result.branch,
    connectionUri: result.connection_uris[0]?.connection_uri ?? "",
  };
}

export async function deleteNeonBranch(
  apiKey: string,
  projectId: string,
  branchId: string
): Promise<void> {
  await neonFetch(apiKey, `/projects/${projectId}/branches/${branchId}`, {
    method: "DELETE",
  });
}

export async function getBranchConnectionUri(
  apiKey: string,
  projectId: string,
  branchId: string
): Promise<string> {
  // Get endpoints for branch
  const endpoints = await neonFetch<{ endpoints: NeonEndpoint[] }>(
    apiKey,
    `/projects/${projectId}/branches/${branchId}/endpoints`
  );

  const endpoint = endpoints.endpoints[0];
  if (!endpoint) {
    throw new Error(`No endpoint found for branch ${branchId}`);
  }

  // Get connection URI for endpoint
  const result = await neonFetch<{ uri: string }>(
    apiKey,
    `/projects/${projectId}/connection_uri?branch_id=${branchId}&endpoint_id=${endpoint.id}&database_name=neondb&role_name=neondb_owner`
  );

  return result.uri;
}

// Helper to get API key from config or throw
export function getApiKey(): string {
  const config = readConfig();
  if (!config.neonApiKey) {
    throw new Error("Neon API key not found. Run 'embedding4ld init' first.");
  }
  return config.neonApiKey;
}

// Helper to get project ID from config or throw
export function getProjectId(): string {
  const config = readConfig();
  if (!config.neonProjectId) {
    throw new Error("Neon project not found. Run 'embedding4ld init' first.");
  }
  return config.neonProjectId;
}
```

**Step 2: Commit**

```bash
git add src/neon-api.ts
git commit -m "feat: add Neon Management API client"
```

---

### Task 0c: Init and Destroy CLI Commands

**Files:**
- Create: `src/commands/init.ts`
- Create: `src/commands/destroy.ts`
- Create: `src/commands/status.ts`

**Step 1: Create init command**

```typescript
// src/commands/init.ts
import ora from "ora";
import pc from "picocolors";
import { readConfig, writeConfig, configExists } from "../paths.js";
import { createNeonProject } from "../neon-api.js";
import { createNeonClient } from "../neon.js";
import { setupGrammarSchema } from "../neon-schema.js";

interface InitOptions {
  apiKey: string;
  projectName?: string;
  force?: boolean;
}

export async function initProject(options: InitOptions): Promise<void> {
  const { apiKey, projectName = "embedding-benchmark", force } = options;
  const spinner = ora();

  // Check existing config
  if (configExists() && !force) {
    const existing = readConfig();
    if (existing.neonProjectId) {
      console.log(pc.yellow("\n⚠ Project already initialized."));
      console.log(pc.dim(`  Project ID: ${existing.neonProjectId}`));
      console.log(pc.dim(`  Use --force to reinitialize (will NOT delete existing project)\n`));
      return;
    }
  }

  try {
    // Create Neon project
    spinner.start("Creating Neon project...");
    const { project, connectionUri } = await createNeonProject(apiKey, projectName);
    spinner.succeed(`Created project: ${project.name} (${project.id})`);

    // Store config
    writeConfig({
      neonApiKey: apiKey,
      neonProjectId: project.id,
      neonProjectName: project.name,
      databaseUrl: connectionUri,
      createdAt: new Date().toISOString(),
    });

    // Setup schema
    spinner.start("Setting up database schema...");
    const sql = createNeonClient(connectionUri);
    await setupGrammarSchema(sql);
    spinner.succeed("Database schema ready");

    console.log(pc.green("\n✿ Initialization complete!\n"));
    console.log(pc.dim("  Config stored in: ~/.embedding_test/config.json"));
    console.log(pc.dim(`  Database URL: ${connectionUri.replace(/:[^:@]+@/, ":***@")}\n`));
    console.log(pc.cyan("Next steps:"));
    console.log(pc.dim("  1. embedding4ld migrate    # Import grammar data"));
    console.log(pc.dim("  2. embedding4ld embed <model>"));
    console.log(pc.dim("  3. embedding4ld benchmark <model>\n"));
  } catch (error) {
    spinner.fail("Initialization failed");
    throw error;
  }
}
```

**Step 2: Create destroy command**

```typescript
// src/commands/destroy.ts
import ora from "ora";
import pc from "picocolors";
import { readConfig, deleteConfigDir, configExists } from "../paths.js";
import { deleteNeonProject } from "../neon-api.js";
import readline from "node:readline";

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

export async function destroyProject(options: { force?: boolean }): Promise<void> {
  const spinner = ora();

  if (!configExists()) {
    console.log(pc.yellow("\n⚠ No project found. Nothing to destroy.\n"));
    return;
  }

  const config = readConfig();

  if (!options.force) {
    console.log(pc.red("\n╭────────────────────────────────────────╮"));
    console.log(pc.red("│  ⚠  WARNING: DESTRUCTIVE OPERATION    │"));
    console.log(pc.red("╰────────────────────────────────────────╯\n"));
    console.log(pc.yellow("This will:"));
    console.log(pc.dim(`  • Delete Neon project: ${config.neonProjectName} (${config.neonProjectId})`));
    console.log(pc.dim("  • Remove all branches and embeddings"));
    console.log(pc.dim("  • Delete ~/.embedding_test directory\n"));

    const confirmed = await confirm(pc.bold("Are you sure?"));
    if (!confirmed) {
      console.log(pc.dim("\nAborted.\n"));
      return;
    }
  }

  try {
    // Delete Neon project
    if (config.neonProjectId && config.neonApiKey) {
      spinner.start("Deleting Neon project...");
      await deleteNeonProject(config.neonApiKey, config.neonProjectId);
      spinner.succeed("Neon project deleted");
    }

    // Delete config directory
    spinner.start("Removing config directory...");
    deleteConfigDir();
    spinner.succeed("Config directory removed");

    console.log(pc.green("\n✿ Project destroyed. Goodbye!\n"));
  } catch (error) {
    spinner.fail("Destroy failed");
    throw error;
  }
}
```

**Step 3: Create status command**

```typescript
// src/commands/status.ts
import pc from "picocolors";
import Table from "cli-table3";
import { readConfig, configExists, CONFIG_DIR } from "../paths.js";
import { listNeonBranches, getApiKey, getProjectId } from "../neon-api.js";

export async function showStatus(): Promise<void> {
  if (!configExists()) {
    console.log(pc.yellow("\n⚠ Not initialized. Run 'embedding4ld init' first.\n"));
    return;
  }

  const config = readConfig();

  console.log(pc.cyan("\n╭────────────────────────────────────────╮"));
  console.log(pc.cyan("│  ") + pc.bold("embedding4ld status") + pc.cyan("                 │"));
  console.log(pc.cyan("╰────────────────────────────────────────╯\n"));

  const configTable = new Table({
    style: { head: [], border: [] },
  });

  configTable.push(
    [pc.dim("Config dir"), CONFIG_DIR],
    [pc.dim("Project"), `${config.neonProjectName} (${config.neonProjectId})`],
    [pc.dim("Created"), config.createdAt ?? "unknown"],
    [pc.dim("Database"), config.databaseUrl?.replace(/:[^:@]+@/, ":***@") ?? "not set"]
  );

  console.log(configTable.toString());

  // List branches
  try {
    const branches = await listNeonBranches(getApiKey(), getProjectId());

    console.log(pc.cyan("\nBranches:"));
    const branchTable = new Table({
      head: [pc.bold("name"), pc.bold("id"), pc.bold("parent")],
      style: { head: [], border: [] },
    });

    for (const branch of branches) {
      branchTable.push([
        branch.name,
        branch.id,
        branch.parent_id ?? pc.dim("(root)"),
      ]);
    }

    console.log(branchTable.toString());
  } catch (error) {
    console.log(pc.yellow("\n⚠ Could not fetch branches"));
  }

  console.log();
}
```

**Step 4: Commit**

```bash
git add src/commands/init.ts src/commands/destroy.ts src/commands/status.ts
git commit -m "feat: add init, destroy, and status CLI commands"
```

---

### Task 0d: Branch Management CLI Commands

**Files:**
- Create: `src/commands/branch.ts`

**Step 1: Create branch management commands**

```typescript
// src/commands/branch.ts
import ora from "ora";
import pc from "picocolors";
import Table from "cli-table3";
import {
  listNeonBranches,
  createNeonBranch,
  deleteNeonBranch,
  getBranchConnectionUri,
  getApiKey,
  getProjectId,
} from "../neon-api.js";

export async function listBranches(): Promise<void> {
  const spinner = ora("Fetching branches...").start();

  try {
    const branches = await listNeonBranches(getApiKey(), getProjectId());
    spinner.stop();

    const table = new Table({
      head: [pc.bold("name"), pc.bold("id"), pc.bold("parent"), pc.bold("created")],
      style: { head: [], border: [] },
    });

    for (const branch of branches) {
      table.push([
        branch.name,
        branch.id.slice(0, 12) + "...",
        branch.parent_id?.slice(0, 12) ?? pc.dim("(root)"),
        new Date(branch.created_at).toLocaleDateString(),
      ]);
    }

    console.log(table.toString());
  } catch (error) {
    spinner.fail("Failed to list branches");
    throw error;
  }
}

export async function createBranch(
  name: string,
  options: { parent?: string }
): Promise<void> {
  const spinner = ora(`Creating branch: ${name}`).start();

  try {
    const apiKey = getApiKey();
    const projectId = getProjectId();

    // Find parent branch ID if name provided
    let parentBranchId: string | undefined;
    if (options.parent) {
      const branches = await listNeonBranches(apiKey, projectId);
      const parent = branches.find((b) => b.name === options.parent);
      if (!parent) {
        throw new Error(`Parent branch not found: ${options.parent}`);
      }
      parentBranchId = parent.id;
    }

    const { branch, connectionUri } = await createNeonBranch(
      apiKey,
      projectId,
      name,
      parentBranchId
    );

    spinner.succeed(`Created branch: ${branch.name}`);
    console.log(pc.dim(`  ID: ${branch.id}`));
    console.log(pc.dim(`  URL: ${connectionUri.replace(/:[^:@]+@/, ":***@")}`));
  } catch (error) {
    spinner.fail("Failed to create branch");
    throw error;
  }
}

export async function deleteBranch(name: string): Promise<void> {
  const spinner = ora(`Deleting branch: ${name}`).start();

  try {
    const apiKey = getApiKey();
    const projectId = getProjectId();

    // Find branch ID by name
    const branches = await listNeonBranches(apiKey, projectId);
    const branch = branches.find((b) => b.name === name);

    if (!branch) {
      throw new Error(`Branch not found: ${name}`);
    }

    if (branch.name === "main") {
      throw new Error("Cannot delete main branch");
    }

    await deleteNeonBranch(apiKey, projectId, branch.id);
    spinner.succeed(`Deleted branch: ${name}`);
  } catch (error) {
    spinner.fail("Failed to delete branch");
    throw error;
  }
}

export async function getBranchUrl(name: string): Promise<string> {
  const apiKey = getApiKey();
  const projectId = getProjectId();

  const branches = await listNeonBranches(apiKey, projectId);
  const branch = branches.find((b) => b.name === name);

  if (!branch) {
    throw new Error(`Branch not found: ${name}`);
  }

  return getBranchConnectionUri(apiKey, projectId, branch.id);
}
```

**Step 2: Commit**

```bash
git add src/commands/branch.ts
git commit -m "feat: add branch management CLI commands"
```

---

## Phase 1: Infrastructure

### Task 1: Add Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Neon serverless driver and CLI dependencies**

Run:
```bash
pnpm add @neondatabase/serverless commander picocolors cli-table3 ora
pnpm add -D @types/cli-table3
```

**Step 2: Verify installation**

Run: `pnpm list @neondatabase/serverless commander`
Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add neon, commander, cli styling dependencies"
```

---

### Task 2: Environment Configuration

**Files:**
- Create: `src/config.ts`
- Modify: `.env.example`

**Step 1: Create config module**

Neon credentials come from `~/.embedding_test/config.json` (managed by `init` command).
Embedding provider keys use environment variables.

```typescript
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
  const config = readConfig();
  if (!config.databaseUrl) {
    throw new Error("Neon not configured. Run 'embedding4ld init' first.");
  }
  return config;
}

export function validateEnv(required: (keyof typeof env)[]): void {
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}
```

**Step 2: Update .env.example**

```bash
# Embedding providers (Neon credentials stored in ~/.embedding_test/)
HF_TOKEN=hf_xxxxx
OPENAI_API_KEY=sk-xxxxx
COHERE_API_KEY=xxxxx
```

**Step 3: Install dotenv**

Run: `pnpm add dotenv`

**Step 4: Commit**

```bash
git add src/config.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat: add environment configuration module"
```

---

### Task 3: Neon Client Module

**Files:**
- Create: `src/neon.ts`

**Step 1: Create Neon connection module**

```typescript
// src/neon.ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { getNeonConfig } from "./config.js";

// Enable connection pooling
neonConfig.fetchConnectionCache = true;

export type NeonClient = ReturnType<typeof neon>;

export function createNeonClient(branchUrl?: string): NeonClient {
  const config = getNeonConfig();
  const url = branchUrl ?? config.databaseUrl;
  if (!url) {
    throw new Error("No database URL available. Run 'embedding4ld init' first.");
  }
  return neon(url);
}

// Helper to derive branch URL from main URL
export function getBranchUrl(branchId: string): string {
  const config = getNeonConfig();
  if (!config.databaseUrl) {
    throw new Error("No database URL configured.");
  }
  // Replace the endpoint ID in the URL with the branch endpoint
  // Format: postgresql://user:pass@ep-xxx.region.neon.tech/db
  // Branch: postgresql://user:pass@ep-yyy.region.neon.tech/db
  const url = new URL(config.databaseUrl);
  const hostParts = url.hostname.split(".");
  hostParts[0] = `ep-${branchId}`;
  url.hostname = hostParts.join(".");
  return url.toString();
}
```

**Step 2: Commit**

```bash
git add src/neon.ts
git commit -m "feat: add Neon serverless client module"
```

---

### Task 4: Neon Schema - Grammar Tables

**Files:**
- Create: `src/neon-schema.ts`

**Step 1: Create schema setup module**

```typescript
// src/neon-schema.ts
import type { NeonClient } from "./neon.js";

export async function setupGrammarSchema(sql: NeonClient): Promise<void> {
  // Enable pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  // Grammar points table
  await sql`
    CREATE TABLE IF NOT EXISTS grammar_points (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      japanese TEXT NOT NULL,
      romaji TEXT,
      meaning TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      detail_url TEXT,
      formation TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Examples table
  await sql`
    CREATE TABLE IF NOT EXISTS examples (
      id SERIAL PRIMARY KEY,
      grammar_point_id INTEGER NOT NULL REFERENCES grammar_points(id) ON DELETE CASCADE,
      japanese TEXT NOT NULL,
      english TEXT NOT NULL,
      source TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_examples_grammar_id ON examples(grammar_point_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_grammar_level ON grammar_points(level)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_grammar_category ON grammar_points(category)`;
}

export async function setupEmbeddingsSchema(sql: NeonClient, dimensions: number): Promise<void> {
  // Grammar embeddings table - dimension varies by model
  await sql`
    CREATE TABLE IF NOT EXISTS grammar_embeddings (
      id SERIAL PRIMARY KEY,
      grammar_point_id INTEGER NOT NULL REFERENCES grammar_points(id) ON DELETE CASCADE,
      model_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_text TEXT NOT NULL,
      embedding vector(${dimensions}),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(grammar_point_id, model_id, source_type, source_text)
    )
  `;

  // IVFFlat index for approximate nearest neighbor search
  await sql`
    CREATE INDEX IF NOT EXISTS idx_embeddings_vector
    ON grammar_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_embeddings_model ON grammar_embeddings(model_id)`;
}
```

**Step 2: Commit**

```bash
git add src/neon-schema.ts
git commit -m "feat: add Neon schema setup for grammar and embeddings"
```

---

### Task 5: Migrate Grammar Data to Neon

**Files:**
- Create: `src/migrate-to-neon.ts`

**Step 1: Create migration script**

```typescript
// src/migrate-to-neon.ts
import { createNeonClient } from "./neon.js";
import { setupGrammarSchema } from "./neon-schema.js";
import { openDatabase, getAllGrammarPoints } from "./db.js";
import ora from "ora";

export async function migrateGrammarToNeon(): Promise<void> {
  const spinner = ora("Connecting to Neon...").start();

  const sql = createNeonClient();
  const localDb = openDatabase();

  try {
    // Setup schema
    spinner.text = "Setting up Neon schema...";
    await setupGrammarSchema(sql);

    // Get local grammar data
    spinner.text = "Reading local grammar data...";
    const grammarPoints = getAllGrammarPoints(localDb);

    spinner.text = `Migrating ${grammarPoints.length} grammar points...`;

    for (const gp of grammarPoints) {
      // Insert grammar point
      const [inserted] = await sql`
        INSERT INTO grammar_points (slug, japanese, romaji, meaning, level, category, detail_url, formation)
        VALUES (${gp.slug}, ${gp.japanese}, ${gp.romaji}, ${gp.meaning}, ${gp.level}, ${gp.category}, ${gp.detailUrl}, ${gp.formation ?? null})
        ON CONFLICT (slug) DO UPDATE SET
          japanese = EXCLUDED.japanese,
          romaji = EXCLUDED.romaji,
          meaning = EXCLUDED.meaning,
          level = EXCLUDED.level,
          category = EXCLUDED.category,
          detail_url = EXCLUDED.detail_url,
          formation = EXCLUDED.formation,
          updated_at = NOW()
        RETURNING id
      `;

      const grammarId = inserted.id;

      // Delete existing examples and insert new ones
      await sql`DELETE FROM examples WHERE grammar_point_id = ${grammarId}`;

      for (const ex of gp.examples) {
        await sql`
          INSERT INTO examples (grammar_point_id, japanese, english, source)
          VALUES (${grammarId}, ${ex.japanese}, ${ex.english}, ${ex.source})
        `;
      }
    }

    spinner.succeed(`Migrated ${grammarPoints.length} grammar points to Neon`);
  } catch (error) {
    spinner.fail("Migration failed");
    throw error;
  } finally {
    localDb.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateGrammarToNeon().catch(console.error);
}
```

**Step 2: Add script to package.json**

Add to scripts:
```json
"migrate:neon": "tsx src/migrate-to-neon.ts"
```

**Step 3: Commit**

```bash
git add src/migrate-to-neon.ts package.json
git commit -m "feat: add grammar migration script for Neon"
```

---

### Task 6: SQLite Benchmark Schema

**Files:**
- Create: `src/benchmark-db.ts`

**Step 1: Create benchmark database module**

```typescript
// src/benchmark-db.ts
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const BENCHMARK_DB_PATH = path.join(DATA_DIR, "benchmark.db");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initializeBenchmarkSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS benchmark_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_text TEXT NOT NULL,
      query_language TEXT NOT NULL,
      target_language TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('direct', 'descriptive', 'situational', 'adversarial')),
      is_ranked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS benchmark_expected (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_id INTEGER NOT NULL REFERENCES benchmark_queries(id) ON DELETE CASCADE,
      grammar_point_id INTEGER NOT NULL,
      relevance_score INTEGER CHECK (relevance_score IS NULL OR relevance_score BETWEEN 1 AND 3),
      UNIQUE(query_id, grammar_point_id)
    );

    CREATE TABLE IF NOT EXISTS embedding_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(provider, model_id)
    );

    CREATE TABLE IF NOT EXISTS benchmark_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL REFERENCES embedding_models(id),
      branch_name TEXT NOT NULL,
      run_at TEXT DEFAULT CURRENT_TIMESTAMP,
      latency_avg_ms REAL
    );

    CREATE TABLE IF NOT EXISTS benchmark_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
      metric_name TEXT NOT NULL,
      value REAL NOT NULL,
      UNIQUE(run_id, metric_name)
    );

    CREATE INDEX IF NOT EXISTS idx_expected_query ON benchmark_expected(query_id);
    CREATE INDEX IF NOT EXISTS idx_runs_model ON benchmark_runs(model_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_run ON benchmark_metrics(run_id);

    CREATE TRIGGER IF NOT EXISTS update_query_timestamp
      AFTER UPDATE ON benchmark_queries
      BEGIN
        UPDATE benchmark_queries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
  `);
}

export function openBenchmarkDatabase(): Database.Database {
  ensureDataDir();
  const db = new Database(BENCHMARK_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initializeBenchmarkSchema(db);
  return db;
}

// Types
export interface BenchmarkQuery {
  id: number;
  queryText: string;
  queryLanguage: string;
  targetLanguage: string;
  difficulty: "direct" | "descriptive" | "situational" | "adversarial";
  isRanked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BenchmarkExpected {
  id: number;
  queryId: number;
  grammarPointId: number;
  relevanceScore: number | null;
}

export interface EmbeddingModelRecord {
  id: number;
  provider: string;
  modelId: string;
  dimensions: number;
  isActive: boolean;
}

export interface BenchmarkRun {
  id: number;
  modelId: number;
  branchName: string;
  runAt: string;
  latencyAvgMs: number | null;
}

export interface BenchmarkMetric {
  id: number;
  runId: number;
  metricName: string;
  value: number;
}
```

**Step 2: Commit**

```bash
git add src/benchmark-db.ts
git commit -m "feat: add SQLite benchmark schema and types"
```

---

## Phase 2: Embedding Provider Abstraction

### Task 7: Embedding Model Interface

**Files:**
- Create: `src/embeddings/types.ts`

**Step 1: Define embedding interface and registry**

```typescript
// src/embeddings/types.ts

export interface EmbeddingModel {
  readonly provider: string;
  readonly modelId: string;
  readonly dimensions: number;

  embed(text: string, type?: "query" | "document"): Promise<number[]>;
  embedBatch(texts: string[], type?: "query" | "document"): Promise<number[][]>;
}

export interface ModelRegistryEntry {
  provider: "huggingface" | "openai" | "cohere";
  dimensions: number;
  supportsAsymmetric?: boolean;
}

export const MODEL_REGISTRY: Record<string, ModelRegistryEntry> = {
  "multilingual-e5-large": { provider: "huggingface", dimensions: 1024, supportsAsymmetric: true },
  "LaBSE": { provider: "huggingface", dimensions: 768 },
  "paraphrase-multilingual-MiniLM-L12-v2": { provider: "huggingface", dimensions: 384 },
  "BGE-M3": { provider: "huggingface", dimensions: 1024, supportsAsymmetric: true },
  "text-embedding-3-small": { provider: "openai", dimensions: 1536 },
  "text-embedding-3-large": { provider: "openai", dimensions: 3072 },
  "embed-multilingual-v3.0": { provider: "cohere", dimensions: 1024, supportsAsymmetric: true },
};

export function getModelInfo(modelId: string): ModelRegistryEntry {
  const entry = MODEL_REGISTRY[modelId];
  if (!entry) {
    throw new Error(`Unknown model: ${modelId}. Available: ${Object.keys(MODEL_REGISTRY).join(", ")}`);
  }
  return entry;
}
```

**Step 2: Commit**

```bash
git add src/embeddings/types.ts
git commit -m "feat: add embedding model interface and registry"
```

---

### Task 8: HuggingFace Provider

**Files:**
- Create: `src/embeddings/huggingface.ts`

**Step 1: Implement HuggingFace embedding provider**

```typescript
// src/embeddings/huggingface.ts
import { HfInference } from "@huggingface/inference";
import type { EmbeddingModel } from "./types.js";
import { env, validateEnv } from "../config.js";

const HF_MODEL_MAP: Record<string, string> = {
  "multilingual-e5-large": "intfloat/multilingual-e5-large",
  "LaBSE": "sentence-transformers/LaBSE",
  "paraphrase-multilingual-MiniLM-L12-v2": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "BGE-M3": "BAAI/bge-m3",
};

export class HuggingFaceEmbedding implements EmbeddingModel {
  readonly provider = "huggingface";
  readonly modelId: string;
  readonly dimensions: number;

  private hf: HfInference;
  private hfModelId: string;
  private supportsAsymmetric: boolean;

  constructor(modelId: string, dimensions: number, supportsAsymmetric = false) {
    validateEnv(["hfToken"]);
    this.modelId = modelId;
    this.dimensions = dimensions;
    this.supportsAsymmetric = supportsAsymmetric;
    this.hfModelId = HF_MODEL_MAP[modelId] ?? modelId;
    this.hf = new HfInference(env.hfToken);
  }

  private formatText(text: string, type?: "query" | "document"): string {
    if (!this.supportsAsymmetric || !type) return text;
    // e5 and BGE use prefixes for asymmetric retrieval
    if (this.modelId.includes("e5") || this.modelId.includes("BGE")) {
      return type === "query" ? `query: ${text}` : `passage: ${text}`;
    }
    return text;
  }

  async embed(text: string, type?: "query" | "document"): Promise<number[]> {
    const formattedText = this.formatText(text, type);
    const result = await this.hf.featureExtraction({
      model: this.hfModelId,
      inputs: formattedText,
    });
    return result as number[];
  }

  async embedBatch(texts: string[], type?: "query" | "document"): Promise<number[][]> {
    const formattedTexts = texts.map((t) => this.formatText(t, type));
    const results = await this.hf.featureExtraction({
      model: this.hfModelId,
      inputs: formattedTexts,
    });
    return results as number[][];
  }
}
```

**Step 2: Commit**

```bash
git add src/embeddings/huggingface.ts
git commit -m "feat: add HuggingFace embedding provider"
```

---

### Task 9: Model Factory

**Files:**
- Create: `src/embeddings/factory.ts`
- Create: `src/embeddings/index.ts`

**Step 1: Create model factory**

```typescript
// src/embeddings/factory.ts
import type { EmbeddingModel } from "./types.js";
import { getModelInfo } from "./types.js";
import { HuggingFaceEmbedding } from "./huggingface.js";

export interface CreateModelOptions {
  modelId: string;
  provider?: string;
  dimensions?: number; // Override for variable-dimension models (OpenAI)
}

export function createModelInstance(options: CreateModelOptions): EmbeddingModel {
  const { modelId, provider: overrideProvider, dimensions: overrideDimensions } = options;

  const info = getModelInfo(modelId);
  const provider = overrideProvider ?? info.provider;
  const dimensions = overrideDimensions ?? info.dimensions;

  switch (provider) {
    case "huggingface":
      return new HuggingFaceEmbedding(modelId, dimensions, info.supportsAsymmetric);

    case "openai":
      // TODO: Implement OpenAI provider
      throw new Error("OpenAI provider not yet implemented");

    case "cohere":
      // TODO: Implement Cohere provider
      throw new Error("Cohere provider not yet implemented");

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

**Step 2: Create barrel export**

```typescript
// src/embeddings/index.ts
export * from "./types.js";
export * from "./factory.js";
export { HuggingFaceEmbedding } from "./huggingface.js";
```

**Step 3: Commit**

```bash
git add src/embeddings/factory.ts src/embeddings/index.ts
git commit -m "feat: add embedding model factory and exports"
```

---

## Phase 3: Benchmark Core

### Task 10: Neon Embedding Operations

**Files:**
- Create: `src/neon-embeddings.ts`

**Step 1: Create embedding storage and search operations**

```typescript
// src/neon-embeddings.ts
import type { NeonClient } from "./neon.js";
import type { EmbeddingModel } from "./embeddings/types.js";

export interface GrammarEmbeddingSource {
  grammarPointId: number;
  sourceType: "name_meaning" | "example" | "formation";
  sourceText: string;
}

export async function storeEmbedding(
  sql: NeonClient,
  source: GrammarEmbeddingSource,
  modelId: string,
  embedding: number[]
): Promise<void> {
  const embeddingStr = `[${embedding.join(",")}]`;
  await sql`
    INSERT INTO grammar_embeddings (grammar_point_id, model_id, source_type, source_text, embedding)
    VALUES (${source.grammarPointId}, ${modelId}, ${source.sourceType}, ${source.sourceText}, ${embeddingStr}::vector)
    ON CONFLICT (grammar_point_id, model_id, source_type, source_text) DO UPDATE SET
      embedding = ${embeddingStr}::vector
  `;
}

export async function storeEmbeddingsBatch(
  sql: NeonClient,
  sources: GrammarEmbeddingSource[],
  modelId: string,
  embeddings: number[][]
): Promise<void> {
  for (let i = 0; i < sources.length; i++) {
    await storeEmbedding(sql, sources[i], modelId, embeddings[i]);
  }
}

export interface SearchResult {
  grammarPointId: number;
  japanese: string;
  meaning: string;
  level: string;
  sourceType: string;
  similarity: number;
}

export async function searchSimilar(
  sql: NeonClient,
  queryEmbedding: number[],
  modelId: string,
  limit = 10
): Promise<SearchResult[]> {
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // Get best match per grammar point
  const results = await sql`
    SELECT DISTINCT ON (gp.id)
      gp.id as grammar_point_id,
      gp.japanese,
      gp.meaning,
      gp.level,
      ge.source_type,
      1 - (ge.embedding <=> ${embeddingStr}::vector) AS similarity
    FROM grammar_embeddings ge
    JOIN grammar_points gp ON gp.id = ge.grammar_point_id
    WHERE ge.model_id = ${modelId}
    ORDER BY gp.id, similarity DESC
  `;

  // Sort by similarity and limit
  return results
    .sort((a: SearchResult, b: SearchResult) => b.similarity - a.similarity)
    .slice(0, limit);
}

export async function getEmbeddingCount(sql: NeonClient, modelId: string): Promise<number> {
  const [result] = await sql`
    SELECT COUNT(*) as count FROM grammar_embeddings WHERE model_id = ${modelId}
  `;
  return Number(result.count);
}

export async function deleteEmbeddings(sql: NeonClient, modelId: string): Promise<void> {
  await sql`DELETE FROM grammar_embeddings WHERE model_id = ${modelId}`;
}
```

**Step 2: Commit**

```bash
git add src/neon-embeddings.ts
git commit -m "feat: add Neon embedding storage and search operations"
```

---

### Task 11: Grammar Embedding Generator

**Files:**
- Create: `src/embed-grammar.ts`

**Step 1: Create grammar embedding generator**

```typescript
// src/embed-grammar.ts
import { createNeonClient } from "./neon.js";
import { setupEmbeddingsSchema } from "./neon-schema.js";
import { createModelInstance } from "./embeddings/index.js";
import { storeEmbedding, getEmbeddingCount, deleteEmbeddings } from "./neon-embeddings.js";
import type { GrammarEmbeddingSource } from "./neon-embeddings.js";
import ora from "ora";

interface EmbedOptions {
  modelId: string;
  branchUrl?: string;
  force?: boolean;
}

export async function embedGrammarConstructs(options: EmbedOptions): Promise<{
  embedded: number;
  skipped: number;
}> {
  const { modelId, branchUrl, force } = options;
  const spinner = ora("Initializing...").start();

  const sql = createNeonClient(branchUrl);
  const model = createModelInstance({ modelId });

  try {
    // Setup embeddings schema with correct dimensions
    spinner.text = "Setting up embeddings schema...";
    await setupEmbeddingsSchema(sql, model.dimensions);

    // Check existing embeddings
    const existingCount = await getEmbeddingCount(sql, modelId);
    if (existingCount > 0 && !force) {
      spinner.info(`Found ${existingCount} existing embeddings for ${modelId}. Use --force to re-embed.`);
      return { embedded: 0, skipped: existingCount };
    }

    if (force && existingCount > 0) {
      spinner.text = "Deleting existing embeddings...";
      await deleteEmbeddings(sql, modelId);
    }

    // Fetch all grammar points
    spinner.text = "Fetching grammar points...";
    const grammarPoints = await sql`
      SELECT id, slug, japanese, romaji, meaning, formation
      FROM grammar_points
      ORDER BY id
    `;

    // Fetch all examples
    const examples = await sql`
      SELECT grammar_point_id, japanese, english
      FROM examples
      ORDER BY grammar_point_id, id
    `;

    // Group examples by grammar point
    const examplesByGrammar = new Map<number, Array<{ japanese: string; english: string }>>();
    for (const ex of examples) {
      const list = examplesByGrammar.get(ex.grammar_point_id) ?? [];
      list.push({ japanese: ex.japanese, english: ex.english });
      examplesByGrammar.set(ex.grammar_point_id, list);
    }

    // Generate embedding sources
    const sources: GrammarEmbeddingSource[] = [];

    for (const gp of grammarPoints) {
      // Name + meaning
      sources.push({
        grammarPointId: gp.id,
        sourceType: "name_meaning",
        sourceText: `${gp.japanese} - ${gp.meaning}`,
      });

      // Formation (if exists)
      if (gp.formation) {
        sources.push({
          grammarPointId: gp.id,
          sourceType: "formation",
          sourceText: gp.formation,
        });
      }

      // Examples
      const gpExamples = examplesByGrammar.get(gp.id) ?? [];
      for (const ex of gpExamples) {
        sources.push({
          grammarPointId: gp.id,
          sourceType: "example",
          sourceText: ex.japanese,
        });
      }
    }

    // Embed and store
    let embedded = 0;
    const batchSize = 10;

    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);
      spinner.text = `Embedding ${i + batch.length}/${sources.length}...`;

      const texts = batch.map((s) => s.sourceText);
      const embeddings = await model.embedBatch(texts, "document");

      for (let j = 0; j < batch.length; j++) {
        await storeEmbedding(sql, batch[j], modelId, embeddings[j]);
        embedded++;
      }
    }

    spinner.succeed(`Embedded ${embedded} vectors for ${modelId}`);
    return { embedded, skipped: 0 };
  } catch (error) {
    spinner.fail("Embedding failed");
    throw error;
  }
}
```

**Step 2: Commit**

```bash
git add src/embed-grammar.ts
git commit -m "feat: add grammar construct embedding generator"
```

---

### Task 12: Metrics Computation

**Files:**
- Create: `src/metrics.ts`

**Step 1: Implement evaluation metrics**

```typescript
// src/metrics.ts

export interface QueryEvaluation {
  queryId: number;
  expected: Array<{ grammarPointId: number; relevance: number | null }>;
  retrieved: Array<{ grammarPointId: number; similarity: number }>;
  latencyMs: number;
}

// Recall@K: fraction of relevant items found in top K
export function computeRecallAtK(evals: QueryEvaluation[], k: number): number {
  if (evals.length === 0) return 0;

  let totalRecall = 0;
  for (const e of evals) {
    const relevantIds = new Set(e.expected.map((x) => x.grammarPointId));
    const topK = e.retrieved.slice(0, k).map((x) => x.grammarPointId);
    const found = topK.filter((id) => relevantIds.has(id)).length;
    totalRecall += found / relevantIds.size;
  }

  return totalRecall / evals.length;
}

// MRR: Mean Reciprocal Rank
export function computeMRR(evals: QueryEvaluation[]): number {
  if (evals.length === 0) return 0;

  let totalRR = 0;
  for (const e of evals) {
    const relevantIds = new Set(e.expected.map((x) => x.grammarPointId));
    const rank = e.retrieved.findIndex((x) => relevantIds.has(x.grammarPointId));
    if (rank >= 0) {
      totalRR += 1 / (rank + 1);
    }
  }

  return totalRR / evals.length;
}

// Hit@1: did any correct answer land in position 1?
export function computeHitAtK(evals: QueryEvaluation[], k: number): number {
  if (evals.length === 0) return 0;

  let hits = 0;
  for (const e of evals) {
    const relevantIds = new Set(e.expected.map((x) => x.grammarPointId));
    const topK = e.retrieved.slice(0, k).map((x) => x.grammarPointId);
    if (topK.some((id) => relevantIds.has(id))) {
      hits++;
    }
  }

  return hits / evals.length;
}

// NDCG: Normalized Discounted Cumulative Gain (for ranked queries)
export function computeNDCG(evals: QueryEvaluation[], k = 10): number {
  const rankedEvals = evals.filter((e) => e.expected.some((x) => x.relevance !== null));
  if (rankedEvals.length === 0) return 0;

  let totalNDCG = 0;

  for (const e of rankedEvals) {
    const relevanceMap = new Map(
      e.expected.filter((x) => x.relevance !== null).map((x) => [x.grammarPointId, x.relevance!])
    );

    // DCG
    let dcg = 0;
    for (let i = 0; i < Math.min(k, e.retrieved.length); i++) {
      const rel = relevanceMap.get(e.retrieved[i].grammarPointId) ?? 0;
      dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
    }

    // Ideal DCG
    const idealRanking = [...relevanceMap.values()].sort((a, b) => b - a).slice(0, k);
    let idcg = 0;
    for (let i = 0; i < idealRanking.length; i++) {
      idcg += (Math.pow(2, idealRanking[i]) - 1) / Math.log2(i + 2);
    }

    if (idcg > 0) {
      totalNDCG += dcg / idcg;
    }
  }

  return totalNDCG / rankedEvals.length;
}

// Average latency
export function computeAvgLatency(evals: QueryEvaluation[]): number {
  if (evals.length === 0) return 0;
  return evals.reduce((sum, e) => sum + e.latencyMs, 0) / evals.length;
}

// Compute all metrics
export function computeAllMetrics(evals: QueryEvaluation[]): Map<string, number> {
  return new Map([
    ["recall@1", computeRecallAtK(evals, 1)],
    ["recall@3", computeRecallAtK(evals, 3)],
    ["recall@5", computeRecallAtK(evals, 5)],
    ["mrr", computeMRR(evals)],
    ["ndcg", computeNDCG(evals)],
    ["hit@1", computeHitAtK(evals, 1)],
    ["avg_latency_ms", computeAvgLatency(evals)],
  ]);
}
```

**Step 2: Commit**

```bash
git add src/metrics.ts
git commit -m "feat: add benchmark evaluation metrics"
```

---

### Task 13: Benchmark Runner

**Files:**
- Create: `src/benchmark-runner.ts`

**Step 1: Implement benchmark runner**

```typescript
// src/benchmark-runner.ts
import Database from "better-sqlite3";
import { createNeonClient } from "./neon.js";
import { openBenchmarkDatabase, type BenchmarkQuery, type BenchmarkExpected } from "./benchmark-db.js";
import { createModelInstance } from "./embeddings/index.js";
import { searchSimilar } from "./neon-embeddings.js";
import { computeAllMetrics, type QueryEvaluation } from "./metrics.js";
import ora from "ora";

interface RunBenchmarkOptions {
  modelId: string;
  branchUrl?: string;
  branchName: string;
}

interface BenchmarkResult {
  runId: number;
  metrics: Map<string, number>;
  evaluations: QueryEvaluation[];
}

export async function runBenchmark(options: RunBenchmarkOptions): Promise<BenchmarkResult> {
  const { modelId, branchUrl, branchName } = options;
  const spinner = ora("Initializing benchmark...").start();

  const sql = createNeonClient(branchUrl);
  const benchDb = openBenchmarkDatabase();
  const model = createModelInstance({ modelId });

  try {
    // Get or create model record
    let modelRecord = benchDb
      .prepare("SELECT id FROM embedding_models WHERE model_id = ?")
      .get(modelId) as { id: number } | undefined;

    if (!modelRecord) {
      const result = benchDb
        .prepare("INSERT INTO embedding_models (provider, model_id, dimensions) VALUES (?, ?, ?)")
        .run(model.provider, modelId, model.dimensions);
      modelRecord = { id: Number(result.lastInsertRowid) };
    }

    // Load benchmark queries
    spinner.text = "Loading benchmark queries...";
    const queries = benchDb
      .prepare(`
        SELECT id, query_text, query_language, target_language, difficulty, is_ranked
        FROM benchmark_queries
      `)
      .all() as Array<{
        id: number;
        query_text: string;
        query_language: string;
        target_language: string;
        difficulty: string;
        is_ranked: number;
      }>;

    if (queries.length === 0) {
      spinner.warn("No benchmark queries found. Add queries first.");
      return { runId: 0, metrics: new Map(), evaluations: [] };
    }

    // Load expected results
    const expectedMap = new Map<number, Array<{ grammarPointId: number; relevance: number | null }>>();
    const allExpected = benchDb
      .prepare("SELECT query_id, grammar_point_id, relevance_score FROM benchmark_expected")
      .all() as Array<{ query_id: number; grammar_point_id: number; relevance_score: number | null }>;

    for (const exp of allExpected) {
      const list = expectedMap.get(exp.query_id) ?? [];
      list.push({ grammarPointId: exp.grammar_point_id, relevance: exp.relevance_score });
      expectedMap.set(exp.query_id, list);
    }

    // Run evaluations
    const evaluations: QueryEvaluation[] = [];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      spinner.text = `Evaluating query ${i + 1}/${queries.length}...`;

      const expected = expectedMap.get(query.id) ?? [];

      // Embed query and measure latency
      const startTime = performance.now();
      const queryEmbedding = await model.embed(query.query_text, "query");
      const latencyMs = performance.now() - startTime;

      // Search for similar
      const results = await searchSimilar(sql, queryEmbedding, modelId, 10);

      evaluations.push({
        queryId: query.id,
        expected,
        retrieved: results.map((r) => ({
          grammarPointId: r.grammarPointId,
          similarity: r.similarity,
        })),
        latencyMs,
      });
    }

    // Compute metrics
    spinner.text = "Computing metrics...";
    const metrics = computeAllMetrics(evaluations);

    // Store run
    const runResult = benchDb
      .prepare("INSERT INTO benchmark_runs (model_id, branch_name, latency_avg_ms) VALUES (?, ?, ?)")
      .run(modelRecord.id, branchName, metrics.get("avg_latency_ms") ?? null);

    const runId = Number(runResult.lastInsertRowid);

    // Store metrics
    const insertMetric = benchDb.prepare(
      "INSERT INTO benchmark_metrics (run_id, metric_name, value) VALUES (?, ?, ?)"
    );

    for (const [name, value] of metrics) {
      insertMetric.run(runId, name, value);
    }

    spinner.succeed(`Benchmark complete. Run ID: ${runId}`);
    return { runId, metrics, evaluations };
  } finally {
    benchDb.close();
  }
}
```

**Step 2: Commit**

```bash
git add src/benchmark-runner.ts
git commit -m "feat: add benchmark runner"
```

---

## Phase 4: CLI

### Task 14: CLI Entry Point

**Files:**
- Create: `src/cli.ts`

**Step 1: Create CLI with Commander**

```typescript
// src/cli.ts
import { Command } from "commander";
import pc from "picocolors";
import Table from "cli-table3";
import { embedGrammarConstructs } from "./embed-grammar.js";
import { runBenchmark } from "./benchmark-runner.js";
import { migrateGrammarToNeon } from "./migrate-to-neon.js";
import { openBenchmarkDatabase } from "./benchmark-db.js";
import { MODEL_REGISTRY } from "./embeddings/types.js";
import { initProject } from "./commands/init.js";
import { destroyProject } from "./commands/destroy.js";
import { showStatus } from "./commands/status.js";
import { listBranches, createBranch, deleteBranch } from "./commands/branch.js";

const BANNER = `
╭──────────────────────────────────────────────╮
│   ┌─┐┌┬┐┌┐ ┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐  ┬ ┬┬  ┌┬┐      │
│   ├┤ │││├┴┐├┤  ││ │││││││ ┬  │ ││   ││      │
│   └─┘┴ ┴└─┘└─┘─┴┘─┴┘┴┘└┘└─┘  └─┘┴─┘─┴┘      │
│          f o r   l a n g u a g e   d e s i g n│
╰──────────────────────────────────────────────╯
`;

const program = new Command();

program
  .name("embedding4ld")
  .description("Embedding benchmark for multi-linguistic grammar retrieval")
  .version("1.0.0")
  .hook("preAction", () => {
    console.log(pc.cyan(BANNER));
  });

// ─────────────────────────────────────────────
// Project lifecycle commands
// ─────────────────────────────────────────────

program
  .command("init")
  .description("Create Neon project and store credentials in ~/.embedding_test")
  .requiredOption("-k, --api-key <key>", "Neon API key (from console.neon.tech)")
  .option("-n, --name <name>", "Project name", "embedding-benchmark")
  .option("-f, --force", "Reinitialize even if already configured")
  .action(async (opts) => {
    await initProject({
      apiKey: opts.apiKey,
      projectName: opts.name,
      force: opts.force,
    });
  });

program
  .command("destroy")
  .description("Delete Neon project and remove ~/.embedding_test")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (opts) => {
    await destroyProject({ force: opts.force });
  });

program
  .command("status")
  .description("Show current configuration and Neon branches")
  .action(async () => {
    await showStatus();
  });

// ─────────────────────────────────────────────
// Branch management commands
// ─────────────────────────────────────────────

const branchCmd = program
  .command("branch")
  .description("Manage Neon branches");

branchCmd
  .command("list")
  .description("List all branches")
  .action(async () => {
    await listBranches();
  });

branchCmd
  .command("create <name>")
  .description("Create a new branch")
  .option("-p, --parent <branch>", "Parent branch name", "main")
  .action(async (name: string, opts) => {
    await createBranch(name, { parent: opts.parent });
  });

branchCmd
  .command("delete <name>")
  .description("Delete a branch")
  .action(async (name: string) => {
    await deleteBranch(name);
  });

// ─────────────────────────────────────────────
// Data commands
// ─────────────────────────────────────────────

program
  .command("migrate")
  .description("Migrate grammar data from SQLite to Neon")
  .action(async () => {
    await migrateGrammarToNeon();
  });

program
  .command("embed <model>")
  .description("Embed all grammar constructs for a model")
  .option("-b, --branch <name>", "Neon branch name", "main")
  .option("-f, --force", "Re-embed even if vectors exist")
  .action(async (modelId: string, opts) => {
    const result = await embedGrammarConstructs({
      modelId,
      force: opts.force,
    });
    console.log(pc.green(`\n✿ Embedded: ${result.embedded}`));
    if (result.skipped > 0) {
      console.log(pc.yellow(`  Skipped: ${result.skipped}`));
    }
  });

program
  .command("benchmark <model>")
  .description("Run benchmark queries against a model")
  .option("-b, --branch <name>", "Neon branch name", "main")
  .action(async (modelId: string, opts) => {
    const result = await runBenchmark({
      modelId,
      branchName: opts.branch,
    });

    if (result.runId === 0) return;

    console.log(pc.cyan("\n╭────────────────────────────────────────╮"));
    console.log(pc.cyan("│  ") + pc.bold("benchmark results") + pc.cyan("                     │"));
    console.log(pc.cyan("╰────────────────────────────────────────╯\n"));

    const table = new Table({
      head: [pc.bold("metric"), pc.bold("value")],
      style: { head: [], border: [] },
    });

    const formatMetric = (name: string, value: number): string => {
      if (name.includes("latency")) return `${value.toFixed(1)}ms`;
      return value.toFixed(3);
    };

    for (const [name, value] of result.metrics) {
      const bar = name.includes("latency")
        ? ""
        : " " + pc.green("█".repeat(Math.round(value * 20)));
      table.push([name, formatMetric(name, value) + bar]);
    }

    console.log(table.toString());
  });

program
  .command("list-models")
  .description("List available embedding models")
  .action(() => {
    const table = new Table({
      head: [pc.bold("model"), pc.bold("provider"), pc.bold("dims")],
      style: { head: [], border: [] },
    });

    for (const [modelId, info] of Object.entries(MODEL_REGISTRY)) {
      table.push([modelId, info.provider, info.dimensions.toString()]);
    }

    console.log(table.toString());
  });

program
  .command("list-runs")
  .description("List benchmark runs")
  .option("-m, --model <model>", "Filter by model")
  .action((opts) => {
    const db = openBenchmarkDatabase();

    let query = `
      SELECT r.id, m.model_id, r.branch_name, r.run_at, r.latency_avg_ms
      FROM benchmark_runs r
      JOIN embedding_models m ON m.id = r.model_id
    `;

    if (opts.model) {
      query += ` WHERE m.model_id = ?`;
    }

    query += " ORDER BY r.run_at DESC LIMIT 20";

    const runs = opts.model
      ? db.prepare(query).all(opts.model)
      : db.prepare(query).all();

    const table = new Table({
      head: [pc.bold("id"), pc.bold("model"), pc.bold("branch"), pc.bold("date"), pc.bold("latency")],
      style: { head: [], border: [] },
    });

    for (const run of runs as any[]) {
      table.push([
        run.id,
        run.model_id,
        run.branch_name,
        run.run_at,
        run.latency_avg_ms ? `${run.latency_avg_ms.toFixed(1)}ms` : "-",
      ]);
    }

    console.log(table.toString());
    db.close();
  });

program.parse();
```

**Step 2: Update package.json**

Add to scripts:
```json
"cli": "tsx src/cli.ts"
```

Add bin field:
```json
"bin": {
  "embedding4ld": "./dist/cli.js"
}
```

**Step 3: Commit**

```bash
git add src/cli.ts package.json
git commit -m "feat: add CLI with embed, benchmark, and list commands"
```

---

### Task 15: Add Seed Benchmark Queries

**Files:**
- Create: `src/seed-queries.ts`

**Step 1: Create seed script with example queries**

```typescript
// src/seed-queries.ts
import { openBenchmarkDatabase } from "./benchmark-db.js";

interface SeedQuery {
  queryText: string;
  queryLanguage: string;
  targetLanguage: string;
  difficulty: "direct" | "descriptive" | "situational" | "adversarial";
  isRanked: boolean;
  expected: Array<{ grammarPointId: number; relevance?: number }>;
}

// Sample queries for Japanese conditionals
// Grammar point IDs reference Neon grammar_points table
const SEED_QUERIES: SeedQuery[] = [
  // Direct queries (use grammatical terminology)
  {
    queryText: "What is the conditional form in Japanese?",
    queryLanguage: "en",
    targetLanguage: "ja",
    difficulty: "direct",
    isRanked: false,
    expected: [
      { grammarPointId: 1 }, // と
      { grammarPointId: 2 }, // ば
      { grammarPointId: 3 }, // たら
      { grammarPointId: 4 }, // なら
    ],
  },
  // Descriptive queries (describe meaning without jargon)
  {
    queryText: "How do I say 'if it rains tomorrow' in Japanese?",
    queryLanguage: "en",
    targetLanguage: "ja",
    difficulty: "descriptive",
    isRanked: true,
    expected: [
      { grammarPointId: 3, relevance: 3 }, // たら - best for hypothetical future
      { grammarPointId: 2, relevance: 2 }, // ば
      { grammarPointId: 1, relevance: 1 }, // と
    ],
  },
  // Situational queries (contextual, no explicit grammar mention)
  {
    queryText: "I want to tell my friend what happens when I press this button",
    queryLanguage: "en",
    targetLanguage: "ja",
    difficulty: "situational",
    isRanked: true,
    expected: [
      { grammarPointId: 1, relevance: 3 }, // と - natural result
      { grammarPointId: 2, relevance: 2 }, // ば
    ],
  },
];

export function seedBenchmarkQueries(): void {
  const db = openBenchmarkDatabase();

  const insertQuery = db.prepare(`
    INSERT INTO benchmark_queries (query_text, query_language, target_language, difficulty, is_ranked)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertExpected = db.prepare(`
    INSERT INTO benchmark_expected (query_id, grammar_point_id, relevance_score)
    VALUES (?, ?, ?)
  `);

  db.transaction(() => {
    for (const q of SEED_QUERIES) {
      const result = insertQuery.run(
        q.queryText,
        q.queryLanguage,
        q.targetLanguage,
        q.difficulty,
        q.isRanked ? 1 : 0
      );

      const queryId = Number(result.lastInsertRowid);

      for (const exp of q.expected) {
        insertExpected.run(queryId, exp.grammarPointId, exp.relevance ?? null);
      }
    }
  })();

  console.log(`Seeded ${SEED_QUERIES.length} benchmark queries`);
  db.close();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedBenchmarkQueries();
}
```

**Step 2: Add script to package.json**

Add to scripts:
```json
"seed:queries": "tsx src/seed-queries.ts"
```

**Step 3: Commit**

```bash
git add src/seed-queries.ts package.json
git commit -m "feat: add seed script for benchmark queries"
```

---

## Phase 5: Integration Testing

### Task 16: End-to-End Test Script

**Files:**
- Create: `src/test-e2e.ts`

**Step 1: Create end-to-end test**

```typescript
// src/test-e2e.ts
import { createNeonClient } from "./neon.js";
import { openBenchmarkDatabase } from "./benchmark-db.js";
import { createModelInstance, MODEL_REGISTRY } from "./embeddings/index.js";
import { searchSimilar, getEmbeddingCount } from "./neon-embeddings.js";
import pc from "picocolors";

async function runE2ETest(): Promise<void> {
  console.log(pc.cyan("\n🧪 Running end-to-end test...\n"));

  // 1. Test Neon connection
  console.log(pc.yellow("1. Testing Neon connection..."));
  const sql = createNeonClient();
  const [result] = await sql`SELECT 1 as test`;
  console.log(pc.green("   ✓ Neon connection OK"));

  // 2. Test grammar data exists
  console.log(pc.yellow("2. Checking grammar data..."));
  const [countResult] = await sql`SELECT COUNT(*) as count FROM grammar_points`;
  console.log(pc.green(`   ✓ Found ${countResult.count} grammar points`));

  // 3. Test SQLite benchmark DB
  console.log(pc.yellow("3. Testing benchmark database..."));
  const benchDb = openBenchmarkDatabase();
  const queryCount = benchDb.prepare("SELECT COUNT(*) as count FROM benchmark_queries").get() as {
    count: number;
  };
  console.log(pc.green(`   ✓ Found ${queryCount.count} benchmark queries`));
  benchDb.close();

  // 4. Test embedding model
  console.log(pc.yellow("4. Testing embedding model..."));
  const modelId = "multilingual-e5-large";
  const model = createModelInstance({ modelId });
  const testEmbedding = await model.embed("test query", "query");
  console.log(pc.green(`   ✓ Generated embedding with ${testEmbedding.length} dimensions`));

  // 5. Test embedding count
  console.log(pc.yellow("5. Checking embeddings in Neon..."));
  const embeddingCount = await getEmbeddingCount(sql, modelId);
  console.log(pc.green(`   ✓ Found ${embeddingCount} embeddings for ${modelId}`));

  // 6. Test vector search (if embeddings exist)
  if (embeddingCount > 0) {
    console.log(pc.yellow("6. Testing vector search..."));
    const results = await searchSimilar(sql, testEmbedding, modelId, 3);
    console.log(pc.green(`   ✓ Search returned ${results.length} results`));
    for (const r of results) {
      console.log(pc.dim(`      - ${r.japanese} (${r.meaning}): ${r.similarity.toFixed(3)}`));
    }
  }

  console.log(pc.cyan("\n✨ All tests passed!\n"));
}

runE2ETest().catch((error) => {
  console.error(pc.red("\n❌ Test failed:"), error.message);
  process.exit(1);
});
```

**Step 2: Add script to package.json**

Add to scripts:
```json
"test:e2e": "tsx src/test-e2e.ts"
```

**Step 3: Commit**

```bash
git add src/test-e2e.ts package.json
git commit -m "feat: add end-to-end test script"
```

---

## Summary: Getting Started

After implementing all tasks, the workflow is:

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your Neon and HuggingFace credentials

# 2. Migrate grammar data to Neon
pnpm cli migrate

# 3. Seed benchmark queries
pnpm seed:queries

# 4. Embed grammar constructs
pnpm cli embed multilingual-e5-large

# 5. Run benchmark
pnpm cli benchmark multilingual-e5-large

# 6. Compare models (after embedding more)
pnpm cli embed LaBSE
pnpm cli benchmark LaBSE
pnpm cli list-runs
```

---

## Deferred: Admin UI

The SvelteKit admin UI is deferred to a separate plan. Core functionality works via CLI.
