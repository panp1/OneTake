# Unified Campaign Workspace — Plan 3: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the country bar navigation, "All Countries" overview grid, country header, and section pills. Refactor CampaignWorkspace to use country-based filtering across all sections (brief, personas, creatives, media strategy, channel mix, videos, cultural research).

**Architecture:** New `src/components/campaign/` directory with 4 focused components. CampaignWorkspace gets `selectedCountry` state, wraps content in CountryBar, and uses `useMemo` to filter actors/assets/strategies by country. Detail page passes compute_jobs to CampaignWorkspace for status badge data. All data loaded once — country switching is instant (client-side filter, no API calls).

**Tech Stack:** React 18, TypeScript, Next.js 16 App Router, Lucide icons, OneForma design system

**Depends on:** Plan 1 (Schema) must be complete — `country` field must exist on types.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/campaign/CountryBar.tsx` | Create | Horizontal scrollable country tab bar with status badges |
| `src/components/campaign/AllCountriesOverview.tsx` | Create | Grid of country cards with status filters + aggregate stats |
| `src/components/campaign/CountryHeader.tsx` | Create | Per-country summary bar with volume, rate, languages, demographics |
| `src/components/campaign/SectionPills.tsx` | Create | Horizontal pill navigation for content sections |
| `src/components/CampaignWorkspace.tsx` | Modify | Add CountryBar, replace MiniTabs, pass selectedCountry to children |
| `src/app/intake/[id]/page.tsx` | Modify | Pass computeJobs to CampaignWorkspace for country status data |

---

### Task 1: Create SectionPills component

**Files:**
- Create: `src/components/campaign/SectionPills.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";

interface SectionPill {
  key: string;
  label: string;
}

interface SectionPillsProps {
  sections: SectionPill[];
  active: string;
  onChange: (key: string) => void;
}

export default function SectionPills({ sections, active, onChange }: SectionPillsProps) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
      {sections.map((s) => {
        const isActive = s.key === active;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            style={{
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: isActive ? 700 : 600,
              color: isActive ? "#FFFFFF" : "#1A1A1A",
              background: isActive ? "#32373C" : "#F5F5F5",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/campaign/SectionPills.tsx
git commit -m "feat: add SectionPills component for content section navigation"
```

---

### Task 2: Create CountryBar component

**Files:**
- Create: `src/components/campaign/CountryBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useRef, useEffect, useState } from "react";

interface CountryStatus {
  country: string;
  status: "pending" | "processing" | "complete" | "failed";
  stageTarget?: number | null;
}

interface CountryBarProps {
  countries: CountryStatus[];
  selected: string | null; // null = "All Countries"
  onChange: (country: string | null) => void;
}

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  complete: { bg: "#dcfce7", color: "#15803d", label: "DONE" },
  processing: { bg: "#dbeafe", color: "#1d4ed8", label: "GEN" },
  pending: { bg: "#f5f5f5", color: "#737373", label: "PEND" },
  failed: { bg: "#fee2e2", color: "#dc2626", label: "FAIL" },
};

export default function CountryBar({ countries, selected, onChange }: CountryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setShowFade(el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, [countries.length]);

  const isAllSelected = selected === null;

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={scrollRef}
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "2px solid #E5E5E5",
          padding: "0 24px",
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {/* All Countries tab */}
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{
            padding: "12px 20px",
            fontSize: 13,
            fontWeight: isAllSelected ? 700 : 600,
            color: isAllSelected ? "#1A1A1A" : "#737373",
            background: "none",
            border: "none",
            borderBottom: isAllSelected ? "2px solid #32373C" : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
            marginBottom: -2,
          }}
        >
          All Countries
        </button>

        {/* Country tabs */}
        {countries.map((c) => {
          const isActive = selected === c.country;
          const badge = STATUS_BADGES[c.status] || STATUS_BADGES.pending;
          const stageLabel = c.status === "processing" && c.stageTarget
            ? `S${c.stageTarget}/4`
            : badge.label;

          return (
            <button
              key={c.country}
              type="button"
              onClick={() => onChange(c.country)}
              style={{
                padding: "12px 20px",
                fontSize: 13,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? "#1A1A1A" : "#737373",
                background: "none",
                border: "none",
                borderBottom: isActive ? "2px solid #32373C" : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: -2,
              }}
            >
              {c.country}
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  background: badge.bg,
                  color: badge.color,
                  borderRadius: 9999,
                  fontWeight: 700,
                }}
              >
                {stageLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Fade gradient on right edge */}
      {showFade && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 60,
            background: "linear-gradient(to right, transparent, #FFFFFF)",
            pointerEvents: "none",
          }}
        />
      )}

      <style>{`div::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/campaign/CountryBar.tsx
git commit -m "feat: add CountryBar component with scrollable tabs and status badges"
```

---

### Task 3: Create CountryHeader component

**Files:**
- Create: `src/components/campaign/CountryHeader.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import type { CountryQuota } from "@/lib/types";

interface AssetCounts {
  images: number;
  creatives: number;
  copy: number;
  videos: number;
}

interface CountryHeaderProps {
  quota: CountryQuota;
  status: "pending" | "processing" | "complete" | "failed";
  assetCounts: AssetCounts;
  languages: string[];
}

const STATUS_LABELS: Record<string, { bg: string; color: string; label: string }> = {
  complete: { bg: "#dcfce7", color: "#15803d", label: "COMPLETE" },
  processing: { bg: "#dbeafe", color: "#1d4ed8", label: "GENERATING" },
  pending: { bg: "#f5f5f5", color: "#737373", label: "PENDING" },
  failed: { bg: "#fee2e2", color: "#dc2626", label: "FAILED" },
};

export default function CountryHeader({ quota, status, assetCounts, languages }: CountryHeaderProps) {
  const badge = STATUS_LABELS[status] || STATUS_LABELS.pending;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        padding: "16px 20px",
        background: "#F5F5F5",
        borderRadius: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1A1A" }}>
          {quota.country}
        </div>
        <div style={{ fontSize: 12, color: "#737373", marginTop: 2 }}>
          {quota.total_volume.toLocaleString()} contributors | ${quota.rate.toFixed(2)}/person | {languages.join(", ") || "—"}
        </div>
        {quota.demographics.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {quota.demographics.map((d, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  background: "#FFFFFF",
                  borderRadius: 9999,
                  color: "#1A1A1A",
                }}
              >
                {d.category}: {d.value} {d.percentage}%
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {status === "complete" && (
          <>
            <div style={{ textAlign: "center", fontSize: 12, color: "#737373" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A1A" }}>{assetCounts.images}</div>
              Images
            </div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#737373" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A1A" }}>{assetCounts.creatives}</div>
              Creatives
            </div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#737373" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A1A" }}>{assetCounts.copy}</div>
              Copy
            </div>
            {assetCounts.videos > 0 && (
              <div style={{ textAlign: "center", fontSize: 12, color: "#737373" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A1A" }}>{assetCounts.videos}</div>
                Videos
              </div>
            )}
          </>
        )}
        <span
          style={{
            fontSize: 10,
            padding: "4px 10px",
            background: badge.bg,
            color: badge.color,
            borderRadius: 9999,
            fontWeight: 700,
          }}
        >
          {badge.label}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/campaign/CountryHeader.tsx
git commit -m "feat: add CountryHeader component with volume, rate, demographics, asset counts"
```

---

### Task 4: Create AllCountriesOverview component

**Files:**
- Create: `src/components/campaign/AllCountriesOverview.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useMemo } from "react";
import type { CountryQuota, GeneratedAsset, ComputeJob } from "@/lib/types";

interface AllCountriesOverviewProps {
  quotas: CountryQuota[];
  jobs: ComputeJob[];
  assets: GeneratedAsset[];
  onSelectCountry: (country: string) => void;
}

type StatusFilter = "all" | "complete" | "processing" | "pending";

function getCountryStatus(country: string, jobs: ComputeJob[]): { status: string; stageTarget: number | null } {
  const job = jobs.find((j) => j.country === country && j.job_type === "generate_country");
  if (!job) return { status: "pending", stageTarget: null };
  return { status: job.status, stageTarget: job.stage_target };
}

function countAssets(country: string, assets: GeneratedAsset[], type: string): number {
  return assets.filter((a) => a.country === country && a.asset_type === type).length;
}

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  complete: { bg: "#dcfce7", color: "#15803d", label: "DONE" },
  processing: { bg: "#dbeafe", color: "#1d4ed8", label: "GENERATING" },
  pending: { bg: "#f5f5f5", color: "#737373", label: "PENDING" },
  failed: { bg: "#fee2e2", color: "#dc2626", label: "FAILED" },
};

const FILTER_PILLS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "complete", label: "Done" },
  { key: "processing", label: "Generating" },
  { key: "pending", label: "Pending" },
];

export default function AllCountriesOverview({ quotas, jobs, assets, onSelectCountry }: AllCountriesOverviewProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const countryData = useMemo(() => {
    return quotas.map((q) => {
      const { status, stageTarget } = getCountryStatus(q.country, jobs);
      return {
        quota: q,
        status,
        stageTarget,
        images: countAssets(q.country, assets, "base_image"),
        creatives: countAssets(q.country, assets, "composed_creative"),
        copy: countAssets(q.country, assets, "copy"),
      };
    });
  }, [quotas, jobs, assets]);

  const filtered = filter === "all" ? countryData : countryData.filter((c) => c.status === filter);

  const statusCounts = useMemo(() => ({
    all: countryData.length,
    complete: countryData.filter((c) => c.status === "complete").length,
    processing: countryData.filter((c) => c.status === "processing").length,
    pending: countryData.filter((c) => c.status === "pending").length,
  }), [countryData]);

  const totalVolume = quotas.reduce((sum, q) => sum + q.total_volume, 0);
  const totalAssets = assets.length;
  const avgRate = quotas.length > 0 ? quotas.reduce((sum, q) => sum + q.rate, 0) / quotas.length : 0;

  return (
    <div style={{ padding: 24 }}>
      {/* Status filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {FILTER_PILLS.map((fp) => {
          const isActive = filter === fp.key;
          const count = statusCounts[fp.key];
          const pillColors: Record<string, { bg: string; color: string }> = {
            all: { bg: "#32373C", color: "#FFFFFF" },
            complete: { bg: "#dcfce7", color: "#15803d" },
            processing: { bg: "#dbeafe", color: "#1d4ed8" },
            pending: { bg: "#f5f5f5", color: "#737373" },
          };
          const c = isActive ? pillColors[fp.key] : { bg: "#F5F5F5", color: "#737373" };

          return (
            <button
              key={fp.key}
              type="button"
              onClick={() => setFilter(fp.key)}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? c.color : "#737373",
                background: isActive ? c.bg : "#F5F5F5",
                borderRadius: 9999,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {fp.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Country cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {filtered.map((c) => {
          const badge = STATUS_BADGES[c.status] || STATUS_BADGES.pending;
          const isGenerating = c.status === "processing";
          const isPending = c.status === "pending";
          const isDone = c.status === "complete";

          return (
            <div
              key={c.quota.country}
              onClick={() => onSelectCountry(c.quota.country)}
              style={{
                border: `1px solid ${isGenerating ? "#dbeafe" : "#E5E5E5"}`,
                borderRadius: 12,
                padding: 16,
                cursor: "pointer",
                opacity: isPending ? 0.7 : 1,
                background: isGenerating ? "rgba(219,234,254,0.15)" : "#FFFFFF",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                transition: "all 0.15s",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{c.quota.country}</span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "3px 8px",
                    background: badge.bg,
                    color: badge.color,
                    borderRadius: 9999,
                    fontWeight: 700,
                  }}
                >
                  {isGenerating && c.stageTarget ? `STAGE ${c.stageTarget}/4` : badge.label}
                </span>
              </div>

              {/* Volume + Rate */}
              <div style={{ fontSize: 12, color: "#737373", marginBottom: 4 }}>
                {c.quota.total_volume.toLocaleString()} people | ${c.quota.rate.toFixed(2)}
              </div>

              {/* Languages */}
              {c.quota.locale && (
                <div style={{ fontSize: 12, color: "#737373", marginBottom: 8 }}>{c.quota.locale}</div>
              )}

              {/* Asset counts (if done) */}
              {isDone && (
                <div style={{ display: "flex", gap: 12, paddingTop: 8, borderTop: "1px solid #f0f0f0", fontSize: 11, color: "#737373" }}>
                  <span><strong style={{ color: "#1A1A1A" }}>{c.images}</strong> imgs</span>
                  <span><strong style={{ color: "#1A1A1A" }}>{c.creatives}</strong> creatives</span>
                  <span><strong style={{ color: "#1A1A1A" }}>{c.copy}</strong> copy</span>
                </div>
              )}

              {/* Progress bar (if generating) */}
              {isGenerating && c.stageTarget && (
                <div style={{ height: 4, background: "#E5E5E5", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(c.stageTarget / 4) * 100}%`,
                      background: "linear-gradient(135deg, #0693E3, #9B51E0)",
                      borderRadius: 2,
                    }}
                  />
                </div>
              )}

              {/* Demographics */}
              {c.quota.demographics.length > 0 && isDone && (
                <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {c.quota.demographics.slice(0, 2).map((d, i) => (
                    <span key={i} style={{ fontSize: 10, padding: "2px 6px", background: "#F5F5F5", borderRadius: 9999 }}>
                      {d.category} {d.percentage}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Aggregate stats footer */}
      <div
        style={{
          marginTop: 20,
          padding: "16px 20px",
          background: "#F5F5F5",
          borderRadius: 10,
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 16,
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A" }}>{quotas.length}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Countries</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A" }}>{totalVolume.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Contributors</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A" }}>{totalAssets}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Total Assets</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A" }}>${avgRate.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Avg Rate</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#15803d" }}>{statusCounts.complete}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Complete</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1d4ed8" }}>{statusCounts.processing}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>In Progress</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/campaign/AllCountriesOverview.tsx
git commit -m "feat: add AllCountriesOverview with country cards grid, status filters, aggregate stats"
```

---

### Task 5: Update CampaignWorkspace with CountryBar and country filtering

**Files:**
- Modify: `src/components/CampaignWorkspace.tsx`

- [ ] **Step 1: Add imports for new components**

Add at the top of `CampaignWorkspace.tsx`:

```typescript
import CountryBar from "@/components/campaign/CountryBar";
import AllCountriesOverview from "@/components/campaign/AllCountriesOverview";
import CountryHeader from "@/components/campaign/CountryHeader";
import SectionPills from "@/components/campaign/SectionPills";
import type { CountryQuota, ComputeJob } from "@/lib/types";
```

- [ ] **Step 2: Add computeJobs and countryQuotas to CampaignWorkspaceProps**

Update the `CampaignWorkspaceProps` interface:

```typescript
interface CampaignWorkspaceProps {
  briefData: Record<string, any>;
  channelResearch?: Record<string, any> | null;
  designDirection?: Record<string, any> | null;
  campaignStrategies?: any[];
  actors: ActorProfile[];
  assets: GeneratedAsset[];
  computeJobs?: ComputeJob[];
  countryQuotas?: CountryQuota[];
  editable?: boolean;
  requestId?: string;
  onRefine?: (asset: GeneratedAsset) => void;
  onRetry?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
  section?: "brief" | "personas";
}
```

- [ ] **Step 3: Add country state and filtering logic**

Inside the component function, add after existing state declarations:

```typescript
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("brief");

  const hasCountries = (countryQuotas?.length ?? 0) > 0;

  // Build country status list from compute_jobs
  const countryStatuses = useMemo(() => {
    if (!countryQuotas || !computeJobs) return [];
    return countryQuotas.map((q) => {
      const job = computeJobs.find((j) => j.country === q.country && j.job_type === "generate_country");
      return {
        country: q.country,
        status: (job?.status || "pending") as "pending" | "processing" | "complete" | "failed",
        stageTarget: job?.stage_target ?? null,
      };
    });
  }, [countryQuotas, computeJobs]);

  // Filter data by selected country
  const filteredActors = useMemo(
    () => selectedCountry ? actors.filter((a) => a.country === selectedCountry) : actors,
    [actors, selectedCountry]
  );

  const filteredAssets = useMemo(
    () => selectedCountry ? assets.filter((a) => a.country === selectedCountry) : assets,
    [assets, selectedCountry]
  );

  const filteredStrategies = useMemo(
    () => selectedCountry
      ? (campaignStrategies || []).filter((s: any) => s.country === selectedCountry)
      : (campaignStrategies || []),
    [campaignStrategies, selectedCountry]
  );

  const SECTIONS = [
    { key: "brief", label: "Brief" },
    { key: "personas", label: "Personas" },
    { key: "creatives", label: "Creatives" },
    { key: "media", label: "Media Strategy" },
    { key: "channels", label: "Channel Mix" },
    { key: "videos", label: "Videos" },
    { key: "research", label: "Cultural Research" },
  ];
```

- [ ] **Step 4: Wrap the render output with CountryBar**

At the top of the component's return, before existing content, add:

```tsx
{hasCountries && (
  <CountryBar
    countries={countryStatuses}
    selected={selectedCountry}
    onChange={setSelectedCountry}
  />
)}

{/* All Countries Overview */}
{hasCountries && selectedCountry === null && (
  <AllCountriesOverview
    quotas={countryQuotas!}
    jobs={computeJobs || []}
    assets={assets}
    onSelectCountry={setSelectedCountry}
  />
)}
```

When a country IS selected, show `CountryHeader` + `SectionPills` + section content. Use `filteredActors`, `filteredAssets`, `filteredStrategies` in place of `actors`, `assets`, `campaignStrategies` throughout the existing render logic.

- [ ] **Step 5: Replace MiniTabs with SectionPills for country detail view**

When `selectedCountry !== null`, render:

```tsx
{selectedCountry !== null && (
  <>
    <CountryHeader
      quota={countryQuotas!.find((q) => q.country === selectedCountry)!}
      status={countryStatuses.find((c) => c.country === selectedCountry)?.status || "pending"}
      assetCounts={{
        images: filteredAssets.filter((a) => a.asset_type === "base_image").length,
        creatives: filteredAssets.filter((a) => a.asset_type === "composed_creative").length,
        copy: filteredAssets.filter((a) => a.asset_type === "copy").length,
        videos: filteredAssets.filter((a) => a.asset_type === "video").length,
      }}
      languages={[]} // derived from target_languages or quota locale
    />
    <SectionPills sections={SECTIONS} active={activeSection} onChange={setActiveSection} />
    {/* Render active section content using filteredActors/filteredAssets/filteredStrategies */}
  </>
)}
```

- [ ] **Step 6: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add src/components/CampaignWorkspace.tsx
git commit -m "feat: add CountryBar, AllCountriesOverview, country filtering to CampaignWorkspace"
```

---

### Task 6: Pass computeJobs and countryQuotas from detail page

**Files:**
- Modify: `src/app/intake/[id]/page.tsx`

- [ ] **Step 1: Extract countryQuotas from the request's form_data**

In the detail page component, after the request data is loaded, add:

```typescript
const countryQuotas = (request?.form_data?.country_quotas as CountryQuota[] | undefined) ?? [];
```

Add `CountryQuota` to the types import.

- [ ] **Step 2: Pass computeJobs and countryQuotas to CampaignWorkspace**

Find where `<CampaignWorkspace` is rendered and add the new props:

```tsx
computeJobs={computeJobs}
countryQuotas={countryQuotas}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/app/intake/[id]/page.tsx
git commit -m "feat: pass computeJobs and countryQuotas to CampaignWorkspace from detail page"
```

---

### Task 7: Browser testing

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (should be on `http://localhost:3003`)

- [ ] **Step 2: Open an existing campaign**

Navigate to a campaign detail page. Verify:
- If no country_quotas: workspace renders as before (no CountryBar)
- Backwards compatible — existing campaigns unchanged

- [ ] **Step 3: Create a new campaign with country quotas**

Submit a new intake with 3+ target regions and country quota data. Verify:
- CountryBar appears at top with country tabs + status badges
- "All Countries" tab shows the overview grid with country cards
- Clicking a country card switches to that country's detail view
- CountryHeader shows volume, rate, demographics
- SectionPills navigate between Brief / Personas / Creatives / etc.
- Content filters by country (only that country's assets/actors shown)
- Switching countries is instant (no loading)

- [ ] **Step 4: Test country bar scrolling**

If testing with 6+ countries, verify:
- Country bar scrolls horizontally
- Fade gradient appears on right edge
- All countries accessible via scroll

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: browser testing fixes for unified campaign workspace"
```
