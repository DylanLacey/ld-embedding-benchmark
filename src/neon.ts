// src/neon.ts
// Neon serverless client — where database connections happen
import { neon, neonConfig } from "@neondatabase/serverless";
import { readConfig } from "./paths.js";

// Enable connection pooling — keeps those database connections cosy and reusable
neonConfig.fetchConnectionCache = true;

export type NeonClient = ReturnType<typeof neon>;

/**
 * Creates a Neon serverless client.
 *
 * @param databaseUrl - The connection URL. If not provided, reads from stored config.
 *
 * @example
 * ```typescript
 * // With explicit URL (preferred - pass from unified config)
 * const sql = createNeonClient(config.databaseUrl);
 *
 * // Without URL (falls back to stored user config)
 * const sql = createNeonClient();
 * ```
 */
export function createNeonClient(databaseUrl?: string): NeonClient {
  // If no URL provided, fall back to stored user config
  const url = databaseUrl ?? readConfig().databaseUrl;

  if (!url) {
    throw new Error(
      "No database URL available. Provide via --database-url, DATABASE_URL env var, or run 'embedding4ld init'."
    );
  }

  return neon(url);
}

/**
 * Derives a branch-specific URL from a base database URL.
 * Swaps the endpoint ID in the hostname with the branch's endpoint.
 *
 * @param branchId - The branch endpoint ID (e.g., "cool-forest-12345678")
 * @param baseUrl - The base database URL. If not provided, reads from stored config.
 * @returns The connection URL for the specified branch
 */
export function deriveBranchUrl(branchId: string, baseUrl?: string): string {
  const url = baseUrl ?? readConfig().databaseUrl;

  if (!url) {
    throw new Error("No database URL configured.");
  }

  // Format: postgresql://user:pass@ep-xxx.region.neon.tech/db
  // Branch: postgresql://user:pass@ep-yyy.region.neon.tech/db
  const parsed = new URL(url);
  const hostParts = parsed.hostname.split(".");
  hostParts[0] = `ep-${branchId}`;
  parsed.hostname = hostParts.join(".");
  return parsed.toString();
}
