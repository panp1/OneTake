# Agency View Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the agency magic-link portal from a monolithic scroll dump into a structured 2-tab experience with Overview & Strategy + Channels & Ad Sets (with accordion V-groups, stacked thumbnails, ad copy, and pre-generated UTM links).

**Architecture:** Decompose the 497-line `AgencyContent` component into 5 focused components. Tab 1 (Overview) shows channel mix chart + persona cards. Tab 2 (Channels) uses channel sub-tabs → ad set cards → version accordions with stacked thumbnails + copy + UTM. Reuse existing `groupCreativesByVersion()` and `getActiveChannels()` from `src/lib/channels.ts`. UTM links built client-side via `buildDestinationUrl()`.

**Tech Stack:** Next.js App Router, React client components, Lucide React icons, inline styles (enterprise OneForma tokens), existing magic-link auth via `/api/designer/[id]`.

**Spec:** `docs/superpowers/specs/2026-04-12-agency-view-redesign-design.md`
**Mockup:** `.superpowers/brainstorm/97455-1776000958/content/03-agency-stacked-v3.html`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/components/agency/ChannelMixChart.tsx` | Horizontal bar chart for channel budget allocation |
| `src/components/agency/AgencyOverviewTab.tsx` | Tab 1: channel mix + persona overview cards |
| `src/components/agency/VersionAccordion.tsx` | Collapsible V-group with stacked thumbnails + ad copy + UTM link |
| `src/components/agency/AdSetCard.tsx` | Single ad set card with targeting interests + version accordions |
| `src/components/agency/AgencyChannelsTab.tsx` | Tab 2: channel sub-tabs + ad set cards |

### Modified Files
| File | Changes |
|---|---|
| `src/app/agency/[id]/page.tsx` | Replace monolithic `AgencyContent` body with 2-tab layout importing new components. Keep data fetching, auth, loading/error states, helpers. |

---

## Task 1: ChannelMixChart Component

**Files:**
- Create: `src/components/agency/ChannelMixChart.tsx`

- [ ] **Step 1: Create ChannelMixChart**

A "use client" component that computes channel budget allocation from persona data and renders a horizontal bar chart.

```tsx
"use client";

interface Persona {
  persona_name?: string;
  best_channels?: string[];
  targeting_profile?: {
    budget_weight_pct?: number;
  };
}

interface ChannelMixChartProps {
  personas: Persona[];
}

interface ChannelAlloc {
  channel: string;
  pct: number;
}

function computeChannelMix(personas: Persona[]): ChannelAlloc[] {
  const totals = new Map<string, number>();
  for (const p of personas) {
    const weight = p.targeting_profile?.budget_weight_pct ?? 0;
    const channels = p.best_channels ?? [];
    if (channels.length === 0 || weight === 0) continue;
    const perChannel = weight / channels.length;
    for (const ch of channels) {
      const label = ch.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      totals.set(label, (totals.get(label) ?? 0) + perChannel);
    }
  }
  return [...totals.entries()]
    .map(([channel, pct]) => ({ channel, pct: Math.round(pct) }))
    .sort((a, b) => b.pct - a.pct);
}

const BAR_SHADES = ["#32373C", "#555555", "#737373", "#999999", "#B0B0B0", "#CCCCCC"];

export default function ChannelMixChart({ personas }: ChannelMixChartProps) {
  const mix = computeChannelMix(personas);
  if (mix.length === 0) return null;
  const max = mix[0].pct;

  return (
    <div style={{ padding: 18 }}>
      {mix.map((entry, i) => (
        <div key={entry.channel} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, width: 100, textAlign: "right" as const, color: "#1A1A1A" }}>
            {entry.channel}
          </div>
          <div style={{ flex: 1, height: 28, background: "#F7F7F8", borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.max((entry.pct / max) * 100, 8)}%`,
                background: BAR_SHADES[Math.min(i, BAR_SHADES.length - 1)],
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                paddingLeft: 10,
                fontSize: 10,
                fontWeight: 700,
                color: "white",
                minWidth: 28,
              }}
            >
              {entry.pct}%
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: "right" as const }}>{entry.pct}%</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep ChannelMixChart`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/agency/ChannelMixChart.tsx
git commit -m "feat(agency): add ChannelMixChart — horizontal bar chart for channel budget allocation"
```

---

## Task 2: AgencyOverviewTab Component

**Files:**
- Create: `src/components/agency/AgencyOverviewTab.tsx`

- [ ] **Step 1: Create AgencyOverviewTab**

A "use client" component rendering the Overview & Strategy tab with the channel mix panel and persona overview cards.

```tsx
"use client";

import ChannelMixChart from "./ChannelMixChart";

interface Persona {
  persona_name?: string;
  name?: string;
  archetype_key?: string;
  age_range?: string;
  region?: string;
  best_channels?: string[];
  targeting_profile?: {
    budget_weight_pct?: number;
    estimated_pool_size?: string;
    expected_cpl_tier?: string;
    demographics?: { occupation?: string; gender?: string };
  };
}

interface AgencyOverviewTabProps {
  personas: Persona[];
  pillarPrimary?: string | null;
  pillarSecondary?: string | null;
}

export default function AgencyOverviewTab({ personas }: AgencyOverviewTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Channel Mix */}
      <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Channel Mix & Budget Split</div>
            <div style={{ fontSize: 11, color: "#8A8A8E" }}>Recommended allocation based on persona targeting</div>
          </div>
        </div>
        <ChannelMixChart personas={personas} />
      </div>

      {/* Persona Overview */}
      <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Persona Overview</div>
          <div style={{ fontSize: 11, color: "#8A8A8E" }}>{personas.length} target personas</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(personas.length, 3)}, 1fr)`, gap: 14, padding: 18 }}>
          {personas.map((p, i) => {
            const tp = p.targeting_profile ?? {};
            const demo = tp.demographics ?? {};
            const channels = p.best_channels ?? [];
            const name = p.persona_name || p.name || p.archetype_key?.replace(/_/g, " ") || `Persona ${i + 1}`;
            return (
              <div key={i} style={{ border: "1px solid #E8E8EA", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: "#1A1A1A" }}>{name}</div>
                <div style={{ fontSize: 11, color: "#8A8A8E", marginBottom: 10, lineHeight: 1.4 }}>
                  {[p.age_range, p.region, demo.occupation].filter(Boolean).join(" · ")}
                </div>
                <StatRow label="Budget Weight" value={tp.budget_weight_pct ? `${tp.budget_weight_pct}%` : "—"} />
                <StatRow label="Pool Size" value={tp.estimated_pool_size ?? "—"} />
                <StatRow label="Expected CPL" value={tp.expected_cpl_tier ?? "—"} />
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                  {channels.map((ch) => (
                    <span key={ch} style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: "#F7F7F8", color: "#32373C", border: "1px solid #E8E8EA" }}>
                      {ch.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid #F7F7F8" }}>
      <span style={{ fontSize: 11, color: "#8A8A8E" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A" }}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep AgencyOverviewTab
git add src/components/agency/AgencyOverviewTab.tsx
git commit -m "feat(agency): add AgencyOverviewTab — channel mix + persona overview cards"
```

---

## Task 3: VersionAccordion Component

**Files:**
- Create: `src/components/agency/VersionAccordion.tsx`

- [ ] **Step 1: Create VersionAccordion**

A "use client" component rendering a single collapsible V-group with stacked thumbnails on top, ad copy below, and UTM link at the bottom.

```tsx
"use client";

import { useState } from "react";
import { ChevronRight, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { extractField } from "@/lib/format";
import { CHANNEL_DEFINITIONS, getThumbnailDimensions } from "@/lib/channels";
import { buildDestinationUrl } from "@/lib/tracked-links/build-url";
import type { VersionGroup } from "@/lib/channels";

interface VersionAccordionProps {
  version: VersionGroup;
  channelName: string;
  adSetSlug: string;
  campaignSlug: string;
  trackingBaseUrl: string | null;
}

export default function VersionAccordion({
  version,
  channelName,
  adSetSlug,
  campaignSlug,
  trackingBaseUrl,
}: VersionAccordionProps) {
  const [open, setOpen] = useState(false);
  const channelDef = CHANNEL_DEFINITIONS[channelName];

  // Build UTM link
  const utmUrl = trackingBaseUrl
    ? buildDestinationUrl(trackingBaseUrl, {
        utm_campaign: campaignSlug,
        utm_source: channelName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        utm_medium: "paid",
        utm_term: adSetSlug,
        utm_content: version.versionLabel.toLowerCase(),
      })
    : null;

  // Get format labels for the pill
  const formatLabels = channelDef
    ? [...new Set(version.assets.map((a) => {
        const plat = a.platform || "";
        const match = channelDef.formats.find((f) =>
          plat.includes(f.key) || plat.endsWith(`_${f.key}`)
        );
        return match?.label || a.format || plat;
      }))].join(" · ")
    : version.assets.map((a) => a.format || a.platform).join(" · ");

  // Get first asset's copy data for ad copy display
  const firstAsset = version.assets[0];
  const copyData = (firstAsset?.copy_data || {}) as Record<string, unknown>;
  const content = (firstAsset?.content || {}) as Record<string, unknown>;
  const primaryText = extractField(copyData, "primary_text") || extractField(copyData, "caption") || "";
  const headline = extractField(copyData, "headline") || extractField(content, "overlay_headline") || "";
  const description = extractField(copyData, "description") || "";
  const cta = extractField(copyData, "cta") || extractField(content, "overlay_cta") || "";

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    for (const a of version.assets) {
      if (a.blob_url) window.open(a.blob_url, "_blank");
    }
    toast.success(`Downloading ${version.versionLabel} (${version.assets.length} files)`);
  }

  function handleCopyUtm(e: React.MouseEvent) {
    e.stopPropagation();
    if (!utmUrl) return;
    navigator.clipboard.writeText(utmUrl).then(
      () => toast.success("UTM link copied!"),
      () => toast.error("Could not copy"),
    );
  }

  return (
    <div style={{ border: "1px solid #E8E8EA", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
          background: open ? "#FAFAFA" : "white", border: "none", cursor: "pointer",
          fontFamily: "inherit", textAlign: "left" as const,
          borderBottom: open ? "1px solid #E8E8EA" : "none",
        }}
      >
        <ChevronRight size={12} style={{ color: "#8A8A8E", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
        <div style={{ fontSize: 11, fontWeight: 700, width: 28, height: 28, borderRadius: 6, background: "#F7F7F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#32373C" }}>
          {version.versionLabel}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1A1A1A" }}>
          {version.headline}
        </div>
        <div style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: "#F7F7F8", color: "#8A8A8E", flexShrink: 0 }}>
          {formatLabels}
        </div>
        {version.avgVqaScore > 0 && (
          <div style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: version.avgVqaScore >= 0.85 ? "#15803d" : version.avgVqaScore >= 0.7 ? "#a16207" : "#dc2626" }}>
            VQA {version.avgVqaScore.toFixed(2)}
          </div>
        )}
        <button onClick={handleDownload} style={{ padding: "7px 16px", fontSize: 11, borderRadius: 9999, border: "1px solid #E8E8EA", background: "white", color: "#8A8A8E", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 600, fontFamily: "inherit", marginLeft: 8 }}>
          <Download size={10} /> Download {version.versionLabel}
        </button>
      </button>

      {/* Expanded body — stacked layout */}
      {open && (
        <div style={{ padding: 16, background: "#FAFAFA" }}>
          {/* Thumbnails on top */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #E8E8EA" }}>
            {version.assets.map((asset) => {
              const format = channelDef?.formats.find((f) => asset.platform?.includes(f.key));
              const dims = format ? getThumbnailDimensions(format, 96) : { width: 96, height: 96 };
              const label = format?.label
                ? `${format.label} ${format.ratio}`
                : asset.format || asset.platform || "";
              return (
                <div key={asset.id} style={{ width: dims.width, height: dims.height, borderRadius: 8, overflow: "hidden", border: "1px solid #E8E8EA", background: "#EBEBEB", position: "relative" }}>
                  {asset.blob_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.blob_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                  )}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 8, fontWeight: 600, textAlign: "center" as const, padding: "2px 0" }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ad copy below */}
          {primaryText && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#8A8A8E", marginBottom: 4 }}>Primary Text</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "#333", padding: "10px 14px", background: "white", border: "1px solid #E8E8EA", borderRadius: 8, userSelect: "all" as const }}>{primaryText}</div>
            </div>
          )}
          {(headline || description) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {headline && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#8A8A8E", marginBottom: 4 }}>Headline</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", padding: "10px 14px", background: "white", border: "1px solid #E8E8EA", borderRadius: 8, userSelect: "all" as const }}>{headline}</div>
                </div>
              )}
              {description && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#8A8A8E", marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", padding: "10px 14px", background: "white", border: "1px solid #E8E8EA", borderRadius: 8, userSelect: "all" as const }}>{description}</div>
                </div>
              )}
            </div>
          )}
          {cta && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#8A8A8E", marginBottom: 4 }}>CTA</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", padding: "10px 14px", background: "white", border: "1px solid #E8E8EA", borderRadius: 8, userSelect: "all" as const }}>{cta}</div>
            </div>
          )}

          {/* UTM Link */}
          {utmUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#1A1A1A", borderRadius: 8, marginTop: 16 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
              <div style={{ fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 11, color: "#888", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {utmUrl.replace(/^https?:\/\//, "")}
              </div>
              <button onClick={handleCopyUtm} style={{ fontSize: 10, fontWeight: 600, padding: "4px 12px", borderRadius: 9999, background: "white", color: "#32373C", border: "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 3, fontFamily: "inherit" }}>
                <Copy size={10} /> Copy Link
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#8A8A8E", marginTop: 16, fontStyle: "italic" }}>No tracking URL available — add a landing page URL to enable UTM links.</div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep VersionAccordion
git add src/components/agency/VersionAccordion.tsx
git commit -m "feat(agency): add VersionAccordion — collapsible V-group with stacked thumbnails, ad copy, UTM link"
```

---

## Task 4: AdSetCard Component

**Files:**
- Create: `src/components/agency/AdSetCard.tsx`

- [ ] **Step 1: Create AdSetCard**

A "use client" component rendering a single ad set with targeting interests and version accordions.

```tsx
"use client";

import { Download, Clock, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import { groupCreativesByVersion } from "@/lib/channels";
import VersionAccordion from "./VersionAccordion";
import type { GeneratedAsset } from "@/lib/types";

interface AdSetInfo {
  name: string;
  personaName: string;
  pillar: string;
  objective?: string;
  dailyBudget?: string;
  splitTestVariable?: string;
  interests: {
    hyper: string[];
    hot: string[];
    broad: string[];
  };
}

interface AdSetCardProps {
  adSet: AdSetInfo;
  assets: GeneratedAsset[];
  channelName: string;
  campaignSlug: string;
  trackingBaseUrl: string | null;
}

const INTEREST_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  hyper: { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  hot: { bg: "#fce7f3", color: "#9d174d", border: "#fbcfe8" },
  broad: { bg: "#F7F7F8", color: "#32373C", border: "#E8E8EA" },
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdSetCard({ adSet, assets, channelName, campaignSlug, trackingBaseUrl }: AdSetCardProps) {
  const versions = groupCreativesByVersion(assets, channelName);
  const adSetSlug = slugify(adSet.name);

  function handleDownloadAdSet() {
    for (const a of assets) {
      if (a.blob_url) window.open(a.blob_url, "_blank");
    }
    toast.success(`Downloading ${assets.length} creatives for ${adSet.name}`);
  }

  return (
    <div style={{ border: "1px solid #E8E8EA", borderRadius: 10, background: "white", marginBottom: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 18px", borderBottom: "1px solid #F0F0F0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{adSet.name}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 12px", borderRadius: 9999, background: "rgba(109,40,217,0.06)", color: "#6D28D9" }}>
              {adSet.personaName} · {adSet.pillar}
            </span>
            <button onClick={handleDownloadAdSet} style={{ padding: "7px 16px", fontSize: 11, borderRadius: 9999, border: "1px solid #E8E8EA", background: "white", color: "#8A8A8E", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 600, fontFamily: "inherit", marginLeft: 8 }}>
              <Download size={12} /> Download Ad Set
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#8A8A8E", display: "flex", gap: 12 }}>
          {adSet.objective && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {adSet.objective}</span>}
          {adSet.dailyBudget && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><DollarSign size={11} /> ${adSet.dailyBudget}/day</span>}
          {adSet.splitTestVariable && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={11} /> Split test: {adSet.splitTestVariable}</span>}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 18 }}>
        {/* Targeting Interests */}
        {(adSet.interests.hyper.length > 0 || adSet.interests.hot.length > 0 || adSet.interests.broad.length > 0) && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.6, color: "#8A8A8E", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              Targeting Interests
              <span style={{ flex: 1, height: 1, background: "#E8E8EA" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
              {(["hyper", "hot", "broad"] as const).map((tier) => {
                const items = adSet.interests[tier];
                if (items.length === 0) return <div key={tier} />;
                const label = tier === "hyper" ? "Hyper (Exact Match)" : tier === "hot" ? "Hot (Strong Signal)" : "Broad (Reach)";
                const style = INTEREST_STYLES[tier];
                return (
                  <div key={tier}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.6, color: "#8A8A8E", marginBottom: 6 }}>{label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {items.map((interest) => (
                        <span key={interest} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 9999, fontWeight: 500, background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Version Accordions */}
        {versions.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.6, color: "#8A8A8E", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              Creatives & Ad Copy
              <span style={{ flex: 1, height: 1, background: "#E8E8EA" }} />
            </div>
            {versions.map((v) => (
              <VersionAccordion
                key={v.versionLabel}
                version={v}
                channelName={channelName}
                adSetSlug={adSetSlug}
                campaignSlug={campaignSlug}
                trackingBaseUrl={trackingBaseUrl}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep AdSetCard
git add src/components/agency/AdSetCard.tsx
git commit -m "feat(agency): add AdSetCard — targeting interests + version accordions per ad set"
```

---

## Task 5: AgencyChannelsTab Component

**Files:**
- Create: `src/components/agency/AgencyChannelsTab.tsx`

- [ ] **Step 1: Create AgencyChannelsTab**

A "use client" component rendering channel sub-tabs and ad set cards for the active channel.

This component takes the raw brief data and assets, computes ad sets per channel by matching personas to strategy data, and renders `AdSetCard` components.

```tsx
"use client";

import { useState, useMemo } from "react";
import { getActiveChannels, CHANNEL_DEFINITIONS } from "@/lib/channels";
import AdSetCard from "./AdSetCard";
import type { GeneratedAsset } from "@/lib/types";

interface Persona {
  persona_name?: string;
  name?: string;
  archetype_key?: string;
  best_channels?: string[];
  targeting_profile?: {
    budget_weight_pct?: number;
    interests?: { hyper?: string[]; hot?: string[]; broad?: string[] };
  };
}

interface AgencyChannelsTabProps {
  assets: GeneratedAsset[];
  personas: Persona[];
  campaignSlug: string;
  trackingBaseUrl: string | null;
  strategiesSummary: Record<string, { tier?: number; ad_set_count?: number; split_test_variable?: string }> | null;
}

export default function AgencyChannelsTab({
  assets,
  personas,
  campaignSlug,
  trackingBaseUrl,
  strategiesSummary,
}: AgencyChannelsTabProps) {
  const channels = useMemo(() => getActiveChannels(assets), [assets]);
  const [activeChannel, setActiveChannel] = useState(() => channels[0] ?? "");

  // Build ad sets for the active channel by mapping personas that target this channel
  const adSets = useMemo(() => {
    const channelDef = CHANNEL_DEFINITIONS[activeChannel];
    if (!channelDef) return [];

    const channelPlatforms = new Set(channelDef.platforms);
    const channelAssets = assets.filter(
      (a) => a.asset_type === "composed_creative" && channelPlatforms.has(a.platform),
    );

    // Group by persona
    return personas
      .filter((p) => {
        const bestCh = (p.best_channels ?? []).map((c) =>
          c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
        );
        // Check if persona targets this channel (fuzzy match on channel name)
        return bestCh.some((ch) =>
          ch.toLowerCase().includes(activeChannel.toLowerCase()) ||
          activeChannel.toLowerCase().includes(ch.toLowerCase().split(" ")[0])
        );
      })
      .map((p, i) => {
        const personaKey = p.archetype_key || `persona_${i}`;
        const personaName = p.persona_name || p.name || personaKey.replace(/_/g, " ");
        const tp = p.targeting_profile ?? {};
        const interests = tp.interests ?? {};

        // Filter assets for this persona
        const personaAssets = channelAssets.filter((a) => {
          const content = (a.content || {}) as Record<string, string>;
          return content.persona === personaKey || content.actor_name?.toLowerCase().includes(personaName.split(" ")[0]?.toLowerCase() || "");
        });

        // If no persona-specific match, include all channel assets (fallback)
        const finalAssets = personaAssets.length > 0 ? personaAssets : channelAssets;
        const pillar = ((finalAssets[0]?.content || {}) as Record<string, string>).pillar || "earn";

        return {
          adSet: {
            name: `${personaName.split("—")[0].trim()} — ${activeChannel}`,
            personaName: personaName.split("—")[0].trim(),
            pillar: pillar.charAt(0).toUpperCase() + pillar.slice(1),
            objective: "Lead Generation",
            dailyBudget: tp.budget_weight_pct ? String(Math.round((tp.budget_weight_pct / 100) * 150)) : undefined,
            splitTestVariable: strategiesSummary ? Object.values(strategiesSummary)[0]?.split_test_variable : undefined,
            interests: {
              hyper: (interests.hyper as string[]) ?? [],
              hot: (interests.hot as string[]) ?? [],
              broad: (interests.broad as string[]) ?? [],
            },
          },
          assets: finalAssets,
        };
      })
      .filter((entry) => entry.assets.length > 0);
  }, [activeChannel, assets, personas, strategiesSummary]);

  // Count ad sets per channel for the tabs
  const channelAdSetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ch of channels) {
      const channelDef = CHANNEL_DEFINITIONS[ch];
      if (!channelDef) continue;
      const matching = personas.filter((p) => {
        const bestCh = (p.best_channels ?? []).map((c) =>
          c.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase())
        );
        return bestCh.some((c) => c.toLowerCase().includes(ch.toLowerCase()) || ch.toLowerCase().includes(c.toLowerCase().split(" ")[0]));
      });
      counts[ch] = Math.max(matching.length, 1);
    }
    return counts;
  }, [channels, personas]);

  if (channels.length === 0) {
    return <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: "#8A8A8E" }}>No creatives generated yet.</div>;
  }

  return (
    <div>
      {/* Channel sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {channels.map((ch) => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            style={{
              fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 9999,
              border: `1px solid ${activeChannel === ch ? "#32373C" : "#E8E8EA"}`,
              background: activeChannel === ch ? "#32373C" : "white",
              color: activeChannel === ch ? "white" : "#8A8A8E",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {ch} · {channelAdSetCounts[ch] ?? 0} ad sets
          </button>
        ))}
      </div>

      {/* Ad set cards */}
      {adSets.map((entry, i) => (
        <AdSetCard
          key={`${activeChannel}-${i}`}
          adSet={entry.adSet}
          assets={entry.assets}
          channelName={activeChannel}
          campaignSlug={campaignSlug}
          trackingBaseUrl={trackingBaseUrl}
        />
      ))}

      {adSets.length === 0 && (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: "#8A8A8E" }}>
          No ad sets for {activeChannel}. Creatives may not be mapped to personas yet.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep AgencyChannelsTab
git add src/components/agency/AgencyChannelsTab.tsx
git commit -m "feat(agency): add AgencyChannelsTab — channel sub-tabs + ad set cards with targeting + versions"
```

---

## Task 6: Rewrite Agency Page with 2-Tab Layout

**Files:**
- Modify: `src/app/agency/[id]/page.tsx`

- [ ] **Step 1: Rewrite AgencyContent with tabs**

Read the current file first. Keep:
- `AgencyData` interface, `PersonaPackage` interface
- `platformLabel()` helper, `groupByPersona()` helper
- The data fetching `useEffect` in `AgencyContent`
- The loading/error states
- The `AgencyPortalPage` default export with Suspense
- The `useSearchParams` token logic

Replace the monolithic render body (the `<main>` content inside `AgencyContent`) with a 2-tab layout:

**New imports to add:**
```tsx
import { Globe, Layers } from "lucide-react";
import AgencyOverviewTab from "@/components/agency/AgencyOverviewTab";
import AgencyChannelsTab from "@/components/agency/AgencyChannelsTab";
```

**Add state for active tab:**
```tsx
const [activeTab, setActiveTab] = useState<"overview" | "channels">("overview");
```

**Add landing page URL fetch for UTM links:**
```tsx
const [trackingBaseUrl, setTrackingBaseUrl] = useState<string | null>(null);

useEffect(() => {
  if (!data) return;
  fetch(`/api/intake/${id}/landing-pages`)
    .then((r) => r.ok ? r.json() : null)
    .then((lp) => {
      if (lp?.landing_page_url) setTrackingBaseUrl(lp.landing_page_url);
      else if (lp?.job_posting_url) setTrackingBaseUrl(lp.job_posting_url);
      // NEVER use ada_form_url
    })
    .catch(() => {});
}, [data, id]);
```

**Replace `<main>` with:**

Header (enterprise inline styles matching mockup), sticky tab bar, tab content area rendering either `AgencyOverviewTab` or `AgencyChannelsTab`.

The tab bar uses the same pattern as the recruiter workspace — inline styles, charcoal underline on active.

**Remove:** The entire `PersonaCard` component (~195 lines) and the monolithic strategy + persona rendering. These are replaced by the new tab components.

**Key data to pass:**
- `AgencyOverviewTab`: `personas` from `briefData.personas`
- `AgencyChannelsTab`: `assets`, `personas`, `campaignSlug: data.request.campaign_slug || ""`, `trackingBaseUrl`, `strategiesSummary: briefData.campaign_strategies_summary`

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/app/agency/[id]/page.tsx
git commit -m "feat(agency): rewrite agency page with 2-tab layout — Overview & Strategy + Channels & Ad Sets"
```

---
