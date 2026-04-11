# Creative Gallery Overhaul — Channel-Based Version Cards

> **Scope:** Pure frontend. No pipeline changes. Restructures how composed creatives are displayed inside CampaignWorkspace's existing PersonaSection panels.
>
> **Phase 2 (separate spec):** Stage 4 channel-native visual generation — archetype selection considers channel culture (LinkedIn = editorial, TikTok = UGC-adjacent, etc.)

## Goal

Replace the flat creative grid inside each CampaignWorkspace PersonaSection with a structured hierarchy: **Channel Tabs > Toggle Dropdown Version Cards > Format Thumbnails at True Aspect Ratios**. This mirrors how professional designers organize deliverables (channel folders → version folders → aspect ratio variants) and eliminates the "dump of thumbnails" problem.

After this ships:

- Creatives are grouped by channel (Meta, LinkedIn, TikTok, etc.) via tabs
- Within each channel, creatives are grouped into version cards (V1, V2, V3...) by unique creative direction
- Each version card is a toggle dropdown — collapsed by default, expands to reveal format thumbnails
- Format thumbnails display at true aspect ratios (1:1 feed, 9:16 story, 4:5 carousel) at 200px height baseline
- Multiple version cards can be expanded simultaneously for comparison
- Only channels with actual generated creatives appear as tabs (no empty tabs)
- Variable format count per channel (Meta = 3 formats, Telegram = 1 format)

## What Changes vs What Stays

### Stays the same (untouched)
- PersonaSection header (avatar, name, demographics)
- Collapsible panels: Demographics, Psychographics, Channel Targeting, Actor Photos, Ad Messaging
- `groupByPersona()` function — still the outer grouping layer
- CreativeEditorModal — clicking a thumbnail still opens the full detail/edit view
- `toChannel()` in `src/lib/platforms.tsx` — reused for channel normalization

### Changes
- The creative grid at the bottom of each PersonaSection is replaced with the new Channel Tabs + Version Cards component
- Platform icon row (current channel filter) removed — replaced by proper tab bar
- Flat 6-column grid removed — replaced by version card dropdowns with format rows

---

## § 1 — Channel Definitions

### 1.1 Channel → Platform → Format Mapping

A new `CHANNEL_DEFINITIONS` constant defines how platforms roll up into channel tabs:

```typescript
const CHANNEL_DEFINITIONS: Record<string, ChannelDef> = {
  "Meta": {
    platforms: ["ig_feed", "ig_story", "ig_carousel", "facebook_feed", "facebook_stories"],
    formats: [
      { key: "feed", label: "Feed", ratio: "1:1", width: 1080, height: 1080 },
      { key: "story", label: "Story", ratio: "9:16", width: 1080, height: 1920 },
      { key: "carousel", label: "Carousel", ratio: "4:5", width: 1080, height: 1350 },
    ],
    color: "#E1306C",
  },
  "LinkedIn": {
    platforms: ["linkedin_feed", "linkedin_carousel"],
    formats: [
      { key: "feed", label: "Feed", ratio: "1.91:1", width: 1200, height: 627 },
      { key: "carousel_square", label: "Carousel 1:1", ratio: "1:1", width: 1080, height: 1080 },
      { key: "carousel_portrait", label: "Carousel 4:5", ratio: "4:5", width: 1080, height: 1350 },
      { key: "carousel_landscape", label: "Carousel 1.91:1", ratio: "1.91:1", width: 1200, height: 627 },
    ],
    color: "#0A66C2",
  },
  "TikTok": {
    platforms: ["tiktok_feed", "tiktok_carousel"],
    formats: [
      { key: "feed", label: "Feed", ratio: "9:16", width: 1080, height: 1920 },
      { key: "carousel", label: "Carousel", ratio: "9:16", width: 1080, height: 1920 },
    ],
    color: "#000000",
  },
  "Telegram": {
    platforms: ["telegram_card"],
    formats: [
      { key: "card", label: "Card", ratio: "16:9", width: 1280, height: 720 },
    ],
    color: "#229ED9",
  },
  "WhatsApp": {
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
  "WeChat": {
    platforms: ["wechat_moments", "wechat_channels", "wechat_carousel"],
    formats: [
      { key: "moments", label: "Moments", ratio: "1:1", width: 1080, height: 1080 },
      { key: "channels", label: "Channels", ratio: "9:16", width: 1080, height: 1920 },
      { key: "carousel", label: "Carousel", ratio: "1:1", width: 1080, height: 1080 },
    ],
    color: "#07C160",
  },
  "Google": {
    platforms: ["google_display"],
    formats: [
      { key: "display", label: "Display", ratio: "1.91:1", width: 1200, height: 628 },
    ],
    color: "#4285F4",
  },
  "Reddit": {
    platforms: ["reddit_post"],
    formats: [
      { key: "post", label: "Post", ratio: "16:9", width: 1200, height: 675 },
    ],
    color: "#FF4500",
  },
  "Indeed": {
    platforms: ["indeed_banner"],
    formats: [
      { key: "banner", label: "Banner", ratio: "1.91:1", width: 1200, height: 628 },
    ],
    color: "#003A9B",
  },
};
```

### 1.2 Active Channel Detection

Only channels with at least one generated creative appear as tabs:

```typescript
function getActiveChannels(assets: GeneratedAsset[]): string[] {
  const activePlatforms = new Set(assets.map(a => a.platform));
  return Object.entries(CHANNEL_DEFINITIONS)
    .filter(([_, def]) => def.platforms.some(p => activePlatforms.has(p)))
    .map(([name]) => name);
}
```

---

## § 2 — Creative Version Grouping

### 2.1 What Defines a Version

A "version" is a unique creative direction within a channel. Creatives are grouped into versions by the combination of `(actor_name + pillar)` from the asset's `content` JSONB. Creatives with the same actor and pillar but different platforms/formats within the same channel are treated as format variants of the same version.

```typescript
function groupCreativesByVersion(
  assets: GeneratedAsset[],
  channelDef: ChannelDef,
): VersionGroup[] {
  // Filter assets to this channel's platforms
  const channelAssets = assets.filter(a =>
    channelDef.platforms.includes(a.platform)
  );

  // Group by (actor_name + pillar) — each unique combo = one version
  const groups = new Map<string, GeneratedAsset[]>();
  for (const asset of channelAssets) {
    const content = asset.content || {};
    const key = `${content.actor_name || "unknown"}::${content.pillar || "earn"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(asset);
  }

  // Convert to VersionGroup array, sorted by creation order, labeled V1, V2...
  return Array.from(groups.entries())
    .sort((a, b) => {
      const aTime = Math.min(...a[1].map(x => new Date(x.created_at).getTime()));
      const bTime = Math.min(...b[1].map(x => new Date(x.created_at).getTime()));
      return aTime - bTime;
    })
    .map(([key, assets], idx) => {
      const content = assets[0].content || {};
      const headline = content.overlay_headline || content.headline || "";
      const avgScore = assets.reduce((sum, a) => sum + (a.evaluation_score || 0), 0) / assets.length;

      return {
        versionLabel: `V${idx + 1}`,
        headline,
        archetype: content.archetype || "",
        pillar: content.pillar || "earn",
        actorName: content.actor_name || "",
        avgVqaScore: avgScore,
        formatCount: new Set(assets.map(a => a.platform)).size,
        assets,
      };
    });
}
```

### 2.2 VersionGroup Type

```typescript
interface VersionGroup {
  versionLabel: string;           // "V1", "V2", "V3"...
  headline: string;               // Primary headline of this creative direction
  archetype: string;              // "floating_props" | "gradient_hero" | "photo_feature"
  pillar: string;                 // "earn" | "grow" | "shape"
  actorName: string;              // Actor name for reference
  avgVqaScore: number;            // Average VQA score across formats
  formatCount: number;            // Number of distinct formats in this version
  assets: GeneratedAsset[];       // All format variants
}
```

### 2.3 Format Matching Within a Version

To display format thumbnails in the correct order within a version card, each asset is matched to its format definition by platform key:

```typescript
function getFormatForAsset(asset: GeneratedAsset, channelDef: ChannelDef): FormatDef | null {
  // Match by platform → format mapping
  const platform = asset.platform;
  if (platform.includes("story") || platform.includes("whatsapp")) {
    return channelDef.formats.find(f => f.key === "story" || f.key === "channels");
  }
  if (platform.includes("carousel")) {
    // Use asset dimensions to distinguish carousel aspect ratios
    return channelDef.formats.find(f => f.key.includes("carousel")) || null;
  }
  return channelDef.formats.find(f => f.key === "feed" || f.key === "post" || f.key === "card" || f.key === "display" || f.key === "banner" || f.key === "moments");
}
```

---

## § 3 — Channel Tab Bar Component

### 3.1 Visual Design

- Horizontal tab bar below the persona section's existing collapsible panels
- Each tab shows the channel's color dot + channel name
- Active tab has purple text + purple bottom border (2px)
- Inactive tabs have gray text, no border
- Only tabs for channels with assets (no empty tabs)
- Tab order follows a priority list: Meta → LinkedIn → TikTok → Telegram → WhatsApp → X/Twitter → Reddit → WeChat → Google → Indeed

### 3.2 State

- `activeChannel: string` — which channel tab is selected, defaults to first active channel
- State lives in the PersonaSection component (per-persona, not global)

---

## § 4 — Version Card Component

### 4.1 Collapsed State (Default)

A single-row card showing:
- **V badge** (36x36px, rounded-10px, gradient background matching creative's dominant color, white bold text "V1")
- **Headline** (15px, font-weight 600, dark text)
- **Subtitle** (12px, gray) — "{archetype_label} · {pillar} pillar · {format_count} formats"
- **VQA score badge** — green (>=0.85), amber (0.70-0.84), red (<0.70)
- **Chevron** (▾) pointing down, gray

Border: 1px solid #E5E5E5, border-radius: 16px, background: white.
Hover: subtle box-shadow `0 2px 8px rgba(0,0,0,0.06)`.

### 4.2 Expanded State

On click, the card expands to reveal:
- **Border** changes to 1px solid #6B21A8 (purple highlight)
- **Box-shadow** `0 2px 12px rgba(107,33,168,0.08)` (purple tint)
- **Chevron** rotates 180deg (pointing up)
- **Action buttons** appear in the header: "Export for Figma" (btn-primary pill) + "Download All" (btn-secondary pill)
- **Format row** appears below the header with a top border separator

### 4.3 Format Row

- Horizontal flex layout, `gap: 24px`, `align-items: flex-end` (bottom-aligned)
- Background: `#fafafa`, padding: 24px
- Each format thumbnail:
  - **True aspect ratio** at 200px height baseline — Feed 1:1 = 200x200px, Story 9:16 = 113x200px, Carousel 4:5 = 160x200px, Landscape 1.91:1 = 382x200px
  - `border-radius: 12px`, `overflow: hidden`, `box-shadow: 0 4px 16px rgba(0,0,0,0.1)`
  - Hover: `transform: scale(1.02)` with 0.15s transition
  - Click: opens CreativeEditorModal (existing)
  - **Format label** below (12px, font-weight 600, dark text)
  - **Dimensions** below label (11px, gray) — "1080 × 1080"
- If asset has a `blob_url`, render `<img>` with `object-fit: cover`
- If no `blob_url`, render placeholder gradient

### 4.4 Toggle Behavior

- Each version card toggles independently (NOT accordion — multiple can be open)
- State: `expandedVersions: Set<string>` per channel tab
- Animated expand/collapse with CSS transition (max-height or similar)
- All collapsed by default when switching channel tabs

---

## § 5 — Integration with CampaignWorkspace

### 5.1 Where It Lives

Inside `CampaignWorkspace.tsx` > `PersonaSection` component. The existing creative grid (currently lines ~600-867 in PersonaSection) is replaced with:

```
<ChannelTabBar> → <VersionCardList> → <VersionCard> → <FormatRow>
```

### 5.2 New Components

| Component | File | Purpose |
|-----------|------|---------|
| `ChannelCreativeGallery` | `src/components/creative-gallery/ChannelCreativeGallery.tsx` | Top-level: tab bar + version list. Receives persona's assets. |
| `ChannelTabBar` | `src/components/creative-gallery/ChannelTabBar.tsx` | Horizontal tab bar. Emits `onChannelChange`. |
| `VersionCard` | `src/components/creative-gallery/VersionCard.tsx` | Toggle dropdown card. Collapsed header + expanded format row. |
| `FormatThumbnail` | `src/components/creative-gallery/FormatThumbnail.tsx` | Single format preview at true aspect ratio. Click → editor modal. |

### 5.3 Data Constants

| Constant | File | Purpose |
|----------|------|---------|
| `CHANNEL_DEFINITIONS` | `src/lib/channels.ts` | Channel → platform → format mapping |
| `CHANNEL_ORDER` | `src/lib/channels.ts` | Priority order for tab display |
| `groupCreativesByVersion()` | `src/lib/channels.ts` | Group assets into version cards |
| `getActiveChannels()` | `src/lib/channels.ts` | Filter to channels with assets |

### 5.4 Modified Files

| File | Change |
|------|--------|
| `src/components/CampaignWorkspace.tsx` | Replace creative grid in PersonaSection with `<ChannelCreativeGallery>` |

### 5.5 Unchanged Files

| File | Why |
|------|-----|
| `src/lib/platforms.tsx` | `toChannel()` still used elsewhere. New `CHANNEL_DEFINITIONS` is a superset. |
| `src/components/CreativeHtmlEditor.tsx` | Editor modal opens on thumbnail click, no changes needed. |
| `src/components/recruiter/` | Recruiter workspace has its own creative display — separate redesign if needed. |

---

## § 6 — Archetype Label Mapping

For display in version card subtitles:

```typescript
const ARCHETYPE_LABELS: Record<string, string> = {
  floating_props: "Floating Props",
  gradient_hero: "Gradient Hero",
  photo_feature: "Photo Feature",
};
```

Pillar labels: capitalize first letter ("earn" → "Earn").

---

## § 7 — VQA Score Display

Score badge in version card header:

| Score Range | Background | Text Color | Label |
|-------------|-----------|------------|-------|
| >= 0.85 | `#f0fdf4` | `#16a34a` | `{score} VQA` |
| 0.70 - 0.84 | `#fefce8` | `#d97706` | `{score} VQA` |
| < 0.70 | `#fef2f2` | `#dc2626` | `{score} VQA` |

Score is the average VQA score across all format variants in the version.

---

## § 8 — Success Criteria

1. **Channel tabs appear** inside each PersonaSection when creatives exist
2. **Only active channels shown** — no empty tabs
3. **Version cards render** with correct grouping (same actor + pillar = same V card)
4. **Toggle expand/collapse works** — independent per card, no accordion
5. **Format thumbnails display at true aspect ratios** — visually distinct feed vs story vs carousel
6. **Clicking a thumbnail opens CreativeEditorModal** — existing behavior preserved
7. **Export for Figma / Download All buttons work** — trigger existing export routes
8. **Switching channel tabs resets expanded state** — all collapsed on tab change
9. **Variable format count** — Meta shows 3, Telegram shows 1, LinkedIn shows up to 4

---

## § 9 — Explicitly Not In Scope

- **Pipeline changes** — Stage 4 archetype selection stays the same. Channel-native visuals are Phase 2.
- **Recruiter workspace** — Has its own creative display component. Separate redesign.
- **New database columns** — Version grouping is computed from existing `content` JSONB fields.
- **Drag-and-drop reordering** — Version order is by creation time. Manual reorder is future work.
- **Batch approval** — Approve/reject per version is future work. Currently per-asset via existing modal.
