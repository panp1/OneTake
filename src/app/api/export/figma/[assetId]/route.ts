import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

const ROLE_LABEL: Record<string, string> = {
  background: "Background",
  accent_blobs: "Accent Blobs",
  divider: "Divider",
  actor_photo: "Actor Photo",
  headline: "Headline",
  subheadline: "Subheadline",
  cta: "CTA Button",
  social_proof: "Social Proof",
  logo: "Logo",
};

interface LayerManifestEntry {
  z: number;
  role: string;
  artifact_id?: string;
}

interface AssetContent {
  creative_html?: string;
  html_url?: string;
  layer_manifest?: LayerManifestEntry[];
  actor_name?: string;
  pillar?: string;
  archetype?: string;
}

interface GeneratedAsset {
  id: string;
  platform: string;
  format: string;
  blob_url: string | null;
  content: AssetContent;
}

async function inlineImages(html: string): Promise<string> {
  const urlPattern = /https:\/\/[^\s"'`)>]+/g;
  const urls = new Set<string>();

  // Collect all https URLs in src= and url() contexts
  const srcPattern = /src=["']?(https:\/\/[^\s"'`>]+)["']?/gi;
  const urlFnPattern = /url\(["']?(https:\/\/[^\s"'`)]+)["']?\)/gi;

  let match: RegExpExecArray | null;
  while ((match = srcPattern.exec(html)) !== null) urls.add(match[1]);
  while ((match = urlFnPattern.exec(html)) !== null) urls.add(match[1]);

  // Unused — suppress lint warning
  void urlPattern;

  const replacements = new Map<string, string>();

  await Promise.allSettled(
    Array.from(urls).map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        replacements.set(url, `data:${contentType};base64,${base64}`);
      } catch {
        // Leave original URL in place if fetch fails
      }
    })
  );

  let result = html;
  for (const [original, dataUri] of replacements) {
    // Escape special regex chars in URL
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), dataUri);
  }

  return result;
}

function parseDimensions(format: string): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/i.exec(format?.trim() ?? "");
  if (match) {
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  }
  return { width: 1080, height: 1080 };
}

function buildLayerGroups(manifest: LayerManifestEntry[]): string {
  if (!manifest?.length) return "";
  const sorted = [...manifest].sort((a, b) => a.z - b.z);
  return sorted
    .map((entry) => {
      const label = ROLE_LABEL[entry.role] ?? entry.role;
      const artifactPart = entry.artifact_id ? ` (${entry.artifact_id})` : "";
      const safeRole = entry.role.replace(/[^a-zA-Z0-9_-]/g, "_");
      return `  <g id="layer-${entry.z}-${safeRole}" inkscape:label="z${entry.z}: ${label}${artifactPart}"></g>`;
    })
    .join("\n");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId } = await params;

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

  // Get HTML — inline first, then Blob URL
  let html: string | null = null;

  if (content.creative_html) {
    html = content.creative_html;
  } else if (content.html_url) {
    try {
      const res = await fetch(content.html_url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        html = await res.text();
      }
    } catch (error) {
      console.error("[api/export/figma] Failed to fetch html_url:", error);
    }
  }

  if (!html) {
    return Response.json(
      { error: "No HTML content available for this asset" },
      { status: 422 }
    );
  }

  // Inline all external images as base64 data URIs
  const inlinedHtml = await inlineImages(html);

  const { width, height } = parseDimensions(asset.format);
  const layerGroups = buildLayerGroups(content.layer_manifest ?? []);

  const actorName = content.actor_name ?? "Unknown";
  const pillar = content.pillar ?? "Unknown";
  const archetype = content.archetype ?? "Unknown";
  const platform = asset.platform ?? "Unknown";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     viewBox="0 0 ${width} ${height}"
     width="${width}"
     height="${height}">
  <title>Creative — ${actorName} — ${pillar}</title>
  <desc>Archetype: ${archetype}, Platform: ${platform}</desc>

  <g id="full-creative" inkscape:label="Full Creative (HTML)">
    <foreignObject x="0" y="0" width="${width}" height="${height}">
      <div xmlns="http://www.w3.org/1999/xhtml">
        ${inlinedHtml}
      </div>
    </foreignObject>
  </g>

${layerGroups}
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="creative-${assetId}.svg"`,
      "Cache-Control": "no-store",
    },
  });
}
