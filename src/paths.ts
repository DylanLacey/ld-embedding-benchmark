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
  try {
    return JSON.parse(content);
  } catch {
    // Corrupted config? Start fresh, quietly.
    return {};
  }
}

export function writeConfig(config: StoredConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function deleteConfigDir(): void {
  if (fs.existsSync(CONFIG_DIR)) {
    fs.rmSync(CONFIG_DIR, { recursive: true });
  }
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}
