import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import JSZip from "jszip";
import { buildFrameName } from "@/lib/figma-client";

/**
 * Figma Package Export — generates a ZIP of all composed creatives
 * organized by persona/version with the Nova naming convention.
 *
 * Folder structure:
 *   {PersonaName}/V{N}_{Headline}/Nova_{Persona}_V{N}_{platform}_{dims}.png
 *
 * Used by the FigmaExportButton component to give designers a
 * pre-organized package ready for Figma import.
 */

interface AssetRow {
  id: string;
  platform: string;
  format: string;
  blob_url: string;
  content: Record<string, string | number | undefined>;
}

interface BriefPersona {
  persona_name?: string;
  archetype_key?: string;
  actor_name?: string;
  name?: string;
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
  content: Record<string, string | number | undefined>,
  platform: string,
): { width: number; height: number } {
  // Try content metadata first
  if (content.width && content.height) {
    return {
      width: Number(content.width),
      height: Number(content.height),
    };
  }
  // Then try format string like "1080x1920"
  const match = /^(\d+)x(\d+)$/i.exec(String(format ?? "").trim());
  if (match) {
    return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
  }
  // Then try platform lookup
  if (platform && PLATFORM_DIMS[platform]) {
    return PLATFORM_DIMS[platform];
  }
  return { width: 1080, height: 1080 };
}

/** Sanitize a string for use as a filename/folder name. */
function safeName(str: string, maxLen = 50): string {
  return str
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/ +/g, "_")
    .slice(0, maxLen);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;

  try {
    const sql = getDb();

    // ── Fetch composed creatives ──────────────────────────────────
    const assets = (await sql`
      SELECT id, platform, format, blob_url, content
      FROM generated_assets
      WHERE request_id = ${requestId}
        AND asset_type = 'composed_creative'
        AND blob_url IS NOT NULL
      ORDER BY created_at
    `) as AssetRow[];

    if (assets.length === 0) {
      return Response.json({ error: "No creatives found" }, { status: 404 });
    }

    // ── Fetch brief for persona names ─────────────────────────────
    const briefs = await sql`
      SELECT brief_data FROM creative_briefs
      WHERE request_id = ${requestId}
      ORDER BY version DESC LIMIT 1
    `;
    const briefData = (briefs[0]?.brief_data || {}) as Record<string, unknown>;
    const personas = (briefData.personas || []) as BriefPersona[];

    // ── Group assets: persona → version (actor_name::pillar) ──────
    // Same cross-channel grouping logic as DesignerGallery
    const groups = new Map<string, Map<string, AssetRow[]>>();

    for (const asset of assets) {
      const c = asset.content || {};
      const personaKey = String(
        c.persona || (c.actor_name ? String(c.actor_name).split(" ")[0] : "Unknown"),
      );
      const pillar = String(c.pillar || "earn");
      const versionKey = `${String(c.actor_name || "unknown")}::${pillar}`;

      if (!groups.has(personaKey)) groups.set(personaKey, new Map());
      const personaGroup = groups.get(personaKey)!;
      if (!personaGroup.has(versionKey)) personaGroup.set(versionKey, []);
      personaGroup.get(versionKey)!.push(asset);
    }

    // ── Build ZIP ─────────────────────────────────────────────────
    const zip = new JSZip();
    let totalFiles = 0;

    for (const [personaKey, versions] of groups) {
      // Find the full persona name from the brief
      const matchedPersona = personas.find(
        (p) =>
          p.archetype_key === personaKey ||
          p.persona_name?.split(" ")[0] === personaKey ||
          p.actor_name?.split(" ")[0] === personaKey,
      );
      const personaFolderName = safeName(
        matchedPersona?.persona_name || personaKey,
      );

      const personaFolder = zip.folder(personaFolderName)!;
      let vIdx = 1;

      for (const [, versionAssets] of versions) {
        const firstContent = versionAssets[0].content || {};
        const headline = safeName(
          String(
            firstContent.overlay_headline ||
              firstContent.headline ||
              "Untitled",
          ),
          40,
        );
        const versionFolder = personaFolder.folder(`V${vIdx}_${headline}`)!;

        for (const asset of versionAssets) {
          const platform = asset.platform || "unknown";
          const { width, height } = parseDimensions(
            asset.format,
            asset.content || {},
            platform,
          );

          // Build filename using Nova naming convention
          const filename = buildFrameName({
            persona: personaKey,
            version: `V${vIdx}`,
            platform,
            width,
            height,
          }) + ".png";

          // Download the PNG from blob storage
          try {
            const res = await fetch(asset.blob_url, {
              signal: AbortSignal.timeout(10_000),
            });
            if (res.ok) {
              const buffer = await res.arrayBuffer();
              versionFolder.file(filename, buffer);
              totalFiles++;
            }
          } catch {
            // Skip failed downloads — don't break the whole ZIP
            console.warn(
              `[figma-package] Failed to download asset ${asset.id} from ${asset.blob_url}`,
            );
          }
        }

        vIdx++;
      }
    }

    console.log(
      `[figma-package] Built ZIP for request ${requestId}: ${totalFiles} files from ${assets.length} assets`,
    );

    // ── Generate + return ZIP ─────────────────────────────────────
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    // Use campaign slug for the download filename
    const slug =
      (briefData.campaign_slug as string) || requestId.slice(0, 8);

    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}-figma-package.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[figma-package] Failed to generate export:", error);
    return Response.json(
      { error: "Failed to generate Figma package" },
      { status: 500 },
    );
  }
}
