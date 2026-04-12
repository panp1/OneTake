"use client";

import { useState } from "react";
import { Clock, RotateCcw } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { Theme } from "../gallery/tokens";
import { FONT } from "../gallery/tokens";

interface EditHistoryProps {
  asset: GeneratedAsset;
  theme: Theme;
  onRevert: (blobUrl: string) => void;
}

interface HistoryEntry {
  timestamp: string;
  action: string;
  prompt: string;
  original_url: string;
  result_url: string;
  vqa_score?: number;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export default function EditHistory({ asset, theme, onRevert }: EditHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const editHistory = ((asset.content as any)?.edit_history || []) as HistoryEntry[];

  if (editHistory.length === 0) return null;

  const dot = (color: string) => (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          background: "none",
          border: `1px solid ${theme.border}`,
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 12,
          fontFamily: FONT.sans,
          color: theme.textMuted,
          fontWeight: 500,
        }}
      >
        <Clock size={13} />
        History
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Click-away overlay */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 19 }}
            onClick={() => setIsOpen(false)}
          />

          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              width: 280,
              background: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              zIndex: 20,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "10px 14px",
                borderBottom: `1px solid ${theme.border}`,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: FONT.sans,
                color: theme.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Edit History
            </div>

            {/* Timeline */}
            <div style={{ padding: "8px 0" }}>
              {/* Current version */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 14px",
                }}
              >
                {dot("#22c55e")}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: FONT.sans,
                      color: theme.text,
                    }}
                  >
                    Current
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: theme.textMuted,
                      fontFamily: FONT.sans,
                    }}
                  >
                    Active version
                  </div>
                </div>
              </div>

              {/* Edit entries (most recent first) */}
              {[...editHistory].reverse().map((entry, idx) => {
                const editNumber = editHistory.length - idx;
                return (
                  <div
                    key={`edit-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "8px 14px",
                      borderTop: `1px solid ${theme.border}`,
                    }}
                  >
                    {dot(theme.textDim)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: FONT.sans,
                          color: theme.text,
                        }}
                      >
                        Edit {editNumber}
                        {entry.vqa_score !== undefined && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              color: entry.vqa_score >= 0.85 ? theme.vqaGood : theme.vqaOk,
                              fontWeight: 500,
                            }}
                          >
                            {Math.round(entry.vqa_score * 100)}%
                          </span>
                        )}
                      </div>
                      {entry.prompt && (
                        <div
                          style={{
                            fontSize: 11,
                            color: theme.textMuted,
                            fontFamily: FONT.sans,
                            marginTop: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={entry.prompt}
                        >
                          {truncate(entry.prompt, 50)}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: 10,
                          color: theme.textDim,
                          fontFamily: FONT.sans,
                          marginTop: 2,
                        }}
                      >
                        {formatTimestamp(entry.timestamp)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onRevert(entry.original_url);
                        setIsOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        padding: "3px 7px",
                        background: "none",
                        border: `1px solid ${theme.border}`,
                        borderRadius: 5,
                        cursor: "pointer",
                        fontSize: 11,
                        fontFamily: FONT.sans,
                        color: theme.textMuted,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <RotateCcw size={10} />
                      Revert
                    </button>
                  </div>
                );
              })}

              {/* Original version */}
              {editHistory[0]?.original_url && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 14px",
                    borderTop: `1px solid ${theme.border}`,
                  }}
                >
                  {dot(theme.textDim)}
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: FONT.sans,
                        color: theme.text,
                      }}
                    >
                      Original
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: theme.textMuted,
                        fontFamily: FONT.sans,
                        marginTop: 1,
                      }}
                    >
                      First generated version
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onRevert(editHistory[0].original_url);
                      setIsOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      padding: "3px 7px",
                      background: "none",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 5,
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: FONT.sans,
                      color: theme.textMuted,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    <RotateCcw size={10} />
                    Revert
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
