"use client";

import type { Theme } from "../gallery/tokens";
import { FONT } from "../gallery/tokens";

type Layer = "photo" | "graphic";

interface LayerToggleProps {
  activeLayer: Layer;
  onToggle: (layer: Layer) => void;
  theme: Theme;
}

export default function LayerToggle({ activeLayer, onToggle, theme }: LayerToggleProps) {
  return (
    <div style={{
      display: "flex", background: theme.bg, borderRadius: 8,
      padding: 3, border: `1px solid ${theme.border}`,
    }}>
      <button
        onClick={() => onToggle("photo")}
        style={{
          padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: "pointer", border: "none", fontFamily: FONT.sans,
          display: "flex", alignItems: "center", gap: 6,
          background: activeLayer === "photo" ? theme.card : "transparent",
          color: activeLayer === "photo" ? theme.text : theme.textMuted,
          transition: "all 0.15s",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
        Base Photo
      </button>
      <button
        onClick={() => onToggle("graphic")}
        style={{
          padding: "8px 18px", borderRadius: 6, fontSize: 12, fontWeight: 600,
          cursor: "pointer", border: "none", fontFamily: FONT.sans,
          display: "flex", alignItems: "center", gap: 6,
          background: activeLayer === "graphic" ? theme.card : "transparent",
          color: activeLayer === "graphic" ? theme.text : theme.textMuted,
          transition: "all 0.15s",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
        Graphic Overlay
      </button>
    </div>
  );
}

export type { Layer };
