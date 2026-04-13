"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import InterestChipEditor from "@/components/InterestChipEditor";
import type { InterestsByTier } from "@/components/InterestChipEditor";

// ── Types ─────────────────────────────────────────────────────────────

export interface AdSetData {
  name?: string;
  persona_key?: string;
  daily_budget?: number | null;
  targeting_tier?: string;
  targeting_type?: string;
  interests?: string[];
  interests_by_tier?: {
    hyper?: string[];
    hot?: string[];
    broad?: string[];
  };
  placements?: string[];
  split_test_variable?: string;
  objective?: string;
}

interface AdSetRowProps {
  adSet: AdSetData;
  channel: string;
  onUpdate: (field: string, value: unknown) => void;
}

// ── Constants ─────────────────────────────────────────────────────────

const SPLIT_TEST_OPTIONS = ["creative", "audience", "placement"];
const OBJECTIVE_OPTIONS = ["lead_generation", "traffic", "conversions"];

function formatObjective(obj: string): string {
  return obj.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Component ─────────────────────────────────────────────────────────

export default function AdSetRow({ adSet, channel, onUpdate }: AdSetRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState("");
  const budgetRef = useRef<HTMLInputElement>(null);

  const tier = (adSet.targeting_tier ?? adSet.targeting_type ?? "broad").toString();
  const borderColor = tier === "hyper" ? "#6B21A8" : tier === "hot" ? "#f59e0b" : "#22c55e";
  const personaLabel = adSet.persona_key ? adSet.persona_key.replace(/_/g, " ") : "\u2014";
  const dailyBudget = adSet.daily_budget ?? 0;

  // Build tiered interests — use interests_by_tier if available, else place all into matching tier
  const interestsByTier: InterestsByTier = adSet.interests_by_tier
    ? {
        hyper: adSet.interests_by_tier.hyper ?? [],
        hot: adSet.interests_by_tier.hot ?? [],
        broad: adSet.interests_by_tier.broad ?? [],
      }
    : {
        hyper: tier === "hyper" ? (adSet.interests ?? []) : [],
        hot: tier === "hot" ? (adSet.interests ?? []) : [],
        broad: tier === "broad" ? (adSet.interests ?? []) : [],
      };

  const totalInterests =
    interestsByTier.hyper.length +
    interestsByTier.hot.length +
    interestsByTier.broad.length;

  useEffect(() => {
    if (editingBudget && budgetRef.current) {
      budgetRef.current.focus();
      budgetRef.current.select();
    }
  }, [editingBudget]);

  function handleBudgetCommit() {
    const val = parseInt(budgetValue, 10);
    if (!isNaN(val) && val >= 0) {
      onUpdate("daily_budget", val);
    }
    setEditingBudget(false);
  }

  function handleBudgetKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBudgetCommit();
    } else if (e.key === "Escape") {
      setEditingBudget(false);
    }
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E8EA",
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: 10,
        marginBottom: 6,
        overflow: "hidden",
      }}
    >
      {/* Collapsed row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr auto auto auto auto auto auto",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          height: 56,
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Chevron */}
        <ChevronRight
          size={14}
          style={{
            color: "#8A8A8E",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />

        {/* Name */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#1A1A1A",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {adSet.name ?? "Ad Set"}
        </span>

        {/* Persona chip */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 9999,
            background: "rgba(107,33,168,0.08)",
            color: "#6B21A8",
            whiteSpace: "nowrap",
            textTransform: "capitalize",
          }}
        >
          {personaLabel}
        </span>

        {/* Channel chip */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 9999,
            background: "#F7F7F8",
            color: "#32373C",
            whiteSpace: "nowrap",
          }}
        >
          {channel}
        </span>

        {/* Daily budget — click to edit */}
        {editingBudget ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center" }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", marginRight: 2 }}>$</span>
            <input
              ref={budgetRef}
              type="number"
              min={0}
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
              onKeyDown={handleBudgetKeyDown}
              onBlur={handleBudgetCommit}
              style={{
                width: 60,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                padding: "2px 4px",
                borderRadius: 6,
                border: "1px solid #E8E8EA",
                outline: "none",
              }}
            />
            <span style={{ fontSize: 11, color: "#8A8A8E", marginLeft: 2 }}>/day</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditingBudget(true);
              setBudgetValue(String(dailyBudget));
            }}
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "ui-monospace, monospace",
              color: "#1A1A1A",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 6,
              whiteSpace: "nowrap",
            }}
            title="Click to edit budget"
          >
            ${dailyBudget}/day
          </button>
        )}

        {/* Interest count badge */}
        <span style={{ fontSize: 11, color: "#8A8A8E", whiteSpace: "nowrap" }}>
          {totalInterests} interests
        </span>

        {/* Split test dropdown */}
        <select
          value={adSet.split_test_variable ?? "creative"}
          onChange={(e) => {
            e.stopPropagation();
            onUpdate("split_test_variable", e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 6px",
            borderRadius: 6,
            border: "1px solid #E8E8EA",
            background: "#FFFFFF",
            color: "#1A1A1A",
            cursor: "pointer",
            fontFamily: "inherit",
            textTransform: "capitalize",
          }}
        >
          {SPLIT_TEST_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>

        {/* Objective dropdown */}
        <select
          value={adSet.objective ?? "lead_generation"}
          onChange={(e) => {
            e.stopPropagation();
            onUpdate("objective", e.target.value);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 6px",
            borderRadius: 6,
            border: "1px solid #E8E8EA",
            background: "#FFFFFF",
            color: "#1A1A1A",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {OBJECTIVE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {formatObjective(opt)}
            </option>
          ))}
        </select>
      </div>

      {/* Expanded — Interest tiers */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid #E8E8EA",
            padding: "8px 16px 16px 44px",
            background: "#FCFCFC",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <InterestChipEditor
            interests={interestsByTier}
            onChange={(updated) => onUpdate("interests_by_tier", updated)}
          />
        </div>
      )}
    </div>
  );
}
