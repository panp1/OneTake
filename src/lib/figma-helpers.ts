/**
 * Figma frame name helpers — PURE functions, safe for client + server.
 *
 * No `figma-api` import — this module can be imported from "use client" components.
 * For Figma API calls, use `@/lib/figma-client` (server-only).
 */

// ── Frame Name Convention ────────────────────────────────────
// Nova_{PersonaFirstName}_{Version}_{Platform}_{Width}x{Height}
// Example: Nova_Maria_V1_ig_feed_1080x1080

export interface NovaFrameRouting {
  persona: string;
  version: string;
  platform: string;
  width: number;
  height: number;
}

/**
 * Parse a Figma frame name into routing metadata.
 * Returns null if the name doesn't match the Nova convention.
 */
export function parseFrameName(name: string): NovaFrameRouting | null {
  const match = /^Nova_(\w+)_(V\d+)_([a-z_]+)_(\d+)x(\d+)$/.exec(name);
  if (!match) return null;
  return {
    persona: match[1],
    version: match[2],
    platform: match[3],
    width: parseInt(match[4], 10),
    height: parseInt(match[5], 10),
  };
}

/**
 * Build a Nova frame name from routing metadata.
 */
export function buildFrameName(routing: NovaFrameRouting): string {
  return `Nova_${routing.persona}_${routing.version}_${routing.platform}_${routing.width}x${routing.height}`;
}

/**
 * Extract the file key from a Figma URL.
 * Supports: https://www.figma.com/file/KEY/Name and https://www.figma.com/design/KEY/Name
 */
export function extractFileKey(url: string): string | null {
  const match = /figma\.com\/(file|design)\/([a-zA-Z0-9]+)/.exec(url);
  return match ? match[2] : null;
}
