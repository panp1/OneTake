/**
 * Normalize any value (including JSON objects) to human-readable text.
 * Used across all frontend components to prevent raw JSON from rendering.
 */

/**
 * Convert any value to a readable string. Handles:
 * - Strings → returned as-is
 * - Numbers/booleans → stringified
 * - Arrays → joined with commas
 * - Objects → key-value pairs formatted as "Key: value"
 * - Nested objects → flattened with dot notation
 * - null/undefined → fallback string
 */
export function toReadable(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (Array.isArray(value)) {
    return value.map((v) => toReadable(v, "")).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];

    for (const [key, val] of Object.entries(obj)) {
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      if (typeof val === "string") {
        parts.push(`${label}: ${val}`);
      } else if (typeof val === "number") {
        parts.push(`${label}: ${val}`);
      } else if (typeof val === "boolean") {
        parts.push(`${label}: ${val ? "Yes" : "No"}`);
      } else if (Array.isArray(val)) {
        parts.push(`${label}: ${val.join(", ")}`);
      } else if (val && typeof val === "object") {
        // One level deep — don't recurse forever
        const inner = Object.entries(val as Record<string, unknown>)
          .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v ?? "")}`)
          .join(", ");
        parts.push(`${label}: ${inner}`);
      }
    }

    return parts.join(" · ");
  }

  return String(value);
}

/**
 * Format a snake_case or camelCase key into a human-readable label.
 * "outfit_key" → "Outfit Key"
 * "targetVolume" → "Target Volume"
 */
export function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Safely extract a readable string from a content/metadata JSONB field.
 * Commonly used for asset.content fields like composition, shot_type, etc.
 */
export function extractField(
  obj: unknown,
  field: string,
  fallback = ""
): string {
  if (!obj || typeof obj !== "object") return fallback;
  const val = (obj as Record<string, unknown>)[field];
  return toReadable(val, fallback);
}
