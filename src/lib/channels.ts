/**
 * Channel definitions, format mapping, and version grouping logic
 * for the creative gallery. Maps platforms → channels → formats.
 */

import type { GeneratedAsset } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────

export interface FormatDef {
  key: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

export interface ChannelDef {
  platforms: string[];
  formats: FormatDef[];
  color: string;
}

export interface VersionGroup {
  versionLabel: string;
  headline: string;
  archetype: string;
  pillar: string;
  actorName: string;
  avgVqaScore: number;
  formatCount: number;
  assets: GeneratedAsset[];
}

// ── Channel Definitions ────────────────────────────────────────

export const CHANNEL_DEFINITIONS: Record<string, ChannelDef> = {
  Meta: {
    platforms: [
      "ig_feed", "ig_story", "ig_carousel",
      "facebook_feed", "facebook_stories",
    ],
    formats: [
      { key: "feed", label: "Feed", ratio: "1:1", width: 1080, height: 1080 },
      { key: "story", label: "Story", ratio: "9:16", width: 1080, height: 1920 },
      { key: "carousel", label: "Carousel", ratio: "4:5", width: 1080, height: 1350 },
    ],
    color: "#E1306C",
  },
  LinkedIn: {
    platforms: ["linkedin_feed", "linkedin_carousel"],
    formats: [
      { key: "feed", label: "Feed", ratio: "1.91:1", width: 1200, height: 627 },
      { key: "carousel_square", label: "Carousel 1:1", ratio: "1:1", width: 1080, height: 1080 },
      { key: "carousel_portrait", label: "Carousel 4:5", ratio: "4:5", width: 1080, height: 1350 },
      { key: "carousel_landscape", label: "Carousel 1.91:1", ratio: "1.91:1", width: 1200, height: 627 },
    ],
    color: "#0A66C2",
  },
  TikTok: {
    platforms: ["tiktok_feed", "tiktok_carousel"],
    formats: [
      { key: "feed", label: "Feed", ratio: "9:16", width: 1080, height: 1920 },
      { key: "carousel", label: "Carousel", ratio: "9:16", width: 1080, height: 1920 },
    ],
    color: "#000000",
  },
  Telegram: {
    platforms: ["telegram_card"],
    formats: [
      { key: "card", label: "Card", ratio: "16:9", width: 1280, height: 720 },
    ],
    color: "#229ED9",
  },
  WhatsApp: {
    platforms: ["whatsapp_story"],
    formats: [
      { key: "story", label: "Story", ratio: "9:16", width: 1080, height: 1920 },
    ],
    color: "#25D366",
  },
  "X / Twitter": {
    platforms: ["twitter_post"],
    formats: [
      { key: "post", label: "Post", ratio: "16:9", width: 1200, height: 675 },
    ],
    color: "#1DA1F2",
  },
  WeChat: {
    platforms: ["wechat_moments", "wechat_channels", "wechat_carousel"],
    formats: [
      { key: "moments", label: "Moments", ratio: "1:1", width: 1080, height: 1080 },
      { key: "channels", label: "Channels", ratio: "9:16", width: 1080, height: 1920 },
      { key: "carousel", label: "Carousel", ratio: "1:1", width: 1080, height: 1080 },
    ],
    color: "#07C160",
  },
  Google: {
    platforms: ["google_display"],
    formats: [
      { key: "display", label: "Display", ratio: "1.91:1", width: 1200, height: 628 },
    ],
    color: "#4285F4",
  },
  Reddit: {
    platforms: ["reddit_post"],
    formats: [
      { key: "post", label: "Post", ratio: "16:9", width: 1200, height: 675 },
    ],
    color: "#FF4500",
  },
  Indeed: {
    platforms: ["indeed_banner"],
    formats: [
      { key: "banner", label: "Banner", ratio: "1.91:1", width: 1200, height: 628 },
    ],
    color: "#003A9B",
  },
};

export const CHANNEL_ORDER = [
  "Meta", "LinkedIn", "TikTok", "Telegram", "WhatsApp",
  "X / Twitter", "Reddit", "WeChat", "Google", "Indeed",
];

// ── Archetype Labels ───────────────────────────────────────────

export const ARCHETYPE_LABELS: Record<string, string> = {
  floating_props: "Floating Props",
  gradient_hero: "Gradient Hero",
  photo_feature: "Photo Feature",
};

// ── Functions ──────────────────────────────────────────────────

/**
 * Get channels that have at least one generated creative.
 * Returns channel names in CHANNEL_ORDER priority.
 */
export function getActiveChannels(assets: GeneratedAsset[]): string[] {
  const activePlatforms = new Set(
    assets
      .filter((a) => a.asset_type === "composed_creative" && a.blob_url)
      .map((a) => a.platform),
  );

  return CHANNEL_ORDER.filter((channelName) => {
    const def = CHANNEL_DEFINITIONS[channelName];
    return def && def.platforms.some((p) => activePlatforms.has(p));
  });
}

/**
 * Group a persona's creatives into version cards for a given channel.
 * Each version = unique (actor_name + pillar) combination.
 * Returns versions sorted by creation time, labeled V1, V2, V3...
 */
export function groupCreativesByVersion(
  assets: GeneratedAsset[],
  channelName: string,
): VersionGroup[] {
  const def = CHANNEL_DEFINITIONS[channelName];
  if (!def) return [];

  const platformSet = new Set(def.platforms);
  const channelAssets = assets.filter(
    (a) =>
      a.asset_type === "composed_creative" &&
      platformSet.has(a.platform),
  );

  if (channelAssets.length === 0) return [];

  // Group by (actor_name + pillar)
  const groups = new Map<string, GeneratedAsset[]>();
  for (const asset of channelAssets) {
    const content = (asset.content || {}) as Record<string, string>;
    const actor = content.actor_name || "unknown";
    const pillar = content.pillar || "earn";
    const key = `${actor}::${pillar}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(asset);
  }

  // Sort by earliest creation time, label V1, V2...
  return Array.from(groups.entries())
    .sort(([, a], [, b]) => {
      const aTime = Math.min(
        ...a.map((x) => new Date(x.created_at).getTime()),
      );
      const bTime = Math.min(
        ...b.map((x) => new Date(x.created_at).getTime()),
      );
      return aTime - bTime;
    })
    .map(([, versionAssets], idx) => {
      const content = (versionAssets[0].content || {}) as Record<string, string>;
      const scores = versionAssets
        .map((a) => a.evaluation_score)
        .filter((s): s is number => s != null && s > 0);
      const avgScore =
        scores.length > 0
          ? scores.reduce((sum, s) => sum + s, 0) / scores.length
          : 0;

      return {
        versionLabel: `V${idx + 1}`,
        headline:
          content.overlay_headline ||
          content.headline ||
          content.overlay_sub ||
          "Untitled",
        archetype: content.archetype || "",
        pillar: content.pillar || "earn",
        actorName: content.actor_name || "",
        avgVqaScore: avgScore,
        formatCount: new Set(versionAssets.map((a) => a.platform)).size,
        assets: versionAssets,
      };
    });
}

/**
 * Compute thumbnail dimensions at a fixed height baseline.
 * Returns {width, height} in pixels preserving the format's aspect ratio.
 */
export function getThumbnailDimensions(
  format: FormatDef,
  heightBaseline: number = 200,
): { width: number; height: number } {
  const ratio = format.width / format.height;
  return {
    width: Math.round(heightBaseline * ratio),
    height: heightBaseline,
  };
}
