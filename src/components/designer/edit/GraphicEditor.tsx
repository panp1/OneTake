"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { GeneratedAsset } from "@/lib/types";
import type { Theme } from "../gallery/tokens";
import { FONT } from "../gallery/tokens";

/* ── Constants ──────────────────────────────────────────────── */

type HeadlineSize = "small" | "medium" | "large";
type TextPosition = "top" | "center" | "bottom";

const HEADLINE_SIZES: Record<HeadlineSize, { label: string; px: number }> = {
  small: { label: "Small (48px)", px: 48 },
  medium: { label: "Medium (60px)", px: 60 },
  large: { label: "Large (72px)", px: 72 },
};

const TEXT_POSITIONS: Record<TextPosition, { label: string; top: string }> = {
  top: { label: "Top", top: "15%" },
  center: { label: "Center", top: "40%" },
  bottom: { label: "Bottom", top: "70%" },
};

const CTA_COLORS = [
  { hex: "#E91E8C", label: "Pink" },
  { hex: "#6D28D9", label: "Purple" },
  { hex: "#22c55e", label: "Green" },
  { hex: "#32373C", label: "Charcoal" },
  { hex: "#FFFFFF", label: "White" },
] as const;

const TEXT_COLORS = [
  { hex: "#FFFFFF", label: "White" },
  { hex: "#1A1A1A", label: "Dark" },
  { hex: "#E8E8EA", label: "Muted" },
] as const;

/* ── Helpers ────────────────────────────────────────────────── */

function wordCount(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/* ── Props ──────────────────────────────────────────────────── */

interface GraphicEditorProps {
  asset: GeneratedAsset;
  theme: Theme;
  onClose: () => void;
  onSaved: () => void;
}

/* ── Component ──────────────────────────────────────────────── */

export default function GraphicEditor({
  asset,
  theme,
  onClose,
  onSaved,
}: GraphicEditorProps) {
  const content = (asset.content || {}) as Record<string, unknown>;
  const existingOverrides = (content.style_overrides || {}) as Record<string, unknown>;

  /* text state */
  const [overlayHeadline, setOverlayHeadline] = useState(
    (content.overlay_headline as string) || (content.headline as string) || ""
  );
  const [overlaySub, setOverlaySub] = useState(
    (content.overlay_sub as string) || (content.subheadline as string) || ""
  );
  const [overlayCta, setOverlayCta] = useState(
    (content.overlay_cta as string) || (content.cta as string) || ""
  );

  /* style state */
  const [headlineSize, setHeadlineSize] = useState<HeadlineSize>(
    (existingOverrides.headline_size as HeadlineSize) || "medium"
  );
  const [ctaColor, setCtaColor] = useState(
    (existingOverrides.cta_color as string) || "#E91E8C"
  );
  const [textPosition, setTextPosition] = useState<TextPosition>(
    (existingOverrides.text_position as TextPosition) || "top"
  );
  const [textColor, setTextColor] = useState(
    (existingOverrides.text_color as string) || "#FFFFFF"
  );

  const [isSaving, setIsSaving] = useState(false);

  const imageUrl = asset.blob_url || "";

  /* ── computed values ───────────────────────────────────────── */
  const headlinePx = HEADLINE_SIZES[headlineSize].px;
  const subPx = Math.round(headlinePx * 0.6);
  const posTop = TEXT_POSITIONS[textPosition].top;
  const headlineWords = wordCount(overlayHeadline);
  const subChars = overlaySub.length;
  const ctaWords = wordCount(overlayCta);

  /* ── dark panel tokens (matches QuickEditor) ───────────────── */
  const panelBg = "#18181B";
  const panelCard = "#1F1F23";
  const panelBorder = "#2A2A2E";
  const panelText = "#E8E8EA";
  const panelMuted = "#8A8A8E";
  const green = "#22c55e";
  const greenSoft = "rgba(34,197,94,0.12)";

  /* ── save handler ──────────────────────────────────────────── */

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: {
            ...content,
            overlay_headline: overlayHeadline,
            overlay_sub: overlaySub,
            overlay_cta: overlayCta,
            style_overrides: {
              headline_size: headlineSize,
              cta_color: ctaColor,
              text_position: textPosition,
              text_color: textColor,
            },
          },
        }),
      });
      if (res.ok) {
        toast.success("Overlay saved \u2014 re-rendering...");
        onSaved();
      } else {
        toast.error("Failed to save overlay changes");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  /* ── shared input styles ───────────────────────────────────── */

  const inputBase: React.CSSProperties = {
    width: "100%",
    background: panelCard,
    border: `1px solid ${panelBorder}`,
    borderRadius: 8,
    color: panelText,
    fontSize: 13,
    padding: "10px 12px",
    fontFamily: FONT.sans,
    outline: "none",
    transition: "border-color 0.15s",
  };

  const selectBase: React.CSSProperties = {
    ...inputBase,
    WebkitAppearance: "none",
    MozAppearance: "none",
    appearance: "none",
    cursor: "pointer",
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238A8A8E' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 32,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: panelMuted,
    fontFamily: FONT.sans,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const sectionLabel: React.CSSProperties = {
    ...labelStyle,
    marginBottom: 10,
    fontSize: 12,
  };

  /* ── render ────────────────────────────────────────────────── */

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
      {/* ── LEFT: Live Preview Canvas ──────────────────────── */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0C",
          padding: 24,
          overflow: "hidden",
        }}
      >
        {/* Image + overlay container */}
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
            src={imageUrl}
            alt="Creative preview"
            style={{
              maxWidth: "100%",
              maxHeight: 460,
              objectFit: "contain",
              borderRadius: 6,
              display: "block",
            }}
          />

          {/* Text overlay — rendered ON TOP of the image */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingTop: posTop,
              pointerEvents: "none",
              transition: "padding-top 0.3s ease",
            }}
          >
            {/* Headline */}
            {overlayHeadline && (
              <div
                style={{
                  fontSize: headlinePx * 0.72,
                  fontWeight: 800,
                  color: textColor,
                  fontFamily: FONT.sans,
                  textAlign: "center",
                  lineHeight: 1.1,
                  maxWidth: "85%",
                  textShadow: "0 2px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4)",
                  wordBreak: "break-word",
                }}
              >
                {overlayHeadline}
              </div>
            )}

            {/* Subheadline */}
            {overlaySub && (
              <div
                style={{
                  fontSize: subPx * 0.72,
                  fontWeight: 500,
                  color: textColor,
                  fontFamily: FONT.sans,
                  textAlign: "center",
                  lineHeight: 1.3,
                  maxWidth: "75%",
                  opacity: 0.85,
                  marginTop: 8,
                  textShadow: "0 1px 8px rgba(0,0,0,0.5)",
                  wordBreak: "break-word",
                }}
              >
                {overlaySub}
              </div>
            )}

            {/* CTA pill */}
            {overlayCta && (
              <div
                style={{
                  marginTop: 16,
                  background: ctaColor,
                  color: ctaColor === "#FFFFFF" ? "#1A1A1A" : "#FFFFFF",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: FONT.sans,
                  padding: "10px 28px",
                  borderRadius: 9999,
                  textShadow: ctaColor === "#FFFFFF" ? "none" : "0 1px 2px rgba(0,0,0,0.2)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                }}
              >
                {overlayCta}
              </div>
            )}
          </div>
        </div>

        {/* Top-left badge: EDITING: GRAPHIC OVERLAY */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: greenSoft,
            color: green,
            fontSize: 10,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 6,
            fontFamily: FONT.sans,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Editing: Graphic Overlay
        </div>

        {/* Top-right badge: Live Preview (pulsing) */}
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(0,0,0,0.5)",
            padding: "5px 12px",
            borderRadius: 20,
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            className="graphic-editor-pulse"
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: green,
              display: "block",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: green,
              fontFamily: FONT.sans,
              letterSpacing: "0.03em",
            }}
          >
            Live Preview
          </span>
        </div>

        {/* Pulse + spin animations */}
        <style>{`
          @keyframes graphic-editor-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.85); }
          }
          .graphic-editor-pulse {
            animation: graphic-editor-pulse 2s ease-in-out infinite;
          }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>

      {/* ── RIGHT: Edit Panel ──────────────────────────────── */}
      <div
        style={{
          background: panelBg,
          borderLeft: `1px solid ${panelBorder}`,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          overflowY: "auto",
        }}
      >
        {/* ── Section 1: Overlay Text ─────────────────────── */}
        <div>
          <div style={sectionLabel}>Overlay Text</div>

          {/* Headline input */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={labelStyle}>Headline</span>
              <span
                style={{
                  fontSize: 10,
                  color: headlineWords > 7 ? "#ef4444" : panelMuted,
                  fontFamily: FONT.mono,
                  transition: "color 0.15s",
                }}
              >
                {headlineWords}/7 words
              </span>
            </div>
            <input
              type="text"
              value={overlayHeadline}
              onChange={(e) => setOverlayHeadline(e.target.value)}
              placeholder="Enter headline..."
              style={{
                ...inputBase,
                fontSize: 16,
                fontWeight: 700,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = green;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = panelBorder;
              }}
            />
          </div>

          {/* Subheadline input */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={labelStyle}>Subheadline</span>
              <span
                style={{
                  fontSize: 10,
                  color: subChars > 60 ? "#ef4444" : panelMuted,
                  fontFamily: FONT.mono,
                  transition: "color 0.15s",
                }}
              >
                {subChars}/60 chars
              </span>
            </div>
            <input
              type="text"
              value={overlaySub}
              onChange={(e) => setOverlaySub(e.target.value)}
              placeholder="Enter subheadline..."
              style={inputBase}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = green;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = panelBorder;
              }}
            />
          </div>

          {/* CTA input */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={labelStyle}>CTA</span>
              <span
                style={{
                  fontSize: 10,
                  color: ctaWords > 4 ? "#ef4444" : panelMuted,
                  fontFamily: FONT.mono,
                  transition: "color 0.15s",
                }}
              >
                {ctaWords}/4 words
              </span>
            </div>
            <input
              type="text"
              value={overlayCta}
              onChange={(e) => setOverlayCta(e.target.value)}
              placeholder="e.g. Apply Now"
              style={inputBase}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = green;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = panelBorder;
              }}
            />
          </div>
        </div>

        {/* ── Section 2: Style ────────────────────────────── */}
        <div>
          <div style={sectionLabel}>Style</div>

          {/* Headline Size dropdown */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Headline Size</div>
            <select
              value={headlineSize}
              onChange={(e) => setHeadlineSize(e.target.value as HeadlineSize)}
              style={selectBase}
            >
              {(Object.keys(HEADLINE_SIZES) as HeadlineSize[]).map((size) => (
                <option key={size} value={size}>
                  {HEADLINE_SIZES[size].label}
                </option>
              ))}
            </select>
          </div>

          {/* CTA Color swatches */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>CTA Color</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {CTA_COLORS.map((c) => (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => setCtaColor(c.hex)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: c.hex,
                    cursor: "pointer",
                    border:
                      ctaColor === c.hex
                        ? "2px solid #FFFFFF"
                        : c.hex === "#FFFFFF"
                          ? `2px solid ${panelBorder}`
                          : "2px solid transparent",
                    boxShadow:
                      ctaColor === c.hex
                        ? "0 0 0 2px rgba(34,197,94,0.5)"
                        : "none",
                    transition: "all 0.15s",
                    padding: 0,
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Text Position dropdown */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...labelStyle, marginBottom: 6 }}>Text Position</div>
            <select
              value={textPosition}
              onChange={(e) => setTextPosition(e.target.value as TextPosition)}
              style={selectBase}
            >
              {(Object.keys(TEXT_POSITIONS) as TextPosition[]).map((pos) => (
                <option key={pos} value={pos}>
                  {TEXT_POSITIONS[pos].label}
                </option>
              ))}
            </select>
          </div>

          {/* Text Color swatches */}
          <div>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Text Color</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {TEXT_COLORS.map((c) => {
                const isActive = textColor === c.hex;
                const borderColor =
                  c.hex === "#FFFFFF"
                    ? isActive
                      ? green
                      : panelBorder
                    : isActive
                      ? c.hex
                      : "transparent";
                return (
                  <button
                    key={c.hex}
                    title={c.label}
                    onClick={() => setTextColor(c.hex)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: c.hex,
                      cursor: "pointer",
                      border: `2px solid ${borderColor}`,
                      boxShadow: isActive
                        ? `0 0 0 2px rgba(34,197,94,0.4)`
                        : "none",
                      transition: "all 0.15s",
                      padding: 0,
                      flexShrink: 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── Section 3: Save & Re-render ─────────────────── */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            width: "100%",
            padding: "14px 0",
            fontSize: 14,
            fontWeight: 700,
            color: "#FFFFFF",
            background: isSaving ? "rgba(34,197,94,0.4)" : green,
            border: "none",
            borderRadius: 8,
            cursor: isSaving ? "not-allowed" : "pointer",
            fontFamily: FONT.sans,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s",
          }}
        >
          {isSaving ? (
            <>
              <Loader2
                size={15}
                style={{ animation: "spin 1s linear infinite" }}
              />
              Saving...
            </>
          ) : (
            <>
              <Check size={15} />
              Save &amp; Re-render
            </>
          )}
        </button>

        {/* Cost indicator */}
        <div
          style={{
            textAlign: "center",
            fontSize: 10,
            color: panelMuted,
            fontFamily: FONT.mono,
            marginTop: -12,
          }}
        >
          Free &middot; ~2s
        </div>
      </div>
    </div>
  );
}
