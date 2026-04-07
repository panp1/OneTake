/**
 * Convert arbitrary text to a URL-safe slug.
 * - lowercases
 * - replaces any run of non-alphanumeric chars with a single hyphen
 * - trims leading/trailing hyphens
 * - truncates to maxLen (default 60)
 * - returns empty string for empty/all-non-alphanumeric input
 */
export function slugify(input: string, maxLen = 60): string {
  if (typeof input !== 'string') return '';
  const lowered = input.toLowerCase();
  // Normalize unicode (strip accents): á → a
  const normalized = lowered.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  // Replace any run of non-alphanumeric with a single hyphen
  const dashed = normalized.replace(/[^a-z0-9]+/g, '-');
  // Trim leading/trailing hyphens
  const trimmed = dashed.replace(/^-+/, '').replace(/-+$/, '');
  // Truncate, then re-trim trailing hyphen in case the cut landed on one
  return trimmed.slice(0, maxLen).replace(/-+$/, '');
}
