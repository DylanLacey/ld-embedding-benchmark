// src/commands/branch.ts
// Branch management CLI commands — the arborist's toolkit
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
