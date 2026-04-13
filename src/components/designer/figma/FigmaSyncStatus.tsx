"use client";

import { useState, useEffect, useCallback } from "react";
import type { Theme } from "../gallery/tokens";
import { FONT, FIGMA_ICON } from "../gallery/tokens";

interface SyncStatus {
  connected: boolean;
  file_url: string | null;
  last_synced: string | null;
  sync_enabled: boolean;
  frame_count: number;
}

interface FigmaSyncStatusProps {
  requestId: string;
  theme: Theme;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function FigmaSyncStatus({
  requestId,
  theme,
}: FigmaSyncStatusProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/figma/status/${requestId}`);
      if (res.ok) {
        const data = (await res.json()) as SyncStatus;
        setStatus(data);
      }
    } catch {
      // Silently fail on status poll
    }
  }, [requestId]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Don't render anything when not connected
  if (!status || !status.connected) return null;

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      await fetch(`/api/figma/sync/${requestId}`, { method: "POST" });
      await fetchStatus();
    } catch {
      // Sync error handled silently
    } finally {
      setIsSyncing(false);
    }
  }

  const lastSyncText = status.last_synced
    ? `Last sync: ${timeAgo(status.last_synced)}`
    : "Never synced";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        fontFamily: FONT.sans,
        fontSize: 13,
        color: theme.textMuted,
      }}
    >
      {/* Figma icon */}
      <span
        style={{ display: "inline-flex", flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: FIGMA_ICON }}
      />

      {/* Connected indicator */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "#22c55e",
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#22c55e",
            flexShrink: 0,
          }}
        />
        Synced with Figma
      </span>

      <span style={{ color: theme.textDim }}>&middot;</span>
      <span>{lastSyncText}</span>

      <span style={{ color: theme.textDim }}>&middot;</span>

      {/* Sync Now button */}
      <button
        onClick={handleSyncNow}
        disabled={isSyncing}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          height: 28,
          padding: "0 12px",
          borderRadius: 9999,
          border: `1px solid ${theme.border}`,
          background: "transparent",
          color: theme.text,
          fontFamily: FONT.sans,
          fontSize: 12,
          fontWeight: 600,
          cursor: isSyncing ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          opacity: isSyncing ? 0.6 : 1,
        }}
      >
        {isSyncing ? (
          <>
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                border: `2px solid ${theme.textDim}`,
                borderTopColor: theme.text,
                borderRadius: "50%",
                animation: "figma-spin 0.8s linear infinite",
              }}
            />
            Syncing...
          </>
        ) : (
          "Sync Now"
        )}
      </button>

      {/* Open in Figma link */}
      {status.file_url && (
        <a
          href={status.file_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: theme.accent,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            fontFamily: FONT.sans,
            marginLeft: "auto",
          }}
        >
          Open in Figma &rarr;
        </a>
      )}

      {/* Spinner keyframes */}
      <style>{`@keyframes figma-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
