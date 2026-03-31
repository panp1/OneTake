# Frontend Portal System — Design Spec

**Date:** 2026-03-30
**Author:** Steven Junop + Claude
**Status:** Approved, ready for implementation
**Target:** April 6, 2026

## Problem

The frontend has 6 permission bleed-through issues (admin sidebar visible to all, no request ownership checks, designer page loads without token validation). There is no marketing command center for multi-campaign management, no recruiter-specific restricted view, and the designer portal lacks an authenticated mode with Seedream editing capabilities.

## Solution

Three workstreams delivered as one spec:
1. **Permission hardening** — strict role boundaries, ownership checks, filtered navigation
2. **Marketing command center** — campaign dashboard with filters, notifications, live status (navigates to existing detail view for editing)
3. **Recruiter portal** — restricted view showing own requests + approved assets only
4. **Designer portal upgrade** — authenticated mode, campaign sidebar, Seedream interactive editor

## What Already Exists (DO NOT REBUILD)

The following components and views are production-quality and stay as-is:

- **Intake detail view** (`/intake/[id]`) — comprehensive campaign detail with brief editing, messaging refinement, actor profiles, creative grid, pipeline progress, evaluation scores, approve/reject, refine modal, outputs panel
- **Designer components** — DesignerAssetCard, DesignerNoteInput, UploadZone, VersionCompare, DownloadKit, CampaignContextCard
- **Platform mockups** — FacebookFeedFrame, InstagramFeedFrame, InstagramStoryFrame, LinkedInFeedFrame, TikTokFrame, TelegramCardFrame
- **Asset components** — AssetCard, CreativeCard, CreativeGrid, ActorCard, ChannelCard, MockupPreview
- **Pipeline components** — PipelineProgress, EvaluationScores, OutputsPanel, FilterTabs, StatusBadge
- **Form components** — DynamicForm, TaskTypePicker, RefineModal
- **Admin portal** — User management, schema editor, worker monitor
- **App shell** — AppShell, Sidebar, Header

## Design Rules (ALL portals)

- **Lucide icons only** — no emojis ever, anywhere
- **Light theme** — OneForma brand (white bg, dark text, purple accent) per CLAUDE.md
- **System fonts** — -apple-system, 'Segoe UI', Roboto, sans-serif
- **Pill buttons** — rounded-full, charcoal or gradient
- **Clean, minimal, effortless** — generous whitespace, clear hierarchy, no clutter

---

## Workstream 1: Permission Hardening

### 1.1 Role-Filtered Sidebar

**File:** `src/components/Sidebar.tsx`

The sidebar currently shows admin links to all users. Fix:

```
recruiter role sees:
  Pipeline
    - Dashboard (/)
    - New Request (/intake/new)

admin/marketer role sees:
  Pipeline
    - Command Center (/) — NEW
    - New Request (/intake/new)
  Admin
    - Dashboard (/admin)
    - Users (/admin/users)
    - Schemas (/admin/schemas)
    - Workers (/admin/pipeline)

designer role sees:
  Design
    - My Campaigns (/designer)  — NEW authenticated portal
    - Seedream Editor (/designer/editor) — NEW

viewer role sees:
  Pipeline
    - Dashboard (/) — read-only
```

Implementation: Read user role from Clerk + `user_roles` table. Filter `navLinks` array by role before rendering.

### 1.2 Page-Level Role Guards

Add `requireRole()` checks to ALL protected pages:

| Page | Allowed Roles | Current Protection | Fix |
|------|--------------|-------------------|-----|
| `/` (dashboard) | all authenticated | Clerk only | Add ownership filter for recruiter (own requests only) |
| `/intake/new` | recruiter, admin | None | Add `requireRole(['recruiter','admin'])` |
| `/intake/[id]` | owner or admin | None | Add ownership check: `created_by === userId OR role === 'admin'` |
| `/admin/*` | admin | `requireRole(['admin'])` | Already correct |
| `/designer/[id]` | magic link | Public (token in API) | Validate token in page-level `getServerSideProps` before render |

### 1.3 API Ownership Checks

**File:** `src/app/api/intake/route.ts` and `src/app/api/intake/[id]/route.ts`

- `GET /api/intake` — if role is `recruiter`, filter by `created_by = userId`. If `admin`, return all. Pre-existing requests without `created_by` are treated as admin-owned (visible to admin only).
- `GET /api/intake/[id]` — if role is `recruiter`, verify `created_by = userId`. 403 if not owner.
- `POST /api/approve/[id]` — require `admin` role only.
- `POST /api/generate/[id]` — require `admin` or `recruiter` (owner only).

### 1.4 Designer Token Validation in Page

**File:** `src/app/designer/[id]/page.tsx`

Currently the page renders and THEN calls the API to validate the token. Fix: validate token server-side before rendering. If invalid, redirect to error page immediately.

---

## Workstream 2: Marketing Command Center

### 2.1 Route: `/` (Dashboard)

For `admin`/`marketer` roles, the root dashboard becomes the Marketing Command Center. For `recruiter` role, it remains the current filtered list showing only their requests.

**Layout:** Two-panel (campaign list left, selected campaign preview right)

### 2.2 Left Panel — Campaign List

```
+----------------------------------+
| [Search campaigns...]            |
|                                  |
| [All 8] [Generating 2] [Review 3]|
| [Approved 2] [Sent 1]           |
|                                  |
| [Filter: All Campaigns  v]      |
|                                  |
| Vega — Morocco        Generating |
| Arabic-French | 500              |
| ████████████░░░░ Stage 4 (65%)   |
|                                  |
| Cosmos — Morocco      Updated   |
| Arabic-French | Audio            |
| Sarah refined 3 images 2h ago    |
|                                  |
| Lumina — Seattle      Review    |
| English | Smart Glasses           |
| 15 creatives + 9 videos ready    |
|                                  |
| Vega — Brazil         Approved  |
| Portuguese-English | 500         |
| 432 creatives | Sent to agency   |
|                                  |
+------ Stats Bar -----------------+
| 8 Campaigns | 1.2K Creatives | 5 |
+----------------------------------+
```

**Components:**
- Search input (filters by title, country, task type)
- Status filter pills with counts
- Campaign filter dropdown
- Campaign cards with: title, status badge, progress bar (if generating), designer update alert, basic metadata
- Stats bar at bottom (total campaigns, creatives, countries)

**Behavior:**
- Click campaign → navigates to existing `/intake/[id]` detail view
- Real-time polling updates progress bars and status badges
- Designer update campaigns get orange border + "Updated" badge

### 2.3 Right Panel — Campaign Quick Preview

When a campaign is selected (hovered or focused) in the left list, the right panel shows a quick preview WITHOUT navigating away:

```
+------------------------------------------+
| Lumina — Smart Glasses Research    Review |
| Seattle-Metro | English | 500            |
|                          [Export] [Approve]|
|                                          |
| 15 Creatives | 9 Videos | 3 Personas    |
| Avg Score: 0.85 | Budget: $1K/mo         |
|                                          |
| [Creatives] Strategy | Brief | Videos    |
|                                          |
| [Notification: Sarah refined 3 images]   |
|                                          |
| [All] [FB 3] [IG 3] [TT 3] [LI 3]     |
|                                          |
| +--------+ +--------+ +--------+        |
| |Creative| |Creative| |Creative|        |
| |  0.86  | |  0.85  | |  0.72  |        |
| |TT-Elena| |FB-Elena| |IG-David|        |
| +--------+ +--------+ +--------+        |
+------------------------------------------+
```

**This reuses existing components:**
- `CreativeGrid` for the asset grid
- `FilterTabs` for platform filtering
- `PipelineProgress` for the stage bar
- `EvaluationScores` for the score display

**New component needed:** `CampaignPreviewPanel` — a condensed version of the intake detail, showing stats + creative grid + platform filters. Click "View Full" → navigates to `/intake/[id]`.

### 2.4 Notification Feed

**New component:** `NotificationFeed`

Displays real-time events:
- "Vega Morocco — Stage 4 complete (15 creatives)" → type: `stage_complete`
- "Designer Sarah refined Amira — Desk Session" → type: `designer_update`
- "Lumina strategy scored 0.92 — ready for review" → type: `eval_complete`
- "Vega Brazil — approved and sent to agency" → type: `status_change`

**Data source:** New `notifications` table in Neon OR poll existing `compute_jobs` + `generated_assets` for changes.

Notification badge in top nav shows unread count. Click → dropdown or dedicated panel.

### 2.5 Campaign Strategy Tab

**New tab on existing `/intake/[id]` detail view:** "Strategy"

Shows the campaign strategy data from the new `campaign_strategies` table:
- Tier info + progression rules
- Split test plan
- Ad sets with targeting, budget, kill/scale rules
- Budget cascade visualization (country → persona → ad set)
- Platform-specific targeting translation
- Deferred markets (if any)

This is a new section on the EXISTING detail page, not a new page.

---

## Workstream 3: Recruiter Portal

### 3.1 Recruiter Dashboard

Same URL (`/`) but filtered content for `recruiter` role:
- Shows ONLY requests where `created_by = userId`
- Same card layout as marketing command center but simpler
- No notification feed, no stats bar
- "New Request" button prominent

### 3.2 Recruiter Detail View

Same URL (`/intake/[id]`) but restricted content for `recruiter` role:

**Shows:**
- Request title, status, dates
- Pipeline progress bar (stages shown as icons, no details)
- If status is `approved` or `sent`: full approved asset grid with download
- If status is `generating`: progress bar only, no creative previews
- If status is `review`: "Under review by marketing team" message
- Campaign strategy summary (high-level, no ad set details)
- Download final package button (only when approved)

**Hides:**
- Draft/failed creatives
- Evaluation scores
- Refine/retry controls
- Brief editing
- Approve/reject buttons
- Designer notes
- Detailed strategy (ad set targeting, kill rules)

### 3.3 Implementation

The existing `/intake/[id]/page.tsx` detects the user's role and conditionally renders:
- `role === 'admin'` → full detail view (everything)
- `role === 'recruiter'` → restricted view (approved assets + progress only)

This is NOT a separate page — it's conditional rendering within the existing page based on role.

---

## Workstream 4: Designer Portal Upgrade

### 4.1 Authenticated Mode

**New route:** `/designer` (authenticated, role = `designer`)

Shows a campaign list sidebar (all campaigns assigned to this designer) + the existing designer workspace.

The existing magic link flow (`/designer/[id]?token=XXX`) continues to work for external designers. Authenticated mode is for internal team designers.

### 4.2 Campaign List Sidebar

Left sidebar showing:
- All campaigns assigned to this designer
- Status badges (approved/pending/generating)
- Asset counts per campaign
- Notification badges for new assets

Click campaign → loads that campaign's assets in the main workspace.

### 4.3 Seedream Interactive Editor

**New route:** `/designer/editor`

**Layout:** Two-column split

**Left column — Asset browser:**
- Search bar (search by name, campaign, type)
- Filter pills: All, Characters, Creatives, Raw
- Campaign filter dropdown
- Grid of draggable asset thumbnails with VQA scores
- Low-VQA assets highlighted with red border

**Right column — Seedream editor:**
- Drop zone: drag asset from left column
- Original image display (left half)
- Edited preview (right half) with loading animation
- Chat-style edit interface:
  - Previous edits shown as conversation bubbles (designer → Seedream response)
  - Text input for edit prompt
  - Quick action chips: Clean background, Fix skin texture, Improve lighting, Change outfit, Change setting, Remove artifacts
  - Generate button (calls Seedream 4.5 API via OpenRouter)
- Iteration history (numbered dots, undo/reset)
- Submit bar:
  - "Save as Copy" — saves edited version as new asset
  - "Replace Original" — overwrites blob URL + Neon record, updates all creatives using this image, notifies marketing

### 4.4 Seedream API Integration

**New API route:** `POST /api/designer/edit`

```json
{
  "asset_id": "uuid",
  "edit_prompt": "Fix the background, remove textbooks, add clean modern desk",
  "token": "magic_link_token" // or session auth
}
```

Calls Seedream 4.5 via OpenRouter with the edit prompt + original image URL. Returns new image URL.

**New API route:** `POST /api/designer/replace`

```json
{
  "asset_id": "uuid",
  "new_blob_url": "https://blob.vercel-storage.com/...",
  "edit_description": "Cleaned background, improved lighting"
}
```

Overwrites `generated_assets.blob_url`, logs the edit in metadata, creates notification for marketing.

### 4.5 Per-Platform Preview with Ad Copy

**New tab in designer workspace:** "Platform Preview"

Shows the creative rendered in each platform's mockup frame WITH the ad copy displayed below:
- Instagram Feed frame + headline + primary text
- Facebook Feed frame + headline + description
- TikTok frame + hook + caption
- LinkedIn frame + headline + body

Reuses the existing platform mockup components (`FacebookFeedFrame`, `InstagramFeedFrame`, etc.) with ad copy data from `generated_assets.copy_data`.

---

## Database Changes

### New Table: `notifications`

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  request_id  UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('stage_complete', 'designer_update', 'eval_complete', 'status_change', 'asset_approved')),
  title       TEXT NOT NULL,
  body        TEXT,
  read        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read);
```

### Column Additions

```sql
-- Track which designer is assigned to which request
ALTER TABLE intake_requests ADD COLUMN IF NOT EXISTS assigned_designer TEXT;
```

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/components/CampaignList.tsx` | Left panel campaign list with search, filters, status badges |
| `src/components/CampaignPreviewPanel.tsx` | Right panel quick preview (reuses CreativeGrid, FilterTabs) |
| `src/components/NotificationFeed.tsx` | Notification dropdown + badge |
| `src/components/CampaignStrategyView.tsx` | Strategy tab content (ad sets, targeting, budget cascade) |
| `src/components/RecruiterDetailView.tsx` | Restricted detail view for recruiter role |
| `src/components/designer/SeedreamEditor.tsx` | Two-column editor with drag-drop + chat interface |
| `src/components/designer/AssetBrowser.tsx` | Searchable, filterable, draggable asset grid |
| `src/components/designer/EditChat.tsx` | Chat-style edit prompt interface |
| `src/components/designer/PlatformPreviewWithCopy.tsx` | Platform mockups with ad copy below |
| `src/components/designer/DesignerCampaignList.tsx` | Authenticated designer campaign sidebar |
| `src/app/designer/page.tsx` | Authenticated designer portal (campaign list) |
| `src/app/designer/editor/page.tsx` | Seedream editor page |
| `src/app/api/designer/edit/route.ts` | Seedream edit API (calls OpenRouter) |
| `src/app/api/designer/replace/route.ts` | Asset replacement API |
| `src/app/api/notifications/route.ts` | Get/mark-read notifications |
| `src/lib/permissions.ts` | Centralized permission helpers |

### Modified Files
| File | Change |
|------|--------|
| `src/components/Sidebar.tsx` | Role-filtered navigation |
| `src/app/page.tsx` | Marketing command center for admin, filtered list for recruiter |
| `src/app/intake/[id]/page.tsx` | Role-based conditional rendering + strategy tab |
| `src/app/designer/[id]/page.tsx` | Server-side token validation before render |
| `src/app/api/intake/route.ts` | Ownership filtering (recruiter sees own only) |
| `src/app/api/intake/[id]/route.ts` | Ownership check (403 if not owner and not admin) |
| `src/middleware.ts` | Update public routes, add designer authenticated routes |
| `src/lib/db/schema.ts` | Add notifications table + assigned_designer column |

---

## Implementation Order

1. **Permission hardening** (1 day) — sidebar filtering, page guards, API ownership checks. Foundation for everything else.
2. **Marketing command center** (2 days) — campaign list, preview panel, notification feed, strategy tab.
3. **Recruiter portal** (1 day) — restricted dashboard + detail view. Leverages permission system from step 1.
4. **Designer upgrade** (2 days) — authenticated mode, campaign sidebar, Seedream editor, platform previews with copy.

Total: ~6 days. Target: April 6.
