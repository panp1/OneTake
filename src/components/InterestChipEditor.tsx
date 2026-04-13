"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";

// ── Tier config ───────────────────────────────────────────────────────

const TIERS = [
  {
    key: "hyper" as const,
    label: "HYPER",
    sublabel: "Exact Match",
    textColor: "#92400e",
    bg: "#fef3c7",
    border: "#fde68a",
  },
  {
    key: "hot" as const,
    label: "HOT",
    sublabel: "Strong Signal",
    textColor: "#9d174d",
    bg: "#fce7f3",
    border: "#fbcfe8",
  },
  {
    key: "broad" as const,
    label: "BROAD",
    sublabel: "Reach",
    textColor: "#32373C",
    bg: "#F7F7F8",
    border: "#E8E8EA",
  },
] as const;

type TierKey = (typeof TIERS)[number]["key"];

// ── Types ─────────────────────────────────────────────────────────────

export interface InterestsByTier {
  hyper: string[];
  hot: string[];
  broad: string[];
}

interface InterestChipEditorProps {
  interests: InterestsByTier;
  onChange: (updated: InterestsByTier) => void;
}

// ── Component ─────────────────────────────────────────────────────────

export default function InterestChipEditor({
  interests,
  onChange,
}: InterestChipEditorProps) {
  const [addingTier, setAddingTier] = useState<TierKey | null>(null);
  const [addValue, setAddValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingTier && inputRef.current) {
      inputRef.current.focus();
    }
  }, [addingTier]);

  function handleRemove(tier: TierKey, index: number) {
    const updated = { ...interests };
    updated[tier] = [...updated[tier]];
    updated[tier].splice(index, 1);
    onChange(updated);
  }

  function handleAdd(tier: TierKey) {
    const trimmed = addValue.trim();
    if (!trimmed) return;
    const updated = { ...interests };
    updated[tier] = [...updated[tier], trimmed];
    onChange(updated);
    setAddValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent, tier: TierKey) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd(tier);
    } else if (e.key === "Escape") {
      setAddingTier(null);
      setAddValue("");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, padding: "12px 0" }}>
      {TIERS.map((tier) => {
        const items = interests[tier.key] ?? [];
        return (
          <div key={tier.key}>
            {/* Tier header */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: tier.textColor }}>
                {tier.label}
              </span>
              <span style={{ fontSize: 10, color: "#8A8A8E" }}>
                ({tier.sublabel})
              </span>
            </div>

            {/* Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {items.map((interest, i) => (
                <span
                  key={`${interest}-${i}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: tier.bg,
                    border: `1px solid ${tier.border}`,
                    fontSize: 11,
                    fontWeight: 600,
                    color: tier.textColor,
                  }}
                >
                  {interest}
                  <button
                    type="button"
                    onClick={() => handleRemove(tier.key, i)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      color: tier.textColor,
                      opacity: 0.6,
                    }}
                    aria-label={`Remove ${interest}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              {/* Add button / inline input */}
              {addingTier === tier.key ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, tier.key)}
                  onBlur={() => {
                    if (addValue.trim()) handleAdd(tier.key);
                    setAddingTier(null);
                    setAddValue("");
                  }}
                  placeholder="Type interest..."
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "1px solid #E8E8EA",
                    outline: "none",
                    width: 120,
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAddingTier(tier.key);
                    setAddValue("");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "3px 8px",
                    borderRadius: 6,
                    border: "1px dashed #E8E8EA",
                    background: "none",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#8A8A8E",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={11} />
                  Add
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
