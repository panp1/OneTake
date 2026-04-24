# Country Quotas & Demographics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured per-country volume, rates, and demographic quotas to the intake wizard, with downstream integration into the campaign splitter and persona scaling.

**Architecture:** New `CountryQuotaTable` component in StepDetails with auto-population from target regions, Excel upload, and manual entry. Data stored in `form_data.country_quotas` as JSONB. Campaign splitter reads quotas for per-child volume/rate/demographics and applies persona scaling (2/2 for 1-2 countries, 1/1 for 3+). Extraction prompt updated to detect rate tables and demographic requirements in RFPs.

**Tech Stack:** React (client component), TypeScript, xlsx parser (already in bundle), Python (campaign_splitter.py, stage1, stage2)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/types.ts` | Modify | Add `CountryQuota` and `DemographicQuota` interfaces |
| `src/components/intake/CountryQuotaTable.tsx` | Create | Country quota table with collapsible cards, demographic rows, Excel upload |
| `src/components/intake/StepDetails.tsx` | Modify | Import and render `CountryQuotaTable` below Compensation & Budget |
| `src/components/intake/StepReview.tsx` | Modify | Render country quota summary in review section |
| `src/lib/extraction-prompt.ts` | Modify | Add country_quotas extraction guidance to system prompt |
| `src/app/api/intake/route.ts` | Modify | Auto-calculate `volume_needed` from country quota sum |
| `worker/pipeline/campaign_splitter.py` | Modify | Read country_quotas, inherit per-child data, apply persona scaling |
| `worker/pipeline/stage1_intelligence.py` | Modify | Read `persona_count` from form_data instead of hardcoded 3 |
| `worker/pipeline/stage2_images.py` | Modify | Read `actors_per_persona` from form_data instead of hardcoded 3 |

---

### Task 1: Add TypeScript types

**Files:**
- Modify: `src/lib/types.ts:100` (after `Status` type)

- [ ] **Step 1: Add CountryQuota and DemographicQuota interfaces**

Add after the `Urgency` type definition at line 101:

```typescript
// ============================================================
// COUNTRY QUOTA TYPES (Per-country volume, rates, demographics)
// ============================================================

export interface DemographicQuota {
  category: string;
  value: string;
  percentage: number;
  volume: number;
}

export interface CountryQuota {
  country: string;
  locale: string;
  total_volume: number;
  rate: number;
  currency: string;
  url?: string;
  demographics: DemographicQuota[];
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add CountryQuota and DemographicQuota types"
```

---

### Task 2: Build CountryQuotaTable component

**Files:**
- Create: `src/components/intake/CountryQuotaTable.tsx`

- [ ] **Step 1: Create the component file**

Create `src/components/intake/CountryQuotaTable.tsx` with:

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, Upload, X, Globe, Users } from "lucide-react";
import { toast } from "sonner";
import type { CountryQuota, DemographicQuota } from "@/lib/types";
import type { LocaleLink } from "./LocaleLinksUpload";

interface CountryQuotaTableProps {
  value: CountryQuota[];
  onChange: (quotas: CountryQuota[]) => void;
  targetRegions: string[];
  localeLinks?: LocaleLink[];
  defaultRate?: number;
  confidenceFlags: Record<string, string>;
}

// ── Styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#737373",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #E5E5E5",
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
  color: "#1A1A1A",
  outline: "none",
  boxSizing: "border-box",
};

// ── Helpers ───────────────────────────────────────────────────────────

function makeEmptyQuota(country: string, defaultRate: number): CountryQuota {
  return {
    country,
    locale: "",
    total_volume: 0,
    rate: defaultRate,
    currency: "USD",
    demographics: [],
  };
}

function makeEmptyDemographic(): DemographicQuota {
  return { category: "", value: "", percentage: 0, volume: 0 };
}

function categoryPercentageSum(demographics: DemographicQuota[], category: string): number {
  return demographics
    .filter((d) => d.category.toLowerCase() === category.toLowerCase() && d.category !== "")
    .reduce((sum, d) => sum + d.percentage, 0);
}

// ── Excel parser ──────────────────────────────────────────────────────

async function parseQuotaXlsx(file: File): Promise<CountryQuota[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Find header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row && row.some((c) => String(c || "").toLowerCase().includes("country"))) {
      headerIdx = i;
      break;
    }
  }

  // Map columns by header name
  const headers = (rows[headerIdx] || []).map((h) => String(h || "").toLowerCase().trim());
  const col = (name: string) => headers.findIndex((h) => h.includes(name));
  const iCountry = col("country");
  const iVolume = col("volume");
  const iRate = col("rate");
  const iCategory = col("category");
  const iValue = col("value");
  const iPercentage = col("percent");

  if (iCountry < 0) {
    throw new Error("Missing 'Country' column in spreadsheet");
  }

  // Group rows by country
  const countryMap = new Map<string, CountryQuota>();

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[iCountry]) continue;

    const country = String(row[iCountry]).trim();
    if (!countryMap.has(country)) {
      countryMap.set(country, {
        country,
        locale: "",
        total_volume: iVolume >= 0 ? Number(row[iVolume]) || 0 : 0,
        rate: iRate >= 0 ? Number(String(row[iRate]).replace(/[^0-9.]/g, "")) || 0 : 0,
        currency: "USD",
        demographics: [],
      });
    }

    const quota = countryMap.get(country)!;

    // If volume/rate appears on subsequent rows for same country, use the first non-zero
    if (quota.total_volume === 0 && iVolume >= 0) {
      quota.total_volume = Number(row[iVolume]) || 0;
    }
    if (quota.rate === 0 && iRate >= 0) {
      quota.rate = Number(String(row[iRate]).replace(/[^0-9.]/g, "")) || 0;
    }

    // Parse demographic row if category column exists and has a value
    if (iCategory >= 0 && row[iCategory]) {
      const pct = iPercentage >= 0 ? Number(row[iPercentage]) || 0 : 0;
      quota.demographics.push({
        category: String(row[iCategory]).trim(),
        value: iValue >= 0 ? String(row[iValue] || "").trim() : "",
        percentage: pct,
        volume: Math.round(quota.total_volume * pct / 100),
      });
    }
  }

  return Array.from(countryMap.values());
}

// ── Demographic Row ───────────────────────────────────────────────────

function DemographicRow({
  demo,
  totalVolume,
  allDemographics,
  onChange,
  onRemove,
}: {
  demo: DemographicQuota;
  totalVolume: number;
  allDemographics: DemographicQuota[];
  onChange: (updated: DemographicQuota) => void;
  onRemove: () => void;
}) {
  const catSum = categoryPercentageSum(allDemographics, demo.category);
  const overBudget = demo.category !== "" && catSum > 100;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 32px", gap: 8, alignItems: "center" }}>
      <input
        type="text"
        value={demo.category}
        onChange={(e) => onChange({ ...demo, category: e.target.value })}
        placeholder="e.g. Ethnicity"
        style={inputStyle}
      />
      <input
        type="text"
        value={demo.value}
        onChange={(e) => onChange({ ...demo, value: e.target.value })}
        placeholder="e.g. Middle Eastern"
        style={inputStyle}
      />
      <input
        type="number"
        min={0}
        max={100}
        value={demo.percentage || ""}
        onChange={(e) => {
          const pct = Number(e.target.value) || 0;
          onChange({ ...demo, percentage: pct, volume: Math.round(totalVolume * pct / 100) });
        }}
        placeholder="%"
        style={{
          ...inputStyle,
          borderColor: overBudget ? "#f59e0b" : "#E5E5E5",
          textAlign: "center",
        }}
      />
      <span style={{ fontSize: 13, color: "#737373", textAlign: "center" }}>
        {demo.percentage > 0 ? Math.round(totalVolume * demo.percentage / 100).toLocaleString() : "—"}
      </span>
      <button
        type="button"
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#737373",
          borderRadius: 6,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ── Country Card ──────────────────────────────────────────────────────

function CountryCard({
  quota,
  onChange,
  onRemove,
}: {
  quota: CountryQuota;
  onChange: (updated: CountryQuota) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const demoCount = quota.demographics.length;
  const chevron = expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />;

  function updateDemographic(index: number, updated: DemographicQuota) {
    const next = [...quota.demographics];
    next[index] = updated;
    onChange({ ...quota, demographics: next });
  }

  function removeDemographic(index: number) {
    const next = quota.demographics.filter((_, i) => i !== index);
    onChange({ ...quota, demographics: next });
  }

  function addDemographic() {
    onChange({ ...quota, demographics: [...quota.demographics, makeEmptyDemographic()] });
  }

  // Collapsed view
  if (!expanded) {
    return (
      <div
        style={{
          border: "1px solid #E5E5E5",
          borderRadius: 12,
          padding: "14px 20px",
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(true)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {chevron}
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{quota.country}</span>
          <span style={{ fontSize: 12, color: "#737373" }}>
            {quota.total_volume.toLocaleString()} contributors | ${quota.rate.toFixed(2)}/person
            {demoCount > 0 && ` | ${demoCount} demographic rule${demoCount > 1 ? "s" : ""}`}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", padding: 4 }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  // Expanded view
  return (
    <div
      style={{
        border: "1px solid #E5E5E5",
        borderRadius: 12,
        background: "#FFFFFF",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          borderBottom: "1px solid #E5E5E5",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(false)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {chevron}
          <Globe size={16} color="#737373" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{quota.country}</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#737373", padding: 4 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "20px" }}>
        {/* Volume / Rate / Locale row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>Volume</label>
            <input
              type="number"
              min={0}
              value={quota.total_volume || ""}
              onChange={(e) => {
                const vol = Number(e.target.value) || 0;
                const updatedDemos = quota.demographics.map((d) => ({
                  ...d,
                  volume: Math.round(vol * d.percentage / 100),
                }));
                onChange({ ...quota, total_volume: vol, demographics: updatedDemos });
              }}
              placeholder="e.g. 1000"
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          <div>
            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>Rate ($)</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#737373", fontSize: 13, pointerEvents: "none" }}>$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={quota.rate || ""}
                onChange={(e) => onChange({ ...quota, rate: Number(e.target.value) || 0 })}
                placeholder="0.00"
                style={{ ...inputStyle, width: "100%", paddingLeft: 28 }}
              />
            </div>
          </div>
          <div>
            <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>Locale</label>
            <input
              type="text"
              value={quota.locale}
              onChange={(e) => onChange({ ...quota, locale: e.target.value })}
              placeholder="e.g. en_US"
              style={{ ...inputStyle, width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
            />
          </div>
        </div>

        {/* Demographics section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Users size={14} color="#737373" />
            <span style={labelStyle}>Demographics</span>
          </div>

          {quota.demographics.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 32px", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#737373", fontWeight: 600, textTransform: "uppercase" }}>Category</span>
                <span style={{ fontSize: 10, color: "#737373", fontWeight: 600, textTransform: "uppercase" }}>Value</span>
                <span style={{ fontSize: 10, color: "#737373", fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>%</span>
                <span style={{ fontSize: 10, color: "#737373", fontWeight: 600, textTransform: "uppercase", textAlign: "center" }}>Volume</span>
                <span />
              </div>
              {/* Demographic rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {quota.demographics.map((demo, i) => (
                  <DemographicRow
                    key={i}
                    demo={demo}
                    totalVolume={quota.total_volume}
                    allDemographics={quota.demographics}
                    onChange={(updated) => updateDemographic(i, updated)}
                    onRemove={() => removeDemographic(i)}
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={addDemographic}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "#737373",
              background: "none",
              border: "1px dashed #E5E5E5",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Plus size={12} />
            Add Requirement
          </button>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #F5F5F5", fontSize: 12, color: "#737373" }}>
          Total: {quota.total_volume.toLocaleString()} contributors | ${quota.rate.toFixed(2)}/person
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function CountryQuotaTable({
  value,
  onChange,
  targetRegions,
  localeLinks,
  defaultRate = 0,
  confidenceFlags,
}: CountryQuotaTableProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allExpanded, setAllExpanded] = useState(true);

  // Auto-populate from target regions
  useEffect(() => {
    const existingCountries = new Set(value.map((q) => q.country.toLowerCase()));
    const newQuotas: CountryQuota[] = [];

    for (const region of targetRegions) {
      if (!existingCountries.has(region.toLowerCase())) {
        newQuotas.push(makeEmptyQuota(region, defaultRate));
        existingCountries.add(region.toLowerCase());
      }
    }

    // Remove quotas for regions no longer in targetRegions (only if they have no data entered)
    const regionSet = new Set(targetRegions.map((r) => r.toLowerCase()));
    const kept = value.filter((q) => {
      if (regionSet.has(q.country.toLowerCase())) return true;
      // Keep if data was entered (volume > 0 or has demographics)
      return q.total_volume > 0 || q.demographics.length > 0 || q.rate > 0;
    });

    if (newQuotas.length > 0 || kept.length !== value.length) {
      onChange([...kept, ...newQuotas]);
    }
  }, [targetRegions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge locale links when they change
  useEffect(() => {
    if (!localeLinks || localeLinks.length === 0) return;

    let changed = false;
    const updated = value.map((q) => {
      const match = localeLinks.find((ll) => {
        const llCountry = ll.language.replace(/\s*\(.*\)/, "").toLowerCase();
        return llCountry === q.country.toLowerCase() || ll.locale.toLowerCase().endsWith(q.country.toLowerCase().slice(0, 2));
      });
      if (match && !q.locale) {
        changed = true;
        const parsedRate = Number(match.rate.replace(/[^0-9.]/g, "")) || 0;
        return {
          ...q,
          locale: match.locale,
          url: match.url,
          rate: q.rate === 0 && parsedRate > 0 ? parsedRate : q.rate,
        };
      }
      return q;
    });

    if (changed) onChange(updated);
  }, [localeLinks]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateQuota(index: number, updated: CountryQuota) {
    const next = [...value];
    next[index] = updated;
    onChange(next);
  }

  function removeQuota(index: number) {
    const q = value[index];
    if (q.total_volume > 0 || q.demographics.length > 0) {
      if (!confirm(`Remove ${q.country}? This will delete its volume, rate, and demographic data.`)) return;
    }
    onChange(value.filter((_, i) => i !== index));
  }

  function addCountry() {
    const name = prompt("Enter country name:");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (value.some((q) => q.country.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`${trimmed} already exists`);
      return;
    }
    onChange([...value, makeEmptyQuota(trimmed, defaultRate)]);
  }

  async function handleExcelUpload(file: File) {
    if (!file.name.match(/\.(xlsx?|csv)$/i)) {
      toast.error("Please upload an Excel (.xlsx) or CSV file");
      return;
    }
    try {
      const parsed = await parseQuotaXlsx(file);
      if (parsed.length === 0) {
        toast.error("No country data found in the spreadsheet");
        return;
      }
      // Merge with existing: overwrite matching countries, add new ones
      const existingMap = new Map(value.map((q) => [q.country.toLowerCase(), q]));
      for (const pq of parsed) {
        existingMap.set(pq.country.toLowerCase(), pq);
      }
      onChange(Array.from(existingMap.values()));
      toast.success(`Loaded ${parsed.length} country quotas`);
    } catch (err) {
      console.error("Quota XLSX parse error:", err);
      toast.error("Failed to parse spreadsheet");
    }
  }

  // Summary stats
  const totalVolume = value.reduce((sum, q) => sum + q.total_volume, 0);
  const totalCountries = value.length;
  const avgRate = totalCountries > 0
    ? value.reduce((sum, q) => sum + q.rate, 0) / totalCountries
    : 0;

  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Globe size={16} color="#737373" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#737373", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Country Quotas &amp; Demographics
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {value.length >= 6 && (
            <button
              type="button"
              onClick={() => setAllExpanded(!allExpanded)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#737373",
                background: "none",
                border: "1px solid #E5E5E5",
                borderRadius: 9999,
                padding: "6px 14px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleExcelUpload(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
            style={{
              fontSize: 11,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 9999,
              border: "1px solid #E5E5E5",
              background: "#FFFFFF",
              color: "#1A1A1A",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Upload size={12} />
            Upload Excel
          </button>
          <button
            type="button"
            onClick={addCountry}
            style={{
              fontSize: 11,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 9999,
              border: "none",
              background: "#32373C",
              color: "#FFFFFF",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Plus size={12} />
            Add Country
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "#737373", margin: "0 0 16px 0" }}>
        Per-country volume, rates, and demographic requirements. Cards auto-populate from Target Regions above.
      </p>

      {/* Country cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {value.map((quota, i) => (
          <CountryCard
            key={quota.country}
            quota={quota}
            onChange={(updated) => updateQuota(i, updated)}
            onRemove={() => removeQuota(i)}
          />
        ))}
      </div>

      {/* Summary footer */}
      {value.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 20px",
            background: "#F5F5F5",
            borderRadius: 10,
            textAlign: "center",
            fontSize: 13,
            color: "#1A1A1A",
            fontWeight: 500,
          }}
        >
          {totalCountries} {totalCountries === 1 ? "country" : "countries"} | {totalVolume.toLocaleString()} total contributors | Avg rate: ${avgRate.toFixed(2)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/intake/CountryQuotaTable.tsx
git commit -m "feat: add CountryQuotaTable component with collapsible cards, demographics, Excel upload"
```

---

### Task 3: Wire CountryQuotaTable into StepDetails

**Files:**
- Modify: `src/components/intake/StepDetails.tsx`

- [ ] **Step 1: Add import at top of file**

Add after the existing imports (line 2):

```typescript
import CountryQuotaTable from "./CountryQuotaTable";
import type { CountryQuota } from "@/lib/types";
import type { LocaleLink } from "./LocaleLinksUpload";
```

- [ ] **Step 2: Update StepDetailsProps interface**

Replace the interface at line 6:

```typescript
interface StepDetailsProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  confidenceFlags: Record<string, string>;
  localeLinks?: LocaleLink[];
}
```

- [ ] **Step 3: Add CountryQuotaTable section below Compensation & Budget**

After the closing `</div>` of the Compensation sub-section (after line 429), add before the final closing `</div>`:

```tsx
      {/* Country Quotas & Demographics */}
      <div style={{ borderTop: "1px solid #E5E5E5", marginTop: 36, paddingTop: 32 }}>
        <CountryQuotaTable
          value={(formData.country_quotas as CountryQuota[] | undefined) ?? []}
          onChange={(quotas) => {
            const totalVolume = quotas.reduce((sum, q) => sum + q.total_volume, 0);
            onChange({
              ...formData,
              country_quotas: quotas,
              volume_needed: totalVolume > 0 ? totalVolume : formData.volume_needed,
            });
          }}
          targetRegions={(formData.target_regions as string[] | undefined) ?? []}
          localeLinks={localeLinks}
          defaultRate={(formData.compensation_rate as number | undefined) ?? 0}
          confidenceFlags={confidenceFlags}
        />
      </div>
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 5: Test in browser**

Open `http://localhost:3003`, start a new intake, go to StepDetails. Verify:
- Country Quotas section appears below Compensation & Budget
- Adding a Target Region tag auto-creates a country card
- Cards expand/collapse
- Demographic rows can be added with category/value/percentage
- Volume auto-calculates from percentage

- [ ] **Step 6: Commit**

```bash
git add src/components/intake/StepDetails.tsx
git commit -m "feat: wire CountryQuotaTable into StepDetails with auto-population and locale merge"
```

---

### Task 4: Update IntakeWizard to pass localeLinks to StepDetails

**Files:**
- Modify: `src/components/intake/IntakeWizard.tsx`

- [ ] **Step 1: Find the StepDetails render and add localeLinks prop**

In `IntakeWizard.tsx`, find where `<StepDetails` is rendered and add:

```tsx
localeLinks={(formData.locale_links as LocaleLink[] | undefined) ?? []}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/components/intake/IntakeWizard.tsx
git commit -m "feat: pass localeLinks from wizard to StepDetails for rate merge"
```

---

### Task 5: Add country quota summary to StepReview

**Files:**
- Modify: `src/components/intake/StepReview.tsx`

- [ ] **Step 1: Add CountryQuota import**

Add at line 2:

```typescript
import type { CountryQuota } from "@/lib/types";
```

- [ ] **Step 2: Add country quota summary section**

After the Project Details section closing `</div>` (around line 322), add a new section before the Requirements section:

```tsx
        {/* ── Section 2.5: Country Quotas ────────────────────────────────── */}
        {countryQuotas.length > 0 && (
          <div
            style={{
              padding: "28px 32px",
              borderBottom: "1px solid #E8E8EA",
            }}
          >
            <SectionHeader
              icon={<Globe size={15} />}
              title="Country Quotas"
              stepIndex={2}
              onEditStep={onEditStep}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {countryQuotas.map((q) => (
                <div
                  key={q.country}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    background: "#F5F5F5",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#1A1A1A" }}>{q.country}</span>
                  <div style={{ display: "flex", gap: 16, color: "#737373", fontSize: 12 }}>
                    <span>{q.total_volume.toLocaleString()} contributors</span>
                    <span>${q.rate.toFixed(2)}/person</span>
                    {q.demographics.length > 0 && (
                      <span>{q.demographics.length} demographic rule{q.demographics.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "#737373", textAlign: "center" }}>
              {countryQuotas.length} {countryQuotas.length === 1 ? "country" : "countries"} | {countryQuotas.reduce((s, q) => s + q.total_volume, 0).toLocaleString()} total contributors
            </div>
          </div>
        )}
```

- [ ] **Step 3: Add Globe import and countryQuotas variable**

Add `Globe` to the lucide-react imports at line 1:

```typescript
import { LayoutGrid, FileText, Users, AlertCircle, Globe } from "lucide-react";
```

Inside the component function, add before `missingFields`:

```typescript
const countryQuotas = (formData.country_quotas as CountryQuota[] | undefined) ?? [];
```

- [ ] **Step 4: Verify no TypeScript errors and test in browser**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/components/intake/StepReview.tsx
git commit -m "feat: show country quota summary in StepReview"
```

---

### Task 6: Update extraction prompt for country quotas

**Files:**
- Modify: `src/lib/extraction-prompt.ts`

- [ ] **Step 1: Add country_quotas extraction guidance**

In `buildExtractionSystemPrompt()`, add the following text before the closing backtick of the return template (before line 109):

```typescript
- **Country quotas and locale rates**: Look for per-country or per-locale compensation tables in the document. These often appear as columns: Job Title, Locale, Language, Rate/Pay. Also look for demographic requirements or quotas (e.g., "50% female", "ages 18-35", "Middle Eastern descent", skin color specifications). Volume requirements per country or locale. Structure these as "country_quotas" in base_fields — an array of objects: {"country": "...", "locale": "...", "total_volume": N, "rate": N, "currency": "USD", "demographics": [{"category": "...", "value": "...", "percentage": N}]}. If you find a rate table but no volume or demographic data, still extract the countries and rates with total_volume: 0 and empty demographics.
```

- [ ] **Step 2: Add country_quotas to the output format JSON example**

In the output format JSON block, add inside `"base_fields"`:

```json
"country_quotas": [{"country": "...", "locale": "...", "total_volume": 0, "rate": 0, "currency": "USD", "demographics": []}]
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/extraction-prompt.ts
git commit -m "feat: add country quota and demographic extraction guidance to RFP prompt"
```

---

### Task 7: Auto-calculate volume_needed from country quotas in intake API

**Files:**
- Modify: `src/app/api/intake/route.ts`

- [ ] **Step 1: Add volume auto-calculation**

In the `POST` handler, after `const formData = body.form_data ?? {};` (line 76), add:

```typescript
    // Auto-calculate volume_needed from country quotas if present
    const countryQuotas = formData.country_quotas as Array<{ total_volume?: number }> | undefined;
    const quotaVolume = countryQuotas && countryQuotas.length > 0
      ? countryQuotas.reduce((sum: number, q) => sum + (q.total_volume || 0), 0)
      : null;
```

- [ ] **Step 2: Update the createIntakeRequest call**

Change the `volume_needed` line in the `createIntakeRequest` call (line 137):

```typescript
      volume_needed: quotaVolume ?? body.volume_needed ?? null,
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/intake/route.ts
git commit -m "feat: auto-calculate volume_needed from country quotas in intake API"
```

---

### Task 8: Update campaign splitter to read country quotas and apply persona scaling

**Files:**
- Modify: `worker/pipeline/campaign_splitter.py`

- [ ] **Step 1: Add persona scaling constants**

After `SPLIT_THRESHOLD = 3` (line 28), add:

```python
# Persona/actor scaling by country count.
# Fewer countries = deeper creative variety per country.
PERSONA_SCALING = {
    1: {"personas": 2, "actors_per_persona": 2},
    2: {"personas": 2, "actors_per_persona": 2},
}
PERSONA_SCALING_DEFAULT = {"personas": 1, "actors_per_persona": 1}  # 3+ countries


def get_persona_scaling(country_count: int) -> dict:
    """Return persona/actor counts for a given number of target countries."""
    return PERSONA_SCALING.get(country_count, PERSONA_SCALING_DEFAULT)
```

- [ ] **Step 2: Update split_campaign to read country_quotas**

In `split_campaign()`, after `all_language_pairs = form_data.get("language_pairs", [])` (line 169), add:

```python
    # Read structured country quotas if available
    country_quotas = form_data.get("country_quotas", [])
    quota_by_country = {}
    if country_quotas:
        for cq in country_quotas:
            if isinstance(cq, dict) and cq.get("country"):
                quota_by_country[cq["country"].lower()] = cq

    # Determine persona scaling based on total country count
    scaling = get_persona_scaling(len(country_regions))
```

- [ ] **Step 3: Update child form_data construction**

In the `for country, country_region_list in country_regions.items():` loop, after `child_form["cities"] = cities` (line 205), add:

```python
        # Inherit country quota data if available
        cq = quota_by_country.get(country.lower(), {})
        if cq:
            child_form["locale_rate"] = {"amount": cq.get("rate", 0), "currency": cq.get("currency", "USD")}
            child_form["demographics"] = cq.get("demographics", [])
            child_form["locale"] = cq.get("locale", "")
            if cq.get("url"):
                child_form["job_posting_url"] = cq["url"]
            if cq.get("total_volume", 0) > 0:
                child_form["target_volume"] = cq["total_volume"]

        # Apply persona scaling
        child_form["persona_count"] = scaling["personas"]
        child_form["actors_per_persona"] = scaling["actors_per_persona"]
```

- [ ] **Step 4: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.campaign_splitter; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add worker/pipeline/campaign_splitter.py
git commit -m "feat: read country_quotas in splitter, inherit per-child rate/demographics, add persona scaling"
```

---

### Task 9: Update Stage 1 to read persona_count from form_data

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Update persona generation to use dynamic count**

Find line 650 where personas are capped:

```python
    return personas[:3]
```

Replace with:

```python
    return personas[:persona_count]
```

And update the function signature of `_generate_personas_dynamic` (line 602) to accept `persona_count`:

```python
async def _generate_personas_dynamic(
    request: dict,
    cultural_research: dict | None,
    persona_constraints: dict,
    persona_count: int = 2,
) -> list[dict]:
```

- [ ] **Step 2: Update the caller to pass persona_count**

Find where `_generate_personas_dynamic` is called (around line 161). Add `persona_count` from form_data:

```python
    persona_count = request.get("form_data", {}).get("persona_count", 2)
    personas = await _generate_personas_dynamic(
        request,
        cultural_research,
        persona_constraints={},
        persona_count=persona_count,
    )
```

Also update the retry call (around line 503):

```python
                personas = await _generate_personas_dynamic(
                    request,
                    cultural_research,
                    persona_constraints=persona_constraints,
                    persona_count=persona_count,
                )
```

- [ ] **Step 3: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.stage1_intelligence; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/stage1_intelligence.py
git commit -m "feat: read persona_count from form_data instead of hardcoded 3"
```

---

### Task 10: Update Stage 2 to read actors_per_persona from form_data

**Files:**
- Modify: `worker/pipeline/stage2_images.py`

- [ ] **Step 1: Find the actor generation loop**

Search for where actors are generated per persona. Find the loop that iterates over personas and generates actors (likely iterating 3 times per persona). Update it to read `actors_per_persona` from the request:

```python
    actors_per_persona = request.get("form_data", {}).get("actors_per_persona", 2)
```

Use this variable instead of any hardcoded count when determining how many actors to generate per persona.

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.stage2_images; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage2_images.py
git commit -m "feat: read actors_per_persona from form_data instead of hardcoded value"
```

---

### Task 11: End-to-end test

- [ ] **Step 1: Verify dev server is running**

Open `http://localhost:3003` and start a new intake.

- [ ] **Step 2: Test country quota flow**

1. In StepDetails, type "Morocco", "France", "Germany" as Target Regions
2. Verify 3 country cards auto-appear in Country Quotas section
3. Set volumes: Morocco=500, France=800, Germany=300
4. Set rates: Morocco=$17.50, France=$37.50, Germany=$37.50
5. Add demographics to Morocco: Category="Ethnicity", Value="Arab", Percentage=60
6. Verify Volume column shows 300
7. Verify Contributors Needed field shows 1600 (sum of all)
8. Verify summary footer shows "3 countries | 1,600 total contributors | Avg rate: $30.83"

- [ ] **Step 3: Test StepReview**

Navigate to the Review step and verify country quotas appear with correct values.

- [ ] **Step 4: Test submission**

Submit the intake and verify:
- `volume_needed` is saved as 1600 in the database
- `form_data.country_quotas` is saved as JSON array with all data

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: end-to-end test fixes for country quotas"
```
