# Media Strategy Tab Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wall-of-text Media Strategy tab in the marketing view with a country → per-country channel mix → per-channel drill-down layout, matching the approved vertical-slice mockup.

**Architecture:** Client-side derivation only. Extract platform helpers from `CampaignWorkspace.tsx` to a new `src/lib/platforms.tsx`, then build a single focused component `src/components/MediaStrategyTab.tsx` with all sub-components module-level inline. No worker, API, or schema changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, OneForma light theme, Lucide icons. No test framework (this codebase has none) — verification is `tsc --noEmit` + `next build` + manual dev walkthrough.

**Spec:** `docs/superpowers/specs/2026-04-07-media-strategy-tab-design.md`

**Known spec divergence:** The spec called for a fallback when all personas in a country have empty `best_channels` (union of ad-set `placements[]`). This plan simplifies to showing an empty-state message in `ChannelMixBar` instead. Reason: every pipeline run since Apr 3 has populated `best_channels`, so the fallback is dead-code risk. If a future run hits this, add the fallback then.

---

## File Structure

| File | Purpose |
|---|---|
| `src/lib/platforms.tsx` (new) | Platform metadata, `getPlatformMeta`, `PlatformLogo`, `toChannel` — extracted from `CampaignWorkspace.tsx` lines 63-215 and 606-626 |
| `src/components/MediaStrategyTab.tsx` (new) | Default-exported client component with all sub-components module-level inline |
| `src/components/CampaignWorkspace.tsx` (modify) | Import from new `@/lib/platforms`, delete old inline helpers, replace the inline media tab content with `<MediaStrategyTab …>` mount |

Target file sizes after this work:
- `MediaStrategyTab.tsx`: ~750-850 lines (one default export + 10 module-level sub-components + 3 pure helpers)
- `platforms.tsx`: ~180 lines (metadata map + two functions + one logo component)
- `CampaignWorkspace.tsx`: 1660 → ~1440 lines

---

## Task 1: Extract platform helpers to `src/lib/platforms.tsx`

**Why first:** The new component needs `PLATFORM_META`, `getPlatformMeta`, `PlatformLogo`, and a channel normalizer. These currently live inline in `CampaignWorkspace.tsx`. Extracting first lets both files import from one place without any circular dependency.

**Files:**
- Create: `src/lib/platforms.tsx`
- Modify: `src/components/CampaignWorkspace.tsx` (remove inline definitions, add import)

- [ ] **Step 1: Create the new file with the extracted content**

Create `src/lib/platforms.tsx` with this exact content (this is copied verbatim from `CampaignWorkspace.tsx` lines 63-215, plus the `toChannel` helper lifted from lines 606-626 and made module-level, plus an added `TOP_N_CHANNELS` constant for the mix cap):

```tsx
// src/lib/platforms.tsx
// Platform metadata, logos, and channel normalizer.
// Extracted from CampaignWorkspace.tsx so MediaStrategyTab can reuse.

export const TOP_N_CHANNELS = 4;

export const PLATFORM_META: Record<string, { label: string; color: string; brand: string }> = {
  ig_feed: { label: "Instagram", color: "#E1306C", brand: "instagram" },
  instagram_feed: { label: "Instagram", color: "#E1306C", brand: "instagram" },
  ig_story: { label: "IG Stories", color: "#E1306C", brand: "instagram" },
  ig_carousel: { label: "IG Carousel", color: "#E1306C", brand: "instagram" },
  facebook_feed: { label: "Facebook", color: "#1877F2", brand: "facebook" },
  facebook_stories: { label: "FB Stories", color: "#1877F2", brand: "facebook" },
  linkedin_feed: { label: "LinkedIn", color: "#0A66C2", brand: "linkedin" },
  linkedin_carousel: { label: "LI Carousel", color: "#0A66C2", brand: "linkedin" },
  tiktok_feed: { label: "TikTok", color: "#000000", brand: "tiktok" },
  tiktok_carousel: { label: "TT Carousel", color: "#000000", brand: "tiktok" },
  telegram_card: { label: "Telegram", color: "#0088cc", brand: "telegram" },
  twitter_post: { label: "X/Twitter", color: "#1DA1F2", brand: "twitter" },
  wechat_moments: { label: "WeChat", color: "#07C160", brand: "wechat" },
  wechat_carousel: { label: "WC Carousel", color: "#07C160", brand: "wechat" },
  whatsapp_story: { label: "WhatsApp", color: "#25D366", brand: "whatsapp" },
  google_display: { label: "Display", color: "#4285F4", brand: "google" },
  google_search: { label: "Google Search", color: "#4285F4", brand: "google" },
  pinterest_feed: { label: "Pinterest", color: "#E60023", brand: "pinterest" },
  youtube_feed: { label: "YouTube", color: "#FF0000", brand: "youtube" },
  reddit_ads: { label: "Reddit", color: "#FF4500", brand: "reddit" },
  snapchat_feed: { label: "Snapchat", color: "#FFFC00", brand: "snapchat" },
  // Title Case variants (from Stage 3 copy)
  "Facebook Feed": { label: "Facebook", color: "#1877F2", brand: "facebook" },
  "Facebook Groups": { label: "Facebook", color: "#1877F2", brand: "facebook" },
  "Facebook Stories": { label: "Facebook", color: "#1877F2", brand: "facebook" },
  "Instagram Feed": { label: "Instagram", color: "#E1306C", brand: "instagram" },
  "Instagram Stories": { label: "Instagram", color: "#E1306C", brand: "instagram" },
  "LinkedIn Feed": { label: "LinkedIn", color: "#0A66C2", brand: "linkedin" },
  "Google Search": { label: "Google Search", color: "#4285F4", brand: "google" },
  "Reddit Ads": { label: "Reddit", color: "#FF4500", brand: "reddit" },
  "TikTok Feed": { label: "TikTok", color: "#000000", brand: "tiktok" },
  "Telegram Card": { label: "Telegram", color: "#0088cc", brand: "telegram" },
};

export function getPlatformMeta(platform: string) {
  return PLATFORM_META[platform] || { label: platform.replace(/_/g, " "), color: "#6B21A8", brand: "unknown" };
}

/**
 * Normalize any placement/platform string to a canonical channel label.
 * Handles snake_case, Title Case, and stat-suffixed variants like "Facebook Feed (98%)".
 * Returns null for non-ad channels (email, job boards) — caller should filter them out.
 */
export function toChannel(plat: string): string | null {
  const cleaned = plat.replace(/\s*\(.*$/, "").trim();
  const lower = cleaned.toLowerCase().replace(/\s+/g, "_");
  if (lower.includes("email") || lower.includes("university") || lower.includes("job_board")) return null;
  if (lower.includes("instagram") || lower.includes("ig_")) return "Instagram";
  if (lower.includes("facebook") || lower === "fb_feed" || lower === "fb_stories") return "Facebook";
  if (lower.includes("linkedin") || lower === "li_feed" || lower === "li_carousel") return "LinkedIn";
  if (lower.includes("tiktok") || lower === "tt_feed" || lower === "tt_carousel") return "TikTok";
  if (lower.includes("telegram")) return "Telegram";
  if (lower.includes("twitter") || lower.startsWith("x_")) return "X/Twitter";
  if (lower.includes("whatsapp")) return "WhatsApp";
  if (lower.includes("youtube")) return "YouTube";
  if (lower.includes("google") && lower.includes("search")) return "Google Search";
  if (lower.includes("google") && lower.includes("display")) return "Google Display";
  if (lower.includes("pinterest")) return "Pinterest";
  if (lower.includes("reddit")) return "Reddit";
  if (lower.includes("wechat")) return "WeChat";
  if (lower.includes("snapchat")) return "Snapchat";
  return cleaned.split("_")[0].charAt(0).toUpperCase() + cleaned.split("_")[0].slice(1);
}

export function PlatformLogo({ brand, className = "w-5 h-5" }: { brand: string; className?: string }) {
  switch (brand) {
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <defs><linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#FD5" /><stop offset="50%" stopColor="#FF543E" /><stop offset="100%" stopColor="#C837AB" /></linearGradient></defs>
          <rect width="24" height="24" rx="6" fill="url(#ig-grad)" />
          <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="white" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.5" />
          <circle cx="17" cy="7" r="1.2" fill="white" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#1877F2" />
          <path d="M16.5 12.5h-2.5v8h-3v-8H9v-2.5h2v-1.8c0-2 1.2-3.2 3-3.2.9 0 1.5.1 1.5.1v2h-.8c-.8 0-1.2.5-1.2 1.1v1.8h2.5l-.5 2.5z" fill="white" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="4" fill="#0A66C2" />
          <path d="M7 10h2v7H7zm1-3.5a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zM11 10h2v1c.5-.7 1.3-1.2 2.3-1.2 2 0 2.7 1.2 2.7 3.2v4h-2v-3.5c0-1-.4-1.5-1.2-1.5-.9 0-1.5.6-1.5 1.7V17h-2.3V10z" fill="white" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#000" />
          <path d="M16.5 8.5c-.8-.5-1.3-1.4-1.5-2.5h-2v10a2 2 0 11-1.5-1.9V12c-2.2.2-4 2-4 4.2a4.2 4.2 0 007.5 2.3V11c.7.5 1.5.8 2.5.8V9.5c-.4 0-.7-.1-1-.2z" fill="white" />
        </svg>
      );
    case "telegram":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#0088CC" />
          <path d="M6 12l2.5 1.5L10 17l2-3 4 3 3-11-13 6z" fill="white" />
          <path d="M10 17l.5-3 5.5-5" fill="none" stroke="white" strokeWidth=".5" />
        </svg>
      );
    case "twitter":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#000" />
          <path d="M13.5 11L17 7h-1.2l-3 3.4L10.2 7H7l3.7 5.2L7 17h1.2l3.2-3.7 2.8 3.7H17l-3.5-5z" fill="white" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#25D366" />
          <path d="M8 16.5l.8-2.8A5 5 0 1114.5 16L8 16.5z" fill="white" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <rect width="24" height="24" rx="6" fill="#FF0000" />
          <polygon points="10,7 17,12 10,17" fill="white" />
        </svg>
      );
    case "pinterest":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#E60023" />
          <path d="M12 6c-3.3 0-6 2.7-6 6 0 2.5 1.5 4.6 3.6 5.5-.1-.5-.1-1.2 0-1.7l.7-2.8s-.2-.4-.2-.9c0-.8.5-1.4 1.1-1.4.5 0 .8.4.8.9 0 .5-.3 1.3-.5 2-.1.6.3 1.1.9 1.1 1.1 0 2-1.2 2-2.9 0-1.5-1.1-2.5-2.6-2.5-1.8 0-2.8 1.3-2.8 2.7 0 .5.2 1.1.4 1.4.1.1 0 .2 0 .3l-.1.6c0 .1-.1.2-.3.1-.7-.4-1.2-1.4-1.2-2.3 0-1.9 1.4-3.6 4-3.6 2.1 0 3.7 1.5 3.7 3.5 0 2.1-1.3 3.8-3.1 3.8-.6 0-1.2-.3-1.4-.7l-.4 1.5c-.1.5-.4 1.1-.7 1.5.6.2 1.1.3 1.7.3 3.3 0 6-2.7 6-6s-2.7-6-6-6z" fill="white" />
        </svg>
      );
    case "google":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#fff" stroke="#ddd" strokeWidth=".5" />
          <path d="M18.6 12.2H12v2.8h3.8c-.4 1.6-1.8 2.8-3.8 2.8a4.2 4.2 0 010-8.4c1 0 2 .4 2.7 1l2-2a7 7 0 10-4.7 12.2c4 0 7.3-2.8 7.3-7 0-.5 0-.9-.1-1.4z" fill="#4285F4" />
        </svg>
      );
    case "wechat":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#07C160" />
          <ellipse cx="10" cy="11" rx="4.5" ry="3.5" fill="white" />
          <ellipse cx="14.5" cy="14" rx="3.5" ry="2.5" fill="white" opacity=".8" />
        </svg>
      );
    case "reddit":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#FF4500" />
          <circle cx="12" cy="13" r="5" fill="white" />
          <circle cx="10" cy="12.5" r="1" fill="#FF4500" />
          <circle cx="14" cy="12.5" r="1" fill="#FF4500" />
          <circle cx="12" cy="7" r="2" fill="white" />
          <path d="M14 7 L17 4" stroke="white" strokeWidth="1.5" fill="none" />
        </svg>
      );
    case "snapchat":
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#FFFC00" />
          <path d="M12 7c-2 0-3 1.5-3 3v2l-2 .5c0 .5.5 1 1 1-.5 1-1.5 2-1.5 2h11s-1-1-1.5-2c.5 0 1-.5 1-1l-2-.5v-2c0-1.5-1-3-3-3z" fill="white" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle cx="12" cy="12" r="12" fill="#6B21A8" />
          <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{brand.slice(0, 2).toUpperCase()}</text>
        </svg>
      );
  }
}
```

- [ ] **Step 2: Delete the inline definitions in `CampaignWorkspace.tsx` lines 63-215**

Use the Read tool to confirm line numbers, then delete from `// ── Platform metadata ────────────────────────────────────────────────` through the closing brace of `PlatformLogo` (the default case `}`).

- [ ] **Step 3: Add import at the top of `CampaignWorkspace.tsx`**

Right after the `import type { … } from "@/lib/types";` block (currently line 32-36), add:

```tsx
import { PLATFORM_META, getPlatformMeta, PlatformLogo, toChannel, TOP_N_CHANNELS } from "@/lib/platforms";
```

`PLATFORM_META` is imported because the file references it externally in at least one place (it's exported from platforms.tsx so code that previously read the constant still works). `toChannel` and `TOP_N_CHANNELS` are imported now so step 4's cleanup is trivial — we remove the inner function declaration in `channelGroups`.

- [ ] **Step 4: Delete the inner `toChannel` function inside `channelGroups` useMemo**

In `CampaignWorkspace.tsx` find the `channelGroups` `useMemo` (currently around line 604-636). Inside it, the function `function toChannel(plat: string): string | null { … }` is declared inline. Delete that function declaration — it's now imported. Leave the rest of the `useMemo` body unchanged; the reference `toChannel(plat)` on line ~629 will resolve to the import.

- [ ] **Step 5: Verify TypeScript compiles**

Run:
```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors. If TS complains about `PLATFORM_META` being imported but unused, remove `PLATFORM_META` from the import list (only import what's actually referenced).

- [ ] **Step 6: Verify the existing Media Strategy tab still renders unchanged**

Run:
```bash
cd /Users/stevenjunop/centric-intake && npm run dev
```
Open a request with an existing strategy (e.g., the Brazil one `fd318779-45f2-45bb-b0ff-5420c5c10260`), click into the marketing view, click the Media Strategy tab. It should look EXACTLY the same as before this task (we haven't touched the tab yet — only moved helpers). Platform logos should still show. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/lib/platforms.tsx src/components/CampaignWorkspace.tsx
git commit -m "refactor: extract platform helpers to src/lib/platforms.tsx

Prep work for MediaStrategyTab — both files need PLATFORM_META,
getPlatformMeta, PlatformLogo, and toChannel so they live in a shared
lib file instead of inline in CampaignWorkspace.tsx."
```

---

## Task 2: Create `MediaStrategyTab.tsx` skeleton with types and pure helpers

**Why this order:** Build the pure computation layer first. It's the highest-risk piece (channel mix math) and everything else depends on it.

**Files:**
- Create: `src/components/MediaStrategyTab.tsx`

- [ ] **Step 1: Create the file with imports, types, and stub default export**

Create `src/components/MediaStrategyTab.tsx` with this content:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { GeneratedAsset } from "@/lib/types";
import { getPlatformMeta, PlatformLogo, toChannel, TOP_N_CHANNELS } from "@/lib/platforms";

// ── Types ────────────────────────────────────────────────────────────

interface MediaStrategyTabProps {
  strategies: Strategy[];
  assets: GeneratedAsset[];
  briefData: Record<string, any>;
}

interface Strategy {
  id: string;
  country: string;
  tier: number;
  budget_mode: string;
  monthly_budget: number | null;
  strategy_data: StrategyData;
}

interface StrategyData {
  tier?: number;
  monthly_budget?: number | null;
  budget_mode?: string;
  daily_budget_total?: number | null;
  split_test?: { variable?: string; description?: string; measurement?: string };
  campaigns?: Campaign[];
  scaling_rules?: Record<string, string> | string | null;
}

interface Campaign {
  name?: string;
  objective?: string;
  optimization?: string;
  daily_budget?: number | null;
  ad_sets?: AdSet[];
}

interface AdSet {
  name?: string;
  persona_key?: string;
  targeting_type?: "hyper" | "hot" | "broad" | string;
  targeting_tier?: "hyper" | "hot" | "broad" | string;
  interests?: string[];
  demographics?: { age_min?: number; age_max?: number; gender?: string; location?: string | string[] };
  placements?: string[];
  daily_budget?: number | null;
  kill_rule?: string;
  scale_rule?: string;
  creative_assignment_rule?: {
    persona?: string;
    hook_types?: string[];
    treatment?: string;
  };
}

interface Persona {
  archetype_key?: string;
  persona_key?: string;
  best_channels?: string[];
  targeting_profile?: {
    budget_weight_pct?: number;
  };
}

interface ChannelMixEntry {
  channel: string;
  pct: number;
}

interface ChannelBlockData {
  channel: string;
  pct: number;
  monthly: number | null;
  adSets: (AdSet & { _campaign: Campaign })[];
  objectives: string[];
}

// ── Pure helpers ─────────────────────────────────────────────────────

/**
 * Compute the research-driven channel mix for a country.
 * For each persona, distribute its budget_weight_pct evenly across its best_channels,
 * then cap at TOP_N_CHANNELS and renormalize to sum exactly 1.0.
 * Returns [] if no personas have best_channels — caller handles fallback.
 */
export function computeChannelMix(personas: Persona[]): ChannelMixEntry[] {
  const mix: Record<string, number> = {};
  for (const p of personas) {
    const pct = p.targeting_profile?.budget_weight_pct ?? 0;
    const share = pct / 100;
    const channels = p.best_channels ?? [];
    if (channels.length === 0 || share === 0) continue;
    const perChannel = share / channels.length;
    for (const raw of channels) {
      const ch = toChannel(raw);
      if (!ch) continue;
      mix[ch] = (mix[ch] ?? 0) + perChannel;
    }
  }
  const sorted = Object.entries(mix).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, TOP_N_CHANNELS);
  const total = top.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return [];
  return top.map(([channel, v]) => ({ channel, pct: v / total }));
}

/**
 * Group ad sets under the channels they're placed on, limited to the provided set of channels.
 * An ad set with placements [facebook_feed, instagram_feed] appears under both Facebook and Instagram.
 * Each grouped ad set carries a reference to its parent campaign so the per-channel objective is available.
 */
export function groupAdSetsByChannel(
  campaigns: Campaign[],
  topChannels: Set<string>,
): Map<string, (AdSet & { _campaign: Campaign })[]> {
  const result = new Map<string, (AdSet & { _campaign: Campaign })[]>();
  for (const camp of campaigns) {
    const adSets = camp.ad_sets ?? [];
    for (const adSet of adSets) {
      const placements = adSet.placements ?? [];
      const seen = new Set<string>();
      for (const plat of placements) {
        const ch = toChannel(plat);
        if (!ch || !topChannels.has(ch) || seen.has(ch)) continue;
        seen.add(ch);
        if (!result.has(ch)) result.set(ch, []);
        result.get(ch)!.push({ ...adSet, _campaign: camp });
      }
    }
  }
  return result;
}

/**
 * Match composed creatives to an ad set within a specific channel.
 * Filters by persona_key and normalized channel, sorts by VQA score desc.
 */
export function matchCreatives(
  adSet: AdSet,
  assets: GeneratedAsset[],
  channel: string,
): GeneratedAsset[] {
  return assets
    .filter((a) => {
      if (a.asset_type !== "composed_creative") return false;
      const content = (a.content ?? {}) as Record<string, unknown>;
      const personaKey = content.persona_key ?? a.actor_id ?? null;
      if (personaKey !== adSet.persona_key) return false;
      const platRaw = String(content.platform ?? a.platform ?? "");
      const ch = toChannel(platRaw);
      return ch === channel;
    })
    .sort((a, b) => (b.evaluation_score ?? 0) - (a.evaluation_score ?? 0));
}

// ── Component (stub — filled in later tasks) ────────────────────────

export default function MediaStrategyTab({ strategies, assets, briefData }: MediaStrategyTabProps) {
  void assets;
  void briefData;
  if (!strategies || strategies.length === 0) {
    return (
      <p className="text-[13px] text-[var(--muted-foreground)] italic">
        Media strategy hasn&apos;t been generated yet.
      </p>
    );
  }
  return <div className="space-y-4">{/* TODO: build sections in later tasks */}</div>;
}
```

Note: `evaluation_score` is used as the sort key for creatives because that's the actual field on `GeneratedAsset` in `src/lib/types.ts:181`. The spec says "VQA score" — the database column is `evaluation_score`; they're the same thing.

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors. If `GeneratedAsset` type errors out on `content.persona_key`, that's expected — we cast through `Record<string, unknown>` to read the content JSON.

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyTab.tsx
git commit -m "feat(media-strategy): scaffold MediaStrategyTab with pure helpers

computeChannelMix (top-4 renormalized, research-driven from persona
best_channels × budget_weight_pct), groupAdSetsByChannel (dedup per
channel), matchCreatives (persona + channel filter, VQA sort). Component
body is a stub that returns the empty state for now."
```

---

## Task 3: Sanity-check the pure helpers with a throwaway script

**Why:** No test framework exists. A 5-minute throwaway script catches off-by-one mix math and edge cases before we wire up the view. Delete the script after this task.

**Files:**
- Create temporarily: `scripts/verify-media-strategy.mjs` (deleted at end of task)

- [ ] **Step 1: Create the verify script**

Create `scripts/verify-media-strategy.mjs`:

```javascript
// Throwaway verifier for computeChannelMix + groupAdSetsByChannel.
// Run with: node scripts/verify-media-strategy.mjs
// DELETE after verifying.

import { computeChannelMix, groupAdSetsByChannel, matchCreatives } from "../src/components/MediaStrategyTab.tsx";

function assertClose(actual, expected, label) {
  if (Math.abs(actual - expected) > 1e-6) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
  console.log(`OK ${label}`);
}

function assert(cond, label) {
  if (!cond) { console.error(`FAIL ${label}`); process.exit(1); }
  console.log(`OK ${label}`);
}

// Case 1: 3 personas, equal weights, each with 3 unique channels → 9 channels, top 4 renormalized
const case1 = computeChannelMix([
  { targeting_profile: { budget_weight_pct: 33 }, best_channels: ["facebook_feed", "instagram_feed", "tiktok_feed"] },
  { targeting_profile: { budget_weight_pct: 33 }, best_channels: ["linkedin_feed", "twitter_post", "reddit_ads"] },
  { targeting_profile: { budget_weight_pct: 34 }, best_channels: ["whatsapp_story", "telegram_card", "youtube_feed"] },
]);
assert(case1.length === 4, "case1 has 4 channels");
const case1Sum = case1.reduce((s, e) => s + e.pct, 0);
assertClose(case1Sum, 1.0, "case1 sums to 1.0");

// Case 2: overlap — 2 personas share Facebook → Facebook should be the top channel
const case2 = computeChannelMix([
  { targeting_profile: { budget_weight_pct: 50 }, best_channels: ["facebook_feed", "instagram_feed"] },
  { targeting_profile: { budget_weight_pct: 50 }, best_channels: ["facebook_feed", "tiktok_feed"] },
]);
assert(case2[0].channel === "Facebook", "case2 Facebook is top");
assertClose(case2[0].pct, 0.5, "case2 Facebook is 50%");

// Case 3: empty best_channels everywhere → empty array
const case3 = computeChannelMix([
  { targeting_profile: { budget_weight_pct: 100 }, best_channels: [] },
]);
assert(case3.length === 0, "case3 empty");

// Case 4: groupAdSetsByChannel dedup — ad set with [facebook_feed, instagram_feed] appears under both
const campaigns = [{
  name: "Lead Gen",
  objective: "lead_generation",
  ad_sets: [
    { name: "AS1", persona_key: "the_freelancer", placements: ["facebook_feed", "instagram_feed"] },
    { name: "AS2", persona_key: "the_student", placements: ["tiktok_feed"] },
  ],
}];
const grouped = groupAdSetsByChannel(campaigns, new Set(["Facebook", "Instagram", "TikTok"]));
assert(grouped.get("Facebook")?.length === 1, "case4 Facebook has AS1");
assert(grouped.get("Instagram")?.length === 1, "case4 Instagram has AS1 too");
assert(grouped.get("TikTok")?.length === 1, "case4 TikTok has AS2");
assert(grouped.get("Facebook")?.[0]._campaign.objective === "lead_generation", "case4 campaign propagates");

// Case 5: matchCreatives — persona + channel + VQA sort
const assets = [
  { asset_type: "composed_creative", content: { persona_key: "the_freelancer", platform: "facebook_feed" }, evaluation_score: 0.7 },
  { asset_type: "composed_creative", content: { persona_key: "the_freelancer", platform: "facebook_feed" }, evaluation_score: 0.9 },
  { asset_type: "composed_creative", content: { persona_key: "the_student", platform: "facebook_feed" }, evaluation_score: 0.8 },
  { asset_type: "base_image", content: { persona_key: "the_freelancer", platform: "facebook_feed" }, evaluation_score: 1.0 },
];
const matched = matchCreatives({ persona_key: "the_freelancer" }, assets, "Facebook");
assert(matched.length === 2, "case5 count");
assert(matched[0].evaluation_score === 0.9, "case5 VQA sort desc");

console.log("\nAll checks passed.");
```

- [ ] **Step 2: Run the verifier**

Run:
```bash
cd /Users/stevenjunop/centric-intake && npx tsx scripts/verify-media-strategy.mjs
```
Expected output ending with `All checks passed.` and exit code 0.

If `tsx` isn't available, use `node --experimental-strip-types scripts/verify-media-strategy.mjs` (Node 24 supports TS stripping natively). If either approach fails, try adding a top-level `pnpm dlx tsx scripts/verify-media-strategy.mjs`.

If assertions fail:
- `case1 sums to 1.0` failing → the renormalization step at the end of `computeChannelMix` is wrong
- `case2 Facebook is 50%` failing → double-counting or wrong share arithmetic
- `case4 Instagram has AS1 too` failing → the `seen` set in `groupAdSetsByChannel` is wrong (should dedupe per placement, not globally across ad sets)
- `case5 VQA sort desc` failing → sort comparator is backwards

Fix inline and re-run until all pass.

- [ ] **Step 3: Delete the verify script**

Run:
```bash
rm scripts/verify-media-strategy.mjs
```

- [ ] **Step 4: Commit**

Nothing to commit — we only created and deleted the script.

---

## Task 4: Add `CountryTabs` + `CountryHeader` sub-components

**Files:**
- Modify: `src/components/MediaStrategyTab.tsx`

- [ ] **Step 1: Add the two sub-components above the default export**

In `MediaStrategyTab.tsx`, between the `// ── Pure helpers ─` block and the `// ── Component ─` block, add a new section:

```tsx
// ── Sub-components ───────────────────────────────────────────────────

interface CountryTabsProps {
  strategies: Strategy[];
  activeCountry: string;
  onChange: (country: string) => void;
}

function CountryTabs({ strategies, activeCountry, onChange }: CountryTabsProps) {
  return (
    <div className="flex gap-1.5 border-b border-[var(--border)] mb-4 overflow-x-auto">
      {strategies.map((s) => {
        const isActive = s.country === activeCountry;
        const budgetLabel = s.monthly_budget ? `$${Number(s.monthly_budget).toLocaleString()}/mo` : "ratio";
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.country)}
            className={`px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer border-b-2 transition-colors ${
              isActive
                ? "text-[var(--foreground)] border-[rgb(6,147,227)]"
                : "text-[var(--muted-foreground)] border-transparent hover:text-[var(--foreground)]"
            }`}
          >
            {s.country}
            <span className="ml-2 text-[11px] font-normal text-[var(--muted-foreground)]">· {budgetLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

interface CountryHeaderProps {
  strategy: Strategy;
  personaCount: number;
  adSetCount: number;
}

function CountryHeader({ strategy, personaCount, adSetCount }: CountryHeaderProps) {
  const sd = strategy.strategy_data ?? {};
  const isRatio = strategy.budget_mode === "ratio";
  const dailyTotal = sd.daily_budget_total ?? (strategy.monthly_budget ? Math.round(strategy.monthly_budget / 30) : null);
  const splitTest = sd.split_test?.variable;
  return (
    <div className="border border-[var(--border)] rounded-xl bg-white px-6 py-5 mb-4 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div>
        <h2 className="text-[22px] font-bold text-[var(--foreground)] mb-1">{strategy.country}</h2>
        <div className="flex items-center gap-3 text-[12px] text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[rgba(6,147,227,0.1)] text-[rgb(6,147,227)] font-bold text-[11px] uppercase tracking-wider">
            Tier {strategy.tier} · {sd.tier === 1 ? "Interest-only cold" : "Retargeting"}
          </span>
          {splitTest ? <><span className="text-[#ddd]">·</span><span>Split test: <span className="font-semibold text-[var(--foreground)] capitalize">{splitTest}</span></span></> : null}
          <span className="text-[#ddd]">·</span>
          <span>{personaCount} personas · {adSetCount} ad sets</span>
        </div>
      </div>
      <div className="text-right">
        {isRatio ? (
          <div className="text-[14px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Ratio mode</div>
        ) : (
          <>
            <div className="text-[28px] font-extrabold tracking-tight text-[var(--foreground)]">
              ${Number(strategy.monthly_budget ?? 0).toLocaleString()}
              <span className="text-[13px] font-medium text-[var(--muted-foreground)] ml-1">/mo</span>
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)]">
              {dailyTotal ? `$${Number(dailyTotal).toLocaleString()}/day` : ""} · {strategy.budget_mode} mode
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyTab.tsx
git commit -m "feat(media-strategy): add CountryTabs + CountryHeader components"
```

---

## Task 5: Add `ChannelMixBar` sub-component

**Files:**
- Modify: `src/components/MediaStrategyTab.tsx`

- [ ] **Step 1: Add `ChannelMixBar` below `CountryHeader`**

```tsx
interface ChannelMixBarProps {
  mix: ChannelMixEntry[];
  totalMonthly: number | null;
  isRatio: boolean;
}

function ChannelMixBar({ mix, totalMonthly, isRatio }: ChannelMixBarProps) {
  if (mix.length === 0) {
    return (
      <div className="border border-[var(--border)] rounded-xl bg-white px-6 py-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Channel Mix</div>
        <p className="text-[13px] text-[var(--muted-foreground)] italic">
          No channel mix available — personas don&apos;t have best_channels data.
        </p>
      </div>
    );
  }
  return (
    <div className="border border-[var(--border)] rounded-xl bg-white px-6 py-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Channel Mix</div>
      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden mb-3.5 ring-1 ring-black/5">
        {mix.map((m) => {
          const meta = getPlatformMeta(m.channel.toLowerCase() + "_feed");
          return (
            <div
              key={m.channel}
              className="flex items-center justify-center text-white text-[11px] font-bold"
              style={{ flex: m.pct, background: meta.color }}
              title={`${m.channel} ${Math.round(m.pct * 100)}%`}
            >
              {Math.round(m.pct * 100)}%
            </div>
          );
        })}
      </div>
      {/* 4-up legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {mix.map((m) => {
          const meta = getPlatformMeta(m.channel.toLowerCase() + "_feed");
          const channelMonthly = !isRatio && totalMonthly ? Math.round(totalMonthly * m.pct) : null;
          return (
            <div key={m.channel} className="flex items-center gap-2.5 px-3 py-2 border border-[var(--border)] rounded-lg">
              <PlatformLogo brand={meta.brand} className="w-8 h-8 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-[var(--foreground)] truncate">{m.channel}</div>
                <div className="text-[11px] text-[var(--muted-foreground)]">
                  {channelMonthly !== null ? `$${channelMonthly.toLocaleString()}/mo · ` : ""}{Math.round(m.pct * 100)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Note: we derive `getPlatformMeta` by converting the channel label ("Facebook") back to a platform key ("facebook_feed"). This is a small abuse of the key format but avoids adding a second lookup table. If it returns the unknown purple fallback for some channel (e.g. "Google Search"), the code still renders correctly — just with a generic purple logo.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyTab.tsx
git commit -m "feat(media-strategy): add ChannelMixBar component"
```

---

## Task 6: Add `TierBadge`, `AgeBar`, `InterestTags`, `GeoTags`, `RulesRow` small pieces

**Files:**
- Modify: `src/components/MediaStrategyTab.tsx`

- [ ] **Step 1: Add five small presentational components**

Append to the sub-components section:

```tsx
function TierBadge({ tier }: { tier: string }) {
  const color =
    tier === "hyper" ? "bg-[rgba(107,33,168,0.1)] text-[#6B21A8]" :
    tier === "hot" ? "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]" :
    "bg-[rgba(34,197,94,0.12)] text-[#22c55e]";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {tier}
    </span>
  );
}

function AgeBar({ min, max, gender }: { min?: number; max?: number; gender?: string }) {
  const lo = min ?? 18;
  const hi = max ?? 65;
  const left = ((lo - 18) / (65 - 18)) * 100;
  const width = ((hi - lo) / (65 - 18)) * 100;
  const genderLabel = gender && gender !== "all" ? gender : "All genders";
  return (
    <div className="mt-2">
      <div className="relative h-1 bg-[var(--muted)] rounded-sm">
        <div
          className="absolute h-full rounded-sm"
          style={{ left: `${left}%`, width: `${width}%`, background: "linear-gradient(90deg, rgb(6,147,227), rgb(155,81,224))" }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-[var(--muted-foreground)] mt-0.5"><span>18</span><span>65+</span></div>
      <div className="text-[11px] font-semibold mt-0.5 text-[var(--foreground)]">Age {lo}-{hi} · <span className="capitalize">{genderLabel}</span></div>
    </div>
  );
}

function InterestTags({ interests }: { interests: string[] }) {
  if (interests.length === 0) return null;
  return (
    <>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-3 mb-1">Interests</div>
      <div className="flex flex-wrap gap-1">
        {interests.map((i) => (
          <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-[rgba(6,147,227,0.08)] text-[rgb(6,147,227)] font-semibold">
            {i}
          </span>
        ))}
      </div>
    </>
  );
}

function GeoTags({ location }: { location?: string | string[] }) {
  const items: string[] = Array.isArray(location) ? location : location ? [location] : [];
  if (items.length === 0) return null;
  return (
    <>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-3 mb-1">Geographics</div>
      <div className="flex flex-wrap gap-1">
        {items.map((g) => (
          <span key={g} className="text-[11px] px-2 py-0.5 rounded-md bg-[rgba(155,81,224,0.08)] text-[rgb(155,81,224)] font-semibold inline-flex items-center gap-1">
            <span>📍</span>{g}
          </span>
        ))}
      </div>
    </>
  );
}

function RulesRow({ killRule, scaleRule }: { killRule?: string; scaleRule?: string }) {
  if (!killRule && !scaleRule) return null;
  return (
    <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-dashed border-[var(--border)] text-[10px]">
      {killRule ? (
        <div className="flex-1">
          <div className="font-bold uppercase text-[9px] tracking-wider text-[#ef4444]">Kill</div>
          <div className="text-[var(--muted-foreground)] leading-snug">{killRule}</div>
        </div>
      ) : null}
      {scaleRule ? (
        <div className="flex-1">
          <div className="font-bold uppercase text-[9px] tracking-wider text-[#22c55e]">Scale</div>
          <div className="text-[var(--muted-foreground)] leading-snug">{scaleRule}</div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyTab.tsx
git commit -m "feat(media-strategy): add TierBadge, AgeBar, InterestTags, GeoTags, RulesRow"
```

---

## Task 7: Add `CreativeThumb` + `CreativeThumbStrip` components

**Files:**
- Modify: `src/components/MediaStrategyTab.tsx`

- [ ] **Step 1: Add the two components**

```tsx
function CreativeThumb({ asset }: { asset: GeneratedAsset }) {
  const content = (asset.content ?? {}) as Record<string, unknown>;
  const headline = String(content.headline ?? content.hook ?? "").slice(0, 60);
  const hookType = String((content.hook_type ?? content.angle ?? "")).slice(0, 4);
  if (asset.blob_url) {
    return (
      <div className="relative rounded-md overflow-hidden aspect-square bg-[var(--muted)] border border-[var(--border)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.blob_url} alt={headline || "creative"} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        {hookType ? (
          <span className="absolute top-1 right-1 bg-white/95 text-[var(--foreground)] text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">
            {hookType}
          </span>
        ) : null}
        {headline ? (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-white text-[9px] font-bold leading-tight">
            {headline}
          </div>
        ) : null}
      </div>
    );
  }
  // Gradient fallback
  return (
    <div className="relative rounded-md overflow-hidden aspect-square border border-[var(--border)] flex items-end p-1.5">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))", opacity: 0.8 }} />
      {hookType ? (
        <span className="absolute top-1 right-1 bg-white/95 text-[var(--foreground)] text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase z-10">
          {hookType}
        </span>
      ) : null}
      <div className="relative z-10 text-white text-[9px] font-bold leading-tight" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
        {headline || "Creative"}
      </div>
    </div>
  );
}

function CreativeThumbStrip({
  creatives,
  hookTypes,
}: {
  creatives: GeneratedAsset[];
  hookTypes: string[];
}) {
  const visible = creatives.slice(0, 4);
  const overflow = Math.max(0, creatives.length - 4);
  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-[var(--border)]">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[11px] font-bold">
          <span className="inline-block bg-[var(--foreground)] text-white px-2 py-0.5 rounded-full text-[11px] mr-1.5">{creatives.length}</span>
          creatives
        </div>
        {hookTypes.length > 0 ? (
          <span className="text-[10px] text-[var(--muted-foreground)]">Hook: {hookTypes.join(", ")}</span>
        ) : null}
      </div>
      {creatives.length === 0 ? (
        <div className="border border-dashed border-[var(--border)] rounded-md py-4 text-center text-[11px] text-[var(--muted-foreground)] italic">
          No creatives generated yet
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {visible.map((a) => (
            <CreativeThumb key={a.id} asset={a} />
          ))}
          {overflow > 0 ? (
            <div className="aspect-square border border-dashed border-[var(--border)] rounded-md bg-white flex items-center justify-center text-[var(--muted-foreground)] text-[11px] font-bold">
              +{overflow}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors. Note the `eslint-disable-next-line @next/next/no-img-element` comment — we use `<img>` directly because `blob_url` points to external Vercel Blob storage and `next/image` would need full config for a new remote domain.

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyTab.tsx
git commit -m "feat(media-strategy): add CreativeThumb + CreativeThumbStrip"
```

---

## Task 8: Add `AdSetCard` sub-component

**Files:**
- Modify: `src/components/MediaStrategyTab.tsx`

- [ ] **Step 1: Add `AdSetCard` below `CreativeThumbStrip`**

```tsx
interface AdSetCardProps {
  adSet: AdSet & { _campaign: Campaign };
  channel: string;
  assets: GeneratedAsset[];
}

function AdSetCard({ adSet, channel, assets }: AdSetCardProps) {
  const tier = (adSet.targeting_tier ?? adSet.targeting_type ?? "broad").toString();
  const borderColor = tier === "hyper" ? "#6B21A8" : tier === "hot" ? "#f59e0b" : "#22c55e";
  const demo = adSet.demographics ?? {};
  const dailyBudget = adSet.daily_budget;
  const creatives = useMemo(() => matchCreatives(adSet, assets, channel), [adSet, assets, channel]);
  const hookTypes = adSet.creative_assignment_rule?.hook_types ?? [];
  const personaLabel = adSet.persona_key ? adSet.persona_key.replace(/_/g, " ") : "—";

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl px-4 py-3.5" style={{ borderLeft: `3px solid ${borderColor}` }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h4 className="text-[13px] font-bold text-[var(--foreground)] m-0">{adSet.name ?? "Ad Set"}</h4>
          <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
            {dailyBudget ? `$${Number(dailyBudget).toLocaleString()}/day` : "—"} · persona: <span className="capitalize">{personaLabel}</span>
          </div>
        </div>
        <TierBadge tier={tier} />
      </div>

      <AgeBar min={demo.age_min} max={demo.age_max} gender={demo.gender} />
      <InterestTags interests={adSet.interests ?? []} />
      <GeoTags location={demo.location} />

      <CreativeThumbStrip creatives={creatives} hookTypes={hookTypes} />

      <RulesRow killRule={adSet.kill_rule} scaleRule={adSet.scale_rule} />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyTab.tsx
git commit -m "feat(media-strategy): add AdSetCard component"
```

---

## Task 9: Add `ChannelBlock` sub-component with expand/collapse

**Files:**
- Modify: `src/components/MediaStrategyTab.tsx`

- [ ] **Step 1: Add `ChannelBlock` below `AdSetCard`**

```tsx
interface ChannelBlockProps {
  block: ChannelBlockData;
  expanded: boolean;
  onToggle: () => void;
  assets: GeneratedAsset[];
  isRatio: boolean;
  totalMonthly: number | null;
}

function ChannelBlock({ block, expanded, onToggle, assets, isRatio, totalMonthly }: ChannelBlockProps) {
  const meta = getPlatformMeta(block.channel.toLowerCase() + "_feed");
  const channelMonthly = !isRatio && totalMonthly ? Math.round(totalMonthly * block.pct) : null;
  const channelDaily = channelMonthly ? Math.round(channelMonthly / 30) : null;
  const pctLabel = `${Math.round(block.pct * 100)}% of country spend`;
  const objectivesLabel = block.objectives.length > 0 ? block.objectives.join(" · ") : "—";
  const creativeCount = block.adSets.reduce((s, a) => s + matchCreatives(a, assets, block.channel).length, 0);

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl mb-3 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[var(--muted)]/30 transition-colors text-left"
        style={{ borderLeft: `4px solid ${meta.color}` }}
      >
        <div className="flex items-center gap-3.5">
          <PlatformLogo brand={meta.brand} className="w-10 h-10" />
          <div>
            <h3 className="text-[16px] font-bold text-[var(--foreground)] m-0">{block.channel}</h3>
            <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] mt-0.5">
              <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] font-semibold capitalize">
                {objectivesLabel.replace(/_/g, " ")}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] font-semibold">
                {block.adSets.length} ad set{block.adSets.length === 1 ? "" : "s"}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] font-semibold">
                {creativeCount} creative{creativeCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          {isRatio ? (
            <div className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase">{Math.round(block.pct * 100)}%</div>
          ) : (
            <>
              <div className="text-[18px] font-extrabold text-[var(--foreground)]">
                ${Number(channelMonthly ?? 0).toLocaleString()}
                <span className="text-[11px] font-medium text-[var(--muted-foreground)]">/mo</span>
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)]">
                {channelDaily ? `$${channelDaily}/day · ` : ""}{pctLabel}
              </div>
            </>
          )}
        </div>
      </button>
      {expanded ? (
        <div className="px-5 pt-3 pb-5 border-t border-[var(--border)] bg-[#FCFCFC]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2.5 mt-1">Ad Sets</div>
          {block.adSets.length === 0 ? (
            <div className="text-[12px] italic text-[var(--muted-foreground)] py-3">
              No ad sets assigned to this channel yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {block.adSets.map((as, i) => (
                <AdSetCard key={`${as.name ?? "adset"}-${i}`} adSet={as} channel={block.channel} assets={assets} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyTab.tsx
git commit -m "feat(media-strategy): add ChannelBlock with expand/collapse"
```

---

## Task 10: Wire the top-level `MediaStrategyTab` component

**Files:**
- Modify: `src/components/MediaStrategyTab.tsx`

- [ ] **Step 1: Replace the stub default export with the full component**

Delete the current stub `export default function MediaStrategyTab(...)` block and replace it with:

```tsx
export default function MediaStrategyTab({ strategies, assets, briefData }: MediaStrategyTabProps) {
  const sortedStrategies = useMemo(() => {
    return [...(strategies ?? [])].sort((a, b) => (b.monthly_budget ?? 0) - (a.monthly_budget ?? 0));
  }, [strategies]);

  const [activeCountry, setActiveCountry] = useState<string>(sortedStrategies[0]?.country ?? "");
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  const activeStrategy = useMemo(
    () => sortedStrategies.find((s) => s.country === activeCountry) ?? sortedStrategies[0],
    [sortedStrategies, activeCountry],
  );

  const activePersonas: Persona[] = useMemo(() => {
    const allPersonas = (briefData?.personas ?? []) as Persona[];
    if (!activeStrategy) return [];
    // Prefer country-scoped personas if present, otherwise fall back to all.
    const countryPersonas = (briefData?.personas_by_country as Record<string, Persona[]> | undefined)?.[activeStrategy.country];
    return countryPersonas && countryPersonas.length > 0 ? countryPersonas : allPersonas;
  }, [briefData, activeStrategy]);

  const channelMix = useMemo(() => computeChannelMix(activePersonas), [activePersonas]);

  const channelBlocks: ChannelBlockData[] = useMemo(() => {
    if (!activeStrategy) return [];
    const campaigns = activeStrategy.strategy_data?.campaigns ?? [];
    const topChannels = new Set(channelMix.map((m) => m.channel));
    const grouped = groupAdSetsByChannel(campaigns, topChannels);
    return channelMix.map((m) => {
      const adSets = grouped.get(m.channel) ?? [];
      const objectives = Array.from(
        new Set(
          adSets
            .map((a) => a._campaign.objective ?? "")
            .filter((o) => o.length > 0),
        ),
      );
      return {
        channel: m.channel,
        pct: m.pct,
        monthly: activeStrategy.monthly_budget,
        adSets,
        objectives,
      };
    });
  }, [activeStrategy, channelMix]);

  // Default-expand first channel whenever the active country changes.
  const firstChannel = channelBlocks[0]?.channel;
  useEffect(() => {
    if (firstChannel) {
      setExpandedChannels(new Set([firstChannel]));
    }
  }, [firstChannel]);

  if (!sortedStrategies || sortedStrategies.length === 0) {
    return (
      <p className="text-[13px] text-[var(--muted-foreground)] italic">
        Media strategy hasn&apos;t been generated yet.
      </p>
    );
  }

  const handleToggle = (channel: string) => {
    setExpandedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  };

  const totalAdSets = channelBlocks.reduce((s, b) => s + b.adSets.length, 0);
  const isRatio = activeStrategy?.budget_mode === "ratio";
  const totalMonthly = activeStrategy?.monthly_budget ?? null;

  return (
    <div>
      <CountryTabs strategies={sortedStrategies} activeCountry={activeCountry} onChange={setActiveCountry} />
      {activeStrategy ? (
        <>
          <CountryHeader strategy={activeStrategy} personaCount={activePersonas.length} adSetCount={totalAdSets} />
          <ChannelMixBar mix={channelMix} totalMonthly={totalMonthly} isRatio={isRatio} />
          {channelBlocks.length === 0 ? (
            <p className="text-[13px] text-[var(--muted-foreground)] italic">
              No channels to display for this country.
            </p>
          ) : (
            channelBlocks.map((block) => (
              <ChannelBlock
                key={block.channel}
                block={block}
                expanded={expandedChannels.has(block.channel)}
                onToggle={() => handleToggle(block.channel)}
                assets={assets}
                isRatio={isRatio}
                totalMonthly={totalMonthly}
              />
            ))
          )}
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors. Fix any type mismatches inline (most likely: `briefData.personas` needs a cast because `briefData` is `Record<string, any>`).

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyTab.tsx
git commit -m "feat(media-strategy): wire top-level MediaStrategyTab component

Country tab switching, per-country channel mix derivation, expand/collapse
state, default-expand first channel on country change."
```

---

## Task 11: Mount `MediaStrategyTab` inside `CampaignWorkspace.tsx`

**Files:**
- Modify: `src/components/CampaignWorkspace.tsx`

- [ ] **Step 1: Import the new component**

Add to the imports at the top (after the `CreativeHtmlEditor` import around line 29):

```tsx
import MediaStrategyTab from "@/components/MediaStrategyTab";
```

- [ ] **Step 2: Replace the inline media tab content**

Find the `media` tab definition in `CampaignWorkspace.tsx` (currently around lines 1325-1487 — from `{ key: "media", label: "Media Strategy",` through the closing `},` before the next tab definition).

Replace the entire `content: ( … )` block inside that tab object with:

```tsx
content: (
  <MediaStrategyTab
    strategies={campaignStrategies as any}
    assets={assets}
    briefData={briefData}
  />
),
```

The `as any` cast on `campaignStrategies` is because the prop type is declared as `any[]` at the top of the file (line 44) — the new component declares its own proper `Strategy[]` type.

Do not touch any other tab definition.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/stevenjunop/centric-intake && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 4: Verify production build passes**

```bash
cd /Users/stevenjunop/centric-intake && npm run build
```
Expected: build succeeds, no TypeScript or lint errors. If lint flags the `<img>` tag, the `eslint-disable-next-line` comment from Task 7 should already handle it.

- [ ] **Step 5: Commit**

```bash
git add src/components/CampaignWorkspace.tsx
git commit -m "feat(media-strategy): mount MediaStrategyTab in marketing view

Replaces the inline wall-of-cards Media Strategy tab with the new
country → channel mix → per-channel drill-down component."
```

---

## Task 12: Manual verification in dev server

**Why:** No automated tests exist. Manual verification against a real pipeline run is how we confirm visual correctness.

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/stevenjunop/centric-intake && npm run dev
```

- [ ] **Step 2: Open a campaign with a known strategy**

Navigate to a request that has strategies generated. The Brazil run `fd318779-45f2-45bb-b0ff-5420c5c10260` is the safest bet (confirmed to exist in the checkpoint memories). Go to `http://localhost:3000/requests/fd318779-45f2-45bb-b0ff-5420c5c10260` → marketing view → Media Strategy tab.

- [ ] **Step 3: Verify the checklist below**

Check each item in the browser:

1. **Country tabs** render at top. Active country has a colored bottom border. Clicking another country tab swaps all content below.
2. **Country header** shows big monthly budget, tier pill, split-test label (if present), persona count, ad-set count.
3. **Channel mix bar** has up to 4 colored segments that sum to 100%. Hover shows a tooltip with channel + %.
4. **Channel mix legend** shows 4 cards with logos, labels, `$X/mo · Y%`.
5. **First channel block** is expanded by default. Others collapsed.
6. **Expanding a channel** reveals a 2-up grid of ad-set cards.
7. **Ad-set card** shows: name + tier badge + budget line, age bar with gradient fill + label, interest chips (blue), geo chips (purple, if present), creative strip with count badge + thumbnails + overflow tile.
8. **Creative thumbs** show real images (from `blob_url`). Gradient fallback only kicks in for assets without `blob_url`.
9. **Clicking another country tab** collapses old channels and expands the first channel of the new country.
10. **Visual matches** the approved mockup at `.superpowers/brainstorm/68189-1775565914/content/vertical-slice.html` (same file path in Finder).

- [ ] **Step 4: Check for console errors**

Open DevTools → Console. Should be clean (zero red errors, zero hydration warnings).

- [ ] **Step 5: Test edge cases if data available**

If multiple strategies exist:
- Switch between countries — make sure the channel mix changes per country.

If a `ratio` mode campaign exists:
- Verify spend numbers show as `—` or "ratio mode" labels rather than `$0/mo`.

- [ ] **Step 6: If issues found**

Fix inline, commit with a `fix(media-strategy): …` message, and re-verify. If the issue is structural (e.g. the channel mix is computing wrong values against real data), go back and check `computeChannelMix` against the actual persona data shape in the database — particularly whether `best_channels` lives at the root of the persona or under `targeting_profile`.

- [ ] **Step 7: Stop the dev server and do a final commit if needed**

No commit needed if everything worked on first try.

---

## Task 13: Clean up brainstorm session

**Files:**
- Delete: `.superpowers/brainstorm/68189-1775565914/` (only if user wants — it's in `.gitignore` so it shouldn't be committed)

- [ ] **Step 1: Check `.gitignore`**

```bash
grep -q '^.superpowers' /Users/stevenjunop/centric-intake/.gitignore && echo "already ignored" || echo "NEEDS IGNORE"
```

If `NEEDS IGNORE`, append `.superpowers/` to `.gitignore`:

```bash
echo ".superpowers/" >> /Users/stevenjunop/centric-intake/.gitignore
git add .gitignore
git commit -m "chore: ignore .superpowers/ brainstorm sessions"
```

- [ ] **Step 2: Stop the visual companion server**

```bash
/Users/stevenjunop/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/brainstorming/scripts/stop-server.sh /Users/stevenjunop/centric-intake/.superpowers/brainstorm/68189-1775565914
```

- [ ] **Step 3: Final commit summary (if branch work)**

No final commit needed — each task committed its own work.

---

## Final checklist

- [ ] Task 1: Extract platform helpers ✓
- [ ] Task 2: Scaffold MediaStrategyTab with pure helpers ✓
- [ ] Task 3: Sanity-check helpers with throwaway script ✓
- [ ] Task 4: CountryTabs + CountryHeader ✓
- [ ] Task 5: ChannelMixBar ✓
- [ ] Task 6: TierBadge, AgeBar, InterestTags, GeoTags, RulesRow ✓
- [ ] Task 7: CreativeThumb + CreativeThumbStrip ✓
- [ ] Task 8: AdSetCard ✓
- [ ] Task 9: ChannelBlock with expand/collapse ✓
- [ ] Task 10: Wire top-level MediaStrategyTab ✓
- [ ] Task 11: Mount in CampaignWorkspace.tsx ✓
- [ ] Task 12: Manual verification in dev server ✓
- [ ] Task 13: Clean up brainstorm session ✓
