"use client";

import { useMemo } from "react";
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
 * Filters by persona_key and normalized channel, sorts by evaluation_score (VQA) desc.
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
  return <div className="space-y-4">{/* Sub-components added in later tasks */}</div>;
}
