# Frontend Portal System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 4 role-hardened portal views (marketing command center, recruiter, designer, admin) with strict permission boundaries, Seedream interactive editor, and campaign strategy visualization.

**Architecture:** Permission layer (`src/lib/permissions.ts`) gates all routes and API endpoints. Marketing command center is a new dashboard surface that navigates to the existing intake detail view for editing. Recruiter sees a restricted version of the same detail view. Designer gets an authenticated portal with Seedream editing. All existing components are reused — no rebuilds.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind CSS 4, Clerk auth, Lucide icons (no emojis), OneForma light theme

---

## Workstream 1: Permission Hardening

### Task 1: Centralized Permission Helpers

**Files:**
- Create: `src/lib/permissions.ts`

- [ ] **Step 1: Create permission helper module**

```typescript
import { auth } from '@clerk/nextjs/server';
import { getUserRole } from '@/lib/db/user-roles';
import type { UserRole } from '@/lib/types';

export interface AuthContext {
  userId: string;
  role: UserRole;
  email?: string;
}

/**
 * Get the current user's auth context with role.
 * Returns null if not authenticated.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  let email: string | undefined;
  try {
    const { currentUser } = await import('@clerk/nextjs/server');
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress;
  } catch {
    // currentUser may fail in some contexts
  }

  const userRole = await getUserRole(userId, email);
  const role = (userRole?.role as UserRole) ?? 'viewer';

  return { userId, role, email };
}

/**
 * Check if the user can access a specific intake request.
 * Admin/marketer: can access all requests.
 * Recruiter: can only access requests they created.
 * Viewer: read-only access to all (no edit actions).
 */
export function canAccessRequest(
  authCtx: AuthContext,
  requestCreatedBy: string | null
): boolean {
  if (authCtx.role === 'admin') return true;
  if (authCtx.role === 'recruiter') {
    return requestCreatedBy === authCtx.userId;
  }
  if (authCtx.role === 'viewer') return true; // read-only
  return false;
}

/**
 * Check if the user can edit/approve a request.
 * Only admin can approve. Recruiter can edit their own draft requests.
 */
export function canEditRequest(
  authCtx: AuthContext,
  requestCreatedBy: string | null,
  requestStatus: string
): boolean {
  if (authCtx.role === 'admin') return true;
  if (authCtx.role === 'recruiter') {
    return requestCreatedBy === authCtx.userId && requestStatus === 'draft';
  }
  return false;
}

/**
 * Get the sidebar navigation items for a given role.
 */
export function getNavForRole(role: UserRole): {
  sections: { title: string; links: { href: string; label: string; icon: string }[] }[];
} {
  const base = [
    { href: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  ];

  switch (role) {
    case 'admin':
      return {
        sections: [
          {
            title: 'Pipeline',
            links: [
              ...base,
              { href: '/intake/new', label: 'New Request', icon: 'PlusCircle' },
            ],
          },
          {
            title: 'Admin',
            links: [
              { href: '/admin', label: 'Dashboard', icon: 'Settings' },
              { href: '/admin/users', label: 'Users', icon: 'Users' },
              { href: '/admin/schemas', label: 'Schemas', icon: 'FileCode' },
              { href: '/admin/pipeline', label: 'Workers', icon: 'Activity' },
            ],
          },
        ],
      };

    case 'recruiter':
      return {
        sections: [
          {
            title: 'Pipeline',
            links: [
              ...base,
              { href: '/intake/new', label: 'New Request', icon: 'PlusCircle' },
            ],
          },
        ],
      };

    case 'designer':
      return {
        sections: [
          {
            title: 'Design',
            links: [
              { href: '/designer', label: 'My Campaigns', icon: 'Palette' },
              { href: '/designer/editor', label: 'Seedream Editor', icon: 'Wand2' },
            ],
          },
        ],
      };

    case 'viewer':
    default:
      return {
        sections: [
          {
            title: 'Pipeline',
            links: base,
          },
        ],
      };
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/stevenjunop/centric-intake && npx tsc --noEmit src/lib/permissions.ts 2>&1 | head -5`

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: centralized permission helpers — role nav, ownership checks"
```

---

### Task 2: Role-Filtered Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add role-aware API endpoint for client-side role fetching**

Create `src/app/api/auth/me/route.ts`:

```typescript
import { getAuthContext } from '@/lib/permissions';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return Response.json({ userId: ctx.userId, role: ctx.role });
}
```

- [ ] **Step 2: Update Sidebar.tsx to fetch role and filter navigation**

Replace the hardcoded `pipelineLinks`, `adminLinks` arrays and the render logic in `src/components/Sidebar.tsx`. The sidebar should:

1. Call `/api/auth/me` on mount to get the user's role
2. Use a `ROLE_NAV` mapping to determine which sections/links to show
3. Only render sections that have links for the current role

Key changes:
- Remove the hardcoded `adminLinks` array that's shown to everyone
- Add a `useEffect` that fetches `/api/auth/me` to get the role
- Use the role to filter which nav sections render
- While role is loading, show only the Pipeline section (safe default)

The ROLE_NAV mapping (defined in the component):

```typescript
const ROLE_NAV: Record<string, { title: string; links: NavItem[] }[]> = {
  admin: [
    { title: 'Pipeline', links: [
      { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
      { href: '/intake/new', label: 'New Request', Icon: PlusCircle },
    ]},
    { title: 'Admin', links: [
      { href: '/admin', label: 'Dashboard', Icon: Settings },
      { href: '/admin/users', label: 'Users', Icon: Users },
      { href: '/admin/schemas', label: 'Schemas', Icon: FileCode },
      { href: '/admin/pipeline', label: 'Workers', Icon: Activity },
    ]},
  ],
  recruiter: [
    { title: 'Pipeline', links: [
      { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
      { href: '/intake/new', label: 'New Request', Icon: PlusCircle },
    ]},
  ],
  designer: [
    { title: 'Design', links: [
      { href: '/designer', label: 'My Campaigns', Icon: Palette },
      { href: '/designer/editor', label: 'Seedream Editor', Icon: Wand2 },
    ]},
  ],
  viewer: [
    { title: 'Pipeline', links: [
      { href: '/', label: 'Dashboard', Icon: LayoutDashboard },
    ]},
  ],
};
```

Add `Palette` and `Wand2` to the lucide-react imports.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx src/app/api/auth/me/route.ts
git commit -m "feat: role-filtered sidebar — admin links hidden from non-admins"
```

---

### Task 3: API Ownership Checks

**Files:**
- Modify: `src/app/api/intake/route.ts`
- Modify: `src/app/api/intake/[id]/route.ts`

- [ ] **Step 1: Add ownership filtering to intake list API**

In `src/app/api/intake/route.ts`, update the GET handler:

```typescript
import { getAuthContext } from '@/lib/permissions';

export async function GET(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as Status | null;
    const taskType = url.searchParams.get('task_type');

    const requests = await listIntakeRequests({
      status: status ?? undefined,
      task_type: taskType ?? undefined,
      // Recruiters only see their own requests
      created_by: ctx.role === 'recruiter' ? ctx.userId : undefined,
    });

    return Response.json(requests);
  } catch (error) {
    console.error('[api/intake] Failed to list intake requests:', error);
    return Response.json({ error: 'Failed to list intake requests' }, { status: 500 });
  }
}
```

This requires updating `listIntakeRequests` in `src/lib/db/intake.ts` to accept an optional `created_by` filter. Read that file, find the `listIntakeRequests` function, and add a `WHERE created_by = $N` clause when the parameter is provided.

- [ ] **Step 2: Add ownership check to intake detail API**

In `src/app/api/intake/[id]/route.ts`, update the GET handler to check ownership:

```typescript
import { getAuthContext, canAccessRequest } from '@/lib/permissions';

// After fetching the request:
const ctx = await getAuthContext();
if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });

if (!canAccessRequest(ctx, request.created_by)) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/intake/route.ts src/app/api/intake/[id]/route.ts src/lib/db/intake.ts
git commit -m "feat: API ownership checks — recruiters see own requests only"
```

---

### Task 4: Database — Notifications Table

**Files:**
- Modify: `src/lib/db/schema.ts`
- Run: migration

- [ ] **Step 1: Add notifications table + assigned_designer column**

Add to `src/lib/db/schema.ts` after the campaign_strategies table:

```typescript
  // 16. notifications — real-time event feed
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL,
      request_id  UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK (type IN ('stage_complete', 'designer_update', 'eval_complete', 'status_change', 'asset_approved')),
      title       TEXT NOT NULL,
      body        TEXT,
      read        BOOLEAN DEFAULT false,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)`;
```

Run migration:
```bash
cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "
import asyncio, asyncpg
from config import DATABASE_URL
async def migrate():
    conn = await asyncpg.connect(DATABASE_URL)
    await conn.execute('''CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('stage_complete','designer_update','eval_complete','status_change','asset_approved')),
        title TEXT NOT NULL,
        body TEXT,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )''')
    await conn.execute('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)')
    await conn.execute('ALTER TABLE intake_requests ADD COLUMN IF NOT EXISTS assigned_designer TEXT')
    print('Notifications table + assigned_designer column created')
    await conn.close()
asyncio.run(migrate())
"
```

- [ ] **Step 2: Create notification API routes**

Create `src/app/api/notifications/route.ts`:

```typescript
import { getAuthContext } from '@/lib/permissions';
import { neon } from '@/lib/db/neon';

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const sql = neon();
  const notifications = await sql`
    SELECT id, request_id, type, title, body, read, created_at
    FROM notifications
    WHERE user_id = ${ctx.userId}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const unreadCount = notifications.filter((n: any) => !n.read).length;
  return Response.json({ notifications, unreadCount });
}

export async function PATCH(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { ids } = await request.json();
  const sql = neon();

  if (ids && ids.length > 0) {
    await sql`UPDATE notifications SET read = true WHERE id = ANY(${ids}) AND user_id = ${ctx.userId}`;
  } else {
    await sql`UPDATE notifications SET read = true WHERE user_id = ${ctx.userId}`;
  }

  return Response.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts src/app/api/notifications/route.ts
git commit -m "feat: notifications table + API for real-time event feed"
```

---

## Workstream 2: Marketing Command Center

### Task 5: Campaign List Component

**Files:**
- Create: `src/components/CampaignList.tsx`

- [ ] **Step 1: Create the campaign list with search, filters, and status badges**

```typescript
"use client";

import { useState, useMemo } from "react";
import { Search, Filter, Globe, Image, BarChart3 } from "lucide-react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import type { IntakeRequest, Status } from "@/lib/types";

interface CampaignListProps {
  requests: IntakeRequest[];
  loading: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const statusFilters: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "generating", label: "Generating" },
  { value: "review", label: "Review" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
];

export default function CampaignList({
  requests,
  loading,
  selectedId,
  onSelect,
}: CampaignListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    let result = requests;
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.task_type?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [requests, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: requests.length };
    for (const r of requests) {
      counts[r.status] = (counts[r.status] || 0) + 1;
    }
    return counts;
  }, [requests]);

  return (
    <div className="flex flex-col h-full border-r border-[#E5E5E5]">
      {/* Search */}
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2 bg-[#F5F5F5] rounded-lg px-3 py-2">
          <Search size={14} className="text-[#737373]" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-[#1A1A1A] placeholder-[#737373] outline-none flex-1"
          />
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex gap-1 px-4 pb-3 flex-wrap">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-2.5 py-1 rounded-md text-xs cursor-pointer transition-colors ${
              statusFilter === f.value
                ? "bg-[#32373C] text-white"
                : "bg-[#F5F5F5] text-[#737373] hover:bg-[#E5E5E5]"
            }`}
          >
            {f.label}
            {statusCounts[f.value] ? (
              <span className="ml-1 opacity-60">{statusCounts[f.value]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Campaign Cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-3 space-y-2">
                <div className="skeleton h-4 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            ))
          : filtered.map((req) => (
              <button
                key={req.id}
                onClick={() => onSelect?.(req.id)}
                className={`w-full text-left card p-3 cursor-pointer transition-all ${
                  selectedId === req.id
                    ? "ring-2 ring-[#32373C] bg-[#F5F5F5]"
                    : "hover:bg-[#FAFAFA]"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-semibold text-[#1A1A1A] line-clamp-1">
                    {req.title}
                  </span>
                  <StatusBadge status={req.status as Status} />
                </div>
                <div className="text-xs text-[#737373]">
                  {req.target_languages?.slice(0, 2).join(", ")}
                  {(req.target_languages?.length ?? 0) > 2 &&
                    ` +${(req.target_languages?.length ?? 0) - 2}`}
                </div>
                {req.status === "generating" && (
                  <div className="mt-2 h-1 bg-[#E5E5E5] rounded-full">
                    <div
                      className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                      style={{ width: "60%" }}
                    />
                  </div>
                )}
              </button>
            ))}
      </div>

      {/* Stats Bar */}
      <div className="border-t border-[#E5E5E5] px-4 py-3 flex gap-6">
        <div className="text-center">
          <div className="text-lg font-bold text-[#1A1A1A]">{requests.length}</div>
          <div className="text-[10px] text-[#737373]">Campaigns</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-[#1A1A1A]">
            <Globe size={12} className="inline mr-1" />
            {new Set(requests.flatMap((r) => r.target_regions || [])).size}
          </div>
          <div className="text-[10px] text-[#737373]">Countries</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CampaignList.tsx
git commit -m "feat: CampaignList component with search, filters, status badges"
```

---

### Task 6: Marketing Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update dashboard to show command center for admin, filtered list for recruiter**

The existing `src/app/page.tsx` is a client component that fetches all requests. Update it to:

1. Fetch the user's role from `/api/auth/me`
2. If `admin`: render the two-panel command center layout (CampaignList on left, selected campaign preview on right)
3. If `recruiter`: render the existing filtered card list (already built) — the API will auto-filter to their own requests
4. If `viewer`: render the existing list (read-only, no "New Request" button)

The key addition is the two-panel layout for admin:

```tsx
{role === 'admin' ? (
  <div className="flex h-[calc(100vh-64px)]">
    <div className="w-[340px] flex-shrink-0">
      <CampaignList
        requests={requests}
        loading={loading}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </div>
    <div className="flex-1 overflow-y-auto">
      {selectedId ? (
        <CampaignPreviewPanel requestId={selectedId} />
      ) : (
        <div className="flex items-center justify-center h-full text-[#737373]">
          Select a campaign to preview
        </div>
      )}
    </div>
  </div>
) : (
  // Existing card grid for recruiter/viewer
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {filtered.map((req) => (
      <Link key={req.id} href={`/intake/${req.id}`}>
        <IntakeCard request={req} />
      </Link>
    ))}
  </div>
)}
```

Import `CampaignList` and create a simple `CampaignPreviewPanel` that shows basic stats + links to the full detail view. For now, the preview panel can be a simple component that shows the request title, status, and a "View Full Details" link to `/intake/[id]`.

- [ ] **Step 2: Create CampaignPreviewPanel component**

Create `src/components/CampaignPreviewPanel.tsx` — a lightweight preview that shows:
- Campaign header (title, status, dates)
- Quick stats (creative count, video count, personas)
- "View Full Details →" link to `/intake/[id]`
- Notification banner if designer made updates

This component fetches data from `/api/intake/[id]` and `/api/intake/[id]/progress` and renders a condensed version. It reuses `StatusBadge`, `PipelineProgress`, and `FilterTabs` from existing components.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/components/CampaignPreviewPanel.tsx
git commit -m "feat: marketing command center dashboard with campaign list + preview"
```

---

### Task 7: Notification Feed Component

**Files:**
- Create: `src/components/NotificationFeed.tsx`

- [ ] **Step 1: Create notification bell dropdown**

A component that:
1. Polls `/api/notifications` every 30 seconds
2. Shows a bell icon with unread count badge in the header
3. Click → dropdown showing recent notifications
4. Click notification → navigates to the relevant campaign
5. "Mark all read" button
6. Uses Lucide `Bell` icon, NOT emoji

```typescript
"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  request_id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export default function NotificationFeed() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    }
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-[#F5F5F5] cursor-pointer"
      >
        <Bell size={18} className="text-[#737373]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-[#E5E5E5] z-50 max-h-96 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-[#E5E5E5]">
            <span className="text-sm font-semibold text-[#1A1A1A]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[#737373] hover:text-[#1A1A1A] cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-72">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#737373]">
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <Link
                  key={n.id}
                  href={`/intake/${n.request_id}`}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 border-b border-[#F5F5F5] hover:bg-[#FAFAFA] ${
                    !n.read ? "bg-[#F5F5FF]" : ""
                  }`}
                >
                  <div className="text-sm text-[#1A1A1A]">{n.title}</div>
                  {n.body && (
                    <div className="text-xs text-[#737373] mt-0.5">
                      {n.body}
                    </div>
                  )}
                  <div className="text-[10px] text-[#737373] mt-1">
                    {new Date(n.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add NotificationFeed to the Header/AppShell**

In `src/components/AppShell.tsx` or `src/components/Header.tsx`, add `<NotificationFeed />` next to the Clerk `<UserButton />`.

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationFeed.tsx src/components/AppShell.tsx
git commit -m "feat: notification feed with bell icon, polling, mark-all-read"
```

---

### Task 8: Campaign Strategy View Tab

**Files:**
- Create: `src/components/CampaignStrategyView.tsx`

- [ ] **Step 1: Create the strategy visualization component**

This component displays the campaign strategy data from `campaign_strategies` table:
- Tier info (Tier 1, interest-only cold traffic)
- Split test plan (variable, description, measurement)
- Ad sets grid (name, persona, targeting type, interests, budget, kill threshold)
- Budget cascade visualization (country allocation, persona weights)
- Progression rules (trigger, what Tier 2 adds)

Fetch data from a new API endpoint: `GET /api/generate/[id]/strategy`

Create `src/app/api/generate/[id]/strategy/route.ts`:

```typescript
import { getAuthContext } from '@/lib/permissions';
import { neon } from '@/lib/db/neon';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const sql = neon();
  const strategies = await sql`
    SELECT * FROM campaign_strategies
    WHERE request_id = ${params.id}
    ORDER BY created_at DESC
  `;

  return Response.json(strategies);
}
```

The `CampaignStrategyView` component renders the strategy_data JSONB with:
- Cards for each ad set (persona badge, targeting type, interests list, budget, kill threshold)
- Split test comparison (Campaign A vs B)
- Budget cascade bar chart (country → persona → ad set)
- Progression rules timeline

Uses only Lucide icons (Target, DollarSign, TrendingUp, Layers, FlaskConical, ArrowRight).

- [ ] **Step 2: Add Strategy tab to intake detail view**

In `src/app/intake/[id]/page.tsx`, add a "Strategy" tab that renders `<CampaignStrategyView requestId={id} />`. Insert it after the existing "Brief" section. Only show this tab when `role === 'admin'` (recruiters see a simplified version).

- [ ] **Step 3: Commit**

```bash
git add src/components/CampaignStrategyView.tsx src/app/api/generate/[id]/strategy/route.ts src/app/intake/[id]/page.tsx
git commit -m "feat: campaign strategy view tab with ad sets, budget cascade, targeting"
```

---

## Workstream 3: Recruiter Portal

### Task 9: Recruiter Restricted Detail View

**Files:**
- Create: `src/components/RecruiterDetailView.tsx`
- Modify: `src/app/intake/[id]/page.tsx`

- [ ] **Step 1: Create the restricted recruiter view**

```typescript
"use client";

import { Download, Clock, CheckCircle2, Loader2 } from "lucide-react";
import PipelineProgress from "@/components/PipelineProgress";
import StatusBadge from "@/components/StatusBadge";
import CreativeGrid from "@/components/CreativeGrid";
import type { IntakeRequest } from "@/lib/types";

interface RecruiterDetailViewProps {
  request: IntakeRequest;
  assets: any[];
  computeStatus: any;
}

export default function RecruiterDetailView({
  request,
  assets,
  computeStatus,
}: RecruiterDetailViewProps) {
  const isApproved = request.status === "approved" || request.status === "sent";
  const isGenerating = request.status === "generating";
  const approvedAssets = assets.filter(
    (a: any) => a.evaluation_passed === true
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A]">{request.title}</h1>
          <p className="text-sm text-[#737373] mt-1">
            {request.task_type} | {request.target_regions?.join(", ")}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Pipeline Progress (simplified — icons only, no stage details) */}
      <div className="card p-6">
        <PipelineProgress stages={computeStatus?.stages || []} />
      </div>

      {/* Status Messages */}
      {isGenerating && (
        <div className="card p-6 flex items-center gap-3">
          <Loader2 size={20} className="text-blue-500 animate-spin" />
          <div>
            <div className="text-sm font-medium text-[#1A1A1A]">
              Generating your campaign assets...
            </div>
            <div className="text-xs text-[#737373]">
              This usually takes 30-45 minutes. You'll be notified when it's ready.
            </div>
          </div>
        </div>
      )}

      {request.status === "review" && (
        <div className="card p-6 flex items-center gap-3">
          <Clock size={20} className="text-yellow-500" />
          <div>
            <div className="text-sm font-medium text-[#1A1A1A]">
              Under review by the marketing team
            </div>
            <div className="text-xs text-[#737373]">
              Your assets are being reviewed and refined. You'll be notified when they're approved.
            </div>
          </div>
        </div>
      )}

      {/* Approved Assets (only shown when approved/sent) */}
      {isApproved && approvedAssets.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">
              Your Approved Assets
            </h2>
            <button className="btn-primary flex items-center gap-2 text-sm">
              <Download size={14} />
              Download Package
            </button>
          </div>
          <CreativeGrid assets={approvedAssets} />
        </div>
      )}

      {/* Request Details */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">
          Request Details
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[#737373]">Languages:</span>
            <span className="ml-2 text-[#1A1A1A]">
              {request.target_languages?.join(", ")}
            </span>
          </div>
          <div>
            <span className="text-[#737373]">Volume:</span>
            <span className="ml-2 text-[#1A1A1A]">
              {request.form_data?.target_volume || "—"}
            </span>
          </div>
          <div>
            <span className="text-[#737373]">Created:</span>
            <span className="ml-2 text-[#1A1A1A]">
              {new Date(request.created_at).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-[#737373]">Status:</span>
            <span className="ml-2">
              <StatusBadge status={request.status} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add role-based rendering to intake detail page**

In `src/app/intake/[id]/page.tsx`, fetch the role from `/api/auth/me` and conditionally render:

```tsx
if (role === 'recruiter') {
  return (
    <AppShell>
      <RecruiterDetailView
        request={request}
        assets={assets}
        computeStatus={computeStatus}
      />
    </AppShell>
  );
}

// ... existing full detail view for admin
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RecruiterDetailView.tsx src/app/intake/[id]/page.tsx
git commit -m "feat: recruiter restricted view — approved assets only, no drafts"
```

---

## Workstream 4: Designer Portal Upgrade

### Task 10: Authenticated Designer Portal

**Files:**
- Create: `src/app/designer/page.tsx` (authenticated campaign list)
- Create: `src/components/designer/DesignerCampaignList.tsx`

- [ ] **Step 1: Create authenticated designer dashboard**

`src/app/designer/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import DesignerCampaignList from "@/components/designer/DesignerCampaignList";

export default async function DesignerPortal() {
  let auth;
  try {
    auth = await requireRole(["designer", "admin"]);
  } catch {
    redirect("/sign-in");
  }

  return (
    <AppShell>
      <DesignerCampaignList userId={auth.userId} />
    </AppShell>
  );
}
```

`src/components/designer/DesignerCampaignList.tsx` — A client component that:
1. Fetches `/api/intake` (which returns requests assigned to this designer via `assigned_designer` column, or all if admin)
2. Shows a grid of campaign cards with status, asset counts, notification badges
3. Click → navigates to `/designer/[id]` (existing magic-link-style view, but authenticated)

- [ ] **Step 2: Update middleware to allow authenticated designer routes**

In `src/middleware.ts`, the `/designer(.*)` route is currently public. Keep it public for magic link access (`/designer/[id]?token=XXX`) but let authenticated users access `/designer` (no id, no token) through Clerk auth.

No change needed — Clerk middleware only blocks non-public routes. Since `/designer(.*)` is public, both authenticated and magic-link users can access it. The page-level `requireRole` handles the authentication.

- [ ] **Step 3: Commit**

```bash
git add src/app/designer/page.tsx src/components/designer/DesignerCampaignList.tsx
git commit -m "feat: authenticated designer portal with campaign list"
```

---

### Task 11: Seedream Interactive Editor

**Files:**
- Create: `src/app/designer/editor/page.tsx`
- Create: `src/components/designer/SeedreamEditor.tsx`
- Create: `src/components/designer/AssetBrowser.tsx`
- Create: `src/components/designer/EditChat.tsx`
- Create: `src/app/api/designer/edit/route.ts`
- Create: `src/app/api/designer/replace/route.ts`

- [ ] **Step 1: Create the Seedream edit API**

`src/app/api/designer/edit/route.ts`:

```typescript
import { getAuthContext } from '@/lib/permissions';

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { asset_id, edit_prompt, image_url } = await request.json();

  if (!edit_prompt || !image_url) {
    return Response.json({ error: 'Missing edit_prompt or image_url' }, { status: 400 });
  }

  // Call Seedream 4.5 via OpenRouter for image editing
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'bytedance-seed/seedream-4.5',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: edit_prompt },
            { type: 'image_url', image_url: { url: image_url } },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: 'Seedream API failed', details: err }, { status: 502 });
  }

  const data = await res.json();
  // Extract the generated image URL from the response
  const editedImageUrl = data.choices?.[0]?.message?.content;

  return Response.json({
    asset_id,
    edited_image_url: editedImageUrl,
    edit_prompt,
  });
}
```

- [ ] **Step 2: Create the asset replacement API**

`src/app/api/designer/replace/route.ts`:

```typescript
import { getAuthContext } from '@/lib/permissions';
import { neon } from '@/lib/db/neon';

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { asset_id, new_blob_url, edit_description } = await request.json();

  const sql = neon();

  // Update the asset's blob_url
  await sql`
    UPDATE generated_assets
    SET blob_url = ${new_blob_url},
        content = jsonb_set(
          COALESCE(content, '{}'::jsonb),
          '{edit_history}',
          COALESCE(content->'edit_history', '[]'::jsonb) || ${JSON.stringify([{
            edited_by: ctx.userId,
            description: edit_description,
            timestamp: new Date().toISOString(),
            previous_url: null, // Will be filled from the SELECT
          }])}::jsonb
        )
    WHERE id = ${asset_id}
  `;

  // Get the request_id for the notification
  const asset = await sql`SELECT request_id FROM generated_assets WHERE id = ${asset_id}`;
  const requestId = asset?.[0]?.request_id;

  // Create notification for marketing
  if (requestId) {
    await sql`
      INSERT INTO notifications (user_id, request_id, type, title, body)
      SELECT created_by, ${requestId}, 'designer_update',
        'Designer refined an asset',
        ${edit_description || 'An image was updated by the designer'}
      FROM intake_requests
      WHERE id = ${requestId}
    `;
  }

  return Response.json({ success: true, asset_id });
}
```

- [ ] **Step 3: Create the editor page and components**

`src/app/designer/editor/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import SeedreamEditor from "@/components/designer/SeedreamEditor";

export default async function EditorPage() {
  let auth;
  try {
    auth = await requireRole(["designer", "admin"]);
  } catch {
    redirect("/sign-in");
  }

  return (
    <AppShell>
      <SeedreamEditor />
    </AppShell>
  );
}
```

`src/components/designer/SeedreamEditor.tsx` — the two-column layout:
- Left: `<AssetBrowser />` — searchable, filterable grid of draggable assets
- Right: Editor with original/edited comparison, chat-style edit interface, submit bar

`src/components/designer/AssetBrowser.tsx` — fetches all assets across campaigns, renders as a grid with search, filter (All/Characters/Creatives/Raw), campaign dropdown filter. Each asset is draggable (uses HTML5 drag API with `draggable="true"` and `onDragStart`).

`src/components/designer/EditChat.tsx` — chat-style edit interface:
- Previous edits shown as conversation bubbles
- Text input for edit prompt
- Quick action chips (Lucide icons only: Eraser for clean, Sparkles for fix, Sun for lighting, Shirt for outfit, MapPin for setting, Ban for artifacts)
- Generate button calls `/api/designer/edit`
- Loading state uses the existing image loading animation

- [ ] **Step 4: Commit**

```bash
git add src/app/designer/editor/page.tsx src/components/designer/SeedreamEditor.tsx src/components/designer/AssetBrowser.tsx src/components/designer/EditChat.tsx src/app/api/designer/edit/route.ts src/app/api/designer/replace/route.ts
git commit -m "feat: Seedream interactive editor with drag-drop, chat-style editing, auto-replace"
```

---

### Task 12: Platform Preview with Ad Copy

**Files:**
- Create: `src/components/designer/PlatformPreviewWithCopy.tsx`

- [ ] **Step 1: Create platform preview component that shows mockup + ad copy below**

This wraps the existing platform mockup components (`FacebookFeedFrame`, `InstagramFeedFrame`, etc.) and adds the ad copy text below each mockup:

```typescript
"use client";

import { useState } from "react";
import PlacementPreviewFrame from "@/components/platform-mockups/PlacementPreviewFrame";
import type { GeneratedAsset } from "@/lib/types";

interface PlatformPreviewWithCopyProps {
  assets: GeneratedAsset[];
}

export default function PlatformPreviewWithCopy({
  assets,
}: PlatformPreviewWithCopyProps) {
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  const platforms = [
    "all",
    ...new Set(assets.map((a) => a.platform).filter(Boolean)),
  ];

  const filtered =
    selectedPlatform === "all"
      ? assets
      : assets.filter((a) => a.platform === selectedPlatform);

  return (
    <div className="space-y-4">
      {/* Platform filter */}
      <div className="flex gap-1 flex-wrap">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPlatform(p)}
            className={`px-3 py-1 rounded-md text-xs cursor-pointer ${
              selectedPlatform === p
                ? "bg-[#32373C] text-white"
                : "bg-[#F5F5F5] text-[#737373]"
            }`}
          >
            {p === "all" ? "All" : p.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Preview grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((asset) => (
          <div key={asset.id} className="card overflow-hidden">
            {/* Platform mockup */}
            <div className="bg-[#1A1A1A] p-4 rounded-t-xl">
              <PlacementPreviewFrame creative={{
                ...asset,
                platform: asset.platform,
                placement: asset.platform,
              }} />
            </div>

            {/* Ad copy below */}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="badge badge-generating text-[10px]">
                  {asset.platform?.replace("_", " ")}
                </span>
                <span className="text-[10px] text-[#737373]">
                  {asset.format}
                </span>
              </div>
              {asset.copy_data?.headline && (
                <div>
                  <span className="text-[10px] text-[#737373] uppercase">
                    Headline
                  </span>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    {asset.copy_data.headline}
                  </p>
                </div>
              )}
              {asset.copy_data?.primary_text && (
                <div>
                  <span className="text-[10px] text-[#737373] uppercase">
                    Primary Text
                  </span>
                  <p className="text-xs text-[#737373] line-clamp-3">
                    {asset.copy_data.primary_text}
                  </p>
                </div>
              )}
              {asset.content?.overlay_cta && (
                <div>
                  <span className="text-[10px] text-[#737373] uppercase">
                    CTA
                  </span>
                  <p className="text-sm font-medium text-[#1A1A1A]">
                    {asset.content.overlay_cta}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to designer workspace as a tab**

In the designer portal view (`src/app/designer/[id]/page.tsx`), add a "Platform Preview" tab that renders `<PlatformPreviewWithCopy assets={composedAssets} />`.

- [ ] **Step 3: Commit**

```bash
git add src/components/designer/PlatformPreviewWithCopy.tsx src/app/designer/[id]/page.tsx
git commit -m "feat: platform preview with ad copy — mockups + headlines + CTA per platform"
```
