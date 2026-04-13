# Nova Figma Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠️ ENTERPRISE-GRADE. ZERO BUGS.** This is the plugin the designer loads in Figma. If it crashes, throws errors, or looks janky, we lose trust instantly. Every message handler must have error handling. Every API call must have timeouts. Every UI state must have a loading indicator.

**Goal:** Build an internal Figma plugin that imports Nova creatives into organized Figma frames, exports designer refinements back to Nova, and supports 3-level push from the Nova gallery.

**Architecture:** Plugin lives at `figma-plugin-nova/` in the repo root. `code.ts` handles Figma API (frame creation, image fills, exports). `ui.html` handles Nova API calls + UI. They communicate via typed `postMessage`. Nova-side adds a push API route + PushToFigmaButton component at 3 granularity levels.

**Tech Stack:** TypeScript, `@figma/plugin-typings`, inline HTML/CSS for UI (no build tool — Figma loads raw files), Nova API routes (Next.js).

**Spec:** `docs/superpowers/specs/2026-04-13-figma-plugin-design.md`

---

## File Structure

### Plugin Files (new directory at repo root)
| File | Responsibility |
|---|---|
| `figma-plugin-nova/manifest.json` | Plugin metadata, permissions, allowed domains |
| `figma-plugin-nova/code.ts` | Figma sandbox — frame creation, image fills, selection reading, PNG export |
| `figma-plugin-nova/code.js` | Compiled output (tsc compiles code.ts → code.js) |
| `figma-plugin-nova/ui.html` | Plugin UI — campaign browser, action buttons, Nova API calls, settings |
| `figma-plugin-nova/tsconfig.json` | TypeScript config for Figma plugin |
| `figma-plugin-nova/package.json` | Dependencies (@figma/plugin-typings) |

### Nova-Side Files (new + modified)
| File | Responsibility |
|---|---|
| `src/app/api/figma/push/route.ts` | NEW: POST — save pending push to figma_sync JSONB |
| `src/components/designer/figma/PushToFigmaButton.tsx` | NEW: Push button with scope (campaign/persona/version) |
| `src/components/designer/gallery/DesignerGallery.tsx` | MODIFY: Add campaign-level push button |
| `src/components/designer/gallery/PersonaContextCard.tsx` | MODIFY: Add persona-level push icon |
| `src/components/designer/gallery/VersionGroup.tsx` | MODIFY: Wire version-level push |

---

## Task 1: Plugin Scaffold (manifest + tsconfig + package.json)

**Files:**
- Create: `figma-plugin-nova/manifest.json`
- Create: `figma-plugin-nova/tsconfig.json`
- Create: `figma-plugin-nova/package.json`

- [ ] **Step 1: Create plugin directory and manifest**

```bash
mkdir -p figma-plugin-nova
```

Create `figma-plugin-nova/manifest.json`:
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

Create `figma-plugin-nova/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["ES2017"],
    "strict": true,
    "moduleResolution": "node",
    "module": "commonjs",
    "outDir": ".",
    "rootDir": ".",
    "typeRoots": ["./node_modules/@figma"]
  },
  "include": ["code.ts"]
}
```

Create `figma-plugin-nova/package.json`:
```json
{
  "name": "figma-plugin-nova",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.104.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Install plugin dependencies**

```bash
cd figma-plugin-nova && npm install && cd ..
```

- [ ] **Step 3: Commit**

```bash
git add figma-plugin-nova/
git commit -m "feat(figma-plugin): scaffold plugin — manifest.json, tsconfig, package.json"
```

---

## Task 2: Plugin Code (code.ts — Figma Sandbox)

**Files:**
- Create: `figma-plugin-nova/code.ts`

- [ ] **Step 1: Create code.ts**

This is the Figma sandbox script. It handles frame creation, image insertion, selection reading, and PNG export. It communicates with the UI via `figma.ui.postMessage` and `figma.ui.onmessage`.

```typescript
// figma-plugin-nova/code.ts

// Show the UI panel
figma.showUI(__html__, { width: 320, height: 560, themeColors: true });

// ── Message Types ────────────────────────────────────────────

interface CreateFramesMessage {
  type: "create-frames";
  frames: Array<{
    name: string;
    width: number;
    height: number;
    imageBytes: number[]; // Uint8Array serialized as number[]
    sectionName?: string;
    groupName?: string;
  }>;
  layout: {
    personaGap: number;   // 200
    versionGap: number;   // 100
    formatGap: number;    // 60
  };
}

interface UpdateFrameMessage {
  type: "update-frame";
  name: string;
  imageBytes: number[];
}

interface ReadSelectionMessage {
  type: "read-selection";
}

interface ExportFramesMessage {
  type: "export-frames";
  names: string[];
}

interface ReadAllNovaFramesMessage {
  type: "read-all-nova-frames";
}

type UIMessage =
  | CreateFramesMessage
  | UpdateFrameMessage
  | ReadSelectionMessage
  | ExportFramesMessage
  | ReadAllNovaFramesMessage;

// ── Helpers ──────────────────────────────────────────────────

function findFrameByName(name: string): FrameNode | null {
  const nodes = figma.currentPage.findAll((n) => n.name === name && n.type === "FRAME");
  return (nodes[0] as FrameNode) ?? null;
}

function findAllNovaFrames(): FrameNode[] {
  return figma.currentPage.findAll(
    (n) => n.type === "FRAME" && n.name.startsWith("Nova_")
  ) as FrameNode[];
}

async function setImageFill(frame: FrameNode, imageBytes: Uint8Array): Promise<void> {
  const image = figma.createImage(imageBytes);
  frame.fills = [
    {
      type: "IMAGE",
      imageHash: image.hash,
      scaleMode: "FILL",
    },
  ];
}

// ── Message Handler ──────────────────────────────────────────

figma.ui.onmessage = async (msg: UIMessage) => {
  try {
    switch (msg.type) {
      case "create-frames":
        await handleCreateFrames(msg);
        break;
      case "update-frame":
        await handleUpdateFrame(msg);
        break;
      case "read-selection":
        handleReadSelection();
        break;
      case "export-frames":
        await handleExportFrames(msg);
        break;
      case "read-all-nova-frames":
        handleReadAllNovaFrames();
        break;
      default:
        console.warn("Unknown message type:", (msg as any).type);
    }
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Unknown error in plugin code",
    });
  }
};

// ── Create Frames (Import from Nova) ─────────────────────────

async function handleCreateFrames(msg: CreateFramesMessage): Promise<void> {
  const { frames, layout } = msg;
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  // Group frames by section → group for layout
  const sections = new Map<string, Map<string, typeof frames>>();
  for (const f of frames) {
    const sec = f.sectionName || "Creatives";
    const grp = f.groupName || "V1";
    if (!sections.has(sec)) sections.set(sec, new Map());
    const sectionMap = sections.get(sec)!;
    if (!sectionMap.has(grp)) sectionMap.set(grp, []);
    sectionMap.get(grp)!.push(f);
  }

  let yOffset = 0;

  for (const [sectionName, groups] of sections) {
    // Create section label
    const sectionLabel = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    sectionLabel.characters = sectionName;
    sectionLabel.fontSize = 24;
    sectionLabel.x = 0;
    sectionLabel.y = yOffset;
    yOffset += 50;

    for (const [groupName, groupFrames] of groups) {
      // Create group label
      const groupLabel = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      groupLabel.characters = groupName;
      groupLabel.fontSize = 16;
      groupLabel.x = 0;
      groupLabel.y = yOffset;
      yOffset += 30;

      let xOffset = 0;
      let maxHeight = 0;

      for (const f of groupFrames) {
        try {
          const imageBytes = new Uint8Array(f.imageBytes);
          const existing = findFrameByName(f.name);

          if (existing) {
            // Update existing frame
            await setImageFill(existing, imageBytes);
            updated++;
          } else {
            // Create new frame
            const frame = figma.createFrame();
            frame.name = f.name;
            frame.resize(f.width, f.height);
            frame.x = xOffset;
            frame.y = yOffset;
            await setImageFill(frame, imageBytes);
            created++;
          }

          xOffset += f.width + layout.formatGap;
          maxHeight = Math.max(maxHeight, f.height);
        } catch (e) {
          errors.push(`${f.name}: ${e instanceof Error ? e.message : "failed"}`);
        }
      }

      yOffset += maxHeight + layout.versionGap;
    }

    yOffset += layout.personaGap;
  }

  // Scroll to show imported content
  const allNovaFrames = findAllNovaFrames();
  if (allNovaFrames.length > 0) {
    figma.viewport.scrollAndZoomIntoView(allNovaFrames);
  }

  figma.ui.postMessage({
    type: "frames-created",
    created,
    updated,
    errors,
  });

  figma.notify(
    `${created > 0 ? `Created ${created}` : ""}${created > 0 && updated > 0 ? ", " : ""}${updated > 0 ? `Updated ${updated}` : ""} frames${errors.length > 0 ? ` (${errors.length} errors)` : ""}`,
  );
}

// ── Update Single Frame ──────────────────────────────────────

async function handleUpdateFrame(msg: UpdateFrameMessage): Promise<void> {
  const frame = findFrameByName(msg.name);
  if (!frame) {
    figma.ui.postMessage({ type: "error", message: `Frame "${msg.name}" not found` });
    return;
  }
  const imageBytes = new Uint8Array(msg.imageBytes);
  await setImageFill(frame, imageBytes);
  figma.ui.postMessage({ type: "frame-updated", name: msg.name });
  figma.notify(`Updated: ${msg.name}`);
}

// ── Read Selection ───────────────────────────────────────────

function handleReadSelection(): void {
  const selected = figma.currentPage.selection
    .filter((n): n is FrameNode => n.type === "FRAME" && n.name.startsWith("Nova_"))
    .map((n) => ({ name: n.name, nodeId: n.id }));

  figma.ui.postMessage({ type: "selection-result", frames: selected });
}

// ── Export Frames as PNG ─────────────────────────────────────

async function handleExportFrames(msg: ExportFramesMessage): Promise<void> {
  for (const name of msg.names) {
    const frame = findFrameByName(name);
    if (!frame) {
      figma.ui.postMessage({
        type: "export-error",
        name,
        message: `Frame "${name}" not found`,
      });
      continue;
    }

    try {
      const bytes = await frame.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 2 },
      });
      figma.ui.postMessage({
        type: "export-result",
        name,
        bytes: Array.from(bytes), // Convert Uint8Array to number[] for postMessage
      });
    } catch (e) {
      figma.ui.postMessage({
        type: "export-error",
        name,
        message: e instanceof Error ? e.message : "Export failed",
      });
    }
  }
}

// ── Read All Nova Frames ─────────────────────────────────────

function handleReadAllNovaFrames(): void {
  const frames = findAllNovaFrames().map((n) => ({
    name: n.name,
    nodeId: n.id,
    width: n.width,
    height: n.height,
  }));
  figma.ui.postMessage({ type: "nova-frames-list", frames });
}
```

- [ ] **Step 2: Compile code.ts → code.js**

```bash
cd figma-plugin-nova && npx tsc && cd ..
```

Verify `figma-plugin-nova/code.js` was generated.

- [ ] **Step 3: Commit**

```bash
git add figma-plugin-nova/code.ts figma-plugin-nova/code.js
git commit -m "feat(figma-plugin): add code.ts — Figma sandbox with frame creation, image fills, selection export"
```

---

## Task 3: Plugin UI (ui.html)

**Files:**
- Create: `figma-plugin-nova/ui.html`

- [ ] **Step 1: Create ui.html**

Single-file HTML with embedded CSS + JavaScript. This runs as an iframe with full network access. It calls Nova's API and communicates with `code.ts` via `postMessage`.

The UI has:
- **Settings section** (collapsible): Nova URL + auth token inputs
- **Campaign dropdown**: fetches from `GET /api/intake`
- **Pull button**: imports creatives from Nova to Figma canvas
- **Push button**: exports selected frames back to Nova
- **Sync button**: checks for pending pushes from Nova
- **Status bar**: connection status + last sync time

Key behaviors:
- Settings saved to `parent.postMessage({ pluginMessage: { type: 'save-settings', ... } })` which `code.ts` stores in `figma.clientStorage`
- All Nova API calls use `fetch()` with the stored token as Bearer auth
- Image data passed to `code.ts` as `Array.from(new Uint8Array(buffer))` since `postMessage` can't transfer `Uint8Array` directly between contexts
- Campaign data cached after first fetch
- Pull groups assets by persona → version using the same `actor_name::pillar` logic
- Push reads frame names, parses with the `Nova_` convention regex, matches to assets

The HTML file should be ~400-500 lines with:
- Dark CSS matching Figma's native plugin UI (bg: #2c2c2c, text: #e0e0e0)
- Clean input styling, pill buttons, loading spinners
- Status messages with colored indicators (green=connected, amber=syncing, red=error)
- Progress bars for import/export operations

**CRITICAL:** All API calls must include error handling with user-visible error messages. No silent failures. Every network call has a timeout (10s for metadata, 30s for images).

This is a large file. The subagent should create the full production-ready HTML with all features functional.

- [ ] **Step 2: Commit**

```bash
git add figma-plugin-nova/ui.html
git commit -m "feat(figma-plugin): add ui.html — campaign browser, pull/push/sync actions, settings, dark UI"
```

---

## Task 4: Nova Push API Route

**Files:**
- Create: `src/app/api/figma/push/route.ts`

- [ ] **Step 1: Create the push route**

POST endpoint that saves a pending push to the campaign's `figma_sync` JSONB.

```typescript
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { request_id, scope, persona, version } = body;

  if (!request_id || !scope) {
    return Response.json({ error: "request_id and scope required" }, { status: 400 });
  }

  if (!["campaign", "persona", "version"].includes(scope)) {
    return Response.json({ error: "scope must be campaign, persona, or version" }, { status: 400 });
  }

  const sql = getDb();

  // Read current figma_sync state
  const rows = await sql`
    SELECT figma_sync FROM intake_requests WHERE id = ${request_id}
  `;

  if (rows.length === 0) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const currentSync = (rows[0].figma_sync || {}) as Record<string, any>;
  const pendingPushes = currentSync.pending_pushes || [];

  // Add new pending push
  pendingPushes.push({
    scope,
    persona: persona || null,
    version: version || null,
    timestamp: new Date().toISOString(),
    pushed_by: userId,
  });

  // Update figma_sync
  const updatedSync = { ...currentSync, pending_pushes: pendingPushes };

  await sql`
    UPDATE intake_requests
    SET figma_sync = ${JSON.stringify(updatedSync)}::jsonb
    WHERE id = ${request_id}
  `;

  return Response.json({
    success: true,
    pending_count: pendingPushes.length,
    push: { scope, persona, version },
  });
}

// GET — read pending pushes (for plugin polling)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestId = url.searchParams.get("request_id");
  if (!requestId) return Response.json({ error: "request_id required" }, { status: 400 });

  const sql = getDb();
  const rows = await sql`
    SELECT figma_sync FROM intake_requests WHERE id = ${requestId}
  `;

  if (rows.length === 0) return Response.json({ pending_pushes: [] });

  const sync = (rows[0].figma_sync || {}) as Record<string, any>;
  return Response.json({ pending_pushes: sync.pending_pushes || [] });
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add "src/app/api/figma/push/route.ts"
git commit -m "feat(figma): add push API route — save/read pending pushes for plugin polling"
```

---

## Task 5: PushToFigmaButton Component

**Files:**
- Create: `src/components/designer/figma/PushToFigmaButton.tsx`

- [ ] **Step 1: Create PushToFigmaButton**

"use client" component. Sends a push request to Nova at a specific scope level.

**Props:**
```tsx
interface PushToFigmaButtonProps {
  requestId: string;
  scope: "campaign" | "persona" | "version";
  persona?: string;
  version?: string;
  theme: Theme;
  compact?: boolean; // true = icon-only (for persona/version), false = full button (for header)
}
```

On click: POST to `/api/figma/push` with `{ request_id, scope, persona, version }`.

**Two visual modes:**
- `compact={false}` (header): Full pill button with Figma icon + "Push to Figma" text
- `compact={true}` (persona/version): 30px icon-only button with Figma SVG, tooltip on hover

Success: toast "Pushed to Figma — open the plugin to import"
Error: toast with error message

Import `Theme, FONT, FIGMA_ICON` from `../gallery/tokens`, `toast` from `sonner`.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add src/components/designer/figma/PushToFigmaButton.tsx
git commit -m "feat(figma): add PushToFigmaButton — 3-level push scope (campaign/persona/version)"
```

---

## Task 6: Wire Push Buttons into Gallery

**Files:**
- Modify: `src/components/designer/gallery/DesignerGallery.tsx`
- Modify: `src/components/designer/gallery/PersonaContextCard.tsx`
- Modify: `src/components/designer/gallery/VersionGroup.tsx`

- [ ] **Step 1: Add campaign-level push to gallery header**

In `DesignerGallery.tsx`, import `PushToFigmaButton` and add it to the header actions:
```tsx
<PushToFigmaButton
  requestId={request.id}
  scope="campaign"
  theme={theme}
/>
```

Place it next to the existing FigmaExportButton.

- [ ] **Step 2: Add persona-level push to PersonaContextCard**

In `PersonaContextCard.tsx`, add a new prop `requestId: string` and render a compact push button in the card header:
```tsx
<PushToFigmaButton
  requestId={requestId}
  scope="persona"
  persona={name}
  theme={theme}
  compact
/>
```

Update the prop interface and all call sites.

- [ ] **Step 3: Add version-level push to VersionGroup**

In `VersionGroup.tsx`, update the existing Figma action button (currently shows the Figma SVG) to also trigger a push:
```tsx
<PushToFigmaButton
  requestId={requestId}
  scope="version"
  persona={version.actorName.split(" ")[0]}
  version={version.versionLabel}
  theme={theme}
  compact
/>
```

Add `requestId: string` to the VersionGroup props.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit 2>&1 | head -20
pnpm test 2>&1 | tail -5
git add src/components/designer/gallery/DesignerGallery.tsx src/components/designer/gallery/PersonaContextCard.tsx src/components/designer/gallery/VersionGroup.tsx
git commit -m "feat(figma): wire push buttons into gallery at 3 levels — campaign header, persona card, version trigger"
```
