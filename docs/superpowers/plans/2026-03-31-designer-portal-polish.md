# Designer Portal Polish + Feature Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the Submit Finals flow (status change + Teams notification), delete dead code, and make all designer portal pages fully responsive across mobile/tablet/desktop.

**Architecture:** One new API route (`submit-finals`), one deletion (`designer/edit`), and responsive CSS fixes across 9 existing components. The Submit Finals endpoint follows the same magic-link validation pattern as existing designer routes. All responsive fixes use Tailwind breakpoint classes (`sm:`, `md:`, `lg:`, `xl:`).

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Lucide icons, Neon Postgres, Teams webhook

---

### Task 1: Create Submit Finals API route

**Files:**
- Create: `src/app/api/designer/[id]/submit-finals/route.ts`

- [ ] **Step 1: Create the submit-finals route**

Create `src/app/api/designer/[id]/submit-finals/route.ts`:

```typescript
import { getDb } from '@/lib/db';
import { validateMagicLink } from '@/lib/db/magic-links';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return Response.json({ error: 'Magic link token is required' }, { status: 401 });
    }

    const magicLink = await validateMagicLink(token);
    if (!magicLink || magicLink.request_id !== id) {
      return Response.json({ error: 'Invalid or expired magic link' }, { status: 401 });
    }

    const sql = getDb();

    // Check that at least one upload exists
    let uploads: any[] = [];
    try {
      uploads = await sql`SELECT id FROM designer_uploads WHERE request_id = ${id} LIMIT 1`;
    } catch {
      // Table may not exist yet
    }

    if (uploads.length === 0) {
      return Response.json({ error: 'Upload at least one file before submitting finals' }, { status: 400 });
    }

    // Update request status to 'sent'
    await sql`UPDATE intake_requests SET status = 'sent', updated_at = NOW() WHERE id = ${id}`;

    // Get request title for notification
    const [req] = await sql`SELECT title, created_by FROM intake_requests WHERE id = ${id}`;

    // Create notification record
    try {
      await sql`
        INSERT INTO notifications (id, user_id, type, title, message, link, created_at)
        VALUES (
          gen_random_uuid(),
          ${req.created_by},
          'finals_submitted',
          ${'Designer submitted finals'},
          ${'Finals submitted for ' + req.title},
          ${'/intake/' + id},
          NOW()
        )
      `;
    } catch {
      // Notification table schema may differ — non-critical
    }

    // Send Teams webhook if configured
    try {
      const teamsUrl = process.env.TEAMS_WEBHOOK_URL;
      if (teamsUrl) {
        await fetch(teamsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            summary: `Designer submitted finals for ${req.title}`,
            themeColor: '22c55e',
            title: 'Designer Finals Submitted',
            sections: [{
              facts: [
                { name: 'Campaign', value: req.title },
                { name: 'Status', value: 'Finals delivered' },
              ],
            }],
            potentialAction: [{
              '@type': 'OpenUri',
              name: 'Review Campaign',
              targets: [{ os: 'default', uri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://nova-intake.vercel.app'}/intake/${id}` }],
            }],
          }),
        });
      }
    } catch {
      // Teams notification failure is non-critical
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to submit finals' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/designer/\[id\]/submit-finals/route.ts
git commit -m "feat: add submit-finals API route — status change + Teams notification

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Wire Submit Finals button in UploadZone + delete dead code

**Files:**
- Modify: `src/components/designer/UploadZone.tsx`
- Delete: `src/app/api/designer/edit/route.ts`

- [ ] **Step 1: Rewrite UploadZone handleSubmitFinals to call the API**

In `src/components/designer/UploadZone.tsx`, replace the `handleSubmitFinals` function (lines 93-103) with:

```typescript
  async function handleSubmitFinals() {
    if (uploads.length === 0) {
      toast.error("Upload at least one file before submitting finals");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/designer/${requestId}/submit-finals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit finals");
      }
      toast.success("Finals submitted successfully!");
      onSubmitFinals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit finals");
    } finally {
      setSubmitting(false);
    }
  }
```

- [ ] **Step 2: Update the Submit Finals button to show disabled state when no uploads**

Replace the Submit Finals section at the bottom of UploadZone (lines 215-231) with:

```tsx
      {/* Submit Finals */}
      <div className="flex justify-center pt-4">
        <button
          onClick={handleSubmitFinals}
          disabled={submitting || uploads.length === 0}
          className="btn-success text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title={uploads.length === 0 ? "Upload at least one file first" : undefined}
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {submitting ? "Submitting..." : "Submit Finals to Steven"}
        </button>
      </div>
```

- [ ] **Step 3: Delete the unused designer edit route**

```bash
rm src/app/api/designer/edit/route.ts
```

- [ ] **Step 4: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire Submit Finals button to API + delete unused designer/edit route

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Responsive polish — SeedreamEditor (three-panel → stacked on mobile)

**Files:**
- Modify: `src/components/designer/SeedreamEditor.tsx`

- [ ] **Step 1: Make the three-panel layout responsive**

In `src/components/designer/SeedreamEditor.tsx`, make these edits:

**Header (line 289):** Add hamburger clearance:
```tsx
// Old:
<div className="px-6 py-4 border-b border-[var(--border)] bg-white">
// New:
<div className="px-4 pl-14 lg:pl-6 md:pr-6 py-4 border-b border-[var(--border)] bg-white">
```

**Main flex container (line 297):** Stack on mobile:
```tsx
// Old:
<div className="flex-1 flex overflow-hidden">
// New (the outer container):
<div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
```

**Left asset browser panel (lines 299-305):** Hide on mobile, show on desktop:
```tsx
// Old:
<div className="w-[320px] shrink-0 border-r border-[var(--border)] bg-white overflow-hidden">
// New:
<div className="hidden lg:block w-[320px] shrink-0 border-r border-[var(--border)] bg-white overflow-hidden">
```

**Inner workspace flex (line 311):** Stack on mobile:
```tsx
// Old:
<div className="flex-1 flex overflow-hidden">
// New:
<div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
```

**Image comparison area (line 313):** Mobile padding:
```tsx
// Old:
className="flex-1 p-6 overflow-y-auto"
// New:
className="flex-1 p-4 md:p-6 overflow-y-auto"
```

**Chat panel (line 462):** Full width on mobile, fixed on desktop:
```tsx
// Old:
<div className="w-[340px] shrink-0 border-l border-[var(--border)] bg-white overflow-hidden">
// New:
<div className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-white overflow-hidden h-[300px] lg:h-auto">
```

- [ ] **Step 2: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/designer/SeedreamEditor.tsx
git commit -m "fix: make SeedreamEditor responsive — stacked layout on mobile

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Responsive polish — DesignerCampaignList + designer workspace page

**Files:**
- Modify: `src/components/designer/DesignerCampaignList.tsx`
- Modify: `src/app/designer/[id]/page.tsx`

- [ ] **Step 1: Fix DesignerCampaignList responsive layout**

In `src/components/designer/DesignerCampaignList.tsx`, find the outer container div and add hamburger clearance. Read the file first to find the exact class, then change the main wrapper padding to: `px-4 pl-14 lg:pl-6 md:pr-8 lg:px-10 py-4 md:py-6`

Find the card grid and ensure it uses: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`

Find the search input container and ensure it's full-width on mobile.

- [ ] **Step 2: Fix designer workspace page responsive layout**

In `src/app/designer/[id]/page.tsx`, read the file and apply these patterns throughout:

- Header: add `pl-14 lg:pl-6` for hamburger clearance
- Body container: `px-4 md:px-8 lg:px-10 py-4 md:py-6`
- Any `flex` rows with title + buttons: add `flex-col sm:flex-row gap-3`
- Status badge rows: add `flex-wrap gap-2`
- Asset grids: ensure `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`

- [ ] **Step 3: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/designer/DesignerCampaignList.tsx src/app/designer/\[id\]/page.tsx
git commit -m "fix: responsive polish for designer campaign list + workspace

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Responsive polish — remaining designer components

**Files:**
- Modify: `src/components/designer/AssetBrowser.tsx`
- Modify: `src/components/designer/DesignerAssetCard.tsx`
- Modify: `src/components/designer/EditChat.tsx`
- Modify: `src/components/designer/DownloadKit.tsx`
- Modify: `src/components/designer/CampaignContextCard.tsx`

- [ ] **Step 1: Fix AssetBrowser**

In `src/components/designer/AssetBrowser.tsx`:
- Thumbnail grid: ensure `grid-cols-2` for the asset thumbnails
- Filter tabs: add `flex-wrap` if they use a flex row
- Add `overflow-y-auto scrollbar-hide` to the scrolling container

- [ ] **Step 2: Fix DesignerAssetCard**

In `src/components/designer/DesignerAssetCard.tsx`:
- Card padding: `p-3 md:p-4`
- Action buttons row: add `flex-wrap gap-2`
- Design notes text: add `line-clamp-3` for mobile truncation

- [ ] **Step 3: Fix EditChat quick actions**

In `src/components/designer/EditChat.tsx`, the quick actions section (line 158-172) already uses `flex-wrap gap-1.5` which is correct. Verify and ensure message bubbles use `max-w-[85%]` (already present at line 105). No changes needed if already responsive.

- [ ] **Step 4: Fix DownloadKit**

`src/components/designer/DownloadKit.tsx` already uses `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` (line 79). Verify this is correct. No changes needed.

- [ ] **Step 5: Fix CampaignContextCard**

In `src/components/designer/CampaignContextCard.tsx`:
- Info grid: ensure `grid-cols-1 sm:grid-cols-2`
- Pill tags containers: add `flex-wrap`

- [ ] **Step 6: Verify build passes**

Run: `npx next build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/designer/AssetBrowser.tsx src/components/designer/DesignerAssetCard.tsx src/components/designer/EditChat.tsx src/components/designer/DownloadKit.tsx src/components/designer/CampaignContextCard.tsx
git commit -m "fix: responsive polish for designer asset browser, cards, chat, download kit

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Deploy and verify

**Files:** None (deployment task)

- [ ] **Step 1: Build and deploy**

```bash
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```

- [ ] **Step 2: Verify in browser**

Check the designer portal pages at multiple viewports (375px, 768px, 1440px):
- `/designer` — campaign list
- `/designer/editor` — Seedream editor
- `/designer/[id]` — campaign workspace (requires magic link)

- [ ] **Step 3: Commit any final fixes**
