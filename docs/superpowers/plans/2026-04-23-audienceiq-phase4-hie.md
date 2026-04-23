# AudienceIQ Phase 4: HIE Behavioral Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port VYRA's Heat Intelligence Engine (HIE) — client-side behavioral tracking script, event ingest APIs, fact materialization, query service, 5 CRO diagnostics detectors, and 3 Insights widgets — into centric-intake for OneForma's 1M+ monthly visitors.

**Architecture:** Client-side JS script (adapted from VYRA's 741-line HIE script) deployed via GTM, sends behavioral events to Next.js API routes. Events stored in 3 separated tables (interactions, scroll, snapshots) for query performance at scale. Pre-aggregated fact tables materialized on-demand. 5 deterministic CRO detectors (scroll cliff, CTA weakness, form friction, platform mismatch, ignored section). 3 new Insights widgets.

**Tech Stack:** Next.js 16 App Router, Neon Postgres, vanilla JS (client script), Recharts, Tailwind CSS 4

**Source:** VYRA HIE at `/Users/stevenjunop/vyra/apps/api/` (READ ONLY)

---

## File Structure

### New files:
```
src/
├── lib/
│   └── hie/
│       ├── ingest.ts                # Event validation + batch insert
│       ├── query.ts                 # Heatmap density + scroll depth queries
│       ├── diagnostics.ts           # 5 CRO detectors
│       └── facts.ts                 # Fact materialization (heat + scroll)
├── components/
│   └── insights/
│       └── widgets/
│           ├── HieHeatmapWidget.tsx  # Click density grid
│           ├── HieScrollmapWidget.tsx # Scroll depth bars
│           └── HieFormFrictionWidget.tsx # Form abandonment
├── app/
│   └── api/hie/
│       ├── session/route.ts         # POST register session
│       ├── batch/route.ts           # POST ingest event batch
│       ├── heatmap/route.ts         # GET click density
│       ├── scrollmap/route.ts       # GET scroll depth
│       ├── diagnostics/route.ts     # GET CRO diagnostics
│       └── facts/
│           └── refresh/route.ts     # POST trigger materialization
└── public/
    └── nova-tracking-hie.js         # Client-side tracking script
```

### Files to modify:
```
src/lib/db/schema.ts                  # Add 6 HIE tables
src/components/insights/types.ts      # Add 3 WidgetTypes
src/components/insights/widgetRegistry.ts # Register 3 widgets
```

---

## Task 1: DB Migration — 6 HIE Tables

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add all 6 HIE tables**

Add after `ga4_session_cache` in schema.ts:

```typescript
  // 24. hie_sessions — behavioral session tracking
  await sql`
    CREATE TABLE IF NOT EXISTS hie_sessions (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id        TEXT NOT NULL UNIQUE,
      visitor_id        TEXT NOT NULL,
      landing_page_url  TEXT,
      referrer          TEXT,
      user_agent        TEXT,
      viewport_width    INT,
      viewport_height   INT,
      device_pixel_ratio FLOAT,
      device_type       TEXT,
      screen_width      INT,
      screen_height     INT,
      started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_sessions_visitor ON hie_sessions(visitor_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_sessions_started ON hie_sessions(started_at DESC)`;

  // 25. hie_interaction_events — clicks, CTAs, forms, mousemove, visibility
  await sql`
    CREATE TABLE IF NOT EXISTS hie_interaction_events (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id          TEXT NOT NULL,
      visitor_id          TEXT NOT NULL,
      event_type          TEXT NOT NULL,
      page_url            TEXT,
      page_hash           TEXT,
      x                   INT,
      y                   INT,
      viewport_width      INT,
      viewport_height     INT,
      element_selector    TEXT,
      element_tag         TEXT,
      element_text        TEXT,
      event_data          JSONB DEFAULT '{}',
      client_timestamp_ms BIGINT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_interactions_session ON hie_interaction_events(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_interactions_page ON hie_interaction_events(page_url, event_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_interactions_hash ON hie_interaction_events(page_hash)`;

  // 26. hie_scroll_events — scroll depth tracking
  await sql`
    CREATE TABLE IF NOT EXISTS hie_scroll_events (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id          TEXT NOT NULL,
      visitor_id          TEXT NOT NULL,
      page_url            TEXT,
      page_hash           TEXT,
      scroll_y            INT,
      scroll_percent      INT,
      document_height     INT,
      viewport_height     INT,
      direction           TEXT,
      milestone           INT,
      client_timestamp_ms BIGINT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_scroll_session ON hie_scroll_events(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_scroll_page ON hie_scroll_events(page_url)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_scroll_milestone ON hie_scroll_events(page_url, milestone)`;

  // 27. hie_page_snapshots — compressed DOM for heatmap overlay
  await sql`
    CREATE TABLE IF NOT EXISTS hie_page_snapshots (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_url          TEXT NOT NULL,
      canonical_url     TEXT,
      page_hash         TEXT NOT NULL UNIQUE,
      stripped_html     BYTEA,
      viewport_width    INT,
      document_height   INT,
      element_map       JSONB DEFAULT '{}',
      captured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // 28. hie_heat_facts — pre-aggregated click density
  await sql`
    CREATE TABLE IF NOT EXISTS hie_heat_facts (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_url          TEXT NOT NULL,
      page_hash         TEXT,
      event_type        TEXT NOT NULL,
      grid_x            INT NOT NULL,
      grid_y            INT NOT NULL,
      click_count       INT NOT NULL DEFAULT 0,
      unique_sessions   INT NOT NULL DEFAULT 0,
      unique_visitors   INT NOT NULL DEFAULT 0,
      element_selector  TEXT,
      segment_key       TEXT,
      segment_value     TEXT,
      fact_date         DATE NOT NULL DEFAULT CURRENT_DATE
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_heat_facts_page ON hie_heat_facts(page_url, fact_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_heat_facts_segment ON hie_heat_facts(page_url, segment_key, fact_date)`;

  // 29. hie_scroll_facts — pre-aggregated scroll depth
  await sql`
    CREATE TABLE IF NOT EXISTS hie_scroll_facts (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_url          TEXT NOT NULL,
      page_hash         TEXT,
      depth_band        TEXT NOT NULL,
      sessions_reached  INT NOT NULL DEFAULT 0,
      unique_visitors   INT NOT NULL DEFAULT 0,
      avg_time_at_depth_ms INT NOT NULL DEFAULT 0,
      segment_key       TEXT,
      segment_value     TEXT,
      fact_date         DATE NOT NULL DEFAULT CURRENT_DATE
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hie_scroll_facts_page ON hie_scroll_facts(page_url, fact_date)`;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(hie): add 6 HIE tables — sessions, interactions, scroll, snapshots, heat/scroll facts"
```

---

## Task 2: HIE Ingest Service

**Files:**
- Create: `src/lib/hie/ingest.ts`

- [ ] **Step 1: Create ingest service**

Validates and batch-inserts HIE events into the appropriate tables.

```typescript
/**
 * HIE Ingest — validates and stores behavioral events.
 */

import { getDb } from '@/lib/db';

export interface HieSessionData {
  session_id: string;
  visitor_id: string;
  landing_page_url?: string;
  referrer?: string;
  user_agent?: string;
  viewport_width?: number;
  viewport_height?: number;
  device_pixel_ratio?: number;
  screen_width?: number;
  screen_height?: number;
}

export interface HieEvent {
  event_type: string;
  session_id: string;
  visitor_id: string;
  page_url?: string;
  page_hash?: string;
  x?: number;
  y?: number;
  viewport_width?: number;
  viewport_height?: number;
  element_selector?: string;
  element_tag?: string;
  element_text?: string;
  event_data?: Record<string, unknown>;
  client_timestamp_ms?: number;
  // Scroll-specific
  scroll_y?: number;
  scroll_percent?: number;
  document_height?: number;
  direction?: string;
  milestone?: number;
}

const SCROLL_TYPES = ['scroll_depth'];
const INTERACTION_TYPES = ['click_interaction', 'cta_click', 'form_interaction', 'viewport_resize', 'mousemove_sample', 'element_visibility'];
const SESSION_ID_PATTERN = /^hs_[0-9a-f]{32}$/;
const VISITOR_ID_PATTERN = /^v_[0-9a-f]+$/;

function deriveDeviceType(viewportWidth: number | undefined): string {
  if (!viewportWidth) return 'unknown';
  if (viewportWidth < 768) return 'mobile';
  if (viewportWidth < 1024) return 'tablet';
  return 'desktop';
}

export async function registerSession(data: HieSessionData): Promise<boolean> {
  if (!data.session_id || !data.visitor_id) return false;

  const sql = getDb();
  try {
    await sql`
      INSERT INTO hie_sessions (session_id, visitor_id, landing_page_url, referrer, user_agent, viewport_width, viewport_height, device_pixel_ratio, device_type, screen_width, screen_height)
      VALUES (${data.session_id}, ${data.visitor_id}, ${data.landing_page_url ?? null}, ${data.referrer ?? null}, ${data.user_agent ?? null}, ${data.viewport_width ?? null}, ${data.viewport_height ?? null}, ${data.device_pixel_ratio ?? null}, ${deriveDeviceType(data.viewport_width)}, ${data.screen_width ?? null}, ${data.screen_height ?? null})
      ON CONFLICT (session_id) DO NOTHING
    `;
    return true;
  } catch (err) {
    console.error('[HIE] Session register error:', (err as Error).message);
    return false;
  }
}

export async function ingestBatch(events: HieEvent[]): Promise<{ accepted: number; rejected: number }> {
  const sql = getDb();
  let accepted = 0;
  let rejected = 0;

  for (const event of events) {
    if (!event.event_type || !event.session_id || !event.visitor_id) {
      rejected++;
      continue;
    }

    try {
      if (SCROLL_TYPES.includes(event.event_type)) {
        await sql`
          INSERT INTO hie_scroll_events (session_id, visitor_id, page_url, page_hash, scroll_y, scroll_percent, document_height, viewport_height, direction, milestone, client_timestamp_ms)
          VALUES (${event.session_id}, ${event.visitor_id}, ${event.page_url ?? null}, ${event.page_hash ?? null}, ${event.scroll_y ?? null}, ${event.scroll_percent ?? null}, ${event.document_height ?? null}, ${event.viewport_height ?? null}, ${event.direction ?? null}, ${event.milestone ?? null}, ${event.client_timestamp_ms ?? null})
        `;
      } else if (INTERACTION_TYPES.includes(event.event_type)) {
        await sql`
          INSERT INTO hie_interaction_events (session_id, visitor_id, event_type, page_url, page_hash, x, y, viewport_width, viewport_height, element_selector, element_tag, element_text, event_data, client_timestamp_ms)
          VALUES (${event.session_id}, ${event.visitor_id}, ${event.event_type}, ${event.page_url ?? null}, ${event.page_hash ?? null}, ${event.x ?? null}, ${event.y ?? null}, ${event.viewport_width ?? null}, ${event.viewport_height ?? null}, ${event.element_selector ?? null}, ${event.element_tag ?? null}, ${event.element_text ?? null}, ${JSON.stringify(event.event_data ?? {})}, ${event.client_timestamp_ms ?? null})
        `;
      } else {
        rejected++;
        continue;
      }
      accepted++;
    } catch (err) {
      rejected++;
      console.error('[HIE] Event ingest error:', (err as Error).message);
    }
  }

  return { accepted, rejected };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/hie/ingest.ts
git commit -m "feat(hie): add ingest service — session register + batch event insert"
```

---

## Task 3: HIE Query + Diagnostics Services

**Files:**
- Create: `src/lib/hie/query.ts`
- Create: `src/lib/hie/diagnostics.ts`
- Create: `src/lib/hie/facts.ts`

- [ ] **Step 1: Query service**

```typescript
/**
 * HIE Query — click density and scroll depth from facts or raw events.
 */

import { getDb } from '@/lib/db';

export interface HeatmapCell {
  grid_x: number;
  grid_y: number;
  click_count: number;
  unique_sessions: number;
}

export interface ScrollBand {
  depth_band: string;
  sessions_reached: number;
  unique_visitors: number;
  pct_of_total: number;
}

export async function getClickDensity(pageUrl: string, gridSize: number = 50): Promise<HeatmapCell[]> {
  const sql = getDb();

  // Try facts first
  const facts = await sql`
    SELECT grid_x, grid_y, SUM(click_count)::int as click_count, SUM(unique_sessions)::int as unique_sessions
    FROM hie_heat_facts WHERE page_url = ${pageUrl}
    GROUP BY grid_x, grid_y ORDER BY click_count DESC
  `;

  if (facts.length > 0) return facts as HeatmapCell[];

  // Fallback to raw events
  const raw = await sql`
    SELECT
      FLOOR(x::float / NULLIF(viewport_width, 0) * ${gridSize})::int as grid_x,
      FLOOR(y::float / NULLIF(viewport_height, 0) * ${gridSize})::int as grid_y,
      COUNT(*)::int as click_count,
      COUNT(DISTINCT session_id)::int as unique_sessions
    FROM hie_interaction_events
    WHERE page_url = ${pageUrl} AND event_type IN ('click_interaction', 'cta_click') AND x IS NOT NULL AND y IS NOT NULL
    GROUP BY grid_x, grid_y ORDER BY click_count DESC
  `;

  return raw as HeatmapCell[];
}

export async function getScrollDepth(pageUrl: string): Promise<ScrollBand[]> {
  const sql = getDb();

  // Try facts first
  const facts = await sql`
    SELECT depth_band, SUM(sessions_reached)::int as sessions_reached, SUM(unique_visitors)::int as unique_visitors
    FROM hie_scroll_facts WHERE page_url = ${pageUrl}
    GROUP BY depth_band ORDER BY depth_band
  `;

  if (facts.length > 0) {
    const maxSessions = Math.max(...(facts as { sessions_reached: number }[]).map(f => f.sessions_reached), 1);
    return (facts as ScrollBand[]).map(f => ({ ...f, pct_of_total: Math.round((f.sessions_reached / maxSessions) * 100) }));
  }

  // Fallback to raw events — compute depth bands
  const raw = await sql`
    SELECT
      CASE
        WHEN scroll_percent < 10 THEN '0-10'
        WHEN scroll_percent < 20 THEN '10-20'
        WHEN scroll_percent < 30 THEN '20-30'
        WHEN scroll_percent < 40 THEN '30-40'
        WHEN scroll_percent < 50 THEN '40-50'
        WHEN scroll_percent < 60 THEN '50-60'
        WHEN scroll_percent < 70 THEN '60-70'
        WHEN scroll_percent < 80 THEN '70-80'
        WHEN scroll_percent < 90 THEN '80-90'
        ELSE '90-100'
      END as depth_band,
      COUNT(DISTINCT session_id)::int as sessions_reached,
      COUNT(DISTINCT visitor_id)::int as unique_visitors
    FROM hie_scroll_events WHERE page_url = ${pageUrl}
    GROUP BY depth_band ORDER BY depth_band
  `;

  const maxSessions = Math.max(...(raw as { sessions_reached: number }[]).map(r => r.sessions_reached), 1);
  return (raw as ScrollBand[]).map(r => ({ ...r, pct_of_total: Math.round((r.sessions_reached / maxSessions) * 100) }));
}

export async function getTrackedPages(): Promise<{ page_url: string; event_count: number; session_count: number }[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT page_url, COUNT(*)::int as event_count, COUNT(DISTINCT session_id)::int as session_count
    FROM hie_interaction_events WHERE page_url IS NOT NULL
    GROUP BY page_url ORDER BY event_count DESC LIMIT 50
  `;
  return rows as { page_url: string; event_count: number; session_count: number }[];
}
```

- [ ] **Step 2: Diagnostics service**

```typescript
/**
 * HIE Diagnostics — 5 deterministic CRO detectors.
 */

import { getDb } from '@/lib/db';

export interface DiagnosticObservation {
  type: 'scroll_cliff' | 'cta_weakness' | 'form_friction' | 'platform_mismatch' | 'ignored_section';
  confidence: 'high' | 'medium' | 'low';
  message: string;
  detail: Record<string, unknown>;
  recommended_action: string;
}

export async function runDiagnostics(pageUrl: string): Promise<DiagnosticObservation[]> {
  const observations: DiagnosticObservation[] = [];
  const sql = getDb();

  // 1. Scroll Cliff — >30% drop between consecutive milestones
  const milestones = await sql`
    SELECT milestone, COUNT(DISTINCT session_id)::int as sessions
    FROM hie_scroll_events
    WHERE page_url = ${pageUrl} AND milestone IS NOT NULL
    GROUP BY milestone ORDER BY milestone
  `;

  if (milestones.length >= 2) {
    const ms = milestones as { milestone: number; sessions: number }[];
    for (let i = 1; i < ms.length; i++) {
      const prev = ms[i - 1];
      const curr = ms[i];
      if (prev.sessions > 0) {
        const dropPct = Math.round(((prev.sessions - curr.sessions) / prev.sessions) * 100);
        if (dropPct > 30) {
          observations.push({
            type: 'scroll_cliff',
            confidence: prev.sessions >= 100 ? 'high' : prev.sessions >= 30 ? 'medium' : 'low',
            message: `${dropPct}% of users drop off between ${prev.milestone}% and ${curr.milestone}% scroll depth`,
            detail: { from_milestone: prev.milestone, to_milestone: curr.milestone, drop_pct: dropPct, sessions_before: prev.sessions, sessions_after: curr.sessions },
            recommended_action: `Review content at the ${prev.milestone}-${curr.milestone}% scroll zone — consider moving key information or CTAs above this point`,
          });
        }
      }
    }
  }

  // 2. CTA Weakness — CTAs with hover/proximity but low click rate
  const ctaEvents = await sql`
    SELECT element_selector, element_tag,
      COUNT(*) FILTER (WHERE event_type = 'cta_click')::int as clicks,
      COUNT(*) FILTER (WHERE event_type = 'mousemove_sample')::int as hovers,
      COUNT(DISTINCT session_id)::int as sessions
    FROM hie_interaction_events
    WHERE page_url = ${pageUrl} AND (event_type = 'cta_click' OR (event_type = 'mousemove_sample' AND element_tag IN ('button', 'a')))
    GROUP BY element_selector, element_tag
    HAVING COUNT(*) FILTER (WHERE event_type = 'mousemove_sample') > 5
  `;

  for (const row of ctaEvents) {
    const cta = row as { element_selector: string; element_tag: string; clicks: number; hovers: number; sessions: number };
    if (cta.hovers > 10 && cta.clicks === 0) {
      observations.push({
        type: 'cta_weakness',
        confidence: cta.sessions >= 30 ? 'medium' : 'low',
        message: `CTA "${cta.element_selector}" gets attention (${cta.hovers} hovers) but 0 clicks`,
        detail: { selector: cta.element_selector, hovers: cta.hovers, clicks: cta.clicks },
        recommended_action: 'Review CTA copy, color contrast, and positioning — users notice it but don\'t engage',
      });
    }
  }

  // 3. Form Friction — high abandonment
  const formEvents = await sql`
    SELECT
      COUNT(*) FILTER (WHERE event_data->>'action' = 'focus')::int as form_starts,
      COUNT(*) FILTER (WHERE event_data->>'action' = 'submit')::int as form_submits,
      COUNT(DISTINCT session_id)::int as sessions
    FROM hie_interaction_events
    WHERE page_url = ${pageUrl} AND event_type = 'form_interaction'
  `;

  if (formEvents.length > 0) {
    const form = formEvents[0] as { form_starts: number; form_submits: number; sessions: number };
    if (form.form_starts > 5 && form.form_submits === 0) {
      observations.push({
        type: 'form_friction',
        confidence: form.sessions >= 30 ? 'high' : 'medium',
        message: `${form.form_starts} users started the form but 0 submitted — 100% abandonment`,
        detail: { starts: form.form_starts, submits: form.form_submits },
        recommended_action: 'Simplify the form — reduce fields, add progress indicators, or check for validation errors',
      });
    } else if (form.form_starts > 10 && form.form_submits > 0) {
      const abandonRate = Math.round(((form.form_starts - form.form_submits) / form.form_starts) * 100);
      if (abandonRate > 70) {
        observations.push({
          type: 'form_friction',
          confidence: form.sessions >= 30 ? 'high' : 'medium',
          message: `${abandonRate}% form abandonment rate (${form.form_starts} starts, ${form.form_submits} submits)`,
          detail: { starts: form.form_starts, submits: form.form_submits, abandon_rate: abandonRate },
          recommended_action: 'High form friction detected — consider reducing required fields or adding inline validation',
        });
      }
    }
  }

  // 4. Platform Mismatch — mobile vs desktop behavior divergence
  const deviceSessions = await sql`
    SELECT s.device_type, COUNT(DISTINCT s.session_id)::int as sessions,
      COUNT(DISTINCT e.id)::int as events
    FROM hie_sessions s
    LEFT JOIN hie_interaction_events e ON e.session_id = s.session_id AND e.page_url = ${pageUrl}
    WHERE s.device_type IN ('mobile', 'desktop')
    GROUP BY s.device_type
  `;

  if (deviceSessions.length >= 2) {
    const devices = deviceSessions as { device_type: string; sessions: number; events: number }[];
    const mobile = devices.find(d => d.device_type === 'mobile');
    const desktop = devices.find(d => d.device_type === 'desktop');
    if (mobile && desktop && mobile.sessions > 5 && desktop.sessions > 5) {
      const mobileEngRate = mobile.events / mobile.sessions;
      const desktopEngRate = desktop.events / desktop.sessions;
      if (desktopEngRate > 0 && mobileEngRate / desktopEngRate < 0.4) {
        observations.push({
          type: 'platform_mismatch',
          confidence: (mobile.sessions + desktop.sessions) >= 60 ? 'medium' : 'low',
          message: `Mobile engagement is ${Math.round((mobileEngRate / desktopEngRate) * 100)}% of desktop — potential mobile UX issue`,
          detail: { mobile_rate: Math.round(mobileEngRate * 10) / 10, desktop_rate: Math.round(desktopEngRate * 10) / 10 },
          recommended_action: 'Review mobile layout — check CTA visibility, form usability, and content reflow',
        });
      }
    }
  }

  return observations;
}
```

- [ ] **Step 3: Facts materialization service**

```typescript
/**
 * HIE Fact Materialization — aggregates raw events into heat/scroll fact tables.
 */

import { getDb } from '@/lib/db';

export async function refreshHeatFacts(pageUrl: string, gridSize: number = 50): Promise<number> {
  const sql = getDb();

  // Delete existing facts for this page + today
  await sql`DELETE FROM hie_heat_facts WHERE page_url = ${pageUrl} AND fact_date = CURRENT_DATE`;

  // Aggregate from raw events
  const result = await sql`
    INSERT INTO hie_heat_facts (page_url, page_hash, event_type, grid_x, grid_y, click_count, unique_sessions, unique_visitors, element_selector, fact_date)
    SELECT
      page_url,
      page_hash,
      event_type,
      FLOOR(x::float / NULLIF(viewport_width, 0) * ${gridSize})::int as grid_x,
      FLOOR(y::float / NULLIF(viewport_height, 0) * ${gridSize})::int as grid_y,
      COUNT(*)::int,
      COUNT(DISTINCT session_id)::int,
      COUNT(DISTINCT visitor_id)::int,
      MODE() WITHIN GROUP (ORDER BY element_selector),
      CURRENT_DATE
    FROM hie_interaction_events
    WHERE page_url = ${pageUrl} AND event_type IN ('click_interaction', 'cta_click') AND x IS NOT NULL AND y IS NOT NULL
    GROUP BY page_url, page_hash, event_type, grid_x, grid_y
    RETURNING id
  `;

  return result.length;
}

export async function refreshScrollFacts(pageUrl: string): Promise<number> {
  const sql = getDb();

  await sql`DELETE FROM hie_scroll_facts WHERE page_url = ${pageUrl} AND fact_date = CURRENT_DATE`;

  const result = await sql`
    INSERT INTO hie_scroll_facts (page_url, page_hash, depth_band, sessions_reached, unique_visitors, avg_time_at_depth_ms, fact_date)
    SELECT
      page_url,
      page_hash,
      CASE
        WHEN scroll_percent < 10 THEN '0-10'
        WHEN scroll_percent < 20 THEN '10-20'
        WHEN scroll_percent < 30 THEN '20-30'
        WHEN scroll_percent < 40 THEN '30-40'
        WHEN scroll_percent < 50 THEN '40-50'
        WHEN scroll_percent < 60 THEN '50-60'
        WHEN scroll_percent < 70 THEN '60-70'
        WHEN scroll_percent < 80 THEN '70-80'
        WHEN scroll_percent < 90 THEN '80-90'
        ELSE '90-100'
      END,
      COUNT(DISTINCT session_id)::int,
      COUNT(DISTINCT visitor_id)::int,
      0,
      CURRENT_DATE
    FROM hie_scroll_events
    WHERE page_url = ${pageUrl}
    GROUP BY page_url, page_hash, depth_band
    RETURNING id
  `;

  return result.length;
}
```

- [ ] **Step 4: Commit all**

```bash
git add src/lib/hie/
git commit -m "feat(hie): add query, diagnostics, facts, ingest services"
```

---

## Task 4: HIE API Routes (6 routes)

**Files:**
- Create: `src/app/api/hie/session/route.ts`
- Create: `src/app/api/hie/batch/route.ts`
- Create: `src/app/api/hie/heatmap/route.ts`
- Create: `src/app/api/hie/scrollmap/route.ts`
- Create: `src/app/api/hie/diagnostics/route.ts`
- Create: `src/app/api/hie/facts/refresh/route.ts`

- [ ] **Step 1: Session + batch ingest (NO auth — public endpoints)**

`src/app/api/hie/session/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { registerSession } from '@/lib/hie/ingest';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ok = await registerSession(body);
  return NextResponse.json({ ok }, { status: ok ? 201 : 400 });
}
```

`src/app/api/hie/batch/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ingestBatch } from '@/lib/hie/ingest';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const events = Array.isArray(body) ? body : body.events;
  if (!Array.isArray(events)) return NextResponse.json({ error: 'events array required' }, { status: 400 });
  if (events.length > 100) return NextResponse.json({ error: 'max 100 events per batch' }, { status: 400 });
  const result = await ingestBatch(events);
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Query endpoints (auth required)**

`src/app/api/hie/heatmap/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getClickDensity } from '@/lib/hie/query';

export async function GET(req: NextRequest) {
  await requireAuth();
  const pageUrl = req.nextUrl.searchParams.get('page_url');
  if (!pageUrl) return NextResponse.json({ error: 'page_url required' }, { status: 400 });
  const gridSize = parseInt(req.nextUrl.searchParams.get('grid_size') || '50');
  const cells = await getClickDensity(pageUrl, gridSize);
  return NextResponse.json({ page_url: pageUrl, grid_size: gridSize, cells });
}
```

`src/app/api/hie/scrollmap/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getScrollDepth } from '@/lib/hie/query';

export async function GET(req: NextRequest) {
  await requireAuth();
  const pageUrl = req.nextUrl.searchParams.get('page_url');
  if (!pageUrl) return NextResponse.json({ error: 'page_url required' }, { status: 400 });
  const bands = await getScrollDepth(pageUrl);
  return NextResponse.json({ page_url: pageUrl, bands });
}
```

`src/app/api/hie/diagnostics/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { runDiagnostics } from '@/lib/hie/diagnostics';

export async function GET(req: NextRequest) {
  await requireAuth();
  const pageUrl = req.nextUrl.searchParams.get('page_url');
  if (!pageUrl) return NextResponse.json({ error: 'page_url required' }, { status: 400 });
  const observations = await runDiagnostics(pageUrl);
  return NextResponse.json({ page_url: pageUrl, observations });
}
```

`src/app/api/hie/facts/refresh/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { refreshHeatFacts, refreshScrollFacts } from '@/lib/hie/facts';

export async function POST(req: NextRequest) {
  await requireRole(['admin']);
  const body = await req.json();
  const pageUrl = body.page_url;
  if (!pageUrl) return NextResponse.json({ error: 'page_url required' }, { status: 400 });
  const [heatRows, scrollRows] = await Promise.all([refreshHeatFacts(pageUrl), refreshScrollFacts(pageUrl)]);
  return NextResponse.json({ page_url: pageUrl, heat_facts: heatRows, scroll_facts: scrollRows });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/hie/
git commit -m "feat(hie): add 6 API routes — session, batch, heatmap, scrollmap, diagnostics, facts"
```

---

## Task 5: Client Tracking Script

**Files:**
- Create: `public/nova-tracking-hie.js`

- [ ] **Step 1: Create simplified tracking script**

This is a simplified version of VYRA's 741-line script, focused on the core event types needed for OneForma landing pages. Deployed via GTM.

```javascript
/**
 * Nova HIE — Heat Intelligence Engine (client-side tracker)
 * Adapted from VYRA HIE for OneForma recruitment landing pages.
 * Deploy via GTM Custom HTML tag.
 */
(function() {
  'use strict';

  // Consent gate
  if (window.nova && window.nova.hieConsent === false) return;

  var ENDPOINT = window.nova && window.nova.hieEndpoint || '/api/hie';
  var queue = [];
  var FLUSH_INTERVAL = 5000;
  var MAX_BATCH = 100;
  var sessionId = null;
  var visitorId = null;

  // Cookie helpers
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  }
  function setCookie(name, val, days) {
    var d = new Date(); d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + encodeURIComponent(val) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }
  function hex(len) { for (var s = '', i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }

  // Identity
  visitorId = getCookie('nova_vid');
  if (!visitorId) { visitorId = 'v_' + hex(16); setCookie('nova_vid', visitorId, 365); }
  sessionId = getCookie('nova_hsid');
  if (!sessionId) { sessionId = 'hs_' + hex(32); setCookie('nova_hsid', sessionId, 0); }

  // Page hash (djb2)
  function pageHash() {
    var tags = document.body ? document.body.querySelectorAll('*') : [];
    var s = '';
    for (var i = 0; i < Math.min(tags.length, 200); i++) s += tags[i].tagName;
    var h = 5381;
    for (var j = 0; j < s.length; j++) h = ((h << 5) + h) + s.charCodeAt(j);
    return 'ph_' + (h >>> 0).toString(16);
  }

  // Register session
  var sessionData = {
    session_id: sessionId,
    visitor_id: visitorId,
    landing_page_url: location.href,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio || 1,
    screen_width: screen.width,
    screen_height: screen.height
  };

  fetch(ENDPOINT + '/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData)
  }).catch(function() {});

  // Event helpers
  function pushEvent(evt) {
    evt.session_id = sessionId;
    evt.visitor_id = visitorId;
    evt.page_url = location.href;
    evt.page_hash = pageHash();
    evt.client_timestamp_ms = Date.now();
    evt.viewport_width = window.innerWidth;
    evt.viewport_height = window.innerHeight;
    queue.push(evt);
    if (queue.length >= MAX_BATCH) flush();
  }

  function flush() {
    if (queue.length === 0) return;
    var batch = queue.splice(0, MAX_BATCH);
    var body = JSON.stringify({ events: batch });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT + '/batch', body);
    } else {
      fetch(ENDPOINT + '/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function() {});
    }
  }

  // Click tracking
  document.addEventListener('click', function(e) {
    var t = e.target;
    var isCta = t.tagName === 'BUTTON' || t.tagName === 'A' || t.getAttribute('role') === 'button';
    pushEvent({
      event_type: isCta ? 'cta_click' : 'click_interaction',
      x: e.pageX, y: e.pageY,
      element_selector: t.tagName.toLowerCase() + (t.className ? '.' + t.className.split(' ')[0] : ''),
      element_tag: t.tagName.toLowerCase(),
      element_text: (t.textContent || '').slice(0, 50).trim(),
      event_data: isCta ? { href: t.href || null } : {}
    });
  }, true);

  // Scroll tracking
  var lastScrollPct = -1;
  var scrollTimer = null;
  function onScroll() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function() {
      scrollTimer = null;
      var docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      var vpH = window.innerHeight;
      var scrollY = window.pageYOffset;
      var pct = Math.round((scrollY / Math.max(docH - vpH, 1)) * 100);
      pct = Math.min(Math.max(pct, 0), 100);
      var milestones = [0, 25, 50, 75, 90, 100];
      var milestone = null;
      for (var i = 0; i < milestones.length; i++) {
        if (pct >= milestones[i] && lastScrollPct < milestones[i]) milestone = milestones[i];
      }
      if (Math.abs(pct - lastScrollPct) >= 10 || milestone !== null) {
        pushEvent({
          event_type: 'scroll_depth',
          scroll_y: scrollY,
          scroll_percent: pct,
          document_height: docH,
          direction: pct > lastScrollPct ? 'down' : 'up',
          milestone: milestone
        });
        lastScrollPct = pct;
      }
    }, 500);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // Initial

  // Form tracking
  document.addEventListener('focusin', function(e) {
    var t = e.target;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') {
      pushEvent({
        event_type: 'form_interaction',
        element_selector: t.name || t.id || t.tagName.toLowerCase(),
        element_tag: t.tagName.toLowerCase(),
        event_data: { action: 'focus', field_type: t.type || 'text' }
      });
    }
  }, true);

  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form.tagName === 'FORM') {
      var fields = form.querySelectorAll('input, textarea, select');
      pushEvent({
        event_type: 'form_interaction',
        element_selector: form.id || form.action || 'form',
        element_tag: 'form',
        event_data: { action: 'submit', total_fields: fields.length }
      });
    }
  }, true);

  // Flush on interval + unload
  setInterval(flush, FLUSH_INTERVAL);
  window.addEventListener('beforeunload', flush);
  window.addEventListener('pagehide', flush);

})();
```

- [ ] **Step 2: Commit**

```bash
git add public/nova-tracking-hie.js
git commit -m "feat(hie): add client-side tracking script — clicks, scroll, forms"
```

---

## Task 6: Widget Registry + Types + 3 Widgets

**Files:**
- Modify: `src/components/insights/types.ts`
- Modify: `src/components/insights/widgetRegistry.ts`
- Create: `src/components/insights/widgets/HieHeatmapWidget.tsx`
- Create: `src/components/insights/widgets/HieScrollmapWidget.tsx`
- Create: `src/components/insights/widgets/HieFormFrictionWidget.tsx`

- [ ] **Step 1: Add types**

In `types.ts`, add after `'gsc-queries'`:
```typescript
  // HIE
  | 'hie-heatmap'
  | 'hie-scrollmap'
  | 'hie-form-friction'
```

- [ ] **Step 2: Add to registry**

In `widgetRegistry.ts`, add `MousePointer2, ScrollText, FormInput` to imports (or use available icons). Update comment to "29 widgets". Add before `text-note`:

```typescript
  // ── HIE Behavioral ────────────────────────────────────────
  'hie-heatmap': {
    component: lazy(() => import('./widgets/HieHeatmapWidget')),
    category: 'audienceiq', label: 'HIE Heatmap', icon: MousePointerClick,
    description: 'Click density grid for tracked landing pages',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
  },
  'hie-scrollmap': {
    component: lazy(() => import('./widgets/HieScrollmapWidget')),
    category: 'audienceiq', label: 'HIE Scrollmap', icon: ListChecks,
    description: 'Scroll depth distribution with milestone annotations',
    defaultSize: { w: 6, h: 4 }, minSize: { w: 4, h: 3 },
  },
  'hie-form-friction': {
    component: lazy(() => import('./widgets/HieFormFrictionWidget')),
    category: 'audienceiq', label: 'HIE Diagnostics', icon: AlertTriangle,
    description: 'CRO diagnostics — scroll cliffs, CTA weakness, form friction',
    defaultSize: { w: 12, h: 4 }, minSize: { w: 6, h: 3 },
  },
```

Note: `MousePointerClick`, `ListChecks`, `AlertTriangle` are already imported.

- [ ] **Step 3: Create HieHeatmapWidget**

```typescript
"use client";

import { useEffect, useState } from 'react';
import { MousePointerClick } from 'lucide-react';

interface HeatmapCell { grid_x: number; grid_y: number; click_count: number; unique_sessions: number; }

export default function HieHeatmapWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<{ cells: HeatmapCell[]; page_url: string } | null>(null);
  const pageUrl = config.pageUrl as string;

  useEffect(() => {
    if (!pageUrl) return;
    fetch(`/api/hie/heatmap?page_url=${encodeURIComponent(pageUrl)}`).then(r => r.json()).then(setData).catch(() => {});
  }, [pageUrl]);

  if (!pageUrl) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a page URL in widget settings</div>;
  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.cells.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
      <MousePointerClick className="w-8 h-8 text-[var(--muted-foreground)]" />
      <p className="text-xs font-semibold text-[var(--foreground)]">No Click Data</p>
      <p className="text-[10px] text-[var(--muted-foreground)]">Deploy nova-tracking-hie.js on your landing pages via GTM</p>
    </div>
  );

  const maxClicks = Math.max(...data.cells.map(c => c.click_count), 1);
  const gridSize = 50;

  return (
    <div className="h-full overflow-auto">
      <div className="text-[10px] font-semibold text-[var(--muted-foreground)] mb-2 truncate">{data.page_url}</div>
      <div className="relative" style={{ width: gridSize * 6, height: gridSize * 8 }}>
        {data.cells.map((cell, i) => {
          const opacity = 0.1 + (cell.click_count / maxClicks) * 0.9;
          return (
            <div
              key={i}
              className="absolute rounded-sm"
              style={{
                left: (cell.grid_x / gridSize) * 100 + '%',
                top: (cell.grid_y / gridSize) * 100 + '%',
                width: (1 / gridSize) * 100 + '%',
                height: (1 / gridSize) * 100 + '%',
                background: `rgba(220, 38, 38, ${opacity})`,
              }}
              title={`${cell.click_count} clicks, ${cell.unique_sessions} sessions`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--muted-foreground)]">
        <span>Low</span>
        <div className="flex-1 h-2 rounded-full" style={{ background: 'linear-gradient(to right, rgba(220,38,38,0.1), rgba(220,38,38,1))' }} />
        <span>High</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create HieScrollmapWidget**

```typescript
"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { ScrollText } from 'lucide-react';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface ScrollBand { depth_band: string; sessions_reached: number; pct_of_total: number; }

export default function HieScrollmapWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<{ bands: ScrollBand[] } | null>(null);
  const pageUrl = config.pageUrl as string;

  useEffect(() => {
    if (!pageUrl) return;
    fetch(`/api/hie/scrollmap?page_url=${encodeURIComponent(pageUrl)}`).then(r => r.json()).then(setData).catch(() => {});
  }, [pageUrl]);

  if (!pageUrl) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a page URL in widget settings</div>;
  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.bands.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
      <ScrollText className="w-8 h-8 text-[var(--muted-foreground)]" />
      <p className="text-xs font-semibold text-[var(--foreground)]">No Scroll Data</p>
      <p className="text-[10px] text-[var(--muted-foreground)]">Deploy nova-tracking-hie.js to start collecting scroll data</p>
    </div>
  );

  const getBarColor = (pct: number) => {
    if (pct >= 80) return '#16a34a';
    if (pct >= 50) return '#ca8a04';
    if (pct >= 25) return '#ea580c';
    return '#dc2626';
  };

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.bands} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis type="number" domain={[0, 100]} {...AXIS_STYLE} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="depth_band" {...AXIS_STYLE} width={38} tick={{ fontSize: 9 }} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`, 'Reached']} />
          <Bar dataKey="pct_of_total" radius={[0, 4, 4, 0]} fill="#0693e3" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Create HieFormFrictionWidget (diagnostics viewer)**

```typescript
"use client";

import { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

interface DiagnosticObservation {
  type: string;
  confidence: string;
  message: string;
  recommended_action: string;
}

const TYPE_LABELS: Record<string, string> = {
  scroll_cliff: 'Scroll Cliff',
  cta_weakness: 'CTA Weakness',
  form_friction: 'Form Friction',
  platform_mismatch: 'Platform Mismatch',
  ignored_section: 'Ignored Section',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-600 border-blue-200',
};

export default function HieFormFrictionWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<{ observations: DiagnosticObservation[] } | null>(null);
  const pageUrl = config.pageUrl as string;

  useEffect(() => {
    if (!pageUrl) return;
    fetch(`/api/hie/diagnostics?page_url=${encodeURIComponent(pageUrl)}`).then(r => r.json()).then(setData).catch(() => {});
  }, [pageUrl]);

  if (!pageUrl) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a page URL in widget settings</div>;
  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (data.observations.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <CheckCircle className="w-8 h-8 text-green-500" />
        <p className="text-xs font-semibold text-[var(--foreground)]">No Issues Detected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">All CRO diagnostics passed for this page</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto space-y-2">
      {data.observations.map((obs, i) => {
        const styles = CONFIDENCE_STYLES[obs.confidence] ?? CONFIDENCE_STYLES.low;
        const Icon = obs.confidence === 'high' ? AlertTriangle : AlertCircle;
        return (
          <div key={i} className={`flex gap-2.5 p-3 rounded-xl border ${styles}`}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase">{TYPE_LABELS[obs.type] ?? obs.type}</span>
                <span className="text-[9px] opacity-60">{obs.confidence} confidence</span>
              </div>
              <div className="text-[11px] font-medium">{obs.message}</div>
              <div className="text-[10px] opacity-75 mt-1">{obs.recommended_action}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Commit all**

```bash
git add src/components/insights/types.ts src/components/insights/widgetRegistry.ts src/components/insights/widgets/HieHeatmapWidget.tsx src/components/insights/widgets/HieScrollmapWidget.tsx src/components/insights/widgets/HieFormFrictionWidget.tsx
git commit -m "feat(hie): add 3 HIE widgets — heatmap, scrollmap, diagnostics"
```

---

## Task 7: TypeScript Verification

- [ ] **Step 1: Type check**
```bash
pnpm tsc --noEmit
```

- [ ] **Step 2: Verify 29 total widgets**

- [ ] **Step 3: Commit fixes**
```bash
git add -A
git commit -m "fix(hie): resolve Phase 4 TypeScript issues"
```
