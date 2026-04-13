# Nova Figma Plugin — Design Spec

**Date:** 2026-04-13
**Author:** Steven Junop + Claude
**Status:** Approved

## Overview

Internal Figma plugin that creates a seamless bidirectional bridge between Nova and Figma. The designer can pull creatives from Nova into Figma, push refined work back to Nova, and sync changes. The marketing team can push creatives to the designer's Figma file at 3 granularity levels (campaign, persona, or version).

**Not a published plugin** — loaded as a development plugin via `manifest.json`. No review process. Instant updates.

## Plugin Architecture

```
figma-plugin-nova/
├── manifest.json          # Plugin metadata + permissions
├── code.ts                # Figma sandbox — frame creation, image insertion, selection reading
├── ui.html                # Plugin UI iframe — Nova API calls, campaign browser
├── ui.ts                  # UI logic (bundled into ui.html)
├── tsconfig.json
└── package.json           # typescript + @figma/plugin-typings
```

**Two execution contexts:**
- `code.ts` — Figma sandbox. Access to `figma.*` API (create frames, set image fills, read selections). NO network access.
- `ui.html` — iframe with full network access. Calls Nova API. Communicates with `code.ts` via `window.parent.postMessage` / `figma.ui.onmessage`.

## Plugin UI

Dark panel matching Figma's native UI. ~300px wide.

```
┌─────────────────────────────┐
│ ◆ Nova Creative Studio      │
│ Connected · nova-intake...  │
├─────────────────────────────┤
│ Campaign: [Cutis Dermato ▾] │
├─────────────────────────────┤
│                             │
│  ┌─ PULL FROM NOVA ───────┐ │
│  │ Import all to canvas   │ │
│  │ 24 creatives · 3 pers  │ │
│  └────────────────────────┘ │
│                             │
│  ┌─ PUSH TO NOVA ─────────┐ │
│  │ Push selected frames   │ │
│  │ 0 frames selected      │ │
│  └────────────────────────┘ │
│                             │
│  ┌─ SYNC ─────────────────┐ │
│  │ Check for changes      │ │
│  │ Last sync: 5m ago      │ │
│  └────────────────────────┘ │
│                             │
├─────────────────────────────┤
│ ⚙ Settings                  │
│ Nova URL: nova-intake.ver.. │
│ Token: ••••••••             │
└─────────────────────────────┘
```

## Action 1: Pull from Nova (Import)

### What It Does
Fetches all creatives for a campaign from Nova and creates organized frames on the Figma canvas.

### Flow
```
Designer selects campaign from dropdown
  → Clicks "Import to Canvas"
  → UI fetches: GET /api/generate/{id}/images + GET /api/generate/{id}/brief
  → Groups assets by persona → version (same logic as gallery)
  → Sends image data to code.ts via postMessage
  → code.ts creates Figma structure:
     Section "Maria G." at y=0
       Frame group "V1 — Join Our Clinical Research Team" at y=0
         Frame "Nova_Maria_V1_ig_feed_1080x1080" at x=0
         Frame "Nova_Maria_V1_ig_story_1080x1920" at x=1140
         Frame "Nova_Maria_V1_ig_carousel_1080x1350" at x=2220
       Frame group "V2 — Shape the Future" at y=1200 (below V1)
     Section "Alex T." at y=3000 (below Maria's section)
  → Each frame filled with the creative PNG as image fill
  → Viewport scrolls to show the imported content
  → Toast in plugin: "Imported 24 creatives"
```

### Canvas Layout
- Personas stacked VERTICALLY — 200px gap between sections
- Versions stacked VERTICALLY within persona — 100px gap
- Formats arranged HORIZONTALLY — 60px gap
- Each frame at TRUE dimensions (1080x1080, 1080x1920, etc.)
- Section labels above each persona group
- Frame group labels above each version

### Frame Naming Convention
```
Nova_{PersonaFirstName}_{Version}_{Platform}_{Width}x{Height}
```
Examples: `Nova_Maria_V1_ig_feed_1080x1080`, `Nova_Alex_V2_linkedin_feed_1200x627`

### Handling Existing Frames
If frames with matching `Nova_` names already exist on the canvas:
- **Update mode:** Replace the image fill with the new version
- **Don't duplicate:** Skip creation, just update the fill
- Show count: "Updated 12 frames, created 12 new frames"

## Action 2: Push to Nova (Export from Figma)

### What It Does
Takes selected frames from the Figma canvas, exports as PNG, and sends back to Nova with auto-routing via frame name convention.

### Flow
```
Designer selects frames on canvas (or selects all Nova_ frames)
  → Opens plugin → clicks "Push Selected to Nova"
  → code.ts reads selection, filters for Nova_ prefixed frames
  → For each frame:
    a. Export as PNG bytes (figma.exportAsync)
    b. Parse frame name → routing metadata
    c. Send to UI via postMessage
  → UI uploads each PNG to Nova:
    POST /api/designer/replace with { asset_id, new_blob_url }
  → Progress: "Pushing 3 of 12..."
  → Complete: "12 creatives pushed to Nova"
```

### Selection Modes
- **Manual selection:** Designer selects specific frames → only those push
- **"Push All Nova Frames":** Button that finds ALL frames with `Nova_` prefix and pushes them
- **Persona filter:** "Push all Maria frames" (filters by persona in frame name)

## Action 3: Push FROM Nova Gallery (3 Granularity Levels)

### What It Does
From the Nova web gallery, the designer (or marketing team) can push creatives directly to the connected Figma file. Works at 3 levels.

### Granularity Levels

**Level 1: Campaign (header button)**
- "Push All to Figma" button in the gallery header
- Pushes ALL creatives for ALL personas
- Creates/updates the full Figma structure

**Level 2: Persona (persona tab)**
- "Push to Figma" button on the PersonaContextCard
- Pushes all versions for ONE persona
- Creates/updates only that persona's section in Figma

**Level 3: Version (accordion trigger)**
- "Push to Figma" button on the VersionGroup trigger bar
- Pushes all formats for ONE version
- Creates/updates only that version's frame group

### Technical Flow (Nova → Figma)

Since we can't create frames via the Figma REST API, this works as a **pending push** that the plugin picks up:

```
User clicks "Push to Figma" on V1 in Nova gallery
  → Nova API: POST /api/figma/push with:
    { request_id, scope: "version", persona: "Maria", version: "V1" }
  → API saves a pending_push entry in figma_sync JSONB:
    { pending_pushes: [{ scope, persona, version, timestamp }] }
  → If designer has plugin open, plugin polls and sees pending push
  → Plugin shows banner: "Nova pushed V1 for Maria — Import now?"
  → Designer clicks Import → plugin pulls just that version
  → Pending push cleared
```

**Alternative (simpler for v1):** The "Push to Figma" button in Nova does:
1. Downloads the creatives as the organized ZIP (existing route)
2. Opens the Figma file URL
3. Shows toast: "Package downloaded — import via Nova plugin in Figma"

The plugin's "Pull from Nova" then has a filter for what to pull (full campaign vs persona vs version).

### Nova Gallery UI Changes

Add "Push to Figma" buttons at 3 levels:

1. **Gallery header:** Next to existing "Export to Figma" button, add "Push to Figma" (only visible when Figma is connected)
2. **PersonaContextCard:** Small Figma icon button in the card header
3. **VersionGroup trigger:** Figma icon in the action buttons row (already has a slot — currently opens SVG export)

## Action 4: Sync (Bidirectional Check)

### What It Does
Compares the Figma canvas state against Nova's latest data. Shows what changed on each side.

### Flow
```
Designer clicks "Sync" in plugin
  → Plugin reads all Nova_ frames on canvas
  → Plugin calls Nova API to get latest asset versions
  → Compares:
    - Frames newer in Figma → "Push these to Nova?"
    - Assets newer in Nova → "Pull these to Figma?"
  → Shows diff:
    "2 frames updated locally (push?)"
    "1 creative updated in Nova (pull?)"
  → "Push Changes" / "Pull Updates" / "Sync All" buttons
```

### Change Detection
- **Figma side:** Track frame `lastModified` from Figma's node data
- **Nova side:** Track asset `updated_at` timestamp
- Compare timestamps — whichever is newer is the "truth"
- On conflict (both changed): show warning, let designer choose

## Plugin Setup (One-Time)

```
Designer opens Figma → Plugins → Development → Import from manifest
  → Points to figma-plugin-nova/manifest.json
  → Plugin appears in plugin menu
  → First open: settings panel
    → Enter Nova URL: https://nova-intake.vercel.app
    → Enter auth token (from Nova profile or magic link)
    → "Connect" → validates against GET /api/auth/me
    → "Connected ✓"
  → Settings saved in figma.clientStorage (persists across sessions)
```

## manifest.json

```json
{
  "name": "Nova Creative Studio",
  "id": "nova-creative-studio-internal",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "capabilities": [],
  "enableProposedApi": false,
  "editorType": ["figma"],
  "permissions": ["currentuser"],
  "networkAccess": {
    "allowedDomains": [
      "nova-intake.vercel.app",
      "centric-intake.vercel.app",
      "localhost",
      "*.vercel-storage.com",
      "*.public.blob.vercel-storage.com"
    ]
  }
}
```

## Message Protocol (code.ts ↔ ui.html)

### UI → Code Messages
| Type | Payload | Purpose |
|---|---|---|
| `create-frames` | `{ frames: [{ name, width, height, imageBytes }] }` | Create frames on canvas |
| `update-frame` | `{ name, imageBytes }` | Update existing frame's image fill |
| `read-selection` | `{}` | Get selected frame names |
| `export-frames` | `{ names: string[] }` | Export frames as PNG bytes |
| `read-all-nova-frames` | `{}` | Get all Nova_ frames on canvas |

### Code → UI Messages
| Type | Payload | Purpose |
|---|---|---|
| `frames-created` | `{ count, errors }` | Import complete |
| `frame-updated` | `{ name }` | Single frame updated |
| `selection-result` | `{ frames: [{ name, nodeId }] }` | Selected frames |
| `export-result` | `{ name, bytes: Uint8Array }` | Exported PNG data |
| `nova-frames-list` | `{ frames: [{ name, nodeId }] }` | All Nova_ frames |

## Nova API Routes Needed (New)

| Route | Method | Purpose |
|---|---|---|
| `/api/figma/push` | POST | Mark creatives as pending push (scope: campaign/persona/version) |

All other API routes already exist from the web-based Figma integration.

## Nova Gallery UI Changes

### New Component
| Component | Purpose |
|---|---|
| `src/components/designer/figma/PushToFigmaButton.tsx` | "Push to Figma" button with scope (campaign/persona/version) |

### Modified Components
| Component | Changes |
|---|---|
| `DesignerGallery.tsx` | Add campaign-level "Push to Figma" button in header |
| `PersonaContextCard.tsx` | Add persona-level Figma push icon button |
| `VersionGroup.tsx` | Wire existing Figma action button to push this version |

## Implementation Priority

| Phase | What | Effort |
|---|---|---|
| **Phase 1** | Plugin scaffold + Pull from Nova (import) | Medium — core value |
| **Phase 2** | Push to Nova (export selected) | Low — exports + API call |
| **Phase 3** | Push FROM Nova gallery (3 levels) + pending push API | Medium |
| **Phase 4** | Bidirectional sync with diff | Medium — comparison logic |

Phase 1 alone gives Miguel the ability to one-click import all creatives into Figma. That's the immediate wow factor.
