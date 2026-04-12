"use client";

import { useState, useEffect, useCallback } from "react";
import { X, RefreshCw, Loader2, Check } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { Theme } from "../gallery/tokens";
import { FONT } from "../gallery/tokens";

/* ── Change option definitions ────────────────────────────── */

const CHANGE_OPTIONS = [
  { key: "scene", label: "Scene / Setting" },
  { key: "outfit", label: "Outfit / Wardrobe" },
  { key: "expression", label: "Expression / Emotion" },
  { key: "background", label: "Background / Lighting" },
  { key: "angle", label: "Angle / Pose" },
] as const;

/* ── Props ────────────────────────────────────────────────── */

interface RegenerateModalProps {
  asset: GeneratedAsset;
  theme: Theme;
  onClose: () => void;
  onRegenerated: () => void;
}

/* ── Component ────────────────────────────────────────────── */

export default function RegenerateModal({
  asset,
  theme,
  onClose,
  onRegenerated,
}: RegenerateModalProps) {
  /* state */
  const [changes, setChanges] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imageUrl = asset.blob_url || "";

  /* amber accent */
  const amber = "#f59e0b";
  const amberSoft = "rgba(245,158,11,0.12)";

  /* ── Escape key closes modal ───────────────────────────── */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  /* ── Checkbox toggle ───────────────────────────────────── */

  const toggleChange = useCallback((key: string) => {
    setChanges((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  /* ── Submit handler ────────────────────────────────────── */

  const handleRegenerate = useCallback(async () => {
    if (changes.size === 0 && !direction.trim()) return;
    setIsProcessing(true);
    setError(null);

    try {
      const promptParts: string[] = [];
      if (changes.has("scene")) promptParts.push("Change the scene/setting to something different");
      if (changes.has("outfit")) promptParts.push("Change the outfit/wardrobe");
      if (changes.has("expression")) promptParts.push("Change the expression/emotion");
      if (changes.has("background")) promptParts.push("Change the background/lighting");
      if (changes.has("angle")) promptParts.push("Change the angle/pose");
      const fullPrompt =
        promptParts.join(". ") +
        (direction ? ". " + direction : "") +
        ". Preserve the person's face and identity exactly.";

      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: asset.id,
          revision_type: "image",
          prompt: fullPrompt,
        }),
      });

      const data = await res.json();

      if (data.success && data.edited_url) {
        setResultUrl(data.edited_url);
      } else if (data.success && data.status === "processing") {
        // Async job — for now show a hint
        setResultUrl(null);
        setError("Generation queued. Check back shortly.");
      } else {
        setError(data.error || "Regeneration failed. Try again.");
      }
    } catch (err) {
      console.error("[RegenerateModal] Error:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [asset.id, changes, direction]);

  /* ── Use This handler ──────────────────────────────────── */

  const handleUseThis = useCallback(() => {
    onRegenerated();
  }, [onRegenerated]);

  /* ── Try Again handler ─────────────────────────────────── */

  const handleTryAgain = useCallback(() => {
    setResultUrl(null);
    setError(null);
  }, []);

  /* ── Overlay click closes modal ────────────────────────── */

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  /* ── render ─────────────────────────────────────────────── */

  const canSubmit = (changes.size > 0 || direction.trim().length > 0) && !isProcessing;

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT.sans,
      }}
    >
      <div
        style={{
          width: 600,
          maxWidth: "calc(100vw - 40px)",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          background: theme.card,
          borderRadius: 14,
          border: `1px solid ${theme.border}`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <RefreshCw size={16} color={amber} />
            <span style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>
              Regenerate Base Photo
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: theme.textMuted,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              borderRadius: 6,
              transition: "color 0.15s",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div style={{ padding: 20 }}>
          {/* ── Result state: side-by-side ────────────────── */}
          {resultUrl ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                {/* Original */}
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: theme.textMuted,
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Original
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Original"
                    style={{
                      width: "100%",
                      height: 250,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: `1px solid ${theme.border}`,
                    }}
                  />
                </div>
                {/* New */}
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: amber,
                      marginBottom: 8,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    New
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resultUrl}
                    alt="Regenerated"
                    style={{
                      width: "100%",
                      height: 250,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: `1px solid ${amber}`,
                    }}
                  />
                </div>
              </div>

              {/* Result action buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleUseThis}
                  style={{
                    flex: 1,
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
                  Use This
                </button>
                <button
                  onClick={handleTryAgain}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    fontSize: 13,
                    fontWeight: 700,
                    color: theme.text,
                    background: theme.surface,
                    border: `1px solid ${theme.border}`,
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
                  <RefreshCw size={14} />
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  style={{
                    padding: "12px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: theme.textMuted,
                    background: "transparent",
                    border: `1px solid ${theme.border}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    fontFamily: FONT.sans,
                    transition: "all 0.15s",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── Input state: checkboxes + direction ──────── */
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Processing overlay */}
              {isProcessing && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px 0",
                    gap: 14,
                  }}
                >
                  <Loader2
                    size={32}
                    color={amber}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: theme.text,
                    }}
                  >
                    Seedream 4.5 is generating...
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: theme.textMuted,
                    }}
                  >
                    This usually takes about 30 seconds
                  </div>
                  <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {/* Checkboxes — hidden during processing */}
              {!isProcessing && (
                <>
                  {/* What should change? */}
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: theme.text,
                        marginBottom: 12,
                      }}
                    >
                      What should change?
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {CHANGE_OPTIONS.map((option) => {
                        const isChecked = changes.has(option.key);
                        return (
                          <label
                            key={option.key}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              cursor: "pointer",
                              padding: "8px 12px",
                              borderRadius: 8,
                              background: isChecked ? amberSoft : "transparent",
                              border: `1px solid ${isChecked ? amber : theme.border}`,
                              transition: "all 0.15s",
                            }}
                          >
                            {/* Custom checkbox */}
                            <div
                              onClick={(e) => {
                                e.preventDefault();
                                toggleChange(option.key);
                              }}
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 4,
                                border: `1px solid ${isChecked ? amber : theme.border}`,
                                background: isChecked ? amber : "transparent",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              {isChecked && <Check size={12} color="#fff" strokeWidth={3} />}
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleChange(option.key)}
                              style={{ display: "none" }}
                            />
                            <span
                              style={{
                                fontSize: 13,
                                color: theme.text,
                                fontWeight: isChecked ? 600 : 400,
                              }}
                            >
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Direction textarea */}
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: theme.text,
                        marginBottom: 8,
                      }}
                    >
                      Additional direction{" "}
                      <span style={{ fontWeight: 400, color: theme.textMuted }}>
                        (optional)
                      </span>
                    </div>
                    <textarea
                      value={direction}
                      onChange={(e) => setDirection(e.target.value)}
                      placeholder="e.g. Use a warm outdoor cafe in the background, late afternoon light..."
                      rows={3}
                      style={{
                        width: "100%",
                        background: theme.surface,
                        border: `1px solid ${theme.border}`,
                        borderRadius: 8,
                        padding: "10px 12px",
                        fontSize: 12,
                        color: theme.text,
                        fontFamily: FONT.sans,
                        resize: "vertical",
                        outline: "none",
                        lineHeight: 1.5,
                      }}
                    />
                  </div>

                  {/* Error message */}
                  {error && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#ef4444",
                        padding: "8px 12px",
                        background: "rgba(239,68,68,0.1)",
                        borderRadius: 8,
                        border: "1px solid rgba(239,68,68,0.2)",
                      }}
                    >
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Footer — only in input state ────────────────── */}
        {!resultUrl && !isProcessing && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: `1px solid ${theme.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Cost indicator */}
            <div
              style={{
                fontSize: 10,
                color: theme.textMuted,
                fontFamily: FONT.mono,
              }}
            >
              Seedream 4.5 &middot; $0.04 &middot; ~30s
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: theme.textMuted,
                  background: "transparent",
                  border: `1px solid ${theme.border}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: FONT.sans,
                  transition: "all 0.15s",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                disabled={!canSubmit}
                style={{
                  padding: "10px 24px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#000",
                  background: canSubmit ? amber : "rgba(245,158,11,0.3)",
                  border: "none",
                  borderRadius: 10,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  fontFamily: FONT.sans,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.2s",
                }}
              >
                <RefreshCw size={14} />
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
