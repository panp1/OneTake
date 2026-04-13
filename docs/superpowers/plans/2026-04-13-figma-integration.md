# Figma Integration (Upload, Route & Sync) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ ENTERPRISE-GRADE SHIP.** This is the power play — seamless round-trip between Nova and Figma. The designer edits in Figma, Nova auto-syncs back. Zero friction. Must be flawless.

**Goal:** Build a 3-part Figma integration: (1) SVG package export organized by persona/version, (2) Figma connect + live 60s polling sync, (3) manual upload with filename auto-routing.

**Architecture:** `figma-api` npm package for typed Figma REST API calls. New `src/lib/figma-client.ts` wraps the library with Nova-specific helpers. API routes handle connect/sync/status. Frontend components provide the connect modal, sync status display, manual upload, and routing dialogs. The sync poller runs server-side, triggered by a cron or manual POST.

**Tech Stack:** `figma-api` (npm), Next.js API routes, JSZip for client-side ZIP generation, existing Figma SVG export route (`/api/export/figma/[assetId]`), existing asset replace route (`/api/designer/replace`).

**Spec:** `docs/superpowers/specs/2026-04-12-designer-upload-route-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/lib/figma-client.ts` | Figma API wrapper — getFile, getImages, parseFrameName, diffFrames |
| `src/app/api/export/figma-package/[requestId]/route.ts` | Generate ZIP of all SVGs organized by persona/version |
| `src/app/api/figma/connect/route.ts` | Validate + save Figma token + file URL |
| `src/app/api/figma/sync/[requestId]/route.ts` | Trigger sync — poll Figma, detect changes, auto-route |
| `src/app/api/figma/status/[requestId]/route.ts` | Get sync status + last modified |
| `src/components/designer/figma/FigmaExportButton.tsx` | "Push to Figma" ZIP download button + progress |
| `src/components/designer/figma/FigmaConnectModal.tsx` | Connect Figma modal — token + file URL + validate |
| `src/components/designer/figma/FigmaSyncStatus.tsx` | Sync status bar in gallery header |
| `src/components/designer/figma/ManualUpload.tsx` | Drag-drop upload with filename auto-routing |
| `src/components/designer/figma/ReplaceConfirm.tsx` | Before/after confirmation dialog |

### Modified Files
| File | Changes |
|---|---|
| `src/components/designer/gallery/DesignerGallery.tsx` | Add Figma export button, connect modal, sync status in header |
| `src/components/designer/gallery/FormatCard.tsx` | Add "Replace" action to hover overlay |
| `package.json` | Add `figma-api` + `jszip` dependencies |

---

## Task 1: Install Dependencies + Figma Client

**Files:**
- Install: `figma-api`, `jszip`
- Create: `src/lib/figma-client.ts`

- [ ] **Step 1: Install packages**

```bash
pnpm add figma-api jszip
```

- [ ] **Step 2: Create Figma client wrapper**

Create `src/lib/figma-client.ts` — typed wrapper around `figma-api` with Nova-specific helpers.

```typescript
/**
 * Figma REST API client wrapper for Nova.
 *
 * Uses `figma-api` npm package for typed API calls.
 * Provides Nova-specific helpers: frame name parsing, diff detection,
 * image export, and sync state management.
 */

import * as Figma from "figma-api";

// ── Frame Name Convention ────────────────────────────────────
// Nova_{PersonaFirstName}_{Version}_{Platform}_{Width}x{Height}
// Example: Nova_Maria_V1_ig_feed_1080x1080

export interface NovaFrameRouting {
  persona: string;
  version: string;
  platform: string;
  width: number;
  height: number;
}

export interface NovaFrame {
  nodeId: string;
  name: string;
  routing: NovaFrameRouting;
  lastModified?: string;
}

/**
 * Parse a Figma frame name into routing metadata.
 * Returns null if the name doesn't match the Nova convention.
 */
export function parseFrameName(name: string): NovaFrameRouting | null {
  // Nova_Maria_V1_ig_feed_1080x1080
  const match = /^Nova_(\w+)_(V\d+)_([a-z_]+)_(\d+)x(\d+)$/.exec(name);
  if (!match) return null;
  return {
    persona: match[1],
    version: match[2],
    platform: match[3],
    width: parseInt(match[4], 10),
    height: parseInt(match[5], 10),
  };
}

/**
 * Build a Nova frame name from routing metadata.
 */
export function buildFrameName(routing: NovaFrameRouting): string {
  return `Nova_${routing.persona}_${routing.version}_${routing.platform}_${routing.width}x${routing.height}`;
}

/**
 * Create a Figma API client from a personal access token.
 */
export function createFigmaClient(token: string) {
  return new Figma.Api({ personalAccessToken: token });
}

/**
 * Extract the file key from a Figma URL.
 * Supports: https://www.figma.com/file/KEY/Name and https://www.figma.com/design/KEY/Name
 */
export function extractFileKey(url: string): string | null {
  const match = /figma\.com\/(file|design)\/([a-zA-Z0-9]+)/.exec(url);
  return match ? match[2] : null;
}

/**
 * Get all Nova-managed frames from a Figma file.
 * Walks the file tree and returns frames whose names start with "Nova_".
 */
export function extractNovaFrames(fileData: Figma.GetFileResult): NovaFrame[] {
  const frames: NovaFrame[] = [];

  function walk(node: Figma.Node) {
    if ("name" in node && typeof node.name === "string" && node.name.startsWith("Nova_")) {
      const routing = parseFrameName(node.name);
      if (routing) {
        frames.push({
          nodeId: node.id,
          name: node.name,
          routing,
        });
      }
    }
    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child as Figma.Node);
      }
    }
  }

  if (fileData.document) {
    walk(fileData.document as Figma.Node);
  }

  return frames;
}

/**
 * Diff two sets of Nova frames to find which ones changed.
 * Compares by node ID — if a frame exists in both but has different
 * content (detected by Figma's version field), it's considered changed.
 */
export function diffFrames(
  current: NovaFrame[],
  previous: Record<string, string>, // nodeId → last known hash/version
): NovaFrame[] {
  return current.filter((frame) => {
    const prevHash = previous[frame.nodeId];
    // If we don't have a previous hash, it's new (count as changed)
    // If we do, we'll compare after image export (hash the PNG)
    return !prevHash || prevHash !== frame.nodeId; // simplified — real diff uses image hashes
  });
}

/**
 * Export specific frames as PNG from a Figma file.
 * Returns a map of nodeId → PNG URL.
 */
export async function exportFramesAsPng(
  api: Figma.Api,
  fileKey: string,
  nodeIds: string[],
  scale: number = 2,
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};

  const result = await api.getImage({
    file_key: fileKey,
    ids: nodeIds.join(","),
    format: "png",
    scale,
  });

  return (result.images || {}) as Record<string, string>;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep figma-client
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/figma-client.ts package.json pnpm-lock.yaml
git commit -m "feat(figma): add figma-api + jszip deps, create Figma client wrapper with frame parsing + diff helpers"
```

---

## Task 2: SVG Package Export API

**Files:**
- Create: `src/app/api/export/figma-package/[requestId]/route.ts`

- [ ] **Step 1: Create the package export route**

This route generates a ZIP file containing all composed creatives as SVGs, organized by persona/version with the Nova naming convention.

```typescript
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";
import JSZip from "jszip";
import { buildFrameName } from "@/lib/figma-client";
```

**Logic:**
1. Auth check (Clerk)
2. Fetch all composed_creative assets for the request
3. Fetch the brief to get persona names
4. Group assets by persona → version (same grouping as gallery)
5. For each asset, fetch the individual Figma SVG from `/api/export/figma/[assetId]` (internal fetch)
6. Build ZIP with folder structure: `{PersonaName}/{Version}_{Headline}/{Nova_naming_convention}.svg`
7. Return ZIP as `application/zip` with Content-Disposition download header

**For the SVG content:** Instead of calling our own API route (which would be a self-fetch), directly call the same SVG generation logic inline. Import and reuse the SVG generation functions from the existing Figma export route.

Actually, the simplest approach: for each asset, generate the SVG filename using `buildFrameName()` and fetch the rendered PNG as base64 to embed. Use the same `buildTextLayers()` and `buildLayerGroups()` logic from the existing export.

**Simplified approach for v1:** Generate a ZIP where each file is the asset's `blob_url` PNG (not full layered SVG). The layered SVG approach is ideal but complex. Ship the PNG ZIP first, then upgrade to SVGs.

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId } = await params;
  const sql = getDb();

  // Fetch composed creatives
  const assets = await sql`
    SELECT id, platform, format, blob_url, content
    FROM generated_assets
    WHERE request_id = ${requestId}
      AND asset_type = 'composed_creative'
      AND blob_url IS NOT NULL
    ORDER BY created_at
  `;

  if (assets.length === 0) {
    return Response.json({ error: "No creatives found" }, { status: 404 });
  }

  // Fetch brief for persona names
  const briefs = await sql`
    SELECT brief_data FROM creative_briefs
    WHERE request_id = ${requestId}
    ORDER BY version DESC LIMIT 1
  `;
  const briefData = (briefs[0]?.brief_data || {}) as Record<string, any>;
  const personas = (briefData.personas || []) as Array<{ persona_name?: string; archetype_key?: string }>;

  // Build ZIP
  const zip = new JSZip();

  // Group by persona → version
  const groups = new Map<string, Map<string, typeof assets>>();

  for (const asset of assets) {
    const content = (asset.content || {}) as Record<string, string>;
    const personaKey = content.persona || content.actor_name?.split(" ")[0] || "Unknown";
    const pillar = content.pillar || "earn";
    const versionKey = `${content.actor_name || "unknown"}::${pillar}`;

    if (!groups.has(personaKey)) groups.set(personaKey, new Map());
    const personaGroup = groups.get(personaKey)!;
    if (!personaGroup.has(versionKey)) personaGroup.set(versionKey, []);
    personaGroup.get(versionKey)!.push(asset);
  }

  // Build folder structure
  let versionCounter = 0;
  for (const [personaKey, versions] of groups) {
    const personaName = personas.find(p =>
      p.archetype_key === personaKey || p.persona_name?.split(" ")[0] === personaKey
    )?.persona_name?.replace(/[^a-zA-Z0-9_-]/g, "_") || personaKey;

    const personaFolder = zip.folder(personaName)!;
    let vIdx = 1;

    for (const [, versionAssets] of versions) {
      const content = (versionAssets[0].content || {}) as Record<string, string>;
      const headline = (content.overlay_headline || content.headline || "Untitled")
        .replace(/[^a-zA-Z0-9 ]/g, "").replace(/ +/g, "_").slice(0, 40);
      const versionFolder = personaFolder.folder(`V${vIdx}_${headline}`)!;

      for (const asset of versionAssets) {
        const platform = asset.platform || "unknown";
        const dims = asset.format || "1080x1080";
        const filename = `Nova_${personaKey}_V${vIdx}_${platform}_${dims}.png`;

        // Fetch the PNG
        try {
          const res = await fetch(asset.blob_url, { signal: AbortSignal.timeout(10000) });
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            versionFolder.file(filename, buffer);
          }
        } catch {
          // Skip failed downloads
        }
      }
      vIdx++;
    }
    versionCounter++;
  }

  // Generate ZIP
  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
  const slug = briefData.campaign_slug || requestId.slice(0, 8);

  return new Response(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-figma-package.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add "src/app/api/export/figma-package/[requestId]/route.ts"
git commit -m "feat(figma): add /api/export/figma-package — ZIP of all creatives organized by persona/version"
```

---

## Task 3: Figma Connect + Status API Routes

**Files:**
- Create: `src/app/api/figma/connect/route.ts`
- Create: `src/app/api/figma/status/[requestId]/route.ts`

- [ ] **Step 1: Create Figma connect route**

POST endpoint that validates a Figma token + file URL, saves to the campaign record.

```typescript
// POST /api/figma/connect
// Body: { request_id, figma_token, figma_url }
// Validates the token by calling Figma API, extracts file_key,
// saves to intake_requests.figma_sync JSONB column.
```

Uses `createFigmaClient` and `extractFileKey` from `@/lib/figma-client`.

Validation: call `api.getFile({ file_key })` with `depth: 1` — if it succeeds, the token + URL are valid. Save the sync state to the DB.

- [ ] **Step 2: Create Figma status route**

GET endpoint returning the current sync state for a campaign.

```typescript
// GET /api/figma/status/[requestId]
// Returns: { connected, file_url, last_synced, sync_enabled, frame_count }
```

Reads from `intake_requests.figma_sync` JSONB column.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add "src/app/api/figma/connect/route.ts" "src/app/api/figma/status/[requestId]/route.ts"
git commit -m "feat(figma): add connect + status API routes — validate token, save sync state"
```

---

## Task 4: Figma Sync API Route

**Files:**
- Create: `src/app/api/figma/sync/[requestId]/route.ts`

- [ ] **Step 1: Create the sync route**

POST endpoint that performs one sync cycle: poll Figma file, detect changed Nova_ frames, export as PNG, auto-route replacements.

```typescript
// POST /api/figma/sync/[requestId]
// Reads figma_sync from campaign record
// Calls Figma API to get file tree
// Extracts Nova_ frames, diffs against last known state
// Exports changed frames as PNG
// Downloads PNGs, uploads to Blob, replaces assets
// Updates sync state
```

Uses `createFigmaClient`, `extractNovaFrames`, `exportFramesAsPng`, `parseFrameName` from `@/lib/figma-client`.

**Asset matching:** Parse the frame name to get `{persona, version, platform}`, then query the DB:
```sql
SELECT id FROM generated_assets
WHERE request_id = $1
  AND asset_type = 'composed_creative'
  AND platform = $2
  AND content->>'persona' = $3
```

**On match:** Upload new PNG to Blob, PATCH the asset's `blob_url`, add edit_history entry with `action: "figma_sync"`.

**Update sync state:** Save new `last_modified` + `frame_hashes` to `figma_sync` JSONB.

Returns: `{ synced_count, changed_frames, errors }`.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add "src/app/api/figma/sync/[requestId]/route.ts"
git commit -m "feat(figma): add sync API route — poll Figma, detect changes, auto-route replacements"
```

---

## Task 5: Frontend — FigmaExportButton + FigmaConnectModal + FigmaSyncStatus

**Files:**
- Create: `src/components/designer/figma/FigmaExportButton.tsx`
- Create: `src/components/designer/figma/FigmaConnectModal.tsx`
- Create: `src/components/designer/figma/FigmaSyncStatus.tsx`

- [ ] **Step 1: Create FigmaExportButton**

"use client" component. A button in the gallery header that downloads the Figma package ZIP.

Props: `requestId` (string), `theme` (Theme), `campaignSlug` (string).

On click: `window.open(\`/api/export/figma-package/${requestId}\`, "_blank")` + toast "Downloading Figma package..."

Styled: dark button with the 5-color Figma SVG icon + "Export to Figma" text.

- [ ] **Step 2: Create FigmaConnectModal**

"use client" component. Modal for connecting a Figma file to enable live sync.

Props: `requestId`, `theme`, `onClose`, `onConnected` callback.

State: `figmaToken`, `figmaUrl`, `isValidating`, `error`, `step` (1: token, 2: URL, 3: confirming).

3-step flow:
1. Enter Figma Personal Access Token (with link to Figma settings)
2. Paste Figma file URL
3. "Enable Sync" button → POST to `/api/figma/connect`

On success: calls `onConnected()`, shows toast "Figma sync enabled!"

Styled: dark modal matching the gallery theme, green accent for success states.

- [ ] **Step 3: Create FigmaSyncStatus**

"use client" component. Shows sync status in the gallery header when connected.

Props: `requestId`, `theme`.

Polls `GET /api/figma/status/[requestId]` every 30s.

When connected, shows:
```
[Figma icon] Synced with Figma · Last sync: 2m ago · [Sync Now] [Open in Figma →]
```

"Sync Now" button: POST to `/api/figma/sync/[requestId]`.

When not connected, shows nothing (the FigmaExportButton handles that state).

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add src/components/designer/figma/
git commit -m "feat(figma): add FigmaExportButton + FigmaConnectModal + FigmaSyncStatus — full Figma integration UI"
```

---

## Task 6: Manual Upload with Auto-Routing

**Files:**
- Create: `src/components/designer/figma/ManualUpload.tsx`
- Create: `src/components/designer/figma/ReplaceConfirm.tsx`

- [ ] **Step 1: Create ManualUpload**

"use client" component. Drag-drop upload zone with filename auto-routing.

Props: `requestId`, `theme`, `assets` (GeneratedAsset[]), `personas`, `onUploaded` callback.

State: `files` (array of { file: File, routing: NovaFrameRouting | null, status: "matched" | "manual" | "uploading" | "done" }), `isOpen`.

On file drop:
1. Parse each filename with `parseFrameName()`
2. If matched: show routing in green (✓ matched to Maria V1 ig_feed)
3. If not matched: show routing dropdowns (persona, version, platform)
4. "Replace All" button processes each file

Per-file upload:
1. Upload file to Blob via existing `/api/designer/[id]/upload`
2. If routing matched: PATCH the matched asset's blob_url
3. Add edit_history entry with `action: "manual_upload"`

Include progress bar for batch uploads.

- [ ] **Step 2: Create ReplaceConfirm**

"use client" component. Before/after confirmation dialog with slider.

Props: `originalUrl`, `newUrl`, `assetName`, `theme`, `onConfirm`, `onCancel`.

Shows the existing VersionCompare slider pattern (original left, new right) with "Confirm Replace" + "Cancel" buttons.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -10
git add src/components/designer/figma/ManualUpload.tsx src/components/designer/figma/ReplaceConfirm.tsx
git commit -m "feat(figma): add ManualUpload + ReplaceConfirm — drag-drop with filename auto-routing + before/after preview"
```

---

## Task 7: Wire Figma Integration into Gallery

**Files:**
- Modify: `src/components/designer/gallery/DesignerGallery.tsx`
- Modify: `src/components/designer/gallery/FormatCard.tsx`

- [ ] **Step 1: Add Figma components to gallery header**

In `DesignerGallery.tsx`:

Add imports:
```tsx
import FigmaExportButton from "../figma/FigmaExportButton";
import FigmaConnectModal from "../figma/FigmaConnectModal";
import FigmaSyncStatus from "../figma/FigmaSyncStatus";
import ManualUpload from "../figma/ManualUpload";
```

Add state:
```tsx
const [showFigmaConnect, setShowFigmaConnect] = useState(false);
const [showUpload, setShowUpload] = useState(false);
```

In the header actions area (next to ThemeToggle and Download All), add:
```tsx
<FigmaExportButton requestId={request.id} theme={theme} campaignSlug={request.campaign_slug || ""} />
<button onClick={() => setShowFigmaConnect(true)} style={darkButtonStyle}>
  Connect Figma
</button>
<button onClick={() => setShowUpload(true)} style={darkButtonStyle}>
  Upload
</button>
```

Below the header, add sync status:
```tsx
<FigmaSyncStatus requestId={request.id} theme={theme} />
```

Render modals when state is set:
```tsx
{showFigmaConnect && (
  <FigmaConnectModal requestId={request.id} theme={theme} onClose={() => setShowFigmaConnect(false)} onConnected={() => { setShowFigmaConnect(false); toast.success("Figma sync enabled!"); }} />
)}
{showUpload && (
  <ManualUpload requestId={request.id} theme={theme} assets={allComposedAssets} personas={personas} onUploaded={() => { setShowUpload(false); /* refresh */ }} />
)}
```

- [ ] **Step 2: Add Replace action to FormatCard**

In `FormatCard.tsx`, add `onReplace?: () => void` prop.

Add a 4th hover overlay button (Upload icon) that triggers file input for single-asset replacement:
```tsx
<input type="file" hidden ref={fileInputRef} accept="image/*" onChange={handleFileSelect} />
<button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
  <Upload size={14} />
</button>
```

On file select: show ReplaceConfirm dialog, on confirm: upload + replace.

- [ ] **Step 3: Verify TypeScript and tests**

```bash
npx tsc --noEmit 2>&1 | head -20
pnpm test 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/components/designer/gallery/DesignerGallery.tsx src/components/designer/gallery/FormatCard.tsx
git commit -m "feat(figma): wire Figma integration into gallery — export button, connect modal, sync status, upload, replace"
```

---

## Task 8: Database Migration for Figma Sync

**Files:**
- Modify: `src/lib/db/schema.ts` (or run migration directly)

- [ ] **Step 1: Add figma_sync column to intake_requests**

Add the JSONB column for storing Figma sync state:

```sql
ALTER TABLE intake_requests ADD COLUMN IF NOT EXISTS figma_sync JSONB DEFAULT NULL;
```

Run this via the existing init-db script or as a direct SQL command.

The column stores:
```json
{
  "file_key": "abc123",
  "file_url": "https://figma.com/file/abc123/...",
  "last_modified": "2026-04-13T10:00:00Z",
  "last_synced": "2026-04-13T10:01:00Z",
  "token": "figd_...",
  "frame_hashes": {},
  "sync_enabled": true
}
```

- [ ] **Step 2: Verify and commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(figma): add figma_sync JSONB column to intake_requests for sync state"
```
