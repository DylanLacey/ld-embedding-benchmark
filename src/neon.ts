// src/neon.ts
import { neon, neonConfig } from "@neondatabase/serverless";
import { getNeonConfig } from "./config.js";

// Enable connection pooling — keeps those database connections cosy and reusable
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

/**
 * Derives a branch-specific URL from the main database URL.
 * Swaps the endpoint ID in the hostname with the branch's endpoint.
 *
 * @param branchId - The branch endpoint ID (e.g., "cool-forest-12345678")
 * @returns The connection URL for the specified branch
 */
export function getBranchUrl(branchId: string): string {
  const config = getNeonConfig();
  if (!config.databaseUrl) {
    throw new Error("No database URL configured.");
  }
  // Format: postgresql://user:pass@ep-xxx.region.neon.tech/db
  // Branch: postgresql://user:pass@ep-yyy.region.neon.tech/db
  const url = new URL(config.databaseUrl);
  const hostParts = url.hostname.split(".");
  hostParts[0] = `ep-${branchId}`;
  url.hostname = hostParts.join(".");
  return url.toString();
}
