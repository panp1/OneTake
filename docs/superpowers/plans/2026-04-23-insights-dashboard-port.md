# Insights Dashboard Builder — Porting Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port SRC Command Center's KPI dashboard + VYRA's drag-and-drop dashboard builder into centric-intake as a role-aware "Insights" module — admins build custom dashboards, recruiters see personal UTM analytics, designers see creative performance, viewers get shared public links. Deep UTM tracking integration throughout.

**Architecture:** Three-panel builder (palette | grid | config) ported from VYRA, re-themed for OneForma LIGHT. Recruitment-specific widgets replace marketing widgets. UTM link data (`tracked_links` table) is a first-class data source — 6 dedicated UTM widgets enable granular drill-down by source, medium, campaign, recruiter, and creative. All metrics APIs accept optional `recruiterId` for role-scoped filtering. Dashboard layouts stored in Neon `dashboards` table. Public sharing via token-based routes with password protection.

**Tech Stack:** Next.js 16 App Router, Neon Postgres, Clerk auth, react-grid-layout (responsive), Recharts (charts), Tailwind CSS 4, Lucide React, sonner (toasts)

**Source repos (READ ONLY — never modify):**
- VYRA dashboard builder: `/Users/stevenjunop/vyra/apps/frontend/src/components/dashboard-builder/`
- VYRA dashboard types: `/Users/stevenjunop/vyra/apps/frontend/src/types/dashboard.ts`
- VYRA dashboard pages: `/Users/stevenjunop/vyra/apps/frontend/src/pages/visualize/`
- SRC Command Center: `/Users/stevenjunop/src-command/apps/src-command-center-web/`

---

## Role-Based Surfacing Strategy

| Role | Access Level | Surfacing Points | Data Scope |
|------|-------------|------------------|------------|
| **Admin** | Full builder + all widgets + share controls | Sidebar "Analytics > Insights" + KPI strip on main dashboard | All recruiters, all campaigns, all data |
| **Recruiter** | View-only pre-built dashboards + personal "My Analytics" tab | RecruiterWorkspace "My Analytics" tab + read-only `/insights` | Only their own `recruiter_clerk_id` data, their campaigns |
| **Designer** | Creative performance summary | Designer portal "Performance" section | Asset pass rates, VQA scores, platform breakdown |
| **Viewer** | Public shared dashboards only | `/insights/public/[token]` (no auth) | Curated view shared by admin |

### Sidebar Navigation Changes

**Admin:**
```
Pipeline
  Dashboard
  New Request
Analytics           ← NEW SECTION
  Insights          ← Full builder (/insights)
Admin
  Dashboard, Users, Schemas, Workers, Artifacts
```

**Recruiter:**
```
Pipeline
  Dashboard
  New Request
Analytics           ← NEW SECTION
  Insights          ← View-only dashboards (/insights)
```

---

## File Structure

### New files to create:
```
src/
├── app/
│   ├── insights/
│   │   ├── page.tsx                              # Dashboard list (server component)
│   │   ├── InsightsDashboardList.tsx              # Client list with create/dup/delete
│   │   └── [id]/
│   │       ├── page.tsx                          # Dashboard builder (server shell)
│   │       └── BuilderClient.tsx                 # Client builder component
│   └── api/insights/
│       ├── route.ts                              # GET (list) + POST (create)
│       ├── [id]/
│       │   ├── route.ts                          # GET + PATCH + DELETE
│       │   ├── duplicate/route.ts                # POST
│       │   └── share/route.ts                    # POST (toggle) + PATCH + DELETE
│       ├── public/[token]/route.ts               # GET (resolve) + POST (verify pw)
│       └── metrics/
│           ├── pipeline/route.ts                 # Pipeline status counts
│           ├── assets/route.ts                   # Asset generation metrics
│           ├── clicks/route.ts                   # Tracked link analytics (scoped)
│           ├── workers/route.ts                  # Compute job metrics
│           ├── activity/route.ts                 # Recent activity feed
│           ├── utm-funnel/route.ts               # UTM drill-down (source→medium→campaign)
│           ├── recruiter-leaderboard/route.ts    # Recruiter rankings by clicks
│           └── creative-performance/route.ts     # Asset-to-click correlation
├── components/
│   └── insights/
│       ├── types.ts                              # All dashboard/widget types
│       ├── DashboardContext.tsx                   # State + undo/redo + auto-save
│       ├── DashboardToolbar.tsx                   # Top bar (title, save, undo, share)
│       ├── DashboardGrid.tsx                      # Responsive react-grid-layout
│       ├── WidgetPalette.tsx                      # Left sidebar — searchable catalog
│       ├── WidgetRenderer.tsx                     # Widget chrome + error boundary
│       ├── WidgetConfigPanel.tsx                  # Right sidebar — widget settings
│       ├── ShareModal.tsx                         # Share dialog
│       ├── DashboardCard.tsx                      # Card for list page
│       ├── KpiStrip.tsx                           # Embeddable KPI strip (admin dashboard)
│       ├── widgetRegistry.ts                      # Central widget catalog
│       ├── chartTheme.ts                          # Light theme chart colors
│       └── widgets/
│           ├── KpiCardsWidget.tsx                 # Pipeline KPIs
│           ├── PipelineOverviewWidget.tsx         # Status distribution donut
│           ├── CampaignTimelineWidget.tsx         # Recent campaigns table
│           ├── AssetGalleryWidget.tsx             # Assets by type + pass rates
│           ├── ClickAnalyticsWidget.tsx           # Aggregate click stats
│           ├── WorkerHealthWidget.tsx             # Compute job status
│           ├── PipelinePerformanceWidget.tsx      # Stage durations + success
│           ├── RegionMapWidget.tsx                # Target regions breakdown
│           ├── UrgencyWidget.tsx                  # Urgent/standard/pipeline donut
│           ├── RecentActivityWidget.tsx           # Latest pipeline events
│           ├── TextNoteWidget.tsx                 # Static text
│           ├── UtmFunnelWidget.tsx                # UTM drill-down: source→medium→campaign
│           ├── RecruiterLeaderboardWidget.tsx     # Recruiter rankings
│           ├── CreativePerformanceWidget.tsx      # Asset-to-click correlation
│           ├── CampaignRoiWidget.tsx              # Per-campaign link+click trends
│           ├── SourceHeatmapWidget.tsx            # Source × Medium heatmap
│           └── LinkBuilderWidget.tsx              # Embedded UTM link generator
```

### Files to modify:
```
src/components/Sidebar.tsx                         # Add "Analytics > Insights" nav
src/components/recruiter/RecruiterWorkspace.tsx     # Add "My Analytics" tab
src/app/page.tsx                                   # Add KPI strip to admin view
src/lib/db/schema.ts                               # Add dashboards table
package.json                                       # Add react-grid-layout + recharts
```

---

## Phase 1: Foundation (Tasks 1–3)

### Task 1: Install Dependencies + Database Migration

**Files:**
- Modify: `package.json`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Install react-grid-layout and recharts**

```bash
pnpm add react-grid-layout recharts
pnpm add -D @types/react-grid-layout
```

- [ ] **Step 2: Add dashboards table to schema**

In `src/lib/db/schema.ts`, add after the `user_roles` table creation (around line 372):

```typescript
  // 17. dashboards — custom analytics dashboard layouts
  await sql`
    CREATE TABLE IF NOT EXISTS dashboards (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title           TEXT NOT NULL DEFAULT 'Untitled Dashboard',
      description     TEXT,
      layout_data     JSONB NOT NULL DEFAULT '{"widgets":[],"gridLayouts":{"lg":[],"md":[],"sm":[]}}',
      created_by      TEXT NOT NULL,
      is_template     BOOLEAN NOT NULL DEFAULT FALSE,
      is_shared       BOOLEAN NOT NULL DEFAULT FALSE,
      share_token     TEXT UNIQUE,
      password_hash   TEXT,
      expires_at      TIMESTAMPTZ,
      view_count      INT NOT NULL DEFAULT 0,
      last_viewed_at  TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dashboards_share_token ON dashboards(share_token) WHERE share_token IS NOT NULL`;
```

- [ ] **Step 3: Run migration**

```bash
curl http://localhost:3000/api/admin/stats
```

Verify: No errors. Table `dashboards` exists in Neon.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/db/schema.ts
git commit -m "feat: add dashboards table + react-grid-layout/recharts deps"
```

---

### Task 2: Types + DB Query Module

**Files:**
- Create: `src/components/insights/types.ts`
- Create: `src/lib/db/dashboards.ts`

- [ ] **Step 1: Create types**

```typescript
/**
 * Types for the Insights dashboard builder.
 * Ported from VYRA dashboard builder, adapted for recruitment pipeline + UTM tracking.
 */

export type WidgetType =
  // Pipeline
  | 'kpi-cards'
  | 'pipeline-overview'
  | 'campaign-timeline'
  | 'urgency-breakdown'
  | 'recent-activity'
  // Assets & Creative
  | 'asset-gallery'
  | 'creative-performance'
  // UTM & Analytics
  | 'click-analytics'
  | 'utm-funnel'
  | 'recruiter-leaderboard'
  | 'campaign-roi'
  | 'source-heatmap'
  | 'link-builder'
  // Operations
  | 'worker-health'
  | 'pipeline-performance'
  | 'region-map'
  // Utility
  | 'text-note';

export type WidgetCategory =
  | 'pipeline'
  | 'assets'
  | 'utm'
  | 'operations'
  | 'utility';

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  title: string;
  config: Record<string, unknown>;
}

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface DashboardLayoutData {
  widgets: WidgetInstance[];
  gridLayouts: {
    lg: GridLayoutItem[];
    md: GridLayoutItem[];
    sm: GridLayoutItem[];
  };
}

export interface Dashboard {
  id: string;
  title: string;
  description: string | null;
  layout_data: DashboardLayoutData;
  created_by: string;
  is_template: boolean;
  is_shared: boolean;
  share_token: string | null;
  password_hash: string | null;
  expires_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
```

- [ ] **Step 2: Create DB query module**

File: `src/lib/db/dashboards.ts`

```typescript
import { getDb } from '@/lib/db';
import crypto from 'crypto';
import type { Dashboard, DashboardLayoutData } from '@/components/insights/types';

const emptyLayout: DashboardLayoutData = {
  widgets: [],
  gridLayouts: { lg: [], md: [], sm: [] },
};

export async function listDashboards(createdBy?: string): Promise<Dashboard[]> {
  const sql = getDb();
  if (createdBy) {
    const rows = await sql`
      SELECT * FROM dashboards
      WHERE created_by = ${createdBy} AND is_template = FALSE
      ORDER BY updated_at DESC
    `;
    return rows as Dashboard[];
  }
  const rows = await sql`
    SELECT * FROM dashboards WHERE is_template = FALSE ORDER BY updated_at DESC
  `;
  return rows as Dashboard[];
}

export async function getDashboard(id: string): Promise<Dashboard | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM dashboards WHERE id = ${id}`;
  return (rows[0] as Dashboard) ?? null;
}

export async function createDashboard(
  title: string,
  createdBy: string,
  layoutData?: DashboardLayoutData,
  description?: string,
): Promise<Dashboard> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO dashboards (title, description, layout_data, created_by)
    VALUES (${title}, ${description ?? null}, ${JSON.stringify(layoutData ?? emptyLayout)}, ${createdBy})
    RETURNING *
  `;
  return rows[0] as Dashboard;
}

export async function updateDashboard(
  id: string,
  updates: { title?: string; description?: string; layout_data?: DashboardLayoutData },
): Promise<Dashboard | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dashboards SET
      title = COALESCE(${updates.title ?? null}, title),
      description = COALESCE(${updates.description ?? null}, description),
      layout_data = COALESCE(${updates.layout_data ? JSON.stringify(updates.layout_data) : null}::jsonb, layout_data),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as Dashboard) ?? null;
}

export async function deleteDashboard(id: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`DELETE FROM dashboards WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function duplicateDashboard(id: string, createdBy: string): Promise<Dashboard | null> {
  const original = await getDashboard(id);
  if (!original) return null;
  const sql = getDb();
  const rows = await sql`
    INSERT INTO dashboards (title, description, layout_data, created_by)
    VALUES (${original.title + ' (copy)'}, ${original.description}, ${JSON.stringify(original.layout_data)}, ${createdBy})
    RETURNING *
  `;
  return rows[0] as Dashboard;
}

export async function toggleShare(id: string): Promise<{ is_shared: boolean; share_token: string | null }> {
  const sql = getDb();
  const dashboard = await getDashboard(id);
  if (!dashboard) throw new Error('Dashboard not found');
  if (dashboard.is_shared) {
    await sql`UPDATE dashboards SET is_shared = FALSE, share_token = NULL, updated_at = NOW() WHERE id = ${id}`;
    return { is_shared: false, share_token: null };
  }
  const token = crypto.randomBytes(24).toString('base64url');
  await sql`UPDATE dashboards SET is_shared = TRUE, share_token = ${token}, updated_at = NOW() WHERE id = ${id}`;
  return { is_shared: true, share_token: token };
}

export async function updateShareSettings(
  id: string,
  settings: { password_hash?: string; expires_at?: string | null },
): Promise<Dashboard | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dashboards SET
      password_hash = COALESCE(${settings.password_hash ?? null}, password_hash),
      expires_at = ${settings.expires_at ?? null}::timestamptz,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as Dashboard) ?? null;
}

export async function resolveShareToken(token: string): Promise<Dashboard | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM dashboards WHERE share_token = ${token} AND is_shared = TRUE`;
  const dashboard = (rows[0] as Dashboard) ?? null;
  if (!dashboard) return null;
  if (dashboard.expires_at && new Date(dashboard.expires_at) < new Date()) return null;
  await sql`UPDATE dashboards SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = ${dashboard.id}`;
  return dashboard;
}

export async function listTemplates(): Promise<Dashboard[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM dashboards WHERE is_template = TRUE ORDER BY title`;
  return rows as Dashboard[];
}

export async function seedDefaultTemplate(): Promise<void> {
  const sql = getDb();
  const existing = await sql`SELECT id FROM dashboards WHERE is_template = TRUE AND title = 'Recruitment Pipeline Overview'`;
  if (existing.length > 0) return;

  const layoutData: DashboardLayoutData = {
    widgets: [
      { id: 'tpl-kpi', type: 'kpi-cards', title: 'KPI Cards', config: {} },
      { id: 'tpl-pipeline', type: 'pipeline-overview', title: 'Pipeline Status', config: {} },
      { id: 'tpl-urgency', type: 'urgency-breakdown', title: 'Urgency', config: {} },
      { id: 'tpl-timeline', type: 'campaign-timeline', title: 'Recent Campaigns', config: {} },
      { id: 'tpl-utm', type: 'utm-funnel', title: 'UTM Breakdown', config: {} },
      { id: 'tpl-leaderboard', type: 'recruiter-leaderboard', title: 'Recruiter Leaderboard', config: {} },
      { id: 'tpl-creative', type: 'creative-performance', title: 'Creative Performance', config: {} },
      { id: 'tpl-workers', type: 'worker-health', title: 'Worker Health', config: {} },
    ],
    gridLayouts: {
      lg: [
        { i: 'tpl-kpi', x: 0, y: 0, w: 12, h: 2, minW: 6, minH: 2 },
        { i: 'tpl-pipeline', x: 0, y: 2, w: 6, h: 4, minW: 4, minH: 3 },
        { i: 'tpl-urgency', x: 6, y: 2, w: 6, h: 4, minW: 3, minH: 2 },
        { i: 'tpl-timeline', x: 0, y: 6, w: 12, h: 4, minW: 6, minH: 3 },
        { i: 'tpl-utm', x: 0, y: 10, w: 6, h: 4, minW: 4, minH: 3 },
        { i: 'tpl-leaderboard', x: 6, y: 10, w: 6, h: 4, minW: 4, minH: 3 },
        { i: 'tpl-creative', x: 0, y: 14, w: 6, h: 4, minW: 4, minH: 3 },
        { i: 'tpl-workers', x: 6, y: 14, w: 6, h: 3, minW: 4, minH: 2 },
      ],
      md: [
        { i: 'tpl-kpi', x: 0, y: 0, w: 8, h: 2, minW: 6, minH: 2 },
        { i: 'tpl-pipeline', x: 0, y: 2, w: 4, h: 4, minW: 4, minH: 3 },
        { i: 'tpl-urgency', x: 4, y: 2, w: 4, h: 4, minW: 3, minH: 2 },
        { i: 'tpl-timeline', x: 0, y: 6, w: 8, h: 4, minW: 6, minH: 3 },
        { i: 'tpl-utm', x: 0, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
        { i: 'tpl-leaderboard', x: 4, y: 10, w: 4, h: 4, minW: 4, minH: 3 },
        { i: 'tpl-creative', x: 0, y: 14, w: 4, h: 4, minW: 4, minH: 3 },
        { i: 'tpl-workers', x: 4, y: 14, w: 4, h: 3, minW: 4, minH: 2 },
      ],
      sm: [
        { i: 'tpl-kpi', x: 0, y: 0, w: 4, h: 2 },
        { i: 'tpl-pipeline', x: 0, y: 2, w: 4, h: 4 },
        { i: 'tpl-urgency', x: 0, y: 6, w: 4, h: 3 },
        { i: 'tpl-timeline', x: 0, y: 9, w: 4, h: 4 },
        { i: 'tpl-utm', x: 0, y: 13, w: 4, h: 4 },
        { i: 'tpl-leaderboard', x: 0, y: 17, w: 4, h: 4 },
        { i: 'tpl-creative', x: 0, y: 21, w: 4, h: 4 },
        { i: 'tpl-workers', x: 0, y: 25, w: 4, h: 3 },
      ],
    },
  };

  await sql`
    INSERT INTO dashboards (title, description, layout_data, created_by, is_template)
    VALUES (
      'Recruitment Pipeline Overview',
      'Pre-built dashboard: KPIs, pipeline status, UTM analytics, recruiter leaderboard, creative performance.',
      ${JSON.stringify(layoutData)},
      'system',
      TRUE
    )
  `;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/types.ts src/lib/db/dashboards.ts
git commit -m "feat: add Insights types + dashboard DB module with templates"
```

---

### Task 3: API Routes — Dashboard CRUD + Share + Public

**Files:**
- Create: `src/app/api/insights/route.ts`
- Create: `src/app/api/insights/[id]/route.ts`
- Create: `src/app/api/insights/[id]/duplicate/route.ts`
- Create: `src/app/api/insights/[id]/share/route.ts`
- Create: `src/app/api/insights/public/[token]/route.ts`

- [ ] **Step 1: List + create route**

File: `src/app/api/insights/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listDashboards, createDashboard } from '@/lib/db/dashboards';

export async function GET() {
  const user = await requireAuth();
  const dashboards = await listDashboards();
  return NextResponse.json(dashboards);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  const body = await req.json();
  const dashboard = await createDashboard(
    body.title || 'Untitled Dashboard',
    user.userId,
    body.layout_data,
    body.description,
  );
  return NextResponse.json(dashboard, { status: 201 });
}
```

- [ ] **Step 2: Get + update + delete route**

File: `src/app/api/insights/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDashboard, updateDashboard, deleteDashboard } from '@/lib/db/dashboards';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const dashboard = await getDashboard(id);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(dashboard);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();
  const dashboard = await updateDashboard(id, {
    title: body.title,
    description: body.description,
    layout_data: body.layout_data,
  });
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(dashboard);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const deleted = await deleteDashboard(id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Duplicate route**

File: `src/app/api/insights/[id]/duplicate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { duplicateDashboard } from '@/lib/db/dashboards';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAuth();
  const { id } = await params;
  const dashboard = await duplicateDashboard(id, user.userId);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(dashboard, { status: 201 });
}
```

- [ ] **Step 4: Share routes**

File: `src/app/api/insights/[id]/share/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { toggleShare, updateShareSettings } from '@/lib/db/dashboards';
import crypto from 'crypto';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const result = await toggleShare(id);
  return NextResponse.json(result);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAuth();
  const { id } = await params;
  const body = await req.json();
  const updates: { password_hash?: string; expires_at?: string | null } = {};
  if (body.password) {
    updates.password_hash = crypto.createHash('sha256').update(body.password).digest('hex');
  }
  if (body.expires_in_days) {
    const d = new Date();
    d.setDate(d.getDate() + body.expires_in_days);
    updates.expires_at = d.toISOString();
  } else if (body.expires_in_days === 0) {
    updates.expires_at = null;
  }
  const dashboard = await updateShareSettings(id, updates);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(dashboard);
}
```

- [ ] **Step 5: Public token route**

File: `src/app/api/insights/public/[token]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveShareToken } from '@/lib/db/dashboards';
import crypto from 'crypto';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const dashboard = await resolveShareToken(token);
  if (!dashboard) return NextResponse.json({ error: 'Not found or expired' }, { status: 404 });
  if (dashboard.password_hash) {
    return NextResponse.json({ password_required: true, title: dashboard.title }, { status: 401 });
  }
  return NextResponse.json({ title: dashboard.title, layout_data: dashboard.layout_data, view_count: dashboard.view_count });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json();
  const dashboard = await resolveShareToken(token);
  if (!dashboard) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (dashboard.password_hash) {
    const hash = crypto.createHash('sha256').update(body.password || '').digest('hex');
    if (hash !== dashboard.password_hash) return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
  return NextResponse.json({ title: dashboard.title, layout_data: dashboard.layout_data, view_count: dashboard.view_count });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/insights/
git commit -m "feat: add Insights API routes — CRUD, duplicate, share, public"
```

---

## Phase 2: Metrics APIs with Recruiter Scoping (Tasks 4–5)

### Task 4: Core Metrics APIs (pipeline, assets, workers, activity)

**Files:**
- Create: `src/app/api/insights/metrics/pipeline/route.ts`
- Create: `src/app/api/insights/metrics/assets/route.ts`
- Create: `src/app/api/insights/metrics/workers/route.ts`
- Create: `src/app/api/insights/metrics/activity/route.ts`

All metrics routes accept `?recruiterId=xxx` query param. When present, data is scoped to that recruiter's campaigns. When absent, all data is returned. Recruiter role auto-injects their own ID server-side.

- [ ] **Step 1: Pipeline metrics (status counts, urgency, recent)**

File: `src/app/api/insights/metrics/pipeline/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');

  // If recruiter-scoped, filter to campaigns they created
  const createdByFilter = recruiterId ? sql`AND created_by = ${recruiterId}` : sql``;

  const [statusCounts, urgencyCounts, totalRow, recentRows] = await Promise.all([
    sql`SELECT status, COUNT(*)::int as count FROM intake_requests WHERE 1=1 ${createdByFilter} GROUP BY status ORDER BY status`,
    sql`SELECT urgency, COUNT(*)::int as count FROM intake_requests WHERE 1=1 ${createdByFilter} GROUP BY urgency`,
    sql`SELECT COUNT(*)::int as total FROM intake_requests WHERE 1=1 ${createdByFilter}`,
    sql`SELECT id, title, status, urgency, task_type, created_at FROM intake_requests WHERE 1=1 ${createdByFilter} ORDER BY created_at DESC LIMIT 10`,
  ]);

  return NextResponse.json({
    total: totalRow[0]?.total ?? 0,
    by_status: statusCounts,
    by_urgency: urgencyCounts,
    recent: recentRows,
  });
}
```

- [ ] **Step 2: Asset metrics**

File: `src/app/api/insights/metrics/assets/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');

  const createdByFilter = recruiterId
    ? sql`AND request_id IN (SELECT id FROM intake_requests WHERE created_by = ${recruiterId})`
    : sql``;

  const [totalRow, byType, byPlatform, passRate] = await Promise.all([
    sql`SELECT COUNT(*)::int as total FROM generated_assets WHERE 1=1 ${createdByFilter}`,
    sql`SELECT asset_type, COUNT(*)::int as count FROM generated_assets WHERE 1=1 ${createdByFilter} GROUP BY asset_type ORDER BY count DESC`,
    sql`SELECT platform, COUNT(*)::int as count FROM generated_assets WHERE 1=1 ${createdByFilter} GROUP BY platform ORDER BY count DESC`,
    sql`SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE evaluation_passed = TRUE)::int as passed
        FROM generated_assets WHERE evaluation_score IS NOT NULL ${createdByFilter}`,
  ]);

  return NextResponse.json({
    total: totalRow[0]?.total ?? 0,
    by_type: byType,
    by_platform: byPlatform,
    pass_rate: passRate[0] ?? { total: 0, passed: 0 },
  });
}
```

- [ ] **Step 3: Worker metrics**

File: `src/app/api/insights/metrics/workers/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  await requireAuth();
  const sql = getDb();

  const [statusCounts, avgDuration, recentJobs] = await Promise.all([
    sql`SELECT status, COUNT(*)::int as count FROM compute_jobs GROUP BY status`,
    sql`SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::int as avg_seconds
        FROM compute_jobs WHERE completed_at IS NOT NULL AND started_at IS NOT NULL`,
    sql`SELECT id, request_id, job_type, status, error_message, started_at, completed_at, created_at
        FROM compute_jobs ORDER BY created_at DESC LIMIT 10`,
  ]);

  return NextResponse.json({
    by_status: statusCounts,
    avg_duration_seconds: avgDuration[0]?.avg_seconds ?? 0,
    recent: recentJobs,
  });
}
```

- [ ] **Step 4: Activity metrics (regions, languages, recent campaigns)**

File: `src/app/api/insights/metrics/activity/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');
  const createdByFilter = recruiterId ? sql`WHERE created_by = ${recruiterId}` : sql``;

  const [campaigns, regions, languages] = await Promise.all([
    sql`SELECT id, title, status, urgency, task_type, target_regions, target_languages, created_at, updated_at
        FROM intake_requests ${createdByFilter} ORDER BY updated_at DESC LIMIT 20`,
    sql`SELECT unnest(target_regions) as region, COUNT(*)::int as count
        FROM intake_requests ${createdByFilter} GROUP BY region ORDER BY count DESC`,
    sql`SELECT unnest(target_languages) as language, COUNT(*)::int as count
        FROM intake_requests ${createdByFilter} GROUP BY language ORDER BY count DESC`,
  ]);

  return NextResponse.json({ recent_campaigns: campaigns, by_region: regions, by_language: languages });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/insights/metrics/pipeline/ src/app/api/insights/metrics/assets/ src/app/api/insights/metrics/workers/ src/app/api/insights/metrics/activity/
git commit -m "feat: add core metrics APIs with recruiter-scoped filtering"
```

---

### Task 5: UTM-Specific Metrics APIs (funnel, leaderboard, creative performance)

**Files:**
- Create: `src/app/api/insights/metrics/utm-funnel/route.ts`
- Create: `src/app/api/insights/metrics/recruiter-leaderboard/route.ts`
- Create: `src/app/api/insights/metrics/creative-performance/route.ts`

- [ ] **Step 1: UTM funnel drill-down**

File: `src/app/api/insights/metrics/utm-funnel/route.ts`

This is the core UTM analytics endpoint. Returns clicks broken down by source → medium → campaign.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');
  const recruiterFilter = recruiterId ? sql`WHERE recruiter_clerk_id = ${recruiterId}` : sql``;

  const [bySource, byMedium, byCampaign, bySourceMedium, totalRow] = await Promise.all([
    sql`SELECT utm_source, SUM(click_count)::int as clicks, COUNT(*)::int as link_count
        FROM tracked_links ${recruiterFilter}
        GROUP BY utm_source ORDER BY clicks DESC`,
    sql`SELECT utm_medium, SUM(click_count)::int as clicks, COUNT(*)::int as link_count
        FROM tracked_links ${recruiterFilter}
        GROUP BY utm_medium ORDER BY clicks DESC`,
    sql`SELECT utm_campaign, SUM(click_count)::int as clicks, COUNT(*)::int as link_count
        FROM tracked_links ${recruiterFilter}
        GROUP BY utm_campaign ORDER BY clicks DESC LIMIT 15`,
    sql`SELECT utm_source, utm_medium, SUM(click_count)::int as clicks
        FROM tracked_links ${recruiterFilter}
        GROUP BY utm_source, utm_medium ORDER BY clicks DESC LIMIT 20`,
    sql`SELECT
          COALESCE(SUM(click_count), 0)::int as total_clicks,
          COUNT(*)::int as total_links
        FROM tracked_links ${recruiterFilter}`,
  ]);

  return NextResponse.json({
    total_clicks: totalRow[0]?.total_clicks ?? 0,
    total_links: totalRow[0]?.total_links ?? 0,
    by_source: bySource,
    by_medium: byMedium,
    by_campaign: byCampaign,
    source_medium_matrix: bySourceMedium,
  });
}
```

- [ ] **Step 2: Recruiter leaderboard**

File: `src/app/api/insights/metrics/recruiter-leaderboard/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  await requireAuth();
  const sql = getDb();

  const leaderboard = await sql`
    SELECT
      tl.recruiter_clerk_id,
      COALESCE(ur.name, ur.email, tl.recruiter_clerk_id) as recruiter_name,
      SUM(tl.click_count)::int as total_clicks,
      COUNT(tl.id)::int as links_created,
      MAX(tl.click_count)::int as best_link_clicks,
      COUNT(DISTINCT tl.request_id)::int as campaigns_active
    FROM tracked_links tl
    LEFT JOIN user_roles ur ON ur.clerk_id = tl.recruiter_clerk_id
    GROUP BY tl.recruiter_clerk_id, ur.name, ur.email
    ORDER BY total_clicks DESC
    LIMIT 20
  `;

  return NextResponse.json({ leaderboard });
}
```

- [ ] **Step 3: Creative-to-click performance**

File: `src/app/api/insights/metrics/creative-performance/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');
  const recruiterFilter = recruiterId ? sql`AND tl.recruiter_clerk_id = ${recruiterId}` : sql``;

  const creativePerf = await sql`
    SELECT
      ga.id as asset_id,
      ga.asset_type,
      ga.platform,
      ga.blob_url,
      ga.evaluation_score,
      ga.evaluation_passed,
      COALESCE(SUM(tl.click_count), 0)::int as total_clicks,
      COUNT(tl.id)::int as link_count
    FROM generated_assets ga
    LEFT JOIN tracked_links tl ON tl.asset_id = ga.id ${recruiterFilter}
    WHERE ga.asset_type IN ('composed_creative', 'carousel_panel', 'base_image')
    GROUP BY ga.id, ga.asset_type, ga.platform, ga.blob_url, ga.evaluation_score, ga.evaluation_passed
    ORDER BY total_clicks DESC
    LIMIT 20
  `;

  return NextResponse.json({ creatives: creativePerf });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/insights/metrics/utm-funnel/ src/app/api/insights/metrics/recruiter-leaderboard/ src/app/api/insights/metrics/creative-performance/
git commit -m "feat: add UTM funnel, recruiter leaderboard, creative performance APIs"
```

---

## Phase 3: Dashboard Builder Core (Tasks 6–10)

### Task 6: Chart Theme + Widget Registry

**Files:**
- Create: `src/components/insights/chartTheme.ts`
- Create: `src/components/insights/widgetRegistry.ts`

- [ ] **Step 1: Create light-mode chart theme**

```typescript
/**
 * Light-theme chart styling for Insights widgets.
 * Adapted from VYRA chartTheme.ts — flipped to OneForma brand.
 */

export const CHART_COLORS = {
  blue: '#0693e3',
  purple: '#9b51e0',
  green: '#16a34a',
  amber: '#ca8a04',
  red: '#dc2626',
  teal: '#0d9488',
  orange: '#ea580c',
  charcoal: '#32373c',
};

export const CHART_PALETTE = [
  CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.green,
  CHART_COLORS.amber, CHART_COLORS.teal, CHART_COLORS.orange,
  CHART_COLORS.red, CHART_COLORS.charcoal,
];

export const AXIS_STYLE = {
  tick: { fill: '#737373', fontSize: 11 },
  axisLine: { stroke: '#e5e5e5' },
  tickLine: { stroke: '#e5e5e5' },
};

export const GRID_STYLE = { stroke: '#f0f0f0', strokeDasharray: '3 3' };

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #e5e5e5',
    borderRadius: 10,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    fontSize: 12,
    color: '#1a1a1a',
  },
  itemStyle: { color: '#1a1a1a' },
  labelStyle: { color: '#737373', fontWeight: 600 },
};
```

- [ ] **Step 2: Create widget registry — 17 recruitment + UTM widgets**

```typescript
/**
 * Widget Registry — 17 widgets across 5 categories.
 * Ported from VYRA, adapted for recruitment pipeline + UTM tracking.
 */

import { lazy, type ComponentType } from 'react';
import {
  BarChart3, Activity, Clock, Image, MousePointerClick, Cpu, Timer,
  Globe, AlertTriangle, ListChecks, StickyNote, GitCompare, Trophy,
  Palette, TrendingUp, Grid3x3, Link2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WidgetType, WidgetCategory } from './types';

export interface WidgetRegistryEntry {
  component: ComponentType<{ config: Record<string, unknown> }>;
  category: WidgetCategory;
  label: string;
  icon: LucideIcon;
  description: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
}

export const WIDGET_CATEGORIES: { id: WidgetCategory; label: string }[] = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'utm', label: 'UTM & Link Analytics' },
  { id: 'assets', label: 'Assets & Creative' },
  { id: 'operations', label: 'Operations' },
  { id: 'utility', label: 'Utility' },
];

export const WIDGET_REGISTRY: Record<WidgetType, WidgetRegistryEntry> = {
  // ── Pipeline ──────────────────────────────────────────────
  'kpi-cards': {
    component: lazy(() => import('./widgets/KpiCardsWidget')),
    category: 'pipeline', label: 'KPI Cards', icon: BarChart3,
    description: 'Total campaigns, approved, generating, sent to agency',
    defaultSize: { w: 12, h: 2 }, minSize: { w: 6, h: 2 },
  },
  'pipeline-overview': {
    component: lazy(() => import('./widgets/PipelineOverviewWidget')),
    category: 'pipeline', label: 'Pipeline Status', icon: Activity,
    description: 'Campaign distribution by pipeline stage',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'campaign-timeline': {
    component: lazy(() => import('./widgets/CampaignTimelineWidget')),
    category: 'pipeline', label: 'Campaign Timeline', icon: Clock,
    description: 'Recent campaigns with status and progress',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'urgency-breakdown': {
    component: lazy(() => import('./widgets/UrgencyWidget')),
    category: 'pipeline', label: 'Urgency Breakdown', icon: AlertTriangle,
    description: 'Urgent vs standard vs pipeline distribution',
    defaultSize: { w: 4, h: 3 }, minSize: { w: 3, h: 2 },
  },
  'recent-activity': {
    component: lazy(() => import('./widgets/RecentActivityWidget')),
    category: 'pipeline', label: 'Recent Activity', icon: ListChecks,
    description: 'Latest campaign updates and pipeline events',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },

  // ── UTM & Link Analytics ──────────────────────────────────
  'click-analytics': {
    component: lazy(() => import('./widgets/ClickAnalyticsWidget')),
    category: 'utm', label: 'Click Overview', icon: MousePointerClick,
    description: 'Total clicks, links, and recruiter count',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'utm-funnel': {
    component: lazy(() => import('./widgets/UtmFunnelWidget')),
    category: 'utm', label: 'UTM Breakdown', icon: GitCompare,
    description: 'Clicks by source, medium, and campaign — full UTM drill-down',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'recruiter-leaderboard': {
    component: lazy(() => import('./widgets/RecruiterLeaderboardWidget')),
    category: 'utm', label: 'Recruiter Leaderboard', icon: Trophy,
    description: 'Ranked recruiters by clicks, links, and active campaigns',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'campaign-roi': {
    component: lazy(() => import('./widgets/CampaignRoiWidget')),
    category: 'utm', label: 'Campaign Link ROI', icon: TrendingUp,
    description: 'Per-campaign links created and total click performance',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'source-heatmap': {
    component: lazy(() => import('./widgets/SourceHeatmapWidget')),
    category: 'utm', label: 'Source x Medium Heatmap', icon: Grid3x3,
    description: 'Heatmap grid of clicks by UTM source and medium',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 3 },
  },
  'link-builder': {
    component: lazy(() => import('./widgets/LinkBuilderWidget')),
    category: 'utm', label: 'Quick Link Builder', icon: Link2,
    description: 'Create UTM tracked links without leaving the dashboard',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 4, h: 3 },
  },

  // ── Assets & Creative ─────────────────────────────────────
  'asset-gallery': {
    component: lazy(() => import('./widgets/AssetGalleryWidget')),
    category: 'assets', label: 'Asset Summary', icon: Image,
    description: 'Generated assets by type and platform with pass rates',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'creative-performance': {
    component: lazy(() => import('./widgets/CreativePerformanceWidget')),
    category: 'assets', label: 'Creative Performance', icon: Palette,
    description: 'Which creatives drive the most clicks? Asset-to-click correlation',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },

  // ── Operations ────────────────────────────────────────────
  'worker-health': {
    component: lazy(() => import('./widgets/WorkerHealthWidget')),
    category: 'operations', label: 'Worker Health', icon: Cpu,
    description: 'Compute job status and average processing time',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 4, h: 2 },
  },
  'pipeline-performance': {
    component: lazy(() => import('./widgets/PipelinePerformanceWidget')),
    category: 'operations', label: 'Pipeline Performance', icon: Timer,
    description: 'Stage durations and success/failure rates',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
  'region-map': {
    component: lazy(() => import('./widgets/RegionMapWidget')),
    category: 'operations', label: 'Region Distribution', icon: Globe,
    description: 'Campaign target regions breakdown',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },

  // ── Utility ───────────────────────────────────────────────
  'text-note': {
    component: lazy(() => import('./widgets/TextNoteWidget')),
    category: 'utility', label: 'Text Note', icon: StickyNote,
    description: 'Add custom text or notes',
    defaultSize: { w: 6, h: 3 }, minSize: { w: 3, h: 2 },
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/chartTheme.ts src/components/insights/widgetRegistry.ts
git commit -m "feat: add chart theme + 17-widget registry (6 UTM widgets)"
```

---

### Task 7: DashboardContext (State Management)

**Files:**
- Create: `src/components/insights/DashboardContext.tsx`

Ported from VYRA — identical reducer logic, auto-save via fetch API instead of dashboardApi. See original plan Task 8 for the complete 467-line implementation.

- [ ] **Step 1: Create DashboardContext.tsx** — copy exactly from original plan Task 8, Step 1.

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/DashboardContext.tsx
git commit -m "feat: add DashboardContext — state, undo/redo, auto-save"
```

---

### Task 8: WidgetRenderer + WidgetPalette + WidgetConfigPanel

**Files:**
- Create: `src/components/insights/WidgetRenderer.tsx`
- Create: `src/components/insights/WidgetPalette.tsx`
- Create: `src/components/insights/WidgetConfigPanel.tsx`

These are ported from VYRA with dark→light theme flip. See original plan Tasks 9, 10, 11 for complete implementations. All OneForma CSS variables (`var(--foreground)`, `var(--muted)`, `var(--border)`, etc.) replace VYRA's `bg-surface-1`, `text-white/70`, etc.

- [ ] **Step 1: Create WidgetRenderer.tsx** — copy from original plan Task 9.
- [ ] **Step 2: Create WidgetPalette.tsx** — copy from original plan Task 10.
- [ ] **Step 3: Create WidgetConfigPanel.tsx** — copy from original plan Task 11, Step 1. Add UTM-specific config fields:

In the WidgetConfigPanel, after the status filter `<select>`, add a recruiter scope field (visible only for UTM widgets):

```typescript
{/* Recruiter scope — for UTM widgets */}
{['click-analytics', 'utm-funnel', 'recruiter-leaderboard', 'campaign-roi', 'source-heatmap', 'creative-performance'].includes(widget.type) && (
  <div>
    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">Recruiter Scope</label>
    <select
      value={(widget.config.recruiterScope as string) || ''}
      onChange={(e) => handleConfigChange('recruiterScope', e.target.value || undefined)}
      className="input-base text-xs !py-1.5"
    >
      <option value="">All Recruiters</option>
      <option value="self">My Data Only</option>
    </select>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/insights/WidgetRenderer.tsx src/components/insights/WidgetPalette.tsx src/components/insights/WidgetConfigPanel.tsx
git commit -m "feat: add WidgetRenderer, WidgetPalette, WidgetConfigPanel"
```

---

### Task 9: DashboardToolbar + ShareModal + DashboardGrid + DashboardCard

**Files:**
- Create: `src/components/insights/DashboardToolbar.tsx`
- Create: `src/components/insights/ShareModal.tsx`
- Create: `src/components/insights/DashboardGrid.tsx`
- Create: `src/components/insights/DashboardCard.tsx`

These are all ported from VYRA with theme adaptations. See original plan Tasks 11–13 for complete implementations.

- [ ] **Step 1: Create DashboardToolbar.tsx** — copy from original plan Task 11, Step 2.
- [ ] **Step 2: Create ShareModal.tsx** — copy from original plan Task 12.
- [ ] **Step 3: Create DashboardGrid.tsx** — copy from original plan Task 13, Step 1.
- [ ] **Step 4: Create DashboardCard.tsx** — copy from original plan Task 13, Step 2.
- [ ] **Step 5: Commit**

```bash
git add src/components/insights/DashboardToolbar.tsx src/components/insights/ShareModal.tsx src/components/insights/DashboardGrid.tsx src/components/insights/DashboardCard.tsx
git commit -m "feat: add DashboardToolbar, ShareModal, DashboardGrid, DashboardCard"
```

---

### Task 10: All 17 Widget Implementations

**Files:**
- Create: 17 files in `src/components/insights/widgets/`

- [ ] **Step 1: Core pipeline widgets (KPI, PipelineOverview, CampaignTimeline, Urgency, RecentActivity)** — copy from original plan Task 14, Steps 1–3 and Step 7 (UrgencyWidget, RecentActivityWidget).

- [ ] **Step 2: Asset widgets (AssetGallery)** — copy from original plan Task 14, Step 4.

- [ ] **Step 3: Operations widgets (WorkerHealth, PipelinePerformance, RegionMap)** — copy from original plan Task 14, Steps 6–7.

- [ ] **Step 4: TextNoteWidget** — copy from original plan Task 14, Step 7.

- [ ] **Step 5: ClickAnalyticsWidget** — copy from original plan Task 14, Step 5.

- [ ] **Step 6: NEW — UtmFunnelWidget**

File: `src/components/insights/widgets/UtmFunnelWidget.tsx`

```typescript
"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { CHART_COLORS, AXIS_STYLE, TOOLTIP_STYLE, GRID_STYLE } from '../chartTheme';

interface UtmData {
  total_clicks: number;
  total_links: number;
  by_source: { utm_source: string; clicks: number; link_count: number }[];
  by_medium: { utm_medium: string; clicks: number; link_count: number }[];
  by_campaign: { utm_campaign: string; clicks: number; link_count: number }[];
}

export default function UtmFunnelWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<UtmData | null>(null);
  const [view, setView] = useState<'source' | 'medium' | 'campaign'>('source');

  useEffect(() => {
    const params = new URLSearchParams();
    if (config.recruiterScope === 'self') params.set('recruiterId', 'self');
    fetch(`/api/insights/metrics/utm-funnel?${params}`).then(r => r.json()).then(setData).catch(() => {});
  }, [config.recruiterScope]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const tabs = [
    { key: 'source' as const, label: 'By Source', data: data.by_source.map(d => ({ name: d.utm_source, clicks: d.clicks, links: d.link_count })) },
    { key: 'medium' as const, label: 'By Medium', data: data.by_medium.map(d => ({ name: d.utm_medium, clicks: d.clicks, links: d.link_count })) },
    { key: 'campaign' as const, label: 'By Campaign', data: data.by_campaign.slice(0, 8).map(d => ({ name: d.utm_campaign.length > 20 ? d.utm_campaign.slice(0, 20) + '...' : d.utm_campaign, clicks: d.clicks, links: d.link_count })) },
  ];

  const activeTab = tabs.find(t => t.key === view) || tabs[0];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1 text-[10px]">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setView(t.key)}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${view === t.key ? 'bg-[var(--foreground)] text-white font-medium' : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)]'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto text-[10px] text-[var(--muted-foreground)]">
          {data.total_clicks} clicks / {data.total_links} links
        </div>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activeTab.data}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="name" {...AXIS_STYLE} tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="clicks" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} name="Clicks" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: NEW — RecruiterLeaderboardWidget**

File: `src/components/insights/widgets/RecruiterLeaderboardWidget.tsx`

```typescript
"use client";

import { useEffect, useState } from 'react';
import { Trophy, MousePointerClick, Link2, Briefcase } from 'lucide-react';

interface Recruiter {
  recruiter_clerk_id: string;
  recruiter_name: string;
  total_clicks: number;
  links_created: number;
  best_link_clicks: number;
  campaigns_active: number;
}

export default function RecruiterLeaderboardWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<Recruiter[] | null>(null);

  useEffect(() => {
    fetch('/api/insights/metrics/recruiter-leaderboard').then(r => r.json()).then(d => setData(d.leaderboard)).catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No recruiter data yet</div>;

  const medalColors = ['#ca8a04', '#737373', '#b45309'];

  return (
    <div className="h-full overflow-auto">
      <div className="space-y-1.5">
        {data.map((r, i) => (
          <div key={r.recruiter_clerk_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--muted)] transition-colors">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: i < 3 ? `${medalColors[i]}15` : 'var(--muted)' }}>
              {i < 3 ? <Trophy className="w-3.5 h-3.5" style={{ color: medalColors[i] }} /> : <span className="text-[10px] font-bold text-[var(--muted-foreground)]">{i + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[var(--foreground)] truncate">{r.recruiter_name}</div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]"><MousePointerClick className="w-3 h-3" /> {r.total_clicks}</span>
                <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]"><Link2 className="w-3 h-3" /> {r.links_created}</span>
                <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]"><Briefcase className="w-3 h-3" /> {r.campaigns_active}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-[var(--foreground)]">{r.total_clicks}</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">clicks</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: NEW — CreativePerformanceWidget**

File: `src/components/insights/widgets/CreativePerformanceWidget.tsx`

```typescript
"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { CHART_COLORS, AXIS_STYLE, TOOLTIP_STYLE, GRID_STYLE } from '../chartTheme';

interface Creative {
  asset_id: string;
  asset_type: string;
  platform: string;
  blob_url: string | null;
  evaluation_score: number | null;
  evaluation_passed: boolean;
  total_clicks: number;
  link_count: number;
}

export default function CreativePerformanceWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<Creative[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (config.recruiterScope === 'self') params.set('recruiterId', 'self');
    fetch(`/api/insights/metrics/creative-performance?${params}`).then(r => r.json()).then(d => setData(d.creatives)).catch(() => {});
  }, [config.recruiterScope]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No creative-to-click data yet</div>;

  const chartData = data.filter(d => d.total_clicks > 0).slice(0, 10).map((d, i) => ({
    name: `${d.platform} #${i + 1}`,
    clicks: d.total_clicks,
    score: d.evaluation_score ? Math.round(d.evaluation_score * 100) : 0,
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 mb-3 text-[10px] text-[var(--muted-foreground)]">
        <span>{data.filter(d => d.total_clicks > 0).length} creatives with clicks</span>
        <span>Top by total click volume</span>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid {...GRID_STYLE} />
            <XAxis dataKey="name" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="clicks" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} name="Clicks" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: NEW — CampaignRoiWidget**

File: `src/components/insights/widgets/CampaignRoiWidget.tsx`

```typescript
"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { CHART_COLORS, AXIS_STYLE, TOOLTIP_STYLE, GRID_STYLE } from '../chartTheme';

export default function CampaignRoiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<{ utm_campaign: string; clicks: number; link_count: number }[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (config.recruiterScope === 'self') params.set('recruiterId', 'self');
    fetch(`/api/insights/metrics/utm-funnel?${params}`).then(r => r.json()).then(d => setData(d.by_campaign)).catch(() => {});
  }, [config.recruiterScope]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const chartData = data.slice(0, 12).map(d => ({
    name: d.utm_campaign.length > 18 ? d.utm_campaign.slice(0, 18) + '...' : d.utm_campaign,
    clicks: d.clicks,
    links: d.link_count,
  }));

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="name" {...AXIS_STYLE} tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={60} />
          <YAxis {...AXIS_STYLE} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Bar dataKey="clicks" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} name="Clicks" />
          <Bar dataKey="links" fill={CHART_COLORS.teal} radius={[4, 4, 0, 0]} name="Links Created" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 10: NEW — SourceHeatmapWidget**

File: `src/components/insights/widgets/SourceHeatmapWidget.tsx`

```typescript
"use client";

import { useEffect, useState } from 'react';

interface MatrixCell { utm_source: string; utm_medium: string; clicks: number; }

export default function SourceHeatmapWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<MatrixCell[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (config.recruiterScope === 'self') params.set('recruiterId', 'self');
    fetch(`/api/insights/metrics/utm-funnel?${params}`).then(r => r.json()).then(d => setData(d.source_medium_matrix)).catch(() => {});
  }, [config.recruiterScope]);

  if (!data || data.length === 0) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No UTM data yet</div>;

  const sources = [...new Set(data.map(d => d.utm_source))];
  const mediums = [...new Set(data.map(d => d.utm_medium))];
  const maxClicks = Math.max(...data.map(d => d.clicks), 1);

  const getClicks = (source: string, medium: string) => data.find(d => d.utm_source === source && d.utm_medium === medium)?.clicks ?? 0;
  const getOpacity = (clicks: number) => clicks === 0 ? 0 : 0.15 + (clicks / maxClicks) * 0.85;

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 px-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider sticky left-0 bg-white">Source \ Medium</th>
            {mediums.map(m => (
              <th key={m} className="text-center py-2 px-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sources.map(source => (
            <tr key={source}>
              <td className="py-1.5 px-2 text-[var(--foreground)] font-medium sticky left-0 bg-white border-r border-[var(--border)]">{source}</td>
              {mediums.map(medium => {
                const clicks = getClicks(source, medium);
                return (
                  <td key={medium} className="py-1.5 px-2 text-center" title={`${source} / ${medium}: ${clicks} clicks`}>
                    <div className="w-full h-8 rounded-md flex items-center justify-center text-[10px] font-bold" style={{
                      background: clicks > 0 ? `rgba(6, 147, 227, ${getOpacity(clicks)})` : 'var(--muted)',
                      color: getOpacity(clicks) > 0.5 ? 'white' : 'var(--foreground)',
                    }}>
                      {clicks > 0 ? clicks : '-'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 11: NEW — LinkBuilderWidget (embedded UTM generator)**

File: `src/components/insights/widgets/LinkBuilderWidget.tsx`

This widget renders a simplified link builder that redirects to the full RecruiterWorkspace.

```typescript
"use client";

import { Link2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LinkBuilderWidget({ config }: { config: Record<string, unknown> }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl gradient-accent flex items-center justify-center">
        <Link2 className="w-6 h-6 text-white" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">UTM Link Builder</h3>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">Create tracked links from any campaign's creative workspace</p>
      </div>
      <Link href="/" className="btn-primary text-xs cursor-pointer">
        Go to Campaigns <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
```

- [ ] **Step 12: Commit all widgets**

```bash
git add src/components/insights/widgets/
git commit -m "feat: add 17 widgets — pipeline, UTM analytics, assets, operations, utility"
```

---

## Phase 4: Pages + Navigation (Tasks 11–14)

### Task 11: Dashboard List Page

See original plan Task 15 for complete implementation. Admin gets "New Dashboard" button. Recruiter gets view-only (no create, but can view dashboards admin built for them).

- [ ] **Step 1: Create `src/app/insights/page.tsx`** — server component with `requireRole(['admin', 'recruiter'])`.
- [ ] **Step 2: Create `src/app/insights/InsightsDashboardList.tsx`** — client component. Admin sees create/duplicate/delete. Recruiter sees view-only cards (hide create/delete buttons if role !== 'admin').
- [ ] **Step 3: Commit**

---

### Task 12: Dashboard Builder Page

See original plan Task 16 for complete implementation. Admin gets full edit mode. Recruiter gets view-only mode (isEditMode forced to false).

- [ ] **Step 1: Create `src/app/insights/[id]/page.tsx`** — server component shell.
- [ ] **Step 2: Create `src/app/insights/[id]/BuilderClient.tsx`** — client builder. Pass `canEdit` prop based on role.
- [ ] **Step 3: Commit**

---

### Task 13: Public Dashboard View

See original plan Task 18 for complete implementation.

- [ ] **Step 1: Create `src/app/insights/public/[token]/page.tsx`** — no-auth public view with password gate.
- [ ] **Step 2: Commit**

---

### Task 14: Sidebar + Main Dashboard KPI Strip

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Create: `src/components/insights/KpiStrip.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update Sidebar — add Analytics section**

In `src/components/Sidebar.tsx`, add `BarChart3` to the lucide-react import.

Add new "Analytics" section to ROLE_NAV for admin (between Pipeline and Admin groups):

```typescript
{
  title: "Analytics",
  links: [
    { href: "/insights", label: "Insights", Icon: BarChart3 },
  ],
},
```

Add same for recruiter (after Pipeline group):

```typescript
{
  title: "Analytics",
  links: [
    { href: "/insights", label: "Insights", Icon: BarChart3 },
  ],
},
```

- [ ] **Step 2: Create KpiStrip — embeddable 5-metric strip for admin dashboard**

File: `src/components/insights/KpiStrip.tsx`

```typescript
"use client";

import { useEffect, useState } from 'react';
import { TrendingUp, Clock, CheckCircle, Send, MousePointerClick } from 'lucide-react';

export function KpiStrip() {
  const [pipeline, setPipeline] = useState<{ total: number; by_status: { status: string; count: number }[] } | null>(null);
  const [clicks, setClicks] = useState<{ summary: { total_clicks: number } } | null>(null);

  useEffect(() => {
    fetch('/api/insights/metrics/pipeline').then(r => r.json()).then(setPipeline).catch(() => {});
    fetch('/api/insights/metrics/clicks').then(r => r.json()).then(setClicks).catch(() => {});
  }, []);

  if (!pipeline) return <div className="grid grid-cols-5 gap-3 mb-6">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>;

  const byStatus = Object.fromEntries(pipeline.by_status.map(s => [s.status, s.count]));
  const cards = [
    { label: 'Campaigns', value: pipeline.total, icon: TrendingUp, color: 'text-[var(--ring)]' },
    { label: 'Generating', value: byStatus['generating'] ?? 0, icon: Clock, color: 'text-blue-600' },
    { label: 'Approved', value: byStatus['approved'] ?? 0, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Sent', value: byStatus['sent'] ?? 0, icon: Send, color: 'text-cyan-600' },
    { label: 'Total Clicks', value: clicks?.summary?.total_clicks ?? 0, icon: MousePointerClick, color: 'text-purple-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--muted)] flex items-center justify-center shrink-0">
            <c.icon className={`w-4 h-4 ${c.color}`} />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{c.label}</div>
            <div className="text-xl font-bold text-[var(--foreground)]">{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add KpiStrip to admin view on main dashboard**

In `src/app/page.tsx`, inside the admin view section (around line 108), add the KPI strip above the two-panel layout:

```typescript
import { KpiStrip } from '@/components/insights/KpiStrip';

// Inside admin view, before the two-panel div:
{role === "admin" && <KpiStrip />}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/components/insights/KpiStrip.tsx src/app/page.tsx
git commit -m "feat: add Insights to sidebar + KPI strip on admin dashboard"
```

---

## Phase 5: Recruiter Integration (Tasks 15–16)

### Task 15: RecruiterWorkspace "My Analytics" Tab

**Files:**
- Modify: `src/components/recruiter/RecruiterWorkspace.tsx`
- Create: `src/components/recruiter/MyAnalyticsTab.tsx`

- [ ] **Step 1: Create MyAnalyticsTab — recruiter-scoped analytics dashboard**

File: `src/components/recruiter/MyAnalyticsTab.tsx`

This is a fixed-layout mini-dashboard showing the recruiter's personal UTM performance. Not the full builder — just embedded widgets. Uses the same metrics APIs with `?recruiterId=self`.

```typescript
"use client";

import { useEffect, useState } from 'react';
import { MousePointerClick, Link2, Trophy, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const AXIS_STYLE = { tick: { fill: '#737373', fontSize: 11 }, axisLine: { stroke: '#e5e5e5' }, tickLine: { stroke: '#e5e5e5' } };
const TOOLTIP_STYLE = { contentStyle: { background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 12, color: '#1a1a1a' } };

interface Props { requestId: string; recruiterId: string; }

export function MyAnalyticsTab({ requestId, recruiterId }: Props) {
  const [utmData, setUtmData] = useState<{ total_clicks: number; total_links: number; by_source: { utm_source: string; clicks: number }[] } | null>(null);
  const [creativeData, setCreativeData] = useState<{ creatives: { asset_id: string; platform: string; total_clicks: number }[] } | null>(null);

  useEffect(() => {
    const params = `recruiterId=${recruiterId}`;
    fetch(`/api/insights/metrics/utm-funnel?${params}`).then(r => r.json()).then(setUtmData).catch(() => {});
    fetch(`/api/insights/metrics/creative-performance?${params}`).then(r => r.json()).then(setCreativeData).catch(() => {});
  }, [recruiterId]);

  if (!utmData) return <div className="space-y-4 p-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>;

  const topCreatives = (creativeData?.creatives ?? []).filter(c => c.total_clicks > 0).slice(0, 5);

  return (
    <div className="p-4 space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'My Clicks', value: utmData.total_clicks, icon: MousePointerClick, color: 'text-purple-600' },
          { label: 'My Links', value: utmData.total_links, icon: Link2, color: 'text-blue-600' },
          { label: 'Avg / Link', value: utmData.total_links > 0 ? Math.round(utmData.total_clicks / utmData.total_links) : 0, icon: TrendingUp, color: 'text-green-600' },
          { label: 'Sources Used', value: utmData.by_source.length, icon: Trophy, color: 'text-amber-600' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{c.label}</span>
            </div>
            <span className="text-2xl font-bold text-[var(--foreground)]">{c.value}</span>
          </div>
        ))}
      </div>

      {/* Clicks by Source */}
      {utmData.by_source.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-[var(--foreground)] mb-3">My Clicks by Source</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utmData.by_source.slice(0, 8)}>
                <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                <XAxis dataKey="utm_source" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="clicks" fill="#0693e3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Creatives */}
      {topCreatives.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-[var(--foreground)] mb-3">My Top-Performing Creatives</h3>
          <div className="space-y-2">
            {topCreatives.map((c, i) => (
              <div key={c.asset_id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--muted)]">
                <span className="text-xs font-bold text-[var(--muted-foreground)] w-5">#{i + 1}</span>
                <span className="text-xs text-[var(--foreground)] flex-1">{c.platform} creative</span>
                <span className="text-xs font-bold text-[var(--foreground)]">{c.total_clicks} clicks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {utmData.total_links === 0 && (
        <div className="card p-8 text-center">
          <Link2 className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">No tracked links yet</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Use the link builder in the Creatives tab to create your first tracked link</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add "My Analytics" tab to RecruiterWorkspace**

In `src/components/recruiter/RecruiterWorkspace.tsx`:

1. Update the TabKey type (line ~8):
```typescript
type TabKey = "creatives" | "organic" | "dashboard" | "analytics";
```

2. Add the import:
```typescript
import { MyAnalyticsTab } from './MyAnalyticsTab';
import { BarChart3 } from 'lucide-react';
```

3. Add the tab button in the tab bar (after the dashboard tab button, around line 149):
```typescript
<TabButton active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")} icon={<BarChart3 size={14} />} label="My Analytics" />
```

4. Add the tab content (in the conditional rendering section, after `activeTab === "dashboard"`):
```typescript
{activeTab === "analytics" && <MyAnalyticsTab requestId={request.id} recruiterId={/* pass current user's clerk ID */} />}
```

Note: The recruiter's Clerk ID needs to be passed down. The RecruiterWorkspace receives the request — add a `recruiterId` prop or fetch it from `/api/auth/me`.

- [ ] **Step 3: Commit**

```bash
git add src/components/recruiter/MyAnalyticsTab.tsx src/components/recruiter/RecruiterWorkspace.tsx
git commit -m "feat: add My Analytics tab to RecruiterWorkspace — personal UTM performance"
```

---

### Task 16: TypeScript Verification + Browser Testing

- [ ] **Step 1: Type check**
```bash
pnpm tsc --noEmit
```

- [ ] **Step 2: Start dev server and verify all surfacing points**
```bash
pnpm dev
```

**Admin verification (8 checks):**
1. Sidebar shows "Analytics > Insights" link
2. Main dashboard (`/`) shows KPI strip at top (5 cards)
3. `/insights` loads dashboard list with "New Dashboard" button
4. Create a dashboard → builder loads with 3-panel layout
5. Widget palette shows 5 categories, 17 widgets
6. Add UTM Funnel widget — data loads from API
7. Add Recruiter Leaderboard — rankings show
8. Share modal toggles sharing, copies link

**Recruiter verification (4 checks):**
1. Sidebar shows "Analytics > Insights"
2. RecruiterWorkspace shows "My Analytics" tab
3. My Analytics shows personal click stats (scoped to recruiter)
4. `/insights` shows view-only dashboards (no create button)

**Public verification (2 checks):**
1. Copy a shared dashboard link → loads without auth
2. Password-protected dashboard shows password gate

- [ ] **Step 3: Commit any fixes**
```bash
git add -A
git commit -m "fix: resolve TypeScript + integration issues"
```

---

## Summary: What Gets Built

### 17 Widgets across 5 Categories

| Category | Widget | Data Source |
|----------|--------|------------|
| **Pipeline** | KPI Cards | `/metrics/pipeline` |
| | Pipeline Status (donut) | `/metrics/pipeline` |
| | Campaign Timeline | `/metrics/pipeline` |
| | Urgency Breakdown | `/metrics/pipeline` |
| | Recent Activity | `/metrics/activity` |
| **UTM & Link Analytics** | Click Overview | `/metrics/clicks` |
| | UTM Breakdown (source/medium/campaign tabs) | `/metrics/utm-funnel` |
| | Recruiter Leaderboard (ranked by clicks) | `/metrics/recruiter-leaderboard` |
| | Campaign Link ROI (clicks + links per campaign) | `/metrics/utm-funnel` |
| | Source x Medium Heatmap | `/metrics/utm-funnel` |
| | Quick Link Builder (redirect to workspace) | — |
| **Assets & Creative** | Asset Summary (types + pass rates) | `/metrics/assets` |
| | Creative Performance (asset-to-click) | `/metrics/creative-performance` |
| **Operations** | Worker Health | `/metrics/workers` |
| | Pipeline Performance | `/metrics/workers` |
| | Region Distribution | `/metrics/activity` |
| **Utility** | Text Note | — |

### 5 Surfacing Points

| Point | Role | What |
|-------|------|------|
| Sidebar "Insights" | Admin + Recruiter | Full builder (admin) / view-only (recruiter) |
| Main Dashboard KPI Strip | Admin | 5 real-time stat cards above campaign list |
| RecruiterWorkspace "My Analytics" tab | Recruiter | Personal UTM stats, clicks by source, top creatives |
| Public shared dashboards | Anyone (no auth) | Token-based view with optional password |
| Widget `recruiterScope` config | UTM widgets | "All Recruiters" vs "My Data Only" toggle |

### 8 Metrics API Endpoints (all with recruiter scoping)

| Endpoint | Scoping |
|----------|---------|
| `/api/insights/metrics/pipeline` | `?recruiterId=` filters by `created_by` |
| `/api/insights/metrics/assets` | `?recruiterId=` filters by request creator |
| `/api/insights/metrics/clicks` | `?recruiterId=` filters by `recruiter_clerk_id` |
| `/api/insights/metrics/workers` | No scoping (ops data) |
| `/api/insights/metrics/activity` | `?recruiterId=` filters by `created_by` |
| `/api/insights/metrics/utm-funnel` | `?recruiterId=` filters by `recruiter_clerk_id` |
| `/api/insights/metrics/recruiter-leaderboard` | No scoping (leaderboard shows all) |
| `/api/insights/metrics/creative-performance` | `?recruiterId=` filters by link creator |

### File Count: ~50 new files, ~4 modified files

### 16 Tasks organized in 5 phases
