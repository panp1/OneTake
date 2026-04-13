"use client";

import { useState, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────

interface ChannelAllocation {
  [channel: string]: number; // fraction 0..1
}

interface ChannelMixEditorProps {
  allocation: ChannelAllocation;
  monthlyBudget: number | null;
  onChange: (updated: ChannelAllocation) => void;
}

// ── Component ─────────────────────────────────────────────────────────

export default function ChannelMixEditor({
  allocation,
  monthlyBudget,
  onChange,
}: ChannelMixEditorProps) {
  const channels = Object.entries(allocation).sort((a, b) => b[1] - a[1]);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingChannel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingChannel]);

  function handleCommit(channel: string) {
    const parsed = parseInt(editValue, 10);
    if (isNaN(parsed)) {
      setEditingChannel(null);
      return;
    }
    const newPct = Math.max(0, Math.min(100, parsed));
    const newFraction = newPct / 100;
    const oldFraction = allocation[channel] ?? 0;
    const delta = newFraction - oldFraction;

    if (delta === 0) {
      setEditingChannel(null);
      return;
    }

    // Rebalance other channels proportionally
    const otherChannels = channels.filter(([ch]) => ch !== channel);
    const otherTotal = otherChannels.reduce((s, [, v]) => s + v, 0);

    const updated: ChannelAllocation = { [channel]: newFraction };

    if (otherTotal > 0) {
      for (const [ch, val] of otherChannels) {
        const proportion = val / otherTotal;
        updated[ch] = Math.max(0, val - delta * proportion);
      }
    } else {
      const remainder = Math.max(0, 1 - newFraction);
      const perChannel = otherChannels.length > 0 ? remainder / otherChannels.length : 0;
      for (const [ch] of otherChannels) {
        updated[ch] = perChannel;
      }
    }

    // Normalize to sum = 1.0
    const total = Object.values(updated).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const ch of Object.keys(updated)) {
        updated[ch] = updated[ch] / total;
      }
    }

    onChange(updated);
    setEditingChannel(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, channel: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit(channel);
    } else if (e.key === "Escape") {
      setEditingChannel(null);
    }
  }

  if (channels.length === 0) {
    return (
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E8E8EA",
          borderRadius: 12,
          padding: "16px 20px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8A8A8E", marginBottom: 8 }}>
          Channel Mix
        </div>
        <p style={{ fontSize: 13, color: "#8A8A8E", fontStyle: "italic", margin: 0 }}>
          No channel allocation data available.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E8EA",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#8A8A8E",
          marginBottom: 12,
        }}
      >
        Channel Mix
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {channels.map(([channel, fraction]) => {
          const pct = Math.round(fraction * 100);
          const monthly = monthlyBudget ? Math.round(monthlyBudget * fraction) : null;
          const isEditing = editingChannel === channel;

          return (
            <div
              key={channel}
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr 60px 80px",
                alignItems: "center",
                gap: 10,
                height: 28,
              }}
            >
              {/* Channel name */}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1A1A1A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {channel}
              </span>

              {/* Bar */}
              <div
                style={{
                  height: 20,
                  background: "#F7F7F8",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: "linear-gradient(90deg, #32373C, #6B7280)",
                    borderRadius: 4,
                    transition: "width 0.2s ease",
                  }}
                />
              </div>

              {/* Percentage — click to edit */}
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="number"
                  min={0}
                  max={100}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, channel)}
                  onBlur={() => handleCommit(channel)}
                  style={{
                    width: 52,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    textAlign: "right",
                    padding: "2px 4px",
                    borderRadius: 6,
                    border: "1px solid #E8E8EA",
                    outline: "none",
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingChannel(channel);
                    setEditValue(String(pct));
                  }}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, monospace",
                    color: "#1A1A1A",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "right",
                    padding: "2px 4px",
                    borderRadius: 6,
                  }}
                  title="Click to edit"
                >
                  {pct}%
                </button>
              )}

              {/* Monthly budget */}
              <span
                style={{
                  fontSize: 12,
                  color: "#8A8A8E",
                  textAlign: "right",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {monthly !== null ? `$${monthly.toLocaleString()}` : "\u2014"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
