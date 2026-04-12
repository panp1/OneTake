"use client";

import { useState, useRef, useCallback } from "react";
import {
  Eraser,
  Sparkles,
  Sun,
  Shirt,
  MapPin,
  Ban,
  Loader2,
  ChevronRight,
  RotateCcw,
  X,
  Check,
  Paintbrush,
} from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { Theme } from "../gallery/tokens";
import { FONT, FIGMA_ICON } from "../gallery/tokens";
import MaskCanvas from "./MaskCanvas";
import type { MaskCanvasHandle } from "./MaskCanvas";

/* ── Quick action presets ─────────────────────────────────── */

const QUICK_ACTIONS = [
  {
    label: "Clean BG",
    icon: Eraser,
    prompt:
      "Clean up the background \u2014 remove distracting elements while preserving the person, their pose, and clothing exactly",
  },
  {
    label: "Fix Texture",
    icon: Sparkles,
    prompt:
      "Improve skin texture and remove any artifacts, blemishes, or AI artifacts while keeping the face and expression identical",
  },
  {
    label: "Lighting",
    icon: Sun,
    prompt:
      "Improve the lighting \u2014 make it more natural and professional while preserving all other elements exactly",
  },
  {
    label: "Outfit",
    icon: Shirt,
    prompt:
      "Adjust the outfit to look more professional and polished while keeping the person and pose identical",
  },
  {
    label: "Setting",
    icon: MapPin,
    prompt:
      "Improve the background setting \u2014 make it more contextually appropriate while preserving the person exactly",
  },
  {
    label: "Remove",
    icon: Ban,
    prompt:
      "Remove the selected area completely and fill with the surrounding background naturally",
  },
] as const;

/* ── Edit mode tabs (visual only for now) ─────────────────── */

type EditTab = "quick" | "regenerate" | "figma";

const EDIT_TABS: { id: EditTab; label: string }[] = [
  { id: "quick", label: "Quick Edit" },
  { id: "regenerate", label: "Regenerate" },
  { id: "figma", label: "Figma" },
];

/* ── Props ────────────────────────────────────────────────── */

interface QuickEditorProps {
  asset: GeneratedAsset;
  theme: Theme;
  onClose: () => void;
  onAccept: (newBlobUrl: string) => void;
}

/* ── Component ────────────────────────────────────────────── */

export default function QuickEditor({
  asset,
  theme,
  onClose,
  onAccept,
}: QuickEditorProps) {
  /* state */
  const [editPrompt, setEditPrompt] = useState("");
  const [strength, setStrength] = useState(0.75);
  const [brushSize, setBrushSize] = useState(40);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [showingResult, setShowingResult] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditTab>("quick");

  const maskRef = useRef<MaskCanvasHandle>(null);

  const imageUrl = asset.blob_url || "";

  /* ── handlers ───────────────────────────────────────────── */

  const handleMaskGenerated = useCallback((dataUrl: string) => {
    setMaskDataUrl(dataUrl);
  }, []);

  const handleQuickAction = useCallback((preset: string) => {
    setEditPrompt(preset);
  }, []);

  const handleClearMask = useCallback(() => {
    maskRef.current?.clear();
    setMaskDataUrl(null);
  }, []);

  const handleApply = useCallback(async () => {
    if (!editPrompt.trim()) return;
    setIsProcessing(true);

    try {
      const payload: Record<string, unknown> = {
        asset_id: asset.id,
        revision_type: "image",
        prompt: editPrompt,
      };
      if (maskDataUrl) {
        payload.mask_image = maskDataUrl;
      }

      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success && data.edited_url) {
        setResultUrl(data.edited_url);
        setShowingResult(true);
      } else if (data.success && data.status === "processing") {
        // Async — poll for result (simple approach: wait and retry)
        // For now, show a message that it's processing
        setResultUrl(null);
        setShowingResult(false);
      } else {
        console.error("[QuickEditor] Revision failed:", data);
      }
    } catch (err) {
      console.error("[QuickEditor] Error:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [asset.id, editPrompt, maskDataUrl]);

  const handleTryAgain = useCallback(() => {
    setResultUrl(null);
    setShowingResult(false);
    setEditPrompt("");
    handleClearMask();
  }, [handleClearMask]);

  const handleAccept = useCallback(() => {
    if (resultUrl) {
      onAccept(resultUrl);
    }
  }, [resultUrl, onAccept]);

  /* ── amber accent ───────────────────────────────────────── */
  const amber = "#f59e0b";
  const amberSoft = "rgba(245,158,11,0.12)";
  const panelBg = "#18181B";
  const panelCard = "#1F1F23";
  const panelBorder = "#2A2A2E";
  const panelText = "#E8E8EA";
  const panelMuted = "#8A8A8E";

  /* ── render ─────────────────────────────────────────────── */
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        minHeight: 520,
        background: panelBg,
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* ── LEFT: Canvas area ──────────────────────────────── */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111113",
          padding: 24,
          overflow: "hidden",
        }}
      >
        {/* Image + Mask container */}
        <div
          style={{
            position: "relative",
            maxWidth: "100%",
            maxHeight: "100%",
            lineHeight: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={showingResult && resultUrl ? resultUrl : imageUrl}
            alt="Editing"
            style={{
              maxWidth: "100%",
              maxHeight: 460,
              objectFit: "contain",
              borderRadius: 6,
              opacity: isProcessing ? 0.4 : 1,
              transition: "opacity 0.3s",
            }}
          />

          {/* Mask Canvas overlay — only when not showing result */}
          {!showingResult && !isProcessing && (
            <MaskCanvas
              ref={maskRef}
              width={1024}
              height={1024}
              brushSize={brushSize}
              onMaskGenerated={handleMaskGenerated}
            />
          )}

          {/* Processing spinner */}
          {isProcessing && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <Loader2
                size={32}
                color={amber}
                style={{ animation: "spin 1s linear infinite" }}
              />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: panelText,
                  fontFamily: FONT.sans,
                }}
              >
                Flux 2 is editing...
              </div>
            </div>
          )}
        </div>

        {/* Top-left badge */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: amberSoft,
            color: amber,
            fontSize: 10,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 6,
            fontFamily: FONT.sans,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Editing: Base Photo
        </div>

        {/* Before/After toggle — only after processing */}
        {resultUrl && !isProcessing && (
          <div style={{ position: "absolute", top: 16, right: 16 }}>
            <div
              style={{
                display: "flex",
                background: panelCard,
                borderRadius: 6,
                padding: 2,
                border: `1px solid ${panelBorder}`,
              }}
            >
              <button
                onClick={() => setShowingResult(false)}
                style={{
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: FONT.sans,
                  background: !showingResult ? amber : "transparent",
                  color: !showingResult ? "#000" : panelMuted,
                  transition: "all 0.15s",
                }}
              >
                Before
              </button>
              <button
                onClick={() => setShowingResult(true)}
                style={{
                  padding: "5px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: FONT.sans,
                  background: showingResult ? amber : "transparent",
                  color: showingResult ? "#000" : panelMuted,
                  transition: "all 0.15s",
                }}
              >
                After
              </button>
            </div>
          </div>
        )}

        {/* Drawing hint — only when no result */}
        {!resultUrl && !isProcessing && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0,0,0,0.6)",
              padding: "6px 14px",
              borderRadius: 20,
              backdropFilter: "blur(8px)",
            }}
          >
            <Paintbrush size={12} color={panelMuted} />
            <span
              style={{
                fontSize: 11,
                color: panelMuted,
                fontFamily: FONT.sans,
              }}
            >
              Draw on the area you want to change
            </span>
          </div>
        )}

        {/* Spin animation keyframes */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* ── RIGHT: Edit panel ──────────────────────────────── */}
      <div
        style={{
          background: panelBg,
          borderLeft: `1px solid ${panelBorder}`,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          overflowY: "auto",
        }}
      >
        {/* Edit mode tabs */}
        <div
          style={{
            display: "flex",
            gap: 2,
            background: panelCard,
            borderRadius: 8,
            padding: 3,
          }}
        >
          {EDIT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: "7px 0",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontFamily: FONT.sans,
                background: activeTab === tab.id ? panelBg : "transparent",
                color: activeTab === tab.id ? amber : panelMuted,
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              {tab.id === "figma" && (
                <span
                  dangerouslySetInnerHTML={{ __html: FIGMA_ICON }}
                  style={{ display: "inline-flex", opacity: 0.7 }}
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quick actions grid */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: panelMuted,
              marginBottom: 8,
              fontFamily: FONT.sans,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Quick Actions
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 6,
            }}
          >
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              const isHovered = hoveredAction === action.label;
              const isActive = editPrompt === action.prompt;
              return (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.prompt)}
                  onMouseEnter={() => setHoveredAction(action.label)}
                  onMouseLeave={() => setHoveredAction(null)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
                    padding: "10px 4px",
                    borderRadius: 8,
                    border: `1px solid ${isActive ? amber : isHovered ? panelBorder : "transparent"}`,
                    background: isActive
                      ? amberSoft
                      : isHovered
                        ? panelCard
                        : "transparent",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: FONT.sans,
                  }}
                >
                  <Icon
                    size={16}
                    color={isActive || isHovered ? amber : panelMuted}
                    style={{ transition: "color 0.15s" }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color:
                        isActive || isHovered ? panelText : panelMuted,
                      transition: "color 0.15s",
                    }}
                  >
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt textarea */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: panelMuted,
              marginBottom: 6,
              fontFamily: FONT.sans,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Describe the change
          </div>
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder="e.g. Make the background a warm coffee shop..."
            rows={3}
            style={{
              width: "100%",
              background: panelCard,
              border: `1px solid ${panelBorder}`,
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 12,
              color: panelText,
              fontFamily: FONT.sans,
              resize: "vertical",
              outline: "none",
              lineHeight: 1.5,
            }}
          />
          <div
            style={{
              fontSize: 10,
              color: panelMuted,
              marginTop: 4,
              fontStyle: "italic",
            }}
          >
            Gemma will refine your prompt
          </div>
        </div>

        {/* Sliders */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Brush size slider */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: panelMuted,
                  fontFamily: FONT.sans,
                }}
              >
                Brush Size
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: panelText,
                  fontFamily: FONT.mono,
                }}
              >
                {brushSize}px
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: amber,
                cursor: "pointer",
              }}
            />
          </div>

          {/* Strength slider */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: panelMuted,
                  fontFamily: FONT.sans,
                }}
              >
                Strength
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: panelText,
                  fontFamily: FONT.mono,
                }}
              >
                {Math.round(strength * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(strength * 100)}
              onChange={(e) => setStrength(Number(e.target.value) / 100)}
              style={{
                width: "100%",
                accentColor: amber,
                cursor: "pointer",
              }}
            />
          </div>
        </div>

        {/* Clear mask button (when mask has been drawn) */}
        {maskDataUrl && !resultUrl && (
          <button
            onClick={handleClearMask}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 0",
              fontSize: 11,
              fontWeight: 600,
              color: panelMuted,
              background: "transparent",
              border: `1px solid ${panelBorder}`,
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: FONT.sans,
              transition: "all 0.15s",
            }}
          >
            <RotateCcw size={12} />
            Clear Mask
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        {!resultUrl ? (
          /* Apply Edit button */
          <button
            onClick={handleApply}
            disabled={isProcessing || !editPrompt.trim()}
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 13,
              fontWeight: 700,
              color: "#000",
              background:
                isProcessing || !editPrompt.trim()
                  ? "rgba(245,158,11,0.3)"
                  : amber,
              border: "none",
              borderRadius: 10,
              cursor:
                isProcessing || !editPrompt.trim()
                  ? "not-allowed"
                  : "pointer",
              fontFamily: FONT.sans,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all 0.2s",
            }}
          >
            {isProcessing ? (
              <>
                <Loader2
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
                Processing...
              </>
            ) : (
              <>
                Apply Edit
                <ChevronRight size={14} />
              </>
            )}
          </button>
        ) : (
          /* Result action buttons */
          <div
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <button
              onClick={handleAccept}
              style={{
                width: "100%",
                padding: "12px 0",
                fontSize: 13,
                fontWeight: 700,
                color: "#fff",
                background: "#22c55e",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: FONT.sans,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
            >
              <Check size={14} />
              Accept &amp; Replace
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleTryAgain}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontSize: 12,
                  fontWeight: 600,
                  color: panelText,
                  background: panelCard,
                  border: `1px solid ${panelBorder}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: FONT.sans,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <RotateCcw size={12} />
                Try Again
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontSize: 12,
                  fontWeight: 600,
                  color: panelMuted,
                  background: "transparent",
                  border: `1px solid ${panelBorder}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontFamily: FONT.sans,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "all 0.15s",
                }}
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Cost indicator */}
        {!resultUrl && (
          <div
            style={{
              textAlign: "center",
              fontSize: 10,
              color: panelMuted,
              fontFamily: FONT.mono,
            }}
          >
            Flux 2 &middot; $0.03 &middot; ~5s
          </div>
        )}
      </div>
    </div>
  );
}
