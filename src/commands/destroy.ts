// src/commands/destroy.ts
// The great unmaking — delete project, obliterate config, scatter atoms to the void

import readline from "node:readline";
import ora from "ora";
import pc from "picocolors";
import { deleteNeonProject } from "../neon-api.js";
import { configExists, deleteConfigDir, readConfig } from "../paths.js";

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

export async function destroyProject(options: {
	force?: boolean;
}): Promise<void> {
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
		console.log(
			pc.dim(
				`  • Delete Neon project: ${config.neonProjectName} (${config.neonProjectId})`,
			),
		);
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
