/**
 * GSC Client — fetches search query data.
 *
 * GSC data comes via the seo-ai MCP server or direct API.
 * This module provides query functions for search performance data.
 * Currently returns data from a local cache pattern.
 */

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Fetch top search queries. In Phase 3, this uses cached data
 * or calls the SEO MCP on-demand.
 */
export async function getTopQueries(limit: number = 20): Promise<GscQueryRow[]> {
  // GSC data will be populated via the seo-ai MCP server
  // For now, return empty array — the widget shows "No GSC data yet"
  // Once GSC MCP is wired, this will call:
  // mcp__seo-ai__get_keyword_metrics or similar
  return [];
}

export async function getTopPages(limit: number = 20): Promise<GscPageRow[]> {
  return [];
}

export function isGscConnected(): boolean {
  // Will be true once GSC MCP is configured with property access
  return false;
}
