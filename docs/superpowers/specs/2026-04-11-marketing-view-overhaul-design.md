# Marketing View Overhaul — Side Panel Editor, Autosave, Editable Messaging

> **Scope:** Full-stack. New PATCH API endpoint, autosave hook, side panel creative editor replacing the modal, editable ad messaging cards in PersonaSection. All text fields persist to Neon.

## Goal

Replace the broken edit experience in the marketing view with a production-grade system: a full-viewport side panel editor with working autosave, editable ad messaging cards, and a PATCH API endpoint that persists changes to Neon. Currently, edits show a fake "saved" toast but never call an API — every change vanishes on reload. After this ships, every text field in the marketing view persists immediately.

## What Changes vs What Stays

### Changes
- CreativeEditorModal → replaced by `CreativeSidePanel` (full-viewport slide-over, 60/40 split)
- EditableField `onSave` → wired to `useAutosave` hook with debounced PATCH calls
- Ad Messaging section in PersonaSection → all fields become EditableField with autosave
- New API route: `PATCH /api/assets/[id]` for updating `content` and `copy_data` JSONB

### Stays the same
- Channel tab bar + version cards (just shipped)
- PersonaSection header, demographics, psychographics, channel targeting, actor photos
- CreativeHtmlEditor (Edit HTML button still opens the full HTML editor)
- MediaStrategyTab (read-only — editing strategy is a separate spec)
- Campaign tab EditableFields (already wired, just need autosave hook)

---

## § 1 — PATCH `/api/assets/[id]` Endpoint

### 1.1 Route

**File:** `src/app/api/assets/[id]/route.ts` (existing file — currently has DELETE only)

Add a `PATCH` handler alongside the existing `DELETE`:

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: require admin or designer role
  // Accept JSON body with optional fields:
  //   { content?: Record<string, unknown>, copy_data?: Record<string, unknown> }
  // Merge (not replace) into existing JSONB using jsonb_concat (||)
  // Return updated asset row
}
```

### 1.2 Update Logic

The PATCH performs a **shallow merge** on JSONB fields using Postgres `||` operator:

```sql
UPDATE generated_assets
SET
  content = COALESCE(content, '{}'::jsonb) || $2::jsonb,
  copy_data = COALESCE(copy_data, '{}'::jsonb) || $3::jsonb
WHERE id = $1
RETURNING id, content, copy_data
```

This means:
- `{ content: { overlay_headline: "New Headline" } }` updates only `overlay_headline`, leaves all other content keys untouched
- `{ copy_data: { primary_text: "New text" } }` updates only `primary_text` in copy_data
- Either field can be omitted (only provided fields are updated)

### 1.3 Auth

Same pattern as the existing DELETE handler: Clerk `auth()` → require `admin` or `designer` role. Return 401/403 on failure.

### 1.4 Response

```typescript
// 200 OK
{ id: string, content: Record<string, unknown>, copy_data: Record<string, unknown> }

// 404
{ error: "Asset not found" }

// 400
{ error: "No update fields provided" }
```

---

## § 2 — `useAutosave` Hook

### 2.1 Interface

```typescript
function useAutosave(
  assetId: string,
  field: "content" | "copy_data",
  key: string,
): {
  save: (value: string) => void;    // Call on every edit — internally debounced
  status: "idle" | "saving" | "saved" | "error";
}
```

### 2.2 Behavior

1. `save(value)` is called by EditableField's `onSave` callback
2. Internally debounced at 800ms — resets timer on each call
3. After debounce: `PATCH /api/assets/${assetId}` with `{ [field]: { [key]: value } }`
4. Status transitions: `idle → saving → saved` (on success) or `idle → saving → error` (on failure)
5. `saved` status reverts to `idle` after 2 seconds
6. `error` status stays until next save attempt

### 2.3 File

**Create:** `src/hooks/useAutosave.ts`

---

## § 3 — `AutosaveStatus` Component

A tiny inline indicator showing save state:

```
● All changes saved     (green dot, idle/saved)
● Saving...             (amber dot, saving)
● Save failed — retry   (red dot, error, clickable)
```

**File:** `src/components/AutosaveStatus.tsx`

Used in both the side panel and the messaging cards.

---

## § 4 — `CreativeSidePanel` Component

### 4.1 Layout

Full-viewport slide-over that replaces CreativeEditorModal:

- **Backdrop:** `fixed inset-0 bg-black/30 z-50` — click to close
- **Panel:** `fixed right-0 inset-y-0 w-full z-50` — slides in from right (`translateX(100%) → 0`, 200ms ease)
- **Split:** `flex` — left 60% (dark preview) + right 40% (white edit panel)

### 4.2 Left Side — Dark Preview (60%)

- Background: `#0a0a0a`
- Top bar: Back button, V badge + context (persona, channel, pillar), VQA score, close (X) button
- Center: Creative preview — `blob_url` as `<img>` or gradient placeholder. Large (fills available space with padding). `border-radius: 14px`, heavy shadow.
- Bottom: **Format switcher** — mini thumbnails at true aspect ratios for each format in the version's channel. Active format has purple border + glow. Click to switch — updates the preview image to that format's asset.

### 4.3 Right Side — Edit Panel (40%)

- Background: white
- Header: "Edit Creative" title + format label (e.g., "Feed 1:1")
- Scrollable content area with two sections:

**Section 1: Overlay Text** (purple section label)
- Headline — EditableField, `onSave` → `useAutosave(assetId, "content", "overlay_headline")`
- Subheadline — EditableField, `onSave` → `useAutosave(assetId, "content", "overlay_sub")`
- CTA Button — EditableField, `onSave` → `useAutosave(assetId, "content", "overlay_cta")`

**Section 2: Platform Ad Copy** (purple section label)
- Primary Text — EditableField (multiline), `onSave` → `useAutosave(assetId, "copy_data", "primary_text")`
- Ad Headline — EditableField, `onSave` → `useAutosave(assetId, "copy_data", "headline")`
- Description — EditableField, `onSave` → `useAutosave(assetId, "copy_data", "description")`

**AutosaveStatus** indicator below the fields.

**Action bar** (sticky bottom, white bg, top border):
- Edit HTML (btn-primary) → opens CreativeHtmlEditor
- Export Figma (btn-primary) → `window.open(/api/export/figma/${id})`
- Download (btn-secondary) → download blob_url
- Regenerate (btn-secondary) → calls existing onRefine callback
- Delete (red outline) → calls existing onDelete callback

### 4.4 Format Switcher Behavior

- Shows all formats available for the version's channel (from `CHANNEL_DEFINITIONS`)
- Each format rendered as a mini thumbnail at correct aspect ratio (44px height baseline)
- Active format: purple border `2px solid #6B21A8` + `box-shadow: 0 0 12px rgba(107,33,168,0.3)`
- Inactive: `border: 1px solid rgba(255,255,255,0.2)`, 50% opacity
- Click switches `activeFormatAsset` state — preview updates, edit fields update to that asset's data
- Labels below each: "Feed", "Story", "Carousel"

### 4.5 State

```typescript
interface SidePanelState {
  activeFormatAsset: GeneratedAsset;   // Currently previewed format
  // EditableField + useAutosave handle their own state internally
}
```

### 4.6 Props

```typescript
interface CreativeSidePanelProps {
  version: VersionGroup;              // From channel gallery
  channelDef: ChannelDef;             // For format definitions
  onClose: () => void;
  onRefine?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
}
```

### 4.7 Opening the Panel

In `ChannelCreativeGallery`, when a format thumbnail is clicked:
- Instead of `onAssetClick(asset)` → `setSelectedAsset(asset)` → CreativeEditorModal
- Now: `onAssetClick(asset)` → find the version this asset belongs to → open `CreativeSidePanel` with that version + channel def

This requires lifting state: `ChannelCreativeGallery` manages a `selectedVersion: VersionGroup | null` state. When a thumbnail is clicked, it finds the version containing that asset, sets `selectedVersion`, and renders `CreativeSidePanel`. The format thumbnail that was clicked becomes the `initialFormatAsset`.

### 4.8 File

**Create:** `src/components/creative-gallery/CreativeSidePanel.tsx`

---

## § 5 — Editable Ad Messaging Cards

### 5.1 Current State

The Ad Messaging section in PersonaSection shows copy per platform as read-only text. Headlines, primary text, descriptions, and CTAs are displayed but not editable.

### 5.2 New Behavior

Every text field in the messaging cards becomes an `EditableField` with autosave:

- **Headline** → `EditableField` + `useAutosave(copyAsset.id, "copy_data", "headline")`
- **Primary Text** → `EditableField` (multiline) + `useAutosave(copyAsset.id, "copy_data", "primary_text")`
- **Description** → `EditableField` + `useAutosave(copyAsset.id, "copy_data", "description")`
- **CTA** → `EditableField` + `useAutosave(copyAsset.id, "copy_data", "cta")`

Platform-specific field names are resolved:
- LinkedIn: `introductory_text` instead of `primary_text`
- Twitter/X: `tweet_text` instead of `primary_text`
- Telegram: `message_text` instead of `primary_text`

Each platform card gets its own `AutosaveStatus` indicator.

### 5.3 Where to Modify

**File:** `src/components/CampaignWorkspace.tsx` — PersonaSection's Ad Messaging section (approximately lines 597-670 in the current file, may have shifted after gallery overhaul).

Replace the read-only `<div>` elements with `EditableField` components wired to `useAutosave`.

---

## § 6 — EditableField Enhancement

### 6.1 Current Issues

- `immediatelyRender: false` already added (Tiptap SSR fix)
- `onSave` callback fires but parent never calls API
- No loading/error states visible to user

### 6.2 Changes

No changes to EditableField component itself. The autosave behavior is handled by the `useAutosave` hook in the parent. EditableField remains a pure UI component — it calls `onSave(value)` and the parent decides what to do with it.

The `AutosaveStatus` component is rendered alongside EditableField by the parent, not inside it.

---

## § 7 — Component Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useAutosave.ts` | Debounced autosave hook — PATCH to Neon |
| `src/components/AutosaveStatus.tsx` | Inline save status indicator (green/amber/red dot) |
| `src/components/creative-gallery/CreativeSidePanel.tsx` | Full-viewport slide-over editor |

### Modified Files

| File | Change |
|------|--------|
| `src/app/api/assets/[id]/route.ts` | Add PATCH handler for content/copy_data updates |
| `src/components/CampaignWorkspace.tsx` | Remove CreativeEditorModal, wire side panel, make messaging editable |
| `src/components/creative-gallery/ChannelCreativeGallery.tsx` | Add selectedVersion state, render CreativeSidePanel |
| `src/components/creative-gallery/VersionCard.tsx` | Pass version to onAssetClick so gallery can open panel with version context |

### Unchanged Files

| File | Why |
|------|-----|
| `src/components/EditableField.tsx` | Pure UI component — no changes needed |
| `src/components/MediaStrategyTab.tsx` | Read-only — editing strategy is separate spec |
| `src/components/CreativeHtmlEditor.tsx` | Still opened via "Edit HTML" button in side panel |

---

## § 8 — Data Flow

### Autosave Flow

```
User types in EditableField
  → onSave(newValue) fires
  → useAutosave.save(newValue) called
  → Debounce timer resets (800ms)
  → After 800ms idle: status = "saving"
  → PATCH /api/assets/{id} with { [field]: { [key]: newValue } }
  → 200 OK: status = "saved" → auto-revert to "idle" after 2s
  → Error: status = "error" (stays until next attempt)
```

### Side Panel Data Flow

```
Click format thumbnail in VersionCard
  → ChannelCreativeGallery finds version containing clicked asset
  → Sets selectedVersion + initialAsset
  → CreativeSidePanel renders with version.assets + channelDef.formats
  → Format switcher shows all format variants
  → Click format → update activeFormatAsset → preview + fields update
  → Close → selectedVersion = null → gallery visible again
```

---

## § 9 — Animations

- **Side panel enter:** `translateX(100%) → translateX(0)`, 200ms ease-out
- **Side panel exit:** `translateX(0) → translateX(100%)`, 150ms ease-in
- **Backdrop enter:** `opacity: 0 → 0.3`, 200ms
- **Backdrop exit:** `opacity: 0.3 → 0`, 150ms
- **Format switcher:** active thumbnail border glow pulse (CSS `box-shadow` transition)

CSS transitions only — no animation library needed.

---

## § 10 — Success Criteria

1. **PATCH endpoint works** — `curl -X PATCH /api/assets/{id} -d '{"content":{"overlay_headline":"test"}}' → 200`
2. **Edits persist** — change a headline, reload the page, headline still shows the edit
3. **Side panel opens** — click any format thumbnail → panel slides in from right
4. **Format switcher works** — click Story thumbnail → preview updates to Story format asset
5. **All text fields editable** — headline, sub, CTA, primary text, description in side panel
6. **Ad messaging editable** — all fields in PersonaSection messaging cards are editable
7. **Autosave indicator** — green dot when saved, amber when saving, red on error
8. **Close behavior** — Escape key, backdrop click, or Back button closes panel
9. **Gallery stays mounted** — closing panel reveals gallery instantly (no data refetch)
10. **CreativeEditorModal removed** — no more modal overlay, side panel is the only editor

---

## § 11 — Explicitly Not In Scope

- **MediaStrategyTab editing** — read-only stays. Editing ad strategy (budgets, targeting, placements) is a separate spec.
- **Campaign tab autosave** — the Campaign tab's EditableFields (objective, message, tone) could use the same `useAutosave` hook, but wiring them requires a different PATCH endpoint (brief updates, not asset updates). Separate work.
- **Real-time collaboration** — no WebSocket/SSE for multi-user editing. Last-write-wins is acceptable for a single-user tool.
- **Undo/redo** — Tiptap has built-in undo (Ctrl+Z) per session but no persistent undo history.
- **Batch editing** — editing one field on multiple assets at once. Future work.
