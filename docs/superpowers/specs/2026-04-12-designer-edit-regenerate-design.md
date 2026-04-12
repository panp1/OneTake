# Designer Portal — Edit & Regenerate System — Design Spec

**Date:** 2026-04-12
**Author:** Steven Junop + Claude
**Status:** Approved
**Depends on:** Designer Gallery (System 1) must be implemented first
**Parent spec:** `2026-04-12-designer-portal-redesign-design.md`

## Overview

Give the designer in-platform creative control — quick edits via Flux 2, base image regeneration via Seedream 4.5, and seamless Figma SVG export. The designer should never need to leave the platform for small fixes, and the Figma round-trip for deep edits should be frictionless.

**Current state:** Designer must: download PNG → open Figma → edit → export → manually re-upload. No in-platform editing. No way to regenerate a base image with different direction.

**Target state:** 3 edit modes integrated directly into the gallery format cards:
1. **Quick Edit (Flux 2)** — AI inpainting/edit on the rendered PNG
2. **Regenerate Base (Seedream 4.5)** — regenerate the underlying actor photo
3. **Export for Figma** — download SVG with editable layers (already built, needs polish)

## Two-Layer Architecture

Every creative has two independent layers that require different edit tools:

**Layer 1: Base Photo** (Seedream-generated pixels)
- Scene Swap: pick from 4 existing scenes (instant, free)
- Quick Edit: Flux 2 inpainting for small fixes ($0.03, ~5s)
- Regenerate: Seedream 4.5 full regen with direction ($0.04, ~30s)
- Color code: **Amber** throughout the UI

**Layer 2: Graphic Overlay** (HTML/CSS composition)
- Live text editing: headline, subheadline, CTA
- Style controls: font size, text color, CTA color, text position
- Re-renders via Playwright (free, ~2s)
- Color code: **Green** throughout the UI

**Layer Toggle** in the edit header lets the designer switch between layers. The canvas shows which layer is being edited with a color-coded badge.

## Edit Mode 0: Scene Swap (Instant)

### What It Does
Stage 2 already generates 4 scenes per actor. The designer can instantly swap which scene is used for a version — no AI processing, no waiting. The 4 scenes are already rendered and stored.

### UX Flow
```
Designer clicks "Swap Scene" on a version
  → Horizontal strip of 4 scene thumbnails appears above the format grid
  → Each thumbnail: scene name + small preview (80x80)
  → Current scene highlighted with amber ring
  → Click a different scene → immediately swaps ALL format cards in this version
  → Stage 4 re-composes with the new base image (background, ~10s)
```

### Technical
- No API call needed for the swap — the scene images are already in `actor.scene_images[]`
- PATCH `/api/assets/[id]` to update the `content.scene_key` field
- Trigger async Stage 4 re-composition for all formats in this version

## Edit Mode 1: Quick Edit (Flux 2)

### What It Does
The designer selects an area of the creative and describes what to change. Flux 2 applies the edit in 5-10 seconds. For small fixes that don't require a full redesign. Optional — the designer may prefer scene swap or Figma for most edits.

**Example uses:**
- "Remove the scar on forehead"
- "Make background lighter"
- "Change shirt color to navy"
- "Sharpen the text overlay"
- "Remove the blob in the bottom-left"

### UX Flow

```
Designer hovers on a format card → clicks "Edit" (lightning bolt icon)
  → Gallery fades, inline editor opens
  → Full-width split view:
    LEFT (60%): Creative at full resolution
      - Canvas with brush/lasso mask tool overlay
      - Brush size slider (bottom)
      - "Draw on the area you want to change"
    RIGHT (40%): Edit panel (dark surface)
      - "What should change?" text input
      - Strength slider (0-100%, default 75%)
      - "Apply Edit" button (accent purple)
      - Loading state: progress spinner + "Flux 2 is editing..."
      - Result: before/after toggle
      - "Accept" (replaces original) / "Try Again" / "Cancel"
  → Accept → saves new version, re-runs VQA, updates gallery
```

### Mask Tool
- **Brush mode (default):** circular brush, adjustable radius (10-100px)
- **Lasso mode:** freehand selection polygon
- **Eraser:** remove parts of the mask
- Mask rendered as semi-transparent red overlay (#E91E8C at 30% opacity)
- The mask image is converted to base64 PNG and sent with the edit request

### Technical Implementation

**Frontend component:** `src/components/designer/QuickEditor.tsx`

**State:**
```typescript
interface QuickEditorProps {
  asset: GeneratedAsset;
  onClose: () => void;
  onAccept: (newBlobUrl: string) => void;
}

// Local state:
maskCanvas: HTMLCanvasElement  // drawing surface overlaid on image
editPrompt: string
strength: number (0-1)
isProcessing: boolean
resultUrl: string | null
showingResult: boolean  // toggle before/after
```

**API route:** `POST /api/assets/[id]/edit`

```typescript
// Request body:
{
  mask_image: string       // base64 PNG of the mask (same dimensions as original)
  prompt: string           // "what should change"
  strength: number         // 0-1
}

// Response:
{
  blob_url: string         // new image URL
  vqa_score: number        // re-evaluated score
  vqa_passed: boolean
}
```

**Server-side:**
1. Download original PNG from `blob_url`
2. Call Flux 2 edit API with original + mask + prompt + strength
3. Upload result to Vercel Blob
4. Run VQA evaluation on result
5. Return new blob_url + VQA result
6. Do NOT overwrite original yet — frontend "Accept" triggers the replacement

**Flux 2 integration:** The existing `worker/ai/gemini_edit.py` has Flux 2 wiring. Expose it as an API route callable from the frontend.

### Accept Flow
When designer clicks "Accept":
1. `PATCH /api/assets/[id]` with `{ blob_url: newUrl, edit_history: [...] }`
2. Original blob_url moved to `edit_history` array in asset content
3. New blob_url becomes the active asset
4. Gallery refreshes with updated image
5. VQA score badge updates

### Edit History
Every edit creates a history entry:
```typescript
{
  timestamp: string
  action: "flux2_edit"
  prompt: string
  original_url: string
  result_url: string
  vqa_score: number
}
```

Stored in `asset.content.edit_history[]`. Accessible via a "History" dropdown on the format card showing: Original → Edit 1 → Edit 2. Can revert to any previous version.

## Edit Mode 2: Regenerate Base (Seedream 4.5)

### What It Does
Regenerate the underlying actor photo with modified prompt direction. For when the scene, outfit, expression, or background needs a fundamental change — not a surface edit.

**Example uses:**
- "Different scene — coffee shop instead of clinic"
- "More professional expression — less casual"
- "Different outfit — lab coat instead of scrubs"
- "Warmer lighting — golden hour feel"
- "Different angle — three-quarter view"

### UX Flow

```
Designer clicks "Regenerate" (refresh icon) on a version trigger
  → Modal overlay opens (centered, 600px wide)
  → "What should change about the base photo?"
  → Checkbox options (pre-filled from the current scene data):
    ☐ Scene / Setting
    ☐ Outfit / Wardrobe
    ☐ Expression / Emotion
    ☐ Background / Lighting
    ☐ Angle / Pose
  → Text field: "Additional direction" (optional)
  → "Regenerate" button (accent purple)
  → Loading: "Seedream 4.5 is generating... ~30 seconds"
  → Result: side-by-side original vs new
  → "Use This" / "Try Again" / "Cancel"
  → "Use This" → replaces base image → Stage 4 re-composes ALL formats for this version
```

### Technical Implementation

**Frontend component:** `src/components/designer/RegenerateModal.tsx`

**Props:**
```typescript
interface RegenerateModalProps {
  version: VersionGroup;
  actor: ActorProfile;
  onClose: () => void;
  onRegenerated: () => void;  // triggers gallery refresh
}
```

**API route:** `POST /api/assets/[id]/regenerate`

```typescript
// Request body:
{
  changes: string[]          // ["scene", "outfit", "expression", ...]
  direction: string          // free-text additional direction
  actor_id: string           // which actor to regenerate
  scene_key: string          // which scene slot to replace
}

// Response:
{
  job_id: string             // compute_job ID — regeneration is async
  status: "queued"
}
```

**Server-side:**
1. Create a `compute_job` with type `regenerate_base`
2. Worker picks it up:
   a. Load actor profile + current scene data
   b. Modify the scene prompt based on `changes` + `direction`
   c. Call Seedream 4.5 with modified prompt (preserving face-lock reference)
   d. Run VQA on new base image
   e. If passed, save as new `base_image` asset
   f. Trigger Stage 4 re-composition for ALL formats using the new base
   g. New composed creatives replace old ones in the gallery
3. Frontend polls `GET /api/compute/status/[jobId]` until complete
4. On complete, gallery refreshes with new creatives

### Re-Composition Cascade
When a base image is regenerated:
1. New base image saved → replaces old in actor's `scene_images`
2. Stage 4 Phase 1 (graphic copy) → Phase 2 (composition) re-runs for ALL formats of this version
3. VQA gate evaluates each new composition
4. Old composed creatives archived to history
5. Gallery auto-refreshes when all formats are ready

## Edit Mode 3: Figma SVG Export (Polish)

### What Already Exists
`/api/export/figma/[assetId]` — generates an SVG with:
- Rendered PNG as base `<image>` layer
- Editable SVG `<text>` elements for headline, sub, CTA
- Named `<g>` layer groups from composition manifest
- Platform-aware dimensions
- Proper XML escaping

### What Needs Polish

1. **One-click export per format:** Each format card's Figma icon triggers download immediately (no modal)

2. **Batch export per version:** "Export V1 for Figma" button on the version trigger → downloads a ZIP containing SVGs for ALL formats in that version, named: `V1-Feed-1080x1080.svg`, `V1-Story-1080x1920.svg`, etc.

3. **Export status toast:** "Exported V1 — 3 SVG files ready" with Figma logo

4. **ZIP generation:** For batch export, use client-side JSZip to download all format SVGs in parallel, combine into ZIP, trigger download.

**API route for batch:** `GET /api/export/figma-batch/[versionKey]?request_id=X&token=Y`
- Returns a JSON array of SVG URLs for all assets in that version
- Frontend downloads each, zips client-side

## Edit Mode 4: Graphic Overlay Editor (Daily Driver)

### What It Does
Live HTML/CSS editing of the composition layer — change headline text, subheadline, CTA, font sizes, colors, text position. Preview updates instantly on the canvas. Re-renders via Playwright (free, ~2 seconds). This is the tool the designer will use MOST — faster than any Figma round-trip for text/layout changes.

### UX Flow
```
Designer clicks layer toggle → "Graphic Overlay" (green)
  → Canvas shows the creative with overlay elements highlighted
  → "Live Preview" pulsing badge top-right
  → Right panel shows:
    ├── Overlay Text fields (headline + word count, sub + char count, CTA)
    ├── Style controls:
    │   ├── Headline size (Small 48px / Medium 60px / Large 72px)
    │   ├── CTA color swatches (pink, purple, green, charcoal, white)
    │   ├── Text position (Top / Center / Bottom / Left split / Right split)
    │   └── Text color (white, dark, muted)
    └── "Save & Re-render" button (green, free, ~2s)
  → Text changes update the canvas preview LIVE (debounced 300ms)
  → Save → Playwright re-renders the modified HTML → new PNG
  → VQA re-evaluates (text overlay %, brand compliance)
  → New PNG replaces old → gallery updates
```

### Technical Implementation

**Frontend component:** `src/components/designer/GraphicEditor.tsx`

**State:**
```typescript
interface GraphicEditorProps {
  asset: GeneratedAsset;
  onClose: () => void;
  onSaved: () => void;
}

// Editable fields (from asset.content):
overlayHeadline: string
overlaySub: string
overlayCta: string

// Style controls:
headlineSize: "small" | "medium" | "large"
ctaColor: string  // hex
textPosition: "top" | "center" | "bottom" | "left-split" | "right-split"
textColor: string  // hex
```

**Live preview:** The component fetches the asset's HTML source (from `content.html_url`), modifies the text/style values in-memory, and renders the modified HTML in an iframe or via `dangerouslySetInnerHTML` inside a scaled container. Changes are debounced at 300ms.

**Save flow:**
1. PATCH `/api/assets/[id]` with updated `content` fields (overlay_headline, overlay_sub, overlay_cta, style overrides)
2. Server re-renders the modified HTML via Playwright → new PNG
3. New PNG uploaded to Blob, `blob_url` updated
4. VQA re-evaluates
5. Return new blob_url + VQA result

**API route:** `PATCH /api/assets/[id]` (already exists — extend to support style overrides + re-render trigger)

Add a `rerender: true` flag to the PATCH body that triggers Playwright re-render:
```typescript
{
  content: {
    overlay_headline: "New Headline",
    overlay_sub: "New subheadline",
    overlay_cta: "New CTA",
    style_overrides: {
      headline_size: "large",
      cta_color: "#6D28D9",
      text_position: "top",
      text_color: "#FFFFFF"
    }
  },
  rerender: true  // triggers Playwright re-render + VQA
}
```

### Why This Is the Daily Driver
| Task | Without graphic editor | With graphic editor |
|---|---|---|
| Change headline text | Download → Figma → edit → export → upload (5 min) | Type new text → Save (3 seconds) |
| Swap CTA color | Download → Figma → find layer → change → export → upload | Click color swatch (1 second) |
| Move text from top to bottom | Download → Figma → select all text → move → export → upload | Dropdown: "Bottom" (1 second) |

## Shared Components

### Edit History Dropdown
Appears on each format card when `edit_history` has entries:

```
┌─ History ──────────────────┐
│ Current (Edit 2)     ← ○   │
│ Edit 1 — "lighter bg"  ○   │
│ Original             ○     │
└────────────────────────────┘
```

Click any entry → preview that version. "Revert" button appears if not viewing current.

**API route:** `POST /api/assets/[id]/revert`
```typescript
{ target_url: string }  // blob_url to revert to
```

### Loading States
All edit/regenerate operations show:
- Skeleton pulse animation on the affected format card(s)
- Purple progress ring on the version trigger
- Toast notification on completion: "Edit applied — VQA score: 0.91"

### Error Handling
- Flux 2 failure: "Edit failed — try a different prompt or area"
- Seedream failure: "Regeneration failed — the original is preserved"
- VQA failure on edit result: "Edit applied but VQA scored 0.62 — the designer may want to review"
- Network error: "Connection lost — your edit is saved locally, will retry"

## API Routes Summary

| Route | Method | Purpose |
|---|---|---|
| `/api/assets/[id]/edit` | POST | Flux 2 quick edit |
| `/api/assets/[id]/regenerate` | POST | Seedream 4.5 base regen (creates compute_job) |
| `/api/assets/[id]/history` | GET | Fetch edit history |
| `/api/assets/[id]/revert` | POST | Revert to a previous version |
| `/api/export/figma/[assetId]` | GET | Single SVG export (already exists) |
| `/api/export/figma-batch` | GET | Batch SVG export for a version |

## New Components

| Component | Purpose | Lines (est.) |
|---|---|---|
| `src/components/designer/SceneSwapper.tsx` | Horizontal scene thumbnail strip with instant swap | ~150 |
| `src/components/designer/QuickEditor.tsx` | Inline Flux 2 edit with canvas mask tool | ~350 |
| `src/components/designer/RegenerateModal.tsx` | Seedream 4.5 regen with change checkboxes | ~200 |
| `src/components/designer/GraphicEditor.tsx` | Live HTML/CSS overlay editor with text + style controls | ~400 |
| `src/components/designer/EditHistory.tsx` | History dropdown with revert | ~120 |
| `src/components/designer/MaskCanvas.tsx` | Canvas overlay for brush/lasso mask drawing | ~250 |
| `src/components/designer/LayerToggle.tsx` | Amber (photo) / Green (graphic) layer switcher | ~60 |

## Modified Components

| Component | Changes |
|---|---|
| `FormatCard.tsx` (from System 1) | Add edit/regen/history action handlers |
| `VersionGroup.tsx` (from System 1) | Add batch Figma export button |

## New API Routes

| File | Purpose |
|---|---|
| `src/app/api/assets/[id]/edit/route.ts` | Flux 2 edit endpoint |
| `src/app/api/assets/[id]/regenerate/route.ts` | Seedream regen (creates job) |
| `src/app/api/assets/[id]/history/route.ts` | Edit history |
| `src/app/api/assets/[id]/revert/route.ts` | Revert to previous version |
| `src/app/api/export/figma-batch/route.ts` | Batch SVG ZIP export |

## Implementation Priority

1. **Figma export polish** — lowest effort, highest immediate value (designer can start using right away)
2. **Quick Edit (Flux 2)** — medium effort, high value (eliminates most download-edit-upload cycles)
3. **Regenerate Base (Seedream)** — highest effort, lower frequency (designers rarely need full regen)
4. **Edit History + Revert** — builds on top of edit/regen, adds safety net
