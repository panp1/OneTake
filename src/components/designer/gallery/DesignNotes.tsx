"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type { Theme } from "./tokens";
import { FONT } from "./tokens";
import { ARCHETYPE_LABELS } from "@/lib/channels";

interface DesignNotesProps {
  content: Record<string, any>;
  theme: Theme;
}

export default function DesignNotes({ content, theme }: DesignNotesProps) {
  const [expanded, setExpanded] = useState(false);

  // Build candidate fields — filter out any that are falsy/empty
  const rawFields: { label: string; value: string }[] = [
    {
      label: "Archetype",
      value: content.archetype
        ? ARCHETYPE_LABELS[content.archetype] || content.archetype
        : "",
    },
    {
      label: "Pillar",
      value: content.pillar
        ? content.pillar.charAt(0).toUpperCase() + content.pillar.slice(1)
        : "",
    },
    {
      label: "Scene",
      value: (content.scene || content.setting || "").trim(),
    },
    {
      label: "Design Intent",
      value: (content.design_intent || "").trim(),
    },
  ];

  const fields = rawFields.filter((f) => Boolean(f.value));

  // Nothing to show — don't render the toggle link at all
  if (fields.length === 0) return null;

  return (
    <div
      style={{
        padding: "0 20px 16px",
        background: theme.surface,
        fontFamily: FONT.sans,
      }}
    >
      {/* Toggle link */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: "none",
          border: "none",
          padding: 0,
          fontSize: 11,
          fontWeight: 600,
          color: theme.accent,
          cursor: "pointer",
          fontFamily: FONT.sans,
        }}
      >
        <Info size={12} />
        Design Notes
      </button>

      {/* Expanded grid */}
      {expanded && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`,
            gap: 12,
            marginTop: 12,
          }}
        >
          {fields.map(({ label, value }) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.6px",
                  textTransform: "uppercase",
                  color: theme.textDim,
                  marginBottom: 3,
                  fontFamily: FONT.sans,
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: theme.textMuted,
                  fontFamily: FONT.sans,
                  lineHeight: 1.4,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
