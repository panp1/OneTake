# Landing Pages Dashboard Card — Design Spec

**Date:** 2026-04-07
**Status:** Approved
**Owner:** Steven Junop
**Affected area:** Marketing manager dashboard (`CampaignPreviewPanel`) + designer dashboard (`DesignerPreviewPanel`) — both show the same new card so a URL entered by one role appears for the other.

## Context

Every OneForma recruitment campaign ships with three external URLs the ad agency needs before launching:

1. **Job Posting** — the canonical OneForma job listing
2. **Landing Page** — a custom campaign landing page
3. **ADA Form** — the accessibility qualification / screener form

Today these URLs are tracked in Slack threads or spreadsheets. Marketing manager and designer end up entering them twice in separate places. This spec adds a single input card on the dashboard view that both roles can edit and both see in sync.

## Goals

1. Three input fields for Job Posting / Landing Page / ADA Form URLs, visible on the dashboard view both roles land on.
2. One shared source of truth per campaign — marketing or designer edits, the other role sees the update.
3. URLs persist in a **relational Neon table** with a foreign key to the campaign. Not JSON blob, not client-only state.
4. Auto-save on blur — no save button, no modal, no click-to-edit gate.
5. Works during pipeline run and after — the card is always visible, regardless of campaign status.
6. Visually polished to match the rest of the Nova dashboard. Same card aesthetic, same typography, same density.

## Non-Goals

- Per-country URLs. **Every campaign uses the same 3 URLs across all its target countries.**
- URL validation beyond auto-prepending `https://`. If the user pastes garbage, it saves as garbage.
- Historical edit log / audit trail. Only latest value stored.
- Link preview / OG scrape. Plain text URLs only in v1.
- Sharing these URLs outside the dashboard (e.g., including them in the export ZIP). Separate future work.

## User Stories

- **As the marketing manager**, I want to paste the Job Posting URL into the dashboard as soon as it's available, so the designer sees it without me messaging them.
- **As the designer**, I want to paste the Landing Page URL into the dashboard from my side, so the marketing manager can QA it against the brief.
- **As either role**, I want to click the URL to open it or copy it to my clipboard in one click, so handing off to the agency is frictionless.

## Placement (approved Option B)

**Placement:** between the Intel strip (campaign summary) and the Latest Creatives grid in both preview panels. Natural scan order:

```
Panel scroll order
 ├── Title + status
 ├── Progress bar (marketing only)
 ├── Intel strip / Campaign Context (summary — "what is this campaign")
 ├── ★ Landing Pages Card                      ← new
 └── Latest Creatives / Asset grid
```

Rationale: the user reads *what the campaign is*, sees *where it lives*, then sees *what it looks like*.

## Data Model

### New table: `campaign_landing_pages`

```sql
CREATE TABLE IF NOT EXISTS campaign_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES intake_requests(id) ON DELETE CASCADE,
  job_posting_url TEXT,
  landing_page_url TEXT,
  ada_form_url TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_landing_pages_request
  ON campaign_landing_pages(request_id);
```

Design notes:
- `UNIQUE(request_id)` enforces 1:1 — every campaign has exactly one row (or none).
- `ON DELETE CASCADE` — deleting a campaign removes its landing pages.
- All three URL columns are nullable — any or all may be unset at a given time.
- `updated_by` records the Clerk user id of the last editor for observability.
- `updated_at` updated on every PATCH (not via a trigger — explicitly set in the UPDATE statement to keep the schema simple).
- Migration lives in `src/lib/db/schema.ts` using the existing `CREATE TABLE IF NOT EXISTS` pattern. Idempotent. Runs on next app boot. No manual migration runner needed.

### TypeScript type

New interface in `src/lib/types.ts`:

```ts
export interface CampaignLandingPages {
  id: string;
  request_id: string;
  job_posting_url: string | null;
  landing_page_url: string | null;
  ada_form_url: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}
```

## API Routes

### `GET /api/intake/[id]/landing-pages`

- **Auth**: any authenticated user with access to the request (same check as the existing `GET /api/intake/[id]`).
- **Response 200**:
  ```json
  {
    "id": "uuid",
    "request_id": "uuid",
    "job_posting_url": "https://…" | null,
    "landing_page_url": "https://…" | null,
    "ada_form_url": "https://…" | null,
    "updated_by": "user_xxx" | null,
    "created_at": "2026-04-07T…",
    "updated_at": "2026-04-07T…"
  }
  ```
- **Response 200 when no row exists**: `null` (the component handles this as empty state — all three inputs blank).
- **Response 401**: unauthenticated
- **Response 404**: request id doesn't exist

### `PATCH /api/intake/[id]/landing-pages`

- **Auth**: role must be `admin` or `designer`. Recruiter/viewer get 403.
- **Body**:
  ```json
  {
    "field": "job_posting_url" | "landing_page_url" | "ada_form_url",
    "value": "https://…" | null
  }
  ```
- **Normalization** (both client and server):
  1. Trim whitespace
  2. If empty after trim → `null`
  3. Otherwise if no `http://` or `https://` prefix → prepend `https://`
- **Upsert** via `INSERT … ON CONFLICT (request_id) DO UPDATE`:
  ```sql
  INSERT INTO campaign_landing_pages (request_id, <field>, updated_by, updated_at)
  VALUES ($1, $2, $3, NOW())
  ON CONFLICT (request_id) DO UPDATE SET
    <field> = EXCLUDED.<field>,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW()
  RETURNING *;
  ```
  Because `<field>` is dynamic, the route builds a small allowlist map to avoid SQL injection — `field` must be one of the three known column names or the request is rejected with 400.
- **Response 200**: the updated row (same shape as GET).
- **Response 400**: invalid field name or non-string value
- **Response 403**: role not permitted
- **Response 404**: request id doesn't exist

**Single-field PATCH** (not whole-object) keeps the optimistic UI simple: one blur → one request → one field.

## Frontend Component

New file: **`src/components/LandingPagesCard.tsx`** (~280 lines).

### Props

```tsx
interface LandingPagesCardProps {
  requestId: string;
  canEdit: boolean;
}
```

`canEdit` is computed at the mount point from the current user's role — `admin` or `designer` → `true`; `recruiter`, `viewer` → `false` (readonly inputs, no blur handlers).

### Internal structure

```
LandingPagesCard (default export, 'use client')
├── state
│   ├── pages: CampaignLandingPages | null
│   ├── loading: boolean
│   ├── savingField: string | null          (which field is currently saving)
│   ├── focusedField: string | null         (prevents poll from overwriting focused input)
│   └── error: string | null
│
├── effects
│   ├── initial fetch on mount
│   └── 5-second polling loop (skips if unmounted or any field is focused)
│
├── helpers
│   ├── normalizeUrl(raw: string): string | null
│   ├── saveField(field, rawValue): void    (optimistic update, PATCH, rollback on fail)
│   └── isComplete(pages): boolean          (all 3 non-null for header badge)
│
└── sub-components (module-level)
    ├── <CardHeader complete />
    │   └── title + "applies to all countries" + green "✓ complete" badge when all 3 filled
    └── <LandingPageRow field label icon color value canEdit savingField onBlur onFocus />
        ├── icon panel (14×14 svg, distinct per field)
        ├── label (uppercase 10px: "Job Posting" / "Landing Page" / "ADA Form")
        ├── <input> (always-on, monospace, placeholder when empty)
        ├── saving/editing indicator (3-dot pulse while focused)
        └── action buttons (copy + open-in-new-tab, shown when filled && !focused)
```

### Mount points

Two files mount this component with one line each:

**`src/components/CampaignPreviewPanel.tsx`** — insert between the Intel strip (line ~264) and the Latest Creatives block (line ~267):

```tsx
<LandingPagesCard requestId={request.id} canEdit={canEdit} />
```

**`src/components/designer/DesignerPreviewPanel.tsx`** — insert between `<CampaignContextCard />` (line ~304) and `<DownloadKit />` (line ~307):

```tsx
<LandingPagesCard requestId={requestId} canEdit={canEdit} />
```

`canEdit` resolution in each panel:
- Marketing panel: read from the existing `role` state (already fetched via `/api/auth/me` in `src/app/page.tsx`). Pass down as a new prop.
- Designer panel: same pattern — add a `role` fetch or derive from existing context. Always `true` for designers since they're already role-gated to reach this route.

### Visual treatment

Matches the approved states mockup at `.superpowers/brainstorm/84619-1775579156/content/states.html`. Key specs:

- **Card**: `border border-[var(--border)] rounded-[14px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]`
- **Header**: 11px uppercase label + "applies to all countries" subtitle + conditional "✓ complete" green badge
- **Row** (default): `bg-[#FAFAFA] border rounded-[10px] px-3 py-2.5`
- **Row** (focused): `bg-white border-rgb(6,147,227) ring-3 ring-rgb(6,147,227)/10`
- **Row** (saved): `bg-rgba(34,197,94,0.04) border-rgba(34,197,94,0.25)`
- **Icons**: 14×14 svg in a 30×30 rounded-8 gradient panel (cyan→purple at 10% opacity). Distinct icon per field: clipboard-list (Job Posting, blue), globe (Landing Page, purple), file-check (ADA Form, green).
- **Input**: transparent, no border, `font-mono text-[12px]`, placeholder italic at `#c0c0c0`.
- **Action buttons**: 26×26 rounded-6, hover `bg-[#F0F0F0]`, muted → foreground color on hover. `copy` icon and `external-link` icon. Lucide React: `Copy`, `ExternalLink`.
- **Saving indicator**: 3-dot pulse animation in cyan while focused, replaces action buttons.

## Data Flow + Sync

```
Marketing mgr dashboard              Neon                Designer dashboard
 (CampaignPreviewPanel)                                  (DesignerPreviewPanel)
          │                                                      │
          │ LandingPagesCard             ┌─────────────────┐      │ LandingPagesCard
          │ GET on mount ────────────────►                 ◄──────┤ GET on mount
          │                              │ campaign_landing │      │
          │ 5s poll (non-focused) ───────►     _pages      ◄──────┤ 5s poll (non-focused)
          │                              │                 │      │
          │ blur → PATCH {field,value}   │ UNIQUE(req_id)  │      │
          └──────────────────────────────►                 ◄──────┤ blur → PATCH
                                         └─────────────────┘
```

Sync is eventual via polling — 5s round-trip worst case. If marketing pastes a URL while designer is on the same campaign, designer sees it within 5s without a refresh.

**Polling safety**: the poll skips when any input in the card is focused, so the user's in-progress typing is never overwritten by a network response.

## URL Normalization + Validation

Both client and server run identical normalization before writing:

```ts
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
```

No strict URL validity check. If the user types garbage (e.g. `not a url`), it becomes `https://not a url` and gets saved. The copy + open-link buttons still render, but the open-link click will fail in the browser — that's acceptable feedback for v1. Strict validation adds friction we don't need.

## Permissions

| Role | GET | PATCH |
|---|---|---|
| admin | ✅ | ✅ |
| designer | ✅ | ✅ |
| recruiter | ✅ (readonly inputs in UI) | ❌ 403 |
| viewer | ✅ (readonly inputs in UI) | ❌ 403 |

**Role note:** the `UserRole` type in `src/lib/types.ts:364` is `'admin' | 'recruiter' | 'designer' | 'viewer'` — there is no `'marketer'` role in this codebase. Steven (the marketing manager) operates as `admin`. So "marketing manager can edit" literally means "admin can edit." The two dashboard owners we promised can edit are therefore **admin** (Steven / marketing manager) and **designer**. Recruiters fill the intake form but don't touch the dashboard view's landing-page card.

Permission check on PATCH is a new inline check in the route handler — the existing `canEditRequest` helper in `src/lib/permissions.ts:41` is too restrictive (only admins and recruiters-on-their-own-drafts), so it can't be reused directly. The route uses `getAuthContext()` from `src/lib/permissions.ts:11` to get `{ userId, role }`, then checks `role === 'admin' || role === 'designer'`. UI hides affordances for readonly users but real enforcement is server-side.

## Edge Cases

| Case | Behavior |
|---|---|
| First load, no row in DB | GET returns `null`, card renders with all 3 empty inputs and placeholders |
| User clears a field (backspaces everything) | `normalizeUrl` returns `null`, PATCH sets that column to NULL; other fields untouched |
| PATCH fails (500, network offline) | Optimistic local state rolls back, `sonner` toast error: "Couldn't save landing page" |
| Concurrent edit: A types while B's 5s poll fires | Poll sees `focusedField !== null` and skips the state update; A's input is safe |
| User without edit permission | `canEdit={false}`, inputs readonly, blur handler no-ops, but copy/open buttons still work |
| URL field contains `http://` (not https) | `normalizeUrl` preserves as-is (`^https?://` matches) |
| User pastes whitespace-wrapped URL | `trim()` handles it |
| User types exactly `https://` with nothing else | Treated as "user is mid-typing"; saves the string literally. Harmless. |
| All 3 filled | Header badge renders `✓ complete` in green |
| Campaign deleted | `ON DELETE CASCADE` removes the row — no orphans |

## File Changes Summary

| File | Change | Approx LOC |
|---|---|---|
| `src/lib/db/schema.ts` | Add `CREATE TABLE IF NOT EXISTS campaign_landing_pages` + index | +18 |
| `src/lib/types.ts` | Add `CampaignLandingPages` interface | +10 |
| `src/app/api/intake/[id]/landing-pages/route.ts` | New GET + PATCH handlers with permission + normalization | +130 |
| `src/components/LandingPagesCard.tsx` | New — default export, 2 module-level sub-components, auto-save, 5s poll | +280 |
| `src/components/CampaignPreviewPanel.tsx` | Add import, mount `<LandingPagesCard>` between Intel strip and creatives, pass `canEdit` prop (derived from role) | +10 |
| `src/components/designer/DesignerPreviewPanel.tsx` | Add import, mount between `CampaignContextCard` and `DownloadKit`, pass `canEdit` | +10 |
| `src/app/page.tsx` | Pass `role` down to `CampaignPreviewPanel` (it's already fetched, just needs to propagate) | +2 |

Net: ~460 new lines across 7 files. One new DB table. Two new API endpoints. One shared component mounted in two places.

## Testing Strategy

No unit tests (codebase has no test framework). Verification:

1. **`npx tsc --noEmit`** — clean
2. **`npm run build`** — clean
3. **Manual dev verification** end-to-end:
   - Sign in as admin in one browser
   - Sign in as designer in another browser (or second profile)
   - Both open the same campaign
   - Marketing pastes Job Posting URL → within 5s it appears in designer view
   - Designer pastes Landing Page URL → within 5s it appears in marketing view
   - Verify `https://` auto-prepends when typing `oneforma.com/jobs`
   - Verify clearing a field wipes it to null
   - Verify copy button copies + open-in-new-tab opens the URL
   - Verify `✓ complete` badge appears when all 3 are filled
   - Sign in as recruiter → open same campaign → inputs are readonly, no errors
   - Verify `campaign_landing_pages` row exists in Neon after each save
   - Kill a campaign → verify the landing pages row is gone (cascade)

## Open Questions (resolved)

- ~~Placement~~ → Option B: between Intel strip and Latest Creatives
- ~~Edit UX~~ → Always-on inputs, auto-save on blur, no modal
- ~~Validation~~ → Auto-prepend `https://`, no strict format validation
- ~~Permissions~~ → Admin (Steven / marketing manager) + designer can edit; recruiter/viewer readonly. No `marketer` role exists in this codebase.
- ~~Labels~~ → Short: "Job Posting" / "Landing Page" / "ADA Form"
- ~~Storage~~ → New relational table `campaign_landing_pages` with UNIQUE FK — matches the rest of the codebase's per-concept table pattern, not JSONB on `intake_requests`
- ~~Per-country variants~~ → No, one set per campaign across all countries
- ~~Sync~~ → 5s polling, focus-aware skip to protect in-progress typing

## References

- States mockup (approved): `.superpowers/brainstorm/84619-1775579156/content/states.html`
- Placement mockup (approved Option B): `.superpowers/brainstorm/84619-1775579156/content/placement.html`
- Marketing panel: `src/components/CampaignPreviewPanel.tsx`
- Designer panel: `src/components/designer/DesignerPreviewPanel.tsx`
- Existing schema pattern: `src/lib/db/schema.ts` (see `creative_briefs`, `actor_profiles`, `approvals` — all use the same FK-to-`intake_requests` + `ON DELETE CASCADE` shape)
- Existing permission pattern: `src/lib/permissions.ts`
- URL normalization will match the client-side `normalizeUrl` used here; no external dep added.
