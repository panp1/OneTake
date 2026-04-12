import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

/**
 * Figma SVG Export — produces a Figma-compatible SVG with:
 *   1. Rendered PNG as base <image> layer (full creative)
 *   2. Editable SVG <text> elements for headline, subheadline, CTA
 *   3. Named <g> layer groups matching the composition manifest
 *
 * Why not foreignObject? Figma ignores <foreignObject> entirely.
 * This approach gives designers an importable file with editable text
 * layers on top of the rendered visual.
 */

const ROLE_LABEL: Record<string, string> = {
  background: "Background",
  accent_blobs: "Accent Blobs",
  divider: "Divider",
  actor_photo: "Actor Photo",
  floating_badges: "Floating Badges",
  headline: "Headline",
  subheadline: "Subheadline",
  cta: "CTA Button",
  social_proof: "Social Proof",
  badge: "Badge",
  badge_strip: "Badge Strip",
  photo_border: "Photo Border",
  logo: "Logo",
};

interface LayerManifestEntry {
  z: number;
  role: string;
  artifact_id?: string;
  css?: string;
}

interface AssetContent {
  creative_html?: string;
  html_url?: string;
  layer_manifest?: LayerManifestEntry[];
  actor_name?: string;
  pillar?: string;
  archetype?: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
  overlay_headline?: string;
  overlay_sub?: string;
  overlay_cta?: string;
  width?: number;
  height?: number;
}

interface GeneratedAsset {
  id: string;
  platform: string;
  format: string;
  blob_url: string | null;
  content: AssetContent;
}

/** Fetch a remote image and return it as a base64 data URI. */
async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

// Platform → native dimensions lookup (matches worker/ai/compositor.py PLATFORM_SPECS)
const PLATFORM_DIMS: Record<string, { width: number; height: number }> = {
  ig_feed: { width: 1080, height: 1080 },
  ig_story: { width: 1080, height: 1920 },
  ig_carousel: { width: 1080, height: 1350 },
  linkedin_feed: { width: 1200, height: 627 },
  facebook_feed: { width: 1200, height: 628 },
  tiktok_feed: { width: 1080, height: 1920 },
  telegram_card: { width: 1280, height: 720 },
  twitter_post: { width: 1200, height: 675 },
  google_display: { width: 1200, height: 628 },
  indeed_banner: { width: 1200, height: 628 },
  whatsapp_story: { width: 1080, height: 1920 },
  wechat_moments: { width: 1080, height: 1080 },
};

function parseDimensions(
  format: string,
  content: AssetContent,
  platform: string,
): { width: number; height: number } {
  // Try content metadata first
  if (content.width && content.height) {
    return { width: content.width, height: content.height };
  }
  // Then try format string like "1080x1920"
  const match = /^(\d+)x(\d+)$/i.exec(format?.trim() ?? "");
  if (match) {
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  }
  // Then try platform lookup
  if (platform && PLATFORM_DIMS[platform]) {
    return PLATFORM_DIMS[platform];
  }
  return { width: 1080, height: 1080 };
}

/** Escape text for safe XML embedding. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build editable SVG text layers for headline, subheadline, and CTA.
 * Positioned to roughly match typical composition layouts.
 */
function buildTextLayers(
  content: AssetContent,
  width: number,
  height: number,
): string {
  const layers: string[] = [];
  const headline = content.headline || content.overlay_headline || "";
  const sub = content.subheadline || content.overlay_sub || "";
  const cta = content.cta || content.overlay_cta || "";

  const safeMargin = Math.round(width * 0.06);
  const isVertical = height > width;

  // Headline — upper portion of canvas
  if (headline) {
    const headlineY = isVertical ? Math.round(height * 0.15) : Math.round(height * 0.20);
    const fontSize = isVertical ? Math.round(width * 0.065) : Math.round(width * 0.055);
    layers.push(`  <g id="text-headline" data-figma-label="Headline (Editable)">
    <text x="${safeMargin}" y="${headlineY}"
      font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
      font-size="${fontSize}" font-weight="800" fill="#FFFFFF"
      opacity="0.95">
      ${escapeXml(headline)}
    </text>
  </g>`);
  }

  // Subheadline — below headline
  if (sub) {
    const subY = isVertical ? Math.round(height * 0.20) : Math.round(height * 0.28);
    const fontSize = isVertical ? Math.round(width * 0.038) : Math.round(width * 0.032);
    layers.push(`  <g id="text-subheadline" data-figma-label="Subheadline (Editable)">
    <text x="${safeMargin}" y="${subY}"
      font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
      font-size="${fontSize}" font-weight="500" fill="#FFFFFF"
      opacity="0.85">
      ${escapeXml(sub)}
    </text>
  </g>`);
  }

  // CTA — bottom area (but above dead zone)
  if (cta) {
    const ctaY = isVertical ? Math.round(height * 0.55) : Math.round(height * 0.78);
    const ctaX = Math.round(width / 2);
    const fontSize = isVertical ? Math.round(width * 0.04) : Math.round(width * 0.035);
    const pillWidth = Math.max(cta.length * fontSize * 0.65, 160);
    const pillHeight = Math.round(fontSize * 2.4);
    const pillX = ctaX - pillWidth / 2;
    const pillY = ctaY - pillHeight / 2;

    layers.push(`  <g id="text-cta" data-figma-label="CTA Button (Editable)">
    <rect x="${Math.round(pillX)}" y="${Math.round(pillY)}"
      width="${Math.round(pillWidth)}" height="${Math.round(pillHeight)}"
      rx="${Math.round(pillHeight / 2)}" ry="${Math.round(pillHeight / 2)}"
      fill="#E91E8C" />
    <text x="${ctaX}" y="${Math.round(ctaY + fontSize * 0.35)}"
      font-family="-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
      font-size="${fontSize}" font-weight="700" fill="#FFFFFF"
      text-anchor="middle">
      ${escapeXml(cta.toUpperCase())}
    </text>
  </g>`);
  }

  return layers.join("\n\n");
}

/**
 * Build named layer groups from the composition manifest.
 * These are structural placeholders that show up in Figma's layer panel,
 * each containing a labeled rect showing the layer's role and z-index.
 */
function buildLayerGroups(
  manifest: LayerManifestEntry[],
  width: number,
  height: number,
): string {
  if (!manifest?.length) return "";
  const sorted = [...manifest].sort((a, b) => a.z - b.z);

  return sorted
    .map((entry) => {
      const label = ROLE_LABEL[entry.role] ?? entry.role;
      const artifactPart = entry.artifact_id ? ` (${entry.artifact_id})` : "";
      const safeRole = entry.role.replace(/[^a-zA-Z0-9_-]/g, "_");
      const layerId = `layer-z${entry.z}-${safeRole}`;

      // Create a small labeled rect in the top-left so designers can see what each layer is
      const labelY = 20 + entry.z * 18;
      return `  <g id="${layerId}" data-figma-label="z${entry.z}: ${label}${artifactPart}" opacity="0">
    <rect x="4" y="${labelY}" width="200" height="16" rx="3" fill="#6D28D9" opacity="0.7"/>
    <text x="8" y="${labelY + 12}" font-family="monospace" font-size="10" fill="#FFFFFF">z${entry.z}: ${escapeXml(label)}</text>
  </g>`;
    })
    .join("\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId } = await params;

  // Fetch asset from DB
  let asset: GeneratedAsset | null = null;
  try {
    const sql = getDb();
    const rows = (await sql`
      SELECT id, platform, format, blob_url, content
      FROM generated_assets
      WHERE id = ${assetId}
        AND asset_type = 'composed_creative'
      LIMIT 1
    `) as GeneratedAsset[];
    asset = rows[0] ?? null;
  } catch (error) {
    console.error("[api/export/figma] DB fetch failed:", error);
    return Response.json({ error: "Failed to fetch asset" }, { status: 500 });
  }

  if (!asset) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const content: AssetContent = asset.content ?? {};
  const { width, height } = parseDimensions(asset.format, content, asset.platform);

  // Fetch the rendered PNG and convert to base64 for embedding
  let pngDataUri: string | null = null;
  if (asset.blob_url) {
    pngDataUri = await fetchAsBase64(asset.blob_url);
  }

  if (!pngDataUri) {
    return Response.json(
      { error: "No rendered image available for this asset" },
      { status: 422 },
    );
  }

  // Build SVG components
  const textLayers = buildTextLayers(content, width, height);
  const layerGroups = buildLayerGroups(content.layer_manifest ?? [], width, height);

  const actorName = content.actor_name ?? "Unknown";
  const pillar = content.pillar ?? "unknown";
  const archetype = content.archetype ?? "unknown";
  const platform = asset.platform ?? "unknown";
  const headline = content.headline || content.overlay_headline || "Untitled";

  // Clean filename
  const safeName = `${actorName}-${pillar}-${platform}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="0 0 ${width} ${height}"
     width="${width}"
     height="${height}"
     shape-rendering="geometricPrecision"
     text-rendering="optimizeLegibility">
  <title>${escapeXml(headline)} — ${escapeXml(actorName)}</title>
  <desc>Archetype: ${escapeXml(archetype)}, Platform: ${escapeXml(platform)}, Pillar: ${escapeXml(pillar)}</desc>

  <!-- Base layer: full rendered creative as embedded PNG -->
  <g id="base-creative" data-figma-label="Rendered Creative (Base)">
    <image x="0" y="0" width="${width}" height="${height}"
      href="${pngDataUri}"
      preserveAspectRatio="none" />
  </g>

  <!-- Editable text layers (positioned approximately — adjust in Figma) -->
${textLayers}

  <!-- Composition layer manifest (toggle visibility in Figma to see structure) -->
${layerGroups}
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="${safeName}.svg"`,
      "Cache-Control": "no-store",
    },
  });
}
