# Designer Edit & Regenerate System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ HIGH-STAKES:** This is the designer's primary creative control interface. Platinum-level execution. The dual-layer architecture (amber=photo, green=graphic) must be crystal clear.

**Goal:** Add 4 edit modes to the designer gallery: Scene Swap (instant), Quick Edit (Flux 2), Regenerate (Seedream 4.5), and Graphic Overlay Editor (live HTML/CSS) — with a layer toggle, edit history, and before/after comparison.

**Architecture:** `EditWorkspace` replaces the gallery when editing. It contains a `LayerToggle` that switches between Photo mode (amber — SceneSwapper, QuickEditor, RegenerateModal) and Graphic mode (green — GraphicEditor). All edit operations go through existing `/api/revise` or new API routes. Edit history stored in `asset.content.edit_history[]`.

**Tech Stack:** Next.js App Router, React client components, Canvas API for mask drawing, existing Flux 2 (`/api/revise`), existing Seedream (`/api/revise`), Playwright re-render via PATCH `/api/assets/[id]`, inline styles using gallery design tokens.

**Spec:** `docs/superpowers/specs/2026-04-12-designer-edit-regenerate-design.md`
**Mockup:** `.superpowers/brainstorm/12899-1776019875/content/03-dual-layer-edit.html`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/components/designer/edit/LayerToggle.tsx` | Amber/Green layer switcher |
| `src/components/designer/edit/EditWorkspace.tsx` | Main edit container — replaces gallery when editing |
| `src/components/designer/edit/SceneSwapper.tsx` | Horizontal scene thumbnail strip for instant swap |
| `src/components/designer/edit/QuickEditor.tsx` | Flux 2 inline editor with canvas mask tool |
| `src/components/designer/edit/MaskCanvas.tsx` | Canvas overlay for brush mask drawing |
| `src/components/designer/edit/RegenerateModal.tsx` | Seedream 4.5 regen modal with checkboxes |
| `src/components/designer/edit/GraphicEditor.tsx` | Live HTML/CSS overlay editor |
| `src/components/designer/edit/EditHistory.tsx` | History dropdown with revert |
| `src/app/api/assets/[id]/edit/route.ts` | Flux 2 edit endpoint |
| `src/app/api/assets/[id]/regenerate/route.ts` | Seedream regen endpoint (creates compute_job) |

### Modified Files
| File | Changes |
|---|---|
| `src/components/designer/gallery/DesignerGallery.tsx` | Add edit state, render EditWorkspace when editing |
| `src/components/designer/gallery/VersionGroup.tsx` | Wire edit/regen/scene-swap action buttons |
| `src/components/designer/gallery/FormatCard.tsx` | Wire edit action to open EditWorkspace |

---

## Task 1: LayerToggle + EditWorkspace Shell

**Files:**
- Create: `src/components/designer/edit/LayerToggle.tsx`
- Create: `src/components/designer/edit/EditWorkspace.tsx`

- [ ] **Step 1: Create LayerToggle**

"use client" component. The amber/green layer switcher.

```tsx
"use client";

import type { Theme } from "../gallery/tokens";
import { FONT } from "../gallery/tokens";

type Layer = "photo" | "graphic";

interface LayerToggleProps {
  activeLayer: Layer;
  onToggle: (layer: Layer) => void;
  theme: Theme;
}

export default function LayerToggle({ activeLayer, onToggle, theme }: LayerToggleProps) {
  return (
    <div style={{
      display: "flex", background: theme.bg, borderRadius: 8,
      padding: 3, border: `1px solid ${theme.border}`,
    }}>
      <button
        onClick={() => onToggle("photo")}
        style={{
          padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: "pointer", border: "none", fontFamily: FONT.sans,
          display: "flex", alignItems: "center", gap: 6,
          background: activeLayer === "photo" ? theme.card : "transparent",
          color: activeLayer === "photo" ? theme.text : theme.textMuted,
          transition: "all 0.15s",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
        Base Photo
      </button>
      <button
        onClick={() => onToggle("graphic")}
        style={{
          padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: "pointer", border: "none", fontFamily: FONT.sans,
          display: "flex", alignItems: "center", gap: 6,
          background: activeLayer === "graphic" ? theme.card : "transparent",
          color: activeLayer === "graphic" ? theme.text : theme.textMuted,
          transition: "all 0.15s",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
        Graphic Overlay
      </button>
    </div>
  );
}

export type { Layer };
```

- [ ] **Step 2: Create EditWorkspace shell**

"use client" component. The main edit container that replaces the gallery.

```tsx
"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { Theme } from "../gallery/tokens";
import { FONT } from "../gallery/tokens";
import LayerToggle from "./LayerToggle";
import type { Layer } from "./LayerToggle";

interface EditWorkspaceProps {
  asset: GeneratedAsset;
  theme: Theme;
  onClose: () => void;
  onAssetUpdated: () => void;
}

export default function EditWorkspace({ asset, theme, onClose, onAssetUpdated }: EditWorkspaceProps) {
  const [activeLayer, setActiveLayer] = useState<Layer>("photo");
  const content = (asset.content || {}) as Record<string, any>;
  const platform = asset.platform || "unknown";

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px", borderBottom: `1px solid ${theme.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ color: theme.textMuted, cursor: "pointer", display: "flex", background: "none", border: "none" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT.sans }}>
              Editing: {content.overlay_headline || content.headline || "Creative"}
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>
              {content.actor_name || "Unknown"} · {content.pillar || "earn"} · {platform}
            </div>
          </div>
        </div>
        <LayerToggle activeLayer={activeLayer} onToggle={setActiveLayer} theme={theme} />
      </div>

      {/* Edit content — placeholder for now, will render QuickEditor or GraphicEditor */}
      <div style={{ padding: 24, minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: theme.textMuted }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            {activeLayer === "photo" ? "Photo Edit Mode" : "Graphic Overlay Mode"}
          </div>
          <div style={{ fontSize: 12 }}>
            {activeLayer === "photo"
              ? "Flux 2 quick edit, scene swap, or Seedream regeneration"
              : "Live text + style editing with instant preview"
            }
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "LayerToggle|EditWorkspace"
git add src/components/designer/edit/
git commit -m "feat(designer): add LayerToggle + EditWorkspace shell — amber/green dual-layer architecture"
```

---

## Task 2: QuickEditor with MaskCanvas (Flux 2)

**Files:**
- Create: `src/components/designer/edit/MaskCanvas.tsx`
- Create: `src/components/designer/edit/QuickEditor.tsx`

- [ ] **Step 1: Create MaskCanvas**

"use client" component. An HTML Canvas overlay that lets the designer draw a mask on the creative image.

**Props:**
```tsx
interface MaskCanvasProps {
  width: number;
  height: number;
  brushSize: number;
  isDrawing: boolean;
  onMaskGenerated: (maskDataUrl: string) => void;
}
```

The canvas is transparent by default. When the user draws (mouseDown → mouseMove → mouseUp), it paints semi-transparent pink circles (#E91E8C at 30% opacity) on the canvas. The `onMaskGenerated` callback extracts the canvas as a base64 PNG data URL.

Key methods:
- `handleMouseDown` → sets drawing flag, starts path
- `handleMouseMove` → if drawing, draw circle at cursor position
- `handleMouseUp` → stops drawing, calls `onMaskGenerated(canvas.toDataURL())`

Canvas styled with `position: absolute`, `inset: 0`, `cursor: crosshair`, `pointerEvents: all`.

Include a "Clear Mask" function that fills the canvas with transparent.

- [ ] **Step 2: Create QuickEditor**

"use client" component. The Flux 2 inline editor.

**Props:**
```tsx
interface QuickEditorProps {
  asset: GeneratedAsset;
  theme: Theme;
  onClose: () => void;
  onAccept: (newBlobUrl: string) => void;
}
```

**State:** `editPrompt`, `strength` (0-1, default 0.75), `brushSize` (10-100, default 40), `maskDataUrl`, `isProcessing`, `resultUrl`, `showingResult` (before/after toggle).

**Layout:** Split view — LEFT (60%): image + MaskCanvas overlay + brush hint. RIGHT (40%): quick actions grid (6 buttons: Clean BG, Fix Texture, Lighting, Outfit, Setting, Remove) + prompt textarea + brush/strength sliders + Apply button.

**Quick action buttons:** Each sets the prompt text to a preset (e.g., "Clean background — remove distracting elements while preserving the person"). Uses amber accent colors.

**Apply handler:** POST to `/api/revise` with:
```json
{
  "asset_id": "{asset.id}",
  "revision_type": "image",
  "prompt": "{editPrompt}",
  "mask_image": "{maskDataUrl}"
}
```

The existing `/api/revise` route handles Flux 2 / Seedream image edits. We reuse it.

**Result state:** After processing, show before/after toggle. Two buttons: "Try Again" (clears result) and "Accept" (calls `onAccept(resultUrl)`).

**Processing state:** Dim image to 40% opacity, show spinner + "Flux 2 is editing..." text.

**Apply button:** Amber (#f59e0b), full-width, with cost indicator "$0.03 · ~5s".

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep -E "MaskCanvas|QuickEditor"
git add src/components/designer/edit/MaskCanvas.tsx src/components/designer/edit/QuickEditor.tsx
git commit -m "feat(designer): add QuickEditor with MaskCanvas — Flux 2 inpainting with brush mask + quick actions"
```

---

## Task 3: RegenerateModal (Seedream 4.5)

**Files:**
- Create: `src/components/designer/edit/RegenerateModal.tsx`

- [ ] **Step 1: Create RegenerateModal**

"use client" component. Modal for Seedream 4.5 base image regeneration.

**Props:**
```tsx
interface RegenerateModalProps {
  asset: GeneratedAsset;
  theme: Theme;
  onClose: () => void;
  onRegenerated: () => void;
}
```

**State:** `changes` (Set<string> — which aspects to change), `direction` (free text), `isProcessing`, `jobId`, `resultUrl`, `polling`.

**Change options (checkboxes):**
- Scene / Setting
- Outfit / Wardrobe
- Expression / Emotion
- Background / Lighting
- Angle / Pose

**Layout:** Centered modal (600px wide), dark overlay. Title: "Regenerate Base Photo". Checkboxes + direction textarea + "Regenerate" button (amber).

**Submit handler:** POST to `/api/assets/[id]/regenerate` (new route) with `{ changes: [...], direction: "..." }`.

**For the initial implementation:** Since `/api/assets/[id]/regenerate` creates an async compute_job, use polling via `/api/compute/status/[jobId]` to check completion. For now, simply call the existing `/api/revise` with `revision_type: "image"` and a descriptive prompt built from the checkboxes:

```typescript
const promptParts = [];
if (changes.has("scene")) promptParts.push("Change the scene/setting");
if (changes.has("outfit")) promptParts.push("Change the outfit/wardrobe");
// ... etc
const fullPrompt = promptParts.join(". ") + ". " + direction;

// Call existing /api/revise
const res = await fetch("/api/revise", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    asset_id: asset.id,
    revision_type: "image",
    prompt: fullPrompt,
  }),
});
```

**Result:** Show side-by-side original vs new. "Use This" / "Try Again" / "Cancel".

**Processing state:** Spinner + "Seedream 4.5 is generating... ~30 seconds" + cost "$0.04".

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep RegenerateModal
git add src/components/designer/edit/RegenerateModal.tsx
git commit -m "feat(designer): add RegenerateModal — Seedream 4.5 regen with change checkboxes + direction"
```

---

## Task 4: GraphicEditor (Live Overlay)

**Files:**
- Create: `src/components/designer/edit/GraphicEditor.tsx`

- [ ] **Step 1: Create GraphicEditor**

"use client" component. Live HTML/CSS overlay editor — the daily driver tool.

**Props:**
```tsx
interface GraphicEditorProps {
  asset: GeneratedAsset;
  theme: Theme;
  onClose: () => void;
  onSaved: () => void;
}
```

**State:** `overlayHeadline`, `overlaySub`, `overlayCta` (from asset.content), `headlineSize` ("small"|"medium"|"large"), `ctaColor` (hex string), `textPosition` ("top"|"center"|"bottom"|"left-split"|"right-split"), `textColor` (hex), `isSaving`.

**Initialize from asset.content:**
```tsx
const content = (asset.content || {}) as Record<string, any>;
const [overlayHeadline, setOverlayHeadline] = useState(content.overlay_headline || content.headline || "");
const [overlaySub, setOverlaySub] = useState(content.overlay_sub || content.subheadline || "");
const [overlayCta, setOverlayCta] = useState(content.overlay_cta || content.cta || "");
```

**Layout:** Split view — LEFT (60%): creative preview showing the image with text overlay on top (updated live as fields change). Green "Live Preview" pulsing badge. RIGHT (40%): text fields (headline with word count, sub with char count, CTA) + style controls (headline size dropdown, CTA color swatches, text position dropdown, text color swatches) + "Save & Re-render" button (green).

**Live preview:** The left panel shows the `blob_url` image with the overlay text rendered on top using inline styles. As the user types, the preview updates (debounced 300ms).

**Save handler:** PATCH `/api/assets/[id]` with:
```json
{
  "content": {
    "overlay_headline": "...",
    "overlay_sub": "...",
    "overlay_cta": "...",
    "style_overrides": {
      "headline_size": "large",
      "cta_color": "#6D28D9",
      "text_position": "top",
      "text_color": "#FFFFFF"
    }
  },
  "rerender": true
}
```

The existing PATCH route updates content JSONB. The `rerender: true` flag is noted for future server-side Playwright re-render — for now, just save the content and the gallery shows the updated text on next load.

**CTA color swatches:** Pink (#E91E8C), Purple (#6D28D9), Green (#22c55e), Charcoal (#32373C), White (#FFFFFF).

**Text position options:** Top (default), Center, Bottom, Left split, Right split.

**"Save & Re-render" button:** Green (#22c55e), full-width, shows "Free · ~2s".

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep GraphicEditor
git add src/components/designer/edit/GraphicEditor.tsx
git commit -m "feat(designer): add GraphicEditor — live overlay text + style controls with instant preview"
```

---

## Task 5: EditHistory Dropdown

**Files:**
- Create: `src/components/designer/edit/EditHistory.tsx`

- [ ] **Step 1: Create EditHistory**

"use client" component. Shows edit history timeline with revert capability.

**Props:**
```tsx
interface EditHistoryProps {
  asset: GeneratedAsset;
  theme: Theme;
  onRevert: (blobUrl: string) => void;
}
```

**Extract history from asset.content.edit_history[]** — each entry has `timestamp`, `action`, `prompt`, `original_url`, `result_url`.

**Layout:** Small dropdown triggered by a "History" button. Shows vertical timeline:
- Current (green dot) — active version
- Edit 1 — "lighter bg" (gray dot) — click to preview, "Revert" button
- Original (gray dot) — click to revert to original

If no edit history, return null (don't render the button).

**Revert handler:** Calls `onRevert(selectedUrl)` which triggers PATCH to update blob_url.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | grep EditHistory
git add src/components/designer/edit/EditHistory.tsx
git commit -m "feat(designer): add EditHistory — timeline dropdown with revert capability"
```

---

## Task 6: Wire Edit System into Gallery

**Files:**
- Modify: `src/components/designer/gallery/DesignerGallery.tsx`
- Modify: `src/components/designer/gallery/VersionGroup.tsx`

- [ ] **Step 1: Add edit state to DesignerGallery**

In `DesignerGallery.tsx`, add state for editing:
```tsx
const [editingAsset, setEditingAsset] = useState<GeneratedAsset | null>(null);
```

Import `EditWorkspace` from `../edit/EditWorkspace`.

When `editingAsset` is set, render `EditWorkspace` INSTEAD of the version groups:
```tsx
{editingAsset ? (
  <EditWorkspace
    asset={editingAsset}
    theme={theme}
    onClose={() => setEditingAsset(null)}
    onAssetUpdated={() => { setEditingAsset(null); /* refresh data */ }}
  />
) : (
  /* existing version groups */
)}
```

- [ ] **Step 2: Wire action buttons in VersionGroup**

In `VersionGroup.tsx`, update the Edit (Zap) action button to call a new prop `onEditAsset`:

Add prop: `onEditAsset: (asset: GeneratedAsset) => void`

The Zap button on the version trigger: `onClick={(e) => { e.stopPropagation(); onEditAsset(version.assets[0]); }}` — opens the editor with the first asset in the version.

The Zap button on each FormatCard's hover overlay: opens the editor for that specific format.

Pass `onEditAsset={setEditingAsset}` from DesignerGallery to VersionGroup.

- [ ] **Step 3: Wire EditWorkspace to render the right editor based on layer**

Update `EditWorkspace.tsx` to import and render the actual editors:

```tsx
import QuickEditor from "./QuickEditor";
import GraphicEditor from "./GraphicEditor";
import RegenerateModal from "./RegenerateModal";

// In the render, replace the placeholder:
{activeLayer === "photo" ? (
  <QuickEditor
    asset={asset}
    theme={theme}
    onClose={onClose}
    onAccept={(newUrl) => { /* PATCH asset, refresh gallery */ }}
  />
) : (
  <GraphicEditor
    asset={asset}
    theme={theme}
    onClose={onClose}
    onSaved={onAssetUpdated}
  />
)}
```

- [ ] **Step 4: Verify TypeScript and tests**

```bash
npx tsc --noEmit 2>&1 | head -20
pnpm test 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/components/designer/gallery/DesignerGallery.tsx src/components/designer/gallery/VersionGroup.tsx src/components/designer/edit/EditWorkspace.tsx
git commit -m "feat(designer): wire edit system into gallery — layer toggle, QuickEditor, GraphicEditor, EditHistory"
```
