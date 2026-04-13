"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Theme } from "../gallery/tokens";
import { FONT, FIGMA_ICON } from "../gallery/tokens";

interface FigmaConnectModalProps {
  requestId: string;
  theme: Theme;
  onClose: () => void;
  onConnected: () => void;
}

export default function FigmaConnectModal({
  requestId,
  theme,
  onClose,
  onConnected,
}: FigmaConnectModalProps) {
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaUrl, setFigmaUrl] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  async function handleSubmit() {
    setError(null);
    setIsValidating(true);

    try {
      const res = await fetch("/api/figma/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          figma_token: figmaToken,
          figma_url: figmaUrl,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to connect to Figma");
      }

      setIsConnected(true);
      toast.success("Figma sync enabled!");
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsValidating(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 44,
    padding: "0 14px",
    borderRadius: 10,
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.text,
    fontFamily: FONT.sans,
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s ease",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: theme.textMuted,
    marginBottom: 6,
    fontFamily: FONT.sans,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const canSubmit = figmaToken.trim().length > 0 && figmaUrl.trim().length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "90vw",
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          fontFamily: FONT.sans,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 28,
          }}
        >
          <span
            style={{ display: "inline-flex" }}
            dangerouslySetInnerHTML={{ __html: FIGMA_ICON }}
          />
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: theme.text,
            }}
          >
            Connect Figma
          </h2>
        </div>

        {/* Step 1: Token */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <label style={labelStyle}>
              Step 1 &mdash; Personal Access Token
            </label>
            <a
              href="https://www.figma.com/developers/api#access-tokens"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12,
                color: theme.accent,
                textDecoration: "none",
                fontFamily: FONT.sans,
              }}
            >
              Get your token &rarr;
            </a>
          </div>
          <input
            type="password"
            value={figmaToken}
            onChange={(e) => setFigmaToken(e.target.value)}
            placeholder="figd_..."
            style={inputStyle}
          />
        </div>

        {/* Step 2: File URL */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Step 2 &mdash; Figma File URL</label>
          <input
            type="text"
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            placeholder="https://www.figma.com/file/..."
            style={inputStyle}
          />
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              fontSize: 13,
              fontFamily: FONT.sans,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 9999,
              border: `1px solid ${theme.border}`,
              background: "transparent",
              color: theme.textMuted,
              fontFamily: FONT.sans,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isValidating || isConnected}
            style={{
              height: 40,
              padding: "0 24px",
              borderRadius: 9999,
              border: "none",
              background:
                canSubmit && !isValidating && !isConnected
                  ? "#22c55e"
                  : theme.border,
              color:
                canSubmit && !isValidating && !isConnected
                  ? "#fff"
                  : theme.textMuted,
              fontFamily: FONT.sans,
              fontSize: 13,
              fontWeight: 700,
              cursor:
                canSubmit && !isValidating && !isConnected
                  ? "pointer"
                  : "not-allowed",
              transition: "all 0.2s ease",
              opacity: isValidating ? 0.7 : 1,
            }}
          >
            {isValidating
              ? "Validating..."
              : isConnected
                ? "Connected"
                : "Connect & Enable Sync"}
          </button>
        </div>
      </div>
    </div>
  );
}
