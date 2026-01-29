// src/neon-api.ts
import { readConfig } from "./paths.js";

const NEON_API_BASE = "https://console.neon.tech/api/v2";

// ─────────────────────────────────────────────────────────────────
// Types — exported for consumers who want to inspect response shapes
// ─────────────────────────────────────────────────────────────────

export interface NeonProject {
  id: string;
  name: string;
  created_at: string;
}

export interface NeonBranch {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
}

export interface NeonEndpoint {
  id: string;
  host: string;
  branch_id: string;
}

export interface NeonConnectionUri {
  connection_uri: string;
}

// ─────────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────────

export async function neonFetch<T>(
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

  return response.json() as Promise<T>;
}

// ─────────────────────────────────────────────────────────────────
// Project operations
// ─────────────────────────────────────────────────────────────────

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

export async function deleteNeonProject(
  apiKey: string,
  projectId: string
): Promise<void> {
  await neonFetch(apiKey, `/projects/${projectId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────────────────────────────
// Branch operations
// ─────────────────────────────────────────────────────────────────

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
  const branchSpec: { name: string; parent_id?: string } = { name };
  if (parentBranchId) {
    branchSpec.parent_id = parentBranchId;
  }

  const result = await neonFetch<{
    branch: NeonBranch;
    connection_uris: NeonConnectionUri[];
  }>(apiKey, `/projects/${projectId}/branches`, {
    method: "POST",
    body: JSON.stringify({
      branch: branchSpec,
      endpoints: [{ type: "read_write" }],
    }),
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

// ─────────────────────────────────────────────────────────────────
// Connection URI retrieval
// ─────────────────────────────────────────────────────────────────

export async function getBranchConnectionUri(
  apiKey: string,
  projectId: string,
  branchId: string
): Promise<string> {
  // First, find an endpoint for this branch
  const endpoints = await neonFetch<{ endpoints: NeonEndpoint[] }>(
    apiKey,
    `/projects/${projectId}/branches/${branchId}/endpoints`
  );

  const endpoint = endpoints.endpoints[0];
  if (!endpoint) {
    throw new Error(`No endpoint found for branch ${branchId}`);
  }

  // Then fetch the connection URI for that endpoint
  const result = await neonFetch<{ uri: string }>(
    apiKey,
    `/projects/${projectId}/connection_uri?branch_id=${branchId}&endpoint_id=${endpoint.id}&database_name=neondb&role_name=neondb_owner`
  );

  return result.uri;
}

// ─────────────────────────────────────────────────────────────────
// Config helpers — throw helpful errors when credentials are missing
// ─────────────────────────────────────────────────────────────────

export function getApiKey(): string {
  const config = readConfig();
  if (!config.neonApiKey) {
    throw new Error("Neon API key not found. Run 'embedding4ld init' first.");
  }
  return config.neonApiKey;
}

export function getProjectId(): string {
  const config = readConfig();
  if (!config.neonProjectId) {
    throw new Error("Neon project not found. Run 'embedding4ld init' first.");
  }
  return config.neonProjectId;
}
