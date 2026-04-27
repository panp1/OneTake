# AudienceIQ Phase 3: GA4 + GSC Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Google Analytics 4 and Google Search Console to AudienceIQ — pull real session data, traffic sources, demographics, and search queries into the drift engine's Ring 3 (observed audience).

**Architecture:** GA4 data fetched via the analytics-mcp server already configured in the toolchain. Session data cached in `ga4_session_cache` table. GSC data queried on-demand via the SEO MCP. Two new Insights widgets (GA4 Traffic, GSC Queries). Profile builder's organic ring upgraded from stub to real GA4 demographic data.

**Tech Stack:** Next.js 16 App Router, Neon Postgres, analytics-mcp (GA4 Data API), seo-ai MCP (GSC), Recharts, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-04-23-audienceiq-design.md`

---

## File Structure

### New files:
```
src/
├── lib/
│   └── audienceiq/
│       ├── ga4-client.ts              # GA4 data fetching via analytics MCP
│       └── gsc-client.ts              # GSC query fetching via SEO MCP
├── components/
│   └── insights/
│       └── widgets/
│           ├── Ga4TrafficWidget.tsx    # Sessions, sources, device breakdown
│           └── GscQueriesWidget.tsx    # Top search queries driving traffic
└── app/
    └── api/
        ├── audienceiq/
        │   └── ga4/
        │       ├── sync/route.ts      # POST trigger GA4 sync to cache
        │       └── status/route.ts    # GET GA4 connection status
        └── insights/metrics/
            ├── ga4-traffic/route.ts    # GET GA4 session/traffic data
            └── gsc-queries/route.ts   # GET GSC search query data
```

### Files to modify:
```
src/lib/db/schema.ts                    # Add ga4_session_cache table
src/lib/db/audienceiq.ts                # Add GA4 cache queries
src/lib/audienceiq/profile-builder.ts   # Upgrade organic ring with GA4 data
src/components/insights/types.ts        # Add 2 new WidgetTypes
src/components/insights/widgetRegistry.ts # Register 2 new widgets
```

---

## Task 1: DB Migration — ga4_session_cache

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add ga4_session_cache table**

Add after `audience_health_scores` in schema.ts:

```typescript
  // 23. ga4_session_cache — cached GA4 session data for AudienceIQ
  await sql`
    CREATE TABLE IF NOT EXISTS ga4_session_cache (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ga4_client_id     TEXT,
      date              DATE NOT NULL,
      source            TEXT,
      medium            TEXT,
      campaign          TEXT,
      country           TEXT,
      city              TEXT,
      device_category   TEXT,
      sessions          INT NOT NULL DEFAULT 0,
      engaged_sessions  INT NOT NULL DEFAULT 0,
      conversions       INT NOT NULL DEFAULT 0,
      demographics      JSONB NOT NULL DEFAULT '{}',
      last_synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_ga4_cache_date ON ga4_session_cache(date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ga4_cache_source ON ga4_session_cache(source) WHERE source IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ga4_cache_country ON ga4_session_cache(country) WHERE country IS NOT NULL`;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(audienceiq): add ga4_session_cache table"
```

---

## Task 2: GA4 + GSC Client Modules

**Files:**
- Create: `src/lib/audienceiq/ga4-client.ts`
- Create: `src/lib/audienceiq/gsc-client.ts`

- [ ] **Step 1: Create GA4 client**

This module wraps the analytics MCP calls. Since MCP tools are called server-side via tool invocations, we provide a fetch-based wrapper that calls our own API routes (which in turn use the MCP). For direct data access, we query the `ga4_session_cache` table.

```typescript
/**
 * GA4 Client — fetches analytics data from cache or triggers sync.
 *
 * GA4 data comes in via the analytics-mcp server.
 * This module queries the local ga4_session_cache table.
 * The sync route calls the MCP to populate the cache.
 */

import { getDb } from '@/lib/db';

export interface Ga4SessionRow {
  id: string;
  ga4_client_id: string | null;
  date: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  country: string | null;
  city: string | null;
  device_category: string | null;
  sessions: number;
  engaged_sessions: number;
  conversions: number;
  demographics: Record<string, unknown>;
  last_synced_at: string;
}

export async function isGa4Connected(): Promise<boolean> {
  // GA4 is "connected" if we have any cached data
  const sql = getDb();
  const rows = await sql`SELECT COUNT(*)::int as count FROM ga4_session_cache`;
  return (rows[0] as { count: number }).count > 0;
}

export async function getGa4TrafficSummary(days: number = 30): Promise<{
  total_sessions: number;
  total_engaged: number;
  total_conversions: number;
  by_source: { source: string; sessions: number; conversions: number }[];
  by_country: { country: string; sessions: number }[];
  by_device: { device_category: string; sessions: number }[];
}> {
  const sql = getDb();

  const [totals, bySource, byCountry, byDevice] = await Promise.all([
    sql`SELECT
          COALESCE(SUM(sessions), 0)::int as total_sessions,
          COALESCE(SUM(engaged_sessions), 0)::int as total_engaged,
          COALESCE(SUM(conversions), 0)::int as total_conversions
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int`,
    sql`SELECT source, SUM(sessions)::int as sessions, SUM(conversions)::int as conversions
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND source IS NOT NULL
        GROUP BY source ORDER BY sessions DESC LIMIT 10`,
    sql`SELECT country, SUM(sessions)::int as sessions
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND country IS NOT NULL
        GROUP BY country ORDER BY sessions DESC LIMIT 10`,
    sql`SELECT device_category, SUM(sessions)::int as sessions
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND device_category IS NOT NULL
        GROUP BY device_category ORDER BY sessions DESC`,
  ]);

  return {
    total_sessions: (totals[0] as Record<string, number>)?.total_sessions ?? 0,
    total_engaged: (totals[0] as Record<string, number>)?.total_engaged ?? 0,
    total_conversions: (totals[0] as Record<string, number>)?.total_conversions ?? 0,
    by_source: bySource as { source: string; sessions: number; conversions: number }[],
    by_country: byCountry as { country: string; sessions: number }[],
    by_device: byDevice as { device_category: string; sessions: number }[],
  };
}

export async function getGa4Demographics(days: number = 30): Promise<{
  countries: { name: string; count: number }[];
  devices: { name: string; count: number }[];
}> {
  const sql = getDb();

  const [countries, devices] = await Promise.all([
    sql`SELECT country as name, SUM(sessions)::int as count
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND country IS NOT NULL
        GROUP BY country ORDER BY count DESC`,
    sql`SELECT device_category as name, SUM(sessions)::int as count
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND device_category IS NOT NULL
        GROUP BY device_category ORDER BY count DESC`,
  ]);

  return {
    countries: countries as { name: string; count: number }[],
    devices: devices as { name: string; count: number }[],
  };
}

export async function upsertGa4Session(row: Omit<Ga4SessionRow, 'id' | 'last_synced_at'>): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO ga4_session_cache (ga4_client_id, date, source, medium, campaign, country, city, device_category, sessions, engaged_sessions, conversions, demographics)
    VALUES (${row.ga4_client_id}, ${row.date}, ${row.source}, ${row.medium}, ${row.campaign}, ${row.country}, ${row.city}, ${row.device_category}, ${row.sessions}, ${row.engaged_sessions}, ${row.conversions}, ${JSON.stringify(row.demographics)})
  `;
}
```

- [ ] **Step 2: Create GSC client**

```typescript
/**
 * GSC Client — fetches search query data.
 *
 * GSC data comes via the seo-ai MCP server or direct API.
 * This module provides query functions for search performance data.
 * Currently returns data from a local cache pattern.
 */

export interface GscQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Fetch top search queries. In Phase 3, this uses cached data
 * or calls the SEO MCP on-demand.
 */
export async function getTopQueries(limit: number = 20): Promise<GscQueryRow[]> {
  // GSC data will be populated via the seo-ai MCP server
  // For now, return empty array — the widget shows "No GSC data yet"
  // Once GSC MCP is wired, this will call:
  // mcp__seo-ai__get_keyword_metrics or similar
  return [];
}

export async function getTopPages(limit: number = 20): Promise<GscPageRow[]> {
  return [];
}

export function isGscConnected(): boolean {
  // Will be true once GSC MCP is configured with property access
  return false;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/audienceiq/ga4-client.ts src/lib/audienceiq/gsc-client.ts
git commit -m "feat(audienceiq): add GA4 + GSC client modules"
```

---

## Task 3: GA4 API Routes + Metrics Endpoints

**Files:**
- Create: `src/app/api/audienceiq/ga4/sync/route.ts`
- Create: `src/app/api/audienceiq/ga4/status/route.ts`
- Create: `src/app/api/insights/metrics/ga4-traffic/route.ts`
- Create: `src/app/api/insights/metrics/gsc-queries/route.ts`

- [ ] **Step 1: GA4 sync route**

```typescript
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

export async function POST() {
  await requireRole(['admin']);

  // GA4 sync will use the analytics-mcp server to pull session data
  // For now, returns a placeholder response
  // Once MCP is wired: call mcp__analytics-mcp__run_report, parse rows, upsertGa4Session each

  return NextResponse.json({
    success: false,
    message: 'GA4 sync not yet configured. Connect analytics-mcp with a GA4 property ID to enable.',
    synced: 0,
  });
}
```

- [ ] **Step 2: GA4 status route**

```typescript
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { isGa4Connected } from '@/lib/audienceiq/ga4-client';

export async function GET() {
  await requireAuth();
  const connected = await isGa4Connected();

  return NextResponse.json({
    connected,
    message: connected
      ? 'GA4 data available in cache'
      : 'No GA4 data yet. Trigger a sync or configure analytics-mcp.',
  });
}
```

- [ ] **Step 3: GA4 traffic metrics**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getGa4TrafficSummary, isGa4Connected } from '@/lib/audienceiq/ga4-client';

export async function GET(req: NextRequest) {
  await requireAuth();
  const days = parseInt(req.nextUrl.searchParams.get('days') || '30');

  const connected = await isGa4Connected();
  if (!connected) {
    return NextResponse.json({
      connected: false,
      message: 'No GA4 data available. Configure analytics-mcp and trigger a sync.',
      total_sessions: 0,
      total_engaged: 0,
      total_conversions: 0,
      by_source: [],
      by_country: [],
      by_device: [],
    });
  }

  const summary = await getGa4TrafficSummary(days);
  return NextResponse.json({ connected: true, ...summary });
}
```

- [ ] **Step 4: GSC queries metrics**

```typescript
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getTopQueries, getTopPages, isGscConnected } from '@/lib/audienceiq/gsc-client';

export async function GET() {
  await requireAuth();

  const connected = isGscConnected();
  if (!connected) {
    return NextResponse.json({
      connected: false,
      message: 'GSC not configured. Connect seo-ai MCP to enable search query data.',
      queries: [],
      pages: [],
    });
  }

  const [queries, pages] = await Promise.all([
    getTopQueries(),
    getTopPages(),
  ]);

  return NextResponse.json({ connected: true, queries, pages });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/audienceiq/ga4/ src/app/api/insights/metrics/ga4-traffic/ src/app/api/insights/metrics/gsc-queries/
git commit -m "feat(audienceiq): add GA4 sync/status + traffic/queries metrics APIs"
```

---

## Task 4: Upgrade Organic Profile Builder

**Files:**
- Modify: `src/lib/audienceiq/profile-builder.ts`

- [ ] **Step 1: Replace organic stub with GA4 data**

Read the file. Replace the `buildOrganicProfile` function:

```typescript
export async function buildOrganicProfile(requestId: string): Promise<ProfileData> {
  // Pull GA4 demographic data for the organic ring
  const { isGa4Connected, getGa4Demographics } = await import('./ga4-client');
  const connected = await isGa4Connected();

  if (!connected) {
    return {
      request_id: requestId,
      ring: 'organic',
      demographics: {},
      skills: {},
      languages: [],
      regions: [],
      sample_size: 0,
      confidence: 'low',
      source: 'ga4_unavailable',
    };
  }

  const demo = await getGa4Demographics(30);
  const regions = demo.countries.map(c => c.name);
  const sampleSize = demo.countries.reduce((sum, c) => sum + c.count, 0);
  const confidence = sampleSize >= 1000 ? 'high' : sampleSize >= 100 ? 'medium' : 'low';

  return {
    request_id: requestId,
    ring: 'organic',
    demographics: {
      geo_distribution: Object.fromEntries(demo.countries.map(c => [c.name, c.count])),
      device_distribution: Object.fromEntries(demo.devices.map(d => [d.name, d.count])),
    },
    skills: {},
    languages: [],
    regions,
    sample_size: sampleSize,
    confidence,
    source: 'ga4',
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/audienceiq/profile-builder.ts
git commit -m "feat(audienceiq): upgrade organic profile builder with GA4 demographics"
```

---

## Task 5: Widget Registry + Types Update

**Files:**
- Modify: `src/components/insights/types.ts`
- Modify: `src/components/insights/widgetRegistry.ts`

- [ ] **Step 1: Add 2 new widget types**

In `types.ts`, add after `'audience-health'`:

```typescript
  | 'ga4-traffic'
  | 'gsc-queries'
```

- [ ] **Step 2: Add to registry**

In `widgetRegistry.ts`, add `BarChart2, Search` to lucide-react imports (BarChart2 may already exist — use BarChart if so). Update comment to "26 widgets".

Add in the AudienceIQ section (or create a new "Analytics" subsection):

```typescript
  // ── Analytics ─────────────────────────────────────────────
  'ga4-traffic': {
    component: lazy(() => import('./widgets/Ga4TrafficWidget')),
    category: 'audienceiq', label: 'GA4 Traffic', icon: BarChart3,
    description: 'Sessions, traffic sources, and device breakdown from Google Analytics',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'gsc-queries': {
    component: lazy(() => import('./widgets/GscQueriesWidget')),
    category: 'audienceiq', label: 'Search Queries', icon: Search,
    description: 'Top search queries driving traffic from Google Search Console',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
```

Note: `Search` icon is already imported in the current registry. `BarChart3` is also already imported. So you may only need to update the comment + add the 2 entries.

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/types.ts src/components/insights/widgetRegistry.ts
git commit -m "feat(audienceiq): register GA4 Traffic + GSC Queries widgets"
```

---

## Task 6: GA4 Traffic Widget + GSC Queries Widget

**Files:**
- Create: `src/components/insights/widgets/Ga4TrafficWidget.tsx`
- Create: `src/components/insights/widgets/GscQueriesWidget.tsx`

- [ ] **Step 1: GA4 Traffic Widget**

```typescript
"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Unplug } from 'lucide-react';
import { CHART_COLORS, CHART_PALETTE, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface Ga4Data {
  connected: boolean;
  message?: string;
  total_sessions: number;
  total_engaged: number;
  total_conversions: number;
  by_source: { source: string; sessions: number; conversions: number }[];
  by_country: { country: string; sessions: number }[];
  by_device: { device_category: string; sessions: number }[];
}

export default function Ga4TrafficWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<Ga4Data | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/ga4-traffic?days=${days}`).then(r => r.json()).then(setData).catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">GA4 Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Configure analytics-mcp and trigger a sync to enable</p>
      </div>
    );
  }

  const engagementRate = data.total_sessions > 0 ? Math.round((data.total_engaged / data.total_sessions) * 100) : 0;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Sessions', value: data.total_sessions.toLocaleString() },
          { label: 'Engaged', value: `${engagementRate}%` },
          { label: 'Conversions', value: data.total_conversions.toLocaleString() },
        ].map(c => (
          <div key={c.label} className="px-3 py-2 rounded-lg bg-[var(--muted)] text-center">
            <div className="text-[10px] text-[var(--muted-foreground)]">{c.label}</div>
            <div className="text-sm font-bold text-[var(--foreground)]">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Source chart */}
      {data.by_source.length > 0 && (
        <div className="flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">By Source</div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.by_source.slice(0, 6)}>
              <CartesianGrid {...GRID_STYLE} />
              <XAxis dataKey="source" {...AXIS_STYLE} tick={{ fontSize: 9 }} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="sessions" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: GSC Queries Widget**

```typescript
"use client";

import { useEffect, useState } from 'react';
import { Unplug, Search, TrendingUp, TrendingDown } from 'lucide-react';

interface GscData {
  connected: boolean;
  message?: string;
  queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
}

export default function GscQueriesWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<GscData | null>(null);

  useEffect(() => {
    fetch('/api/insights/metrics/gsc-queries').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Search className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">GSC Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Configure seo-ai MCP to enable search query data</p>
      </div>
    );
  }

  if (data.queries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">
        No search query data yet
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">Query</th>
            <th className="text-right py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">Clicks</th>
            <th className="text-right py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">Impr</th>
            <th className="text-right py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">CTR</th>
            <th className="text-right py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">Pos</th>
          </tr>
        </thead>
        <tbody>
          {data.queries.map((q, i) => (
            <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]">
              <td className="py-2 px-2 text-[var(--foreground)] font-medium truncate max-w-[180px]">{q.query}</td>
              <td className="py-2 px-2 text-right text-[var(--foreground)]">{q.clicks}</td>
              <td className="py-2 px-2 text-right text-[var(--muted-foreground)]">{q.impressions}</td>
              <td className="py-2 px-2 text-right text-[var(--foreground)]">{(q.ctr * 100).toFixed(1)}%</td>
              <td className="py-2 px-2 text-right text-[var(--muted-foreground)]">{q.position.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/widgets/Ga4TrafficWidget.tsx src/components/insights/widgets/GscQueriesWidget.tsx
git commit -m "feat(audienceiq): add GA4 Traffic + GSC Queries widgets"
```

---

## Task 7: TypeScript Verification

- [ ] **Step 1: Type check**
```bash
pnpm tsc --noEmit
```

- [ ] **Step 2: Verify 26 total widgets in registry**

- [ ] **Step 3: Commit any fixes**
```bash
git add -A
git commit -m "fix(audienceiq): resolve Phase 3 TypeScript issues"
```
