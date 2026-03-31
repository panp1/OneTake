# Recruiter Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the recruiter experience into a Campaign Briefing Portal with rich status cards on the dashboard and a full briefing page (creatives, messaging themes, personas) for approved campaigns.

**Architecture:** Two components redesigned — `IntakeCard` gets a recruiter variant with color-coded borders and human-readable status labels; `RecruiterDetailView` gets a full rewrite adding messaging themes, platform-filtered creatives grid, and persona cards. A new `getRecruiterStatus()` helper in `format.ts` maps technical statuses to recruiter-friendly labels. The parent detail page passes the `brief` prop down to RecruiterDetailView.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Lucide React icons, existing API endpoints

---

### Task 1: Add `getRecruiterStatus()` helper to format.ts

**Files:**
- Modify: `src/lib/format.ts`

- [ ] **Step 1: Add the recruiter status mapping function**

Append to the end of `src/lib/format.ts`:

```typescript
/**
 * Map technical pipeline status to recruiter-friendly labels.
 */
export interface RecruiterStatusInfo {
  label: string;
  description: string;
  color: string;       // text/badge color
  bgColor: string;     // badge background
  borderColor: string; // card left border
}

const RECRUITER_STATUS_MAP: Record<string, RecruiterStatusInfo> = {
  draft: {
    label: "Submitted",
    description: "Your request has been received",
    color: "#52525b",
    bgColor: "#f4f4f5",
    borderColor: "#a1a1aa",
  },
  generating: {
    label: "Creating Assets",
    description: "Marketing is generating creative options",
    color: "#1e40af",
    bgColor: "#dbeafe",
    borderColor: "#3b82f6",
  },
  review: {
    label: "Marketing Review",
    description: "Marketing team is reviewing creatives",
    color: "#854d0e",
    bgColor: "#fef9c3",
    borderColor: "#f59e0b",
  },
  approved: {
    label: "Ready for Download",
    description: "Approved! Download your campaign package",
    color: "#166534",
    bgColor: "#dcfce7",
    borderColor: "#22c55e",
  },
  sent: {
    label: "Delivered",
    description: "Package sent to ad agency",
    color: "#155e75",
    bgColor: "#cffafe",
    borderColor: "#06b6d4",
  },
  rejected: {
    label: "Changes Needed",
    description: "Marketing requested changes to your request",
    color: "#991b1b",
    bgColor: "#fee2e2",
    borderColor: "#ef4444",
  },
};

export function getRecruiterStatus(status: string): RecruiterStatusInfo {
  return RECRUITER_STATUS_MAP[status] ?? RECRUITER_STATUS_MAP.draft;
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat: add getRecruiterStatus() helper for recruiter-friendly status labels"
```

---

### Task 2: Create RecruiterIntakeCard component

**Files:**
- Create: `src/components/RecruiterIntakeCard.tsx`

- [ ] **Step 1: Create the recruiter card component**

```typescript
"use client";

import Link from "next/link";
import { Download, Layers } from "lucide-react";
import { getRecruiterStatus } from "@/lib/format";
import type { IntakeRequest } from "@/lib/types";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface RecruiterIntakeCardProps {
  request: IntakeRequest;
  assetCounts?: { images: number; creatives: number; videos: number };
  thumbnails?: string[];
}

export default function RecruiterIntakeCard({
  request,
  assetCounts,
  thumbnails,
}: RecruiterIntakeCardProps) {
  const status = getRecruiterStatus(request.status);
  const isReady = request.status === "approved" || request.status === "sent";
  const totalAssets = assetCounts
    ? assetCounts.images + assetCounts.creatives + assetCounts.videos
    : 0;

  return (
    <Link
      href={`/intake/${request.id}`}
      className="block bg-white border border-[var(--border)] rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all duration-150"
      style={{ borderLeft: `3px solid ${status.borderColor}` }}
    >
      <div className="p-5">
        {/* Title + subtitle */}
        <div className="mb-2">
          <h3 className="text-[14px] font-semibold text-[var(--foreground)] leading-snug">
            {request.title}
          </h3>
          <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
            {request.task_type.replace(/_/g, " ")}
            {request.target_regions?.length > 0 &&
              ` · ${request.target_regions.join(", ")}`}
            {request.target_languages?.length > 0 &&
              ` · ${request.target_languages.slice(0, 3).join(", ")}${
                request.target_languages.length > 3
                  ? ` +${request.target_languages.length - 3}`
                  : ""
              }`}
          </p>
        </div>

        {/* Status badge + asset counts */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span
            className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: status.bgColor, color: status.color }}
          >
            {status.label}
          </span>
          {isReady && totalAssets > 0 && (
            <span className="text-[11px] text-[var(--muted-foreground)]">
              {assetCounts!.creatives > 0 && `${assetCounts!.creatives} creatives`}
              {assetCounts!.images > 0 && ` · ${assetCounts!.images} images`}
              {assetCounts!.videos > 0 && ` · ${assetCounts!.videos} videos`}
            </span>
          )}
        </div>

        {/* Description + thumbnails row */}
        <div className="flex items-end justify-between gap-3">
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed flex-1">
            {status.description}
          </p>

          {/* Thumbnails for approved campaigns */}
          {isReady && thumbnails && thumbnails.length > 0 && (
            <div className="flex gap-1 shrink-0">
              {thumbnails.slice(0, 3).map((url, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--muted)] border border-[var(--border)]"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
              {totalAssets > 3 && (
                <div className="w-10 h-10 rounded-lg bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center">
                  <span className="text-[10px] text-[var(--muted-foreground)] font-medium">
                    +{totalAssets - 3}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: time ago */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {timeAgo(request.created_at)}
          </span>
          {isReady && (
            <span className="text-[10px] font-medium" style={{ color: status.color }}>
              View package →
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/RecruiterIntakeCard.tsx
git commit -m "feat: add RecruiterIntakeCard with rich status cards and thumbnails"
```

---

### Task 3: Wire RecruiterIntakeCard into dashboard page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add import for RecruiterIntakeCard**

At the top of `src/app/page.tsx`, add this import alongside the existing ones:

```typescript
import RecruiterIntakeCard from "@/components/RecruiterIntakeCard";
```

- [ ] **Step 2: Replace IntakeCard with RecruiterIntakeCard for recruiter role**

In the card grid section (the `filtered.map` around line 208), replace the existing card rendering block:

Find this code:
```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((request) => (
              <IntakeCard key={request.id} request={request} />
            ))}
          </div>
```

Replace with:
```tsx
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((request) =>
              role === "recruiter" ? (
                <RecruiterIntakeCard key={request.id} request={request} />
              ) : (
                <IntakeCard key={request.id} request={request} />
              )
            )}
          </div>
```

- [ ] **Step 3: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: use RecruiterIntakeCard for recruiter role on dashboard"
```

---

### Task 4: Pass brief prop to RecruiterDetailView

**Files:**
- Modify: `src/app/intake/[id]/page.tsx`

- [ ] **Step 1: Add brief to RecruiterDetailView invocation**

Find this block (around line 310-319):
```tsx
  if (role === "recruiter") {
    return (
      <AppShell>
        <RecruiterDetailView
          request={request}
          assets={assets}
          pipelineRuns={pipelineRuns}
        />
      </AppShell>
    );
  }
```

Replace with:
```tsx
  if (role === "recruiter") {
    return (
      <AppShell>
        <RecruiterDetailView
          request={request}
          brief={brief}
          assets={assets}
          pipelineRuns={pipelineRuns}
        />
      </AppShell>
    );
  }
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds (TypeScript may warn about extra prop until Task 5 updates the interface — that's fine, it won't error)

- [ ] **Step 3: Commit**

```bash
git add src/app/intake/[id]/page.tsx
git commit -m "feat: pass brief data to RecruiterDetailView"
```

---

### Task 5: Rewrite RecruiterDetailView as Campaign Briefing Page

**Files:**
- Modify: `src/components/RecruiterDetailView.tsx` (full rewrite)

- [ ] **Step 1: Rewrite RecruiterDetailView**

Replace the entire contents of `src/components/RecruiterDetailView.tsx` with:

```typescript
"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  Layers,
  MessageSquare,
  Users,
  FileText,
} from "lucide-react";
import PipelineProgress from "@/components/PipelineProgress";
import { getRecruiterStatus, extractField } from "@/lib/format";
import type {
  IntakeRequest,
  CreativeBrief,
  GeneratedAsset,
  ComputeJob,
  PipelineRun,
} from "@/lib/types";

interface RecruiterDetailViewProps {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  pipelineRuns: PipelineRun[];
}

// ── Persona colors (rotate) ──────────────────────
const PERSONA_COLORS = ["#9B51E0", "#0693E3", "#22c55e", "#f59e0b"];

// ── Value prop tag colors (rotate) ───────────────
const TAG_STYLES = [
  { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  { bg: "#fdf4ff", border: "#e9d5ff", text: "#6b21a8" },
  { bg: "#fefce8", border: "#fde68a", text: "#854d0e" },
  { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
];

export default function RecruiterDetailView({
  request,
  brief,
  assets,
  pipelineRuns,
}: RecruiterDetailViewProps) {
  const [computeJob, setComputeJob] = useState<ComputeJob | null>(null);
  const [localPipelineRuns, setLocalPipelineRuns] = useState<PipelineRun[]>(pipelineRuns);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const status = getRecruiterStatus(request.status);
  const isApproved = request.status === "approved" || request.status === "sent";

  // Only show assets that passed evaluation
  const approvedAssets = assets.filter((a) => a.evaluation_passed === true);

  // Get unique platforms for filter
  const platforms = Array.from(new Set(approvedAssets.map((a) => a.platform).filter(Boolean))).sort();

  // Filter assets by platform
  const filteredAssets =
    platformFilter === "all"
      ? approvedAssets
      : approvedAssets.filter((a) => a.platform === platformFilter);

  // Asset counts
  const imageCount = assets.filter((a) => a.asset_type === "base_image" && a.evaluation_passed).length;
  const creativeCount = assets.filter((a) => a.asset_type === "composed_creative" && a.evaluation_passed).length;
  const videoCount = assets.filter((a) => (a.asset_type as string) === "video").length;

  // Brief data
  const briefData = brief?.brief_data as Record<string, any> | undefined;
  const messaging = briefData?.messaging_strategy as Record<string, any> | undefined;
  const valueProps = (briefData?.value_props || messaging?.value_propositions || []) as string[];
  const personas = (briefData?.personas || []) as Array<{
    name: string;
    demographics?: string;
    age_range?: string;
    pain_point?: string;
    primary_motivation?: string;
    [key: string]: any;
  }>;

  // Poll compute job while generating
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/compute/status/${request.id}`);
      if (res.ok) {
        const { latest } = await res.json();
        setComputeJob(latest ?? null);
      }
    } catch {}
  }, [request.id]);

  useEffect(() => {
    if (request.status !== "generating") return;
    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [request.status, pollStatus]);

  useEffect(() => {
    setLocalPipelineRuns(pipelineRuns);
  }, [pipelineRuns]);

  function handleDownloadAll() {
    for (const asset of approvedAssets) {
      if (asset.blob_url) window.open(asset.blob_url, "_blank");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Accent stripe */}
      <div className="gradient-accent h-1" />

      {/* Header */}
      <div className="bg-white border-b border-[var(--border)] px-4 pl-14 lg:pl-6 md:pr-10 lg:px-10 py-4">
        <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              href="/"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">
                {request.title}
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                {request.task_type.replace(/_/g, " ")} &middot; Created{" "}
                {new Date(request.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
            <span
              className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: status.bgColor, color: status.color }}
            >
              {status.label}
            </span>
            {isApproved && approvedAssets.length > 0 && (
              <button
                onClick={handleDownloadAll}
                className="btn-primary text-xs px-4 py-1.5 cursor-pointer"
              >
                <Download size={14} />
                Download All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 md:px-10 py-6 md:py-8 max-w-[1100px] mx-auto space-y-6">

        {/* ── Campaign Summary ──────────────────────────── */}
        <section className="card p-5 md:p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted-foreground)] mb-2">
            Campaign Summary
          </div>
          <p className="text-[14px] text-[var(--foreground)] leading-relaxed">
            {briefData?.summary || `${request.task_type.replace(/_/g, " ")} campaign targeting ${request.target_regions?.join(", ") || "global"}.`}
          </p>
          <div className="flex flex-wrap gap-4 mt-3">
            {request.target_regions?.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0693E3]" />
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  Regions: <strong className="text-[var(--foreground)]">{request.target_regions.join(", ")}</strong>
                </span>
              </div>
            )}
            {request.target_languages?.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#9B51E0]" />
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  Languages: <strong className="text-[var(--foreground)]">{request.target_languages.join(", ")}</strong>
                </span>
              </div>
            )}
            {isApproved && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  Assets: <strong className="text-[var(--foreground)]">
                    {[
                      creativeCount > 0 && `${creativeCount} creatives`,
                      imageCount > 0 && `${imageCount} images`,
                      videoCount > 0 && `${videoCount} videos`,
                    ].filter(Boolean).join(" · ")}
                  </strong>
                </span>
              </div>
            )}
          </div>
        </section>

        {/* ── Status Card (pre-approval states) ─────────── */}
        {!isApproved && (
          <section className="card p-5 md:p-6">
            {request.status === "generating" && (
              <>
                <div className="flex items-center gap-3 text-sm text-blue-700 mb-4">
                  <Loader2 size={18} className="animate-spin shrink-0" />
                  <div>
                    <p className="font-semibold">Creating Assets</p>
                    <p className="text-[var(--muted-foreground)] mt-0.5">
                      Marketing is generating creative options for your campaign. Check back shortly.
                    </p>
                  </div>
                </div>
                {/* Compute job banner */}
                {computeJob?.status === "processing" && (
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-3 mb-4">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Generating creatives...</span>
                  </div>
                )}
                {computeJob?.status === "complete" && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3 mb-4">
                    <CheckCircle2 size={16} />
                    <span>Generation complete! Moving to review.</span>
                  </div>
                )}
                <PipelineProgress runs={localPipelineRuns} />
              </>
            )}
            {request.status === "draft" && (
              <div className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                <Clock size={18} className="text-[var(--muted-foreground)] shrink-0" />
                <div>
                  <p className="font-semibold">Submitted</p>
                  <p className="text-[var(--muted-foreground)] mt-0.5">
                    Your request has been received. Marketing will begin generating creatives soon.
                  </p>
                </div>
              </div>
            )}
            {request.status === "review" && (
              <div className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                <Clock size={18} className="text-[#f59e0b] shrink-0" />
                <div>
                  <p className="font-semibold">Marketing Review</p>
                  <p className="text-[var(--muted-foreground)] mt-0.5">
                    Creatives have been generated. The marketing team is reviewing them now. You will be notified once approved.
                  </p>
                </div>
              </div>
            )}
            {request.status === "rejected" && (
              <div className="flex items-center gap-3 text-sm text-red-700">
                <FileText size={18} className="shrink-0" />
                <div>
                  <p className="font-semibold">Changes Needed</p>
                  <p className="text-[var(--muted-foreground)] mt-0.5">
                    Marketing has requested changes to your request. Please review and resubmit.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Messaging Themes (approved only) ──────────── */}
        {isApproved && messaging && (
          <section className="card p-5 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} className="text-[#6B21A8]" />
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                Messaging Themes
              </div>
            </div>
            {(messaging.primary_message || briefData?.summary) && (
              <p className="text-[13px] text-[var(--foreground)] leading-relaxed mb-3">
                <strong>Core Message:</strong>{" "}
                {messaging.primary_message || briefData?.summary}
              </p>
            )}
            {valueProps.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {valueProps.map((vp, i) => {
                  const style = TAG_STYLES[i % TAG_STYLES.length];
                  return (
                    <span
                      key={i}
                      className="inline-flex px-3 py-1.5 rounded-lg text-[11px] font-medium leading-snug"
                      style={{
                        backgroundColor: style.bg,
                        border: `1px solid ${style.border}`,
                        color: style.text,
                      }}
                    >
                      {vp}
                    </span>
                  );
                })}
              </div>
            )}
            {messaging.tone && (
              <div className="pt-3 border-t border-[var(--border)]">
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  <strong>Tone:</strong> {messaging.tone}
                </span>
              </div>
            )}
          </section>
        )}

        {/* ── Approved Creatives Grid ───────────────────── */}
        {isApproved && approvedAssets.length > 0 && (
          <section className="card p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-[#22c55e]" />
                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                  Approved Creatives
                </div>
              </div>
              {platforms.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setPlatformFilter("all")}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                      platformFilter === "all"
                        ? "bg-[var(--foreground)] text-white"
                        : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                    }`}
                  >
                    All
                  </button>
                  {platforms.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatformFilter(p)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium cursor-pointer transition-colors ${
                        platformFilter === p
                          ? "bg-[var(--foreground)] text-white"
                          : "bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                      }`}
                    >
                      {p.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {filteredAssets.map((asset) => {
                const content = (asset.content || {}) as Record<string, any>;
                const copyData = (asset.copy_data || {}) as Record<string, any>;
                const headline =
                  content.overlay_headline || copyData.headline || content.headline || "";
                const description =
                  copyData.primary_text || copyData.description || content.overlay_sub || "";

                return (
                  <div
                    key={asset.id}
                    className="border border-[var(--border)] rounded-xl overflow-hidden bg-white hover:shadow-sm transition-shadow"
                  >
                    {/* Image */}
                    <div className="relative aspect-square bg-[var(--muted)]">
                      {asset.blob_url ? (
                        <img
                          src={asset.blob_url}
                          alt={headline || "Creative"}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Layers size={20} className="text-[var(--muted-foreground)] opacity-30" />
                        </div>
                      )}
                      {/* Platform badge */}
                      {asset.platform && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-black/60 text-white backdrop-blur-sm">
                          {asset.platform.replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      {headline && (
                        <p className="text-[12px] font-semibold text-[var(--foreground)] truncate">
                          {headline}
                        </p>
                      )}
                      {description && (
                        <p className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
                          {description}
                        </p>
                      )}
                      {asset.blob_url && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            window.open(asset.blob_url!, "_blank");
                          }}
                          className="text-[10px] font-medium text-[#0693E3] hover:text-[#0574b8] mt-2 cursor-pointer transition-colors"
                        >
                          Download ↓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Target Personas (approved only) ───────────── */}
        {isApproved && personas.length > 0 && (
          <section className="card p-5 md:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-[#0693E3]" />
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
                Target Personas
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {personas.map((persona, i) => {
                const color = PERSONA_COLORS[i % PERSONA_COLORS.length];
                return (
                  <div key={i} className="bg-[var(--muted)] rounded-lg p-4">
                    <p className="text-[13px] font-semibold text-[var(--foreground)]">
                      {persona.name}
                    </p>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                      {persona.demographics || persona.age_range || ""}
                    </p>
                    {(persona.pain_point || persona.primary_motivation) && (
                      <p className="text-[11px] mt-2 font-medium" style={{ color }}>
                        {persona.pain_point || persona.primary_motivation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Request Details (collapsed) ────────────────── */}
        <section className="card">
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="w-full flex items-center justify-between p-5 md:p-6 cursor-pointer"
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
              Request Details
            </div>
            {detailsOpen ? (
              <ChevronUp size={16} className="text-[var(--muted-foreground)]" />
            ) : (
              <ChevronDown size={16} className="text-[var(--muted-foreground)]" />
            )}
          </button>
          {detailsOpen && (
            <div className="px-5 md:px-6 pb-5 md:pb-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {request.target_languages?.length > 0 && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">
                      Languages
                    </span>
                    <span className="text-[var(--foreground)]">
                      {request.target_languages.join(", ")}
                    </span>
                  </div>
                )}
                {request.target_regions?.length > 0 && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">
                      Regions
                    </span>
                    <span className="text-[var(--foreground)]">
                      {request.target_regions.join(", ")}
                    </span>
                  </div>
                )}
                {request.volume_needed != null && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">
                      Volume Needed
                    </span>
                    <span className="text-[var(--foreground)]">
                      {request.volume_needed.toLocaleString()} contributors
                    </span>
                  </div>
                )}
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">
                    Task Type
                  </span>
                  <span className="text-[var(--foreground)] capitalize">
                    {request.task_type.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">
                    Created
                  </span>
                  <span className="text-[var(--foreground)]">
                    {new Date(request.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">
                    Urgency
                  </span>
                  <span className="text-[var(--foreground)] capitalize">
                    {request.urgency}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/RecruiterDetailView.tsx
git commit -m "feat: rewrite RecruiterDetailView as Campaign Briefing Page

Adds messaging themes, platform-filtered creatives grid, target personas,
collapsible request details, and human-readable status labels."
```

---

### Task 6: Deploy and verify

**Files:**
- None (deployment task)

- [ ] **Step 1: Build locally for Vercel**

```bash
npx vercel build --prod
```

- [ ] **Step 2: Deploy prebuilt to production**

```bash
npx vercel deploy --prebuilt --prod
```

- [ ] **Step 3: Switch user role to recruiter for testing**

```bash
export $(grep DATABASE_URL .env.local | tr -d '"') && node --input-type=module -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
await sql\`UPDATE user_roles SET role = 'recruiter' WHERE email = 'stevenjunop@gmail.com'\`;
console.log('Role set to recruiter');
"
```

- [ ] **Step 4: Verify recruiter dashboard and detail pages in browser**

Open https://nova-intake.vercel.app and confirm:
- Dashboard shows Rich Status Cards with color-coded borders
- Detail page for approved campaign shows: Summary, Messaging Themes, Creatives Grid, Personas, Request Details
- Detail page for generating campaign shows: Status card + Pipeline Progress
- All pages are responsive at 375px, 768px, and 1440px

- [ ] **Step 5: Restore admin role**

```bash
export $(grep DATABASE_URL .env.local | tr -d '"') && node --input-type=module -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
await sql\`UPDATE user_roles SET role = 'admin' WHERE email = 'stevenjunop@gmail.com'\`;
console.log('Role restored to admin');
"
```

- [ ] **Step 6: Commit any final fixes**
