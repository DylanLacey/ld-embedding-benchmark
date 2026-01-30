#!/usr/bin/env node
// src/cli.ts
// The grand conductor — where all modules gather for their orchestral debut
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
import {
	listBranches,
	createBranch,
	deleteBranch,
	getBranchUrl,
} from "./commands/branch.js";
import { loadConfig, requireConfig, type Config } from "./config/index.js";

/**
 * Extracts credential overrides from Commander's global options.
 * Maps kebab-case flags to camelCase config keys.
 * Only includes values that were actually provided (not undefined).
 */
function getCliOverrides(opts: Record<string, unknown>): Partial<Config> {
	const overrides: Partial<Config> = {};

	// Only include keys that were explicitly provided
	if (opts.neonApiKey) overrides.neonApiKey = opts.neonApiKey as string;
	if (opts.neonProjectId) overrides.neonProjectId = opts.neonProjectId as string;
	if (opts.databaseUrl) overrides.databaseUrl = opts.databaseUrl as string;
	if (opts.hfToken) overrides.hfToken = opts.hfToken as string;
	if (opts.openaiApiKey) overrides.openaiApiKey = opts.openaiApiKey as string;
	if (opts.cohereApiKey) overrides.cohereApiKey = opts.cohereApiKey as string;

	return overrides;
}

// ASCII art banner — the herald of computational linguistics
const BANNER = `
${pc.cyan("╭──────────────────────────────────────────────╮")}
${pc.cyan("│")}   ${pc.bold("┌─┐┌┬┐┌┐ ┌─┐┌┬┐┌┬┐┬┌┐┌┌─┐  ┬ ┬┬  ┌┬┐")}      ${pc.cyan("│")}
${pc.cyan("│")}   ${pc.bold("├┤ │││├┴┐├┤  ││ │││││││ ┬  │ ││   ││")}      ${pc.cyan("│")}
${pc.cyan("│")}   ${pc.bold("└─┘┴ ┴└─┘└─┘─┴┘─┴┘┴┘└┘└─┘  └─┘┴─┘─┴┘")}      ${pc.cyan("│")}
${pc.cyan("│")}          ${pc.dim("f o r   l a n g u a g e   d e s i g n")}${pc.cyan("│")}
${pc.cyan("╰──────────────────────────────────────────────╯")}
`;

const program = new Command();

program
	.name("embedding4ld")
	.description("Embedding benchmark for multi-linguistic grammar retrieval")
	.version("1.0.0")
	// ─────────────────────────────────────────────────────────────
	// Global credential options — available to all commands
	// CLI flags override env vars override config files
	// ─────────────────────────────────────────────────────────────
	.option("--neon-api-key <key>", "Neon API key (overrides NEON_API_KEY)")
	.option("--neon-project-id <id>", "Neon project ID (overrides NEON_PROJECT_ID)")
	.option("--database-url <url>", "Database connection URL (overrides DATABASE_URL)")
	.option("--hf-token <token>", "HuggingFace API token (overrides HF_TOKEN)")
	.option("--openai-api-key <key>", "OpenAI API key (overrides OPENAI_API_KEY)")
	.option("--cohere-api-key <key>", "Cohere API key (overrides COHERE_API_KEY)")
	.hook("preAction", () => {
		console.log(BANNER);
	});

// ─────────────────────────────────────────────────────────────
// init — the genesis
// ─────────────────────────────────────────────────────────────
program
	.command("init")
	.description("Create Neon project and store credentials in ~/.embedding_test")
	.requiredOption(
		"-k, --api-key <key>",
		"Neon API key (from console.neon.tech)",
	)
	.option("-n, --name <name>", "Project name", "embedding-benchmark")
	.option("-f, --force", "Reinitialise even if already configured")
	.action(async (opts) => {
		await initProject({
			apiKey: opts.apiKey,
			projectName: opts.name,
			force: opts.force,
		});
	});

// ─────────────────────────────────────────────────────────────
// destroy — the apocalypse
// ─────────────────────────────────────────────────────────────
program
	.command("destroy")
	.description("Delete Neon project and remove ~/.embedding_test")
	.option("-f, --force", "Skip confirmation prompt")
	.action(async (opts) => {
		await destroyProject({ force: opts.force });
	});

// ─────────────────────────────────────────────────────────────
// status — the observatory
// ─────────────────────────────────────────────────────────────
program
	.command("status")
	.description("Show current configuration and Neon branches")
	.action(async () => {
		await showStatus();
	});

// ─────────────────────────────────────────────────────────────
// branch — the arborist's toolkit
// ─────────────────────────────────────────────────────────────
const branchCmd = program.command("branch").description("Manage Neon branches");

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

// ─────────────────────────────────────────────────────────────
// migrate — the great journey
// ─────────────────────────────────────────────────────────────
program
	.command("migrate")
	.description("Migrate grammar data from SQLite to Neon")
	.action(async () => {
		await migrateGrammarToNeon();
	});

// ─────────────────────────────────────────────────────────────
// embed — the vectorisation ceremony
// ─────────────────────────────────────────────────────────────
program
	.command("embed <model>")
	.description("Embed all grammar constructs for a model")
	.option("-b, --branch <name>", "Neon branch name", "main")
	.option("-f, --force", "Re-embed even if vectors exist")
	.action(async (modelId: string, opts) => {
		// Resolve branch URL if not on main
		const branchUrl =
			opts.branch && opts.branch !== "main"
				? await getBranchUrl(opts.branch)
				: undefined;

		const result = await embedGrammarConstructs({
			modelId,
			...(branchUrl && { branchUrl }),
			force: opts.force,
		});

		console.log(pc.green(`\n✿ Embedded: ${result.embedded}`));
		if (result.skipped > 0) {
			console.log(pc.yellow(`  Skipped: ${result.skipped}`));
		}
	});

// ─────────────────────────────────────────────────────────────
// benchmark — the proving grounds
// ─────────────────────────────────────────────────────────────
program
	.command("benchmark <model>")
	.description("Run benchmark queries against a model")
	.option("-b, --branch <name>", "Neon branch name", "main")
	.action(async (modelId: string, opts) => {
		// Resolve branch URL if not on main
		const branchUrl =
			opts.branch && opts.branch !== "main"
				? await getBranchUrl(opts.branch)
				: undefined;

		const result = await runBenchmark({
			modelId,
			...(branchUrl && { branchUrl }),
			branchName: opts.branch,
		});

		if (result.runId === 0) return;

		console.log(pc.cyan("\n╭────────────────────────────────────────╮"));
		console.log(
			pc.cyan("│  ") + pc.bold("benchmark results") + pc.cyan("                     │"),
		);
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

// ─────────────────────────────────────────────────────────────
// list-models — the bestiary
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// list-runs — the archive
// ─────────────────────────────────────────────────────────────
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
			query += " WHERE m.model_id = ?";
		}

		query += " ORDER BY r.run_at DESC LIMIT 20";

		const runs = opts.model
			? (db.prepare(query).all(opts.model) as Array<{
					id: number;
					model_id: string;
					branch_name: string;
					run_at: string;
					latency_avg_ms: number | null;
				}>)
			: (db.prepare(query).all() as Array<{
					id: number;
					model_id: string;
					branch_name: string;
					run_at: string;
					latency_avg_ms: number | null;
				}>);

		const table = new Table({
			head: [
				pc.bold("id"),
				pc.bold("model"),
				pc.bold("branch"),
				pc.bold("date"),
				pc.bold("latency"),
			],
			style: { head: [], border: [] },
		});

		for (const run of runs) {
			table.push([
				run.id.toString(),
				run.model_id,
				run.branch_name,
				run.run_at,
				run.latency_avg_ms !== null ? `${run.latency_avg_ms.toFixed(1)}ms` : "-",
			]);
		}

		console.log(table.toString());
		db.close();
	});

// Parse and run — the ignition
program.parse();
