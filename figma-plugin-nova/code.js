"use strict";
// figma-plugin-nova/code.ts
// Show the UI panel
figma.showUI(__html__, { width: 320, height: 560, themeColors: true });
// ── Helpers ──────────────────────────────────────────────────
function findFrameByName(name) {
    var _a;
    const nodes = figma.currentPage.findAll((n) => n.name === name && n.type === "FRAME");
    return (_a = nodes[0]) !== null && _a !== void 0 ? _a : null;
}
function findAllNovaFrames() {
    return figma.currentPage.findAll((n) => n.type === "FRAME" && n.name.startsWith("Nova_"));
}
async function setImageFill(frame, imageBytes) {
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
figma.ui.onmessage = async (msg) => {
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
                console.warn("Unknown message type:", msg.type);
        }
    }
    catch (error) {
        figma.ui.postMessage({
            type: "error",
            message: error instanceof Error ? error.message : "Unknown error in plugin code",
        });
    }
};
// ── Create Frames (Import from Nova) ─────────────────────────
async function handleCreateFrames(msg) {
    const { frames, layout } = msg;
    let created = 0;
    let updated = 0;
    const errors = [];
    // Group frames by section → group for layout
    const sections = new Map();
    for (const f of frames) {
        const sec = f.sectionName || "Creatives";
        const grp = f.groupName || "V1";
        if (!sections.has(sec))
            sections.set(sec, new Map());
        const sectionMap = sections.get(sec);
        if (!sectionMap.has(grp))
            sectionMap.set(grp, []);
        sectionMap.get(grp).push(f);
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
                    }
                    else {
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
                }
                catch (e) {
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
    figma.notify(`${created > 0 ? `Created ${created}` : ""}${created > 0 && updated > 0 ? ", " : ""}${updated > 0 ? `Updated ${updated}` : ""} frames${errors.length > 0 ? ` (${errors.length} errors)` : ""}`);
}
// ── Update Single Frame ──────────────────────────────────────
async function handleUpdateFrame(msg) {
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
function handleReadSelection() {
    const selected = figma.currentPage.selection
        .filter((n) => n.type === "FRAME" && n.name.startsWith("Nova_"))
        .map((n) => ({ name: n.name, nodeId: n.id }));
    figma.ui.postMessage({ type: "selection-result", frames: selected });
}
// ── Export Frames as PNG ─────────────────────────────────────
async function handleExportFrames(msg) {
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
        }
        catch (e) {
            figma.ui.postMessage({
                type: "export-error",
                name,
                message: e instanceof Error ? e.message : "Export failed",
            });
        }
    }
}
// ── Read All Nova Frames ─────────────────────────────────────
function handleReadAllNovaFrames() {
    const frames = findAllNovaFrames().map((n) => ({
        name: n.name,
        nodeId: n.id,
        width: n.width,
        height: n.height,
    }));
    figma.ui.postMessage({ type: "nova-frames-list", frames });
}
