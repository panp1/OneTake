# Media Strategy Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the read-only 678-line `MediaStrategyTab` with an inline-editable `MediaStrategyEditor` that lets the marketing manager edit channel mix percentages, ad set budgets, interests, split tests, and objectives — all with autosave.

**Architecture:** The editor maintains a deep-cloned copy of the full `strategy_data` JSONB in React state. Every edit mutates this local state, then a debounced PATCH sends the entire updated object to the server. Four focused components: `MediaStrategyEditor` (orchestrator), `ChannelMixEditor` (editable bar chart), `AdSetRow` (collapsible row with inline fields), `InterestChipEditor` (tiered chip add/remove).

**Tech Stack:** React 19 (Next.js 16 App Router), TypeScript, inline styles (matching existing OneForma light theme), Neon Postgres (JSONB update), Clerk auth.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/hooks/useStrategyAutosave.ts` | NEW — Debounced autosave hook for strategy JSONB. Accepts `requestId` + `strategyId`, sends full `strategy_data` via PATCH. Returns `{ save, status }`. |
| `src/components/ChannelMixEditor.tsx` | NEW — Horizontal bar chart with click-to-edit percentages. Auto-rebalances to sum 100%. Calls `onAllocationChange`. |
| `src/components/InterestChipEditor.tsx` | NEW — Three-tier interest chips (hyper/hot/broad) with remove (×) and add (+). Calls `onInterestsChange`. |
| `src/components/AdSetRow.tsx` | NEW — Compact collapsible row (~60px). Inline-editable budget, split test dropdown, objective dropdown. Expands to show `InterestChipEditor`. |
| `src/components/MediaStrategyEditor.tsx` | NEW — Main orchestrator. Country tabs, autosave status, `ChannelMixEditor`, flat list of `AdSetRow`s. Owns the mutable strategy state. |
| `src/app/api/generate/[id]/strategy/route.ts` | MODIFY — Add PATCH handler to update `strategy_data` JSONB by strategy ID. |
| `src/components/CampaignWorkspace.tsx` | MODIFY — Swap `MediaStrategyTab` import/usage for `MediaStrategyEditor`. Pass `requestId`. |
| `src/components/MediaStrategyTab.tsx` | DELETE — Replaced by the new editor components. |

---

### Task 1: PATCH API Route

Add a PATCH handler to the existing strategy route so the frontend can persist edits.

**Files:**
- Modify: `src/app/api/generate/[id]/strategy/route.ts`

- [ ] **Step 1: Write the PATCH handler**

Open `src/app/api/generate/[id]/strategy/route.ts` and add this PATCH export below the existing GET:

```ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { strategy_id, strategy_data } = body;

    if (!strategy_id || !strategy_data) {
      return Response.json(
        { error: 'strategy_id and strategy_data are required' },
        { status: 400 }
      );
    }

    const sql = getDb();
    const rows = await sql`
      UPDATE campaign_strategies
      SET strategy_data = ${JSON.stringify(strategy_data)}::jsonb
      WHERE id = ${strategy_id}
        AND request_id = ${id}
      RETURNING id
    `;

    if (rows.length === 0) {
      return Response.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/generate/[id]/strategy] PATCH failed:', error);
    return Response.json(
      { error: 'Failed to update strategy' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `src/app/api/generate/[id]/strategy/route.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/[id]/strategy/route.ts
git commit -m "feat(api): add PATCH handler for strategy_data updates"
```

---

### Task 2: Strategy Autosave Hook

Create a dedicated autosave hook for strategy JSONB that debounces and PATCHes the full `strategy_data` object.

**Files:**
- Create: `src/hooks/useStrategyAutosave.ts`

- [ ] **Step 1: Create the hook**

```ts
"use client";

import { useRef, useState, useCallback } from "react";

export type StrategyAutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave for strategy_data JSONB.
 * Sends the full strategy_data object on each save — no partial update logic.
 *
 * Usage:
 *   const { save, status } = useStrategyAutosave(requestId, strategyId);
 *   // On any edit:
 *   save(updatedStrategyData);
 */
export function useStrategyAutosave(
  requestId: string,
  strategyId: string,
  debounceMs: number = 800,
): {
  save: (strategyData: Record<string, unknown>) => void;
  status: StrategyAutosaveStatus;
} {
  const [status, setStatus] = useState<StrategyAutosaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (strategyData: Record<string, unknown>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);

      setStatus("saving");

      timerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/generate/${requestId}/strategy`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              strategy_id: strategyId,
              strategy_data: strategyData,
            }),
          });

          if (!res.ok) {
            setStatus("error");
            return;
          }

          setStatus("saved");
          revertTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
        } catch {
          setStatus("error");
        }
      }, debounceMs);
    },
    [requestId, strategyId, debounceMs],
  );

  return { save, status };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStrategyAutosave.ts
git commit -m "feat: add useStrategyAutosave hook for strategy JSONB autosave"
```

---

### Task 3: InterestChipEditor

Three-tier interest chip display with add/remove functionality.

**Files:**
- Create: `src/components/InterestChipEditor.tsx`

- [ ] **Step 1: Create the component**

```tsx
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

interface InterestsByTier {
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
                  placeholder="Type interest…"
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/InterestChipEditor.tsx
git commit -m "feat: add InterestChipEditor with tiered add/remove chips"
```

---

### Task 4: ChannelMixEditor

Editable horizontal bar chart. Click a percentage to type a new value. Other bars auto-rebalance to sum to 100%.

**Files:**
- Create: `src/components/ChannelMixEditor.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
    const newPct = Math.max(0, Math.min(100, parseInt(editValue, 10) || 0));
    if (isNaN(newPct)) {
      setEditingChannel(null);
      return;
    }

    const newFraction = newPct / 100;
    const oldFraction = allocation[channel] ?? 0;
    const delta = newFraction - oldFraction;

    // Rebalance other channels proportionally
    const otherChannels = channels.filter(([ch]) => ch !== channel);
    const otherTotal = otherChannels.reduce((s, [, v]) => s + v, 0);

    const updated: ChannelAllocation = { [channel]: newFraction };

    if (otherTotal > 0 && delta !== 0) {
      for (const [ch, val] of otherChannels) {
        const proportion = val / otherTotal;
        const adjusted = Math.max(0, val - delta * proportion);
        updated[ch] = adjusted;
      }
    } else {
      // If other channels sum to 0, distribute remainder equally
      const remainder = Math.max(0, 1 - newFraction);
      const perChannel = otherChannels.length > 0 ? remainder / otherChannels.length : 0;
      for (const [ch] of otherChannels) {
        updated[ch] = perChannel;
      }
    }

    // Normalize to ensure sum = 1.0
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
                {monthly !== null ? `$${monthly.toLocaleString()}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ChannelMixEditor.tsx
git commit -m "feat: add ChannelMixEditor with click-to-edit percentage bars"
```

---

### Task 5: AdSetRow

Compact expandable row with inline-editable daily budget, split test dropdown, objective dropdown. Expands to show `InterestChipEditor`.

**Files:**
- Create: `src/components/AdSetRow.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import InterestChipEditor from "@/components/InterestChipEditor";

// ── Types ─────────────────────────────────────────────────────────────

interface AdSetData {
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
  const personaLabel = adSet.persona_key ? adSet.persona_key.replace(/_/g, " ") : "—";
  const dailyBudget = adSet.daily_budget ?? 0;

  // Build tiered interests — use interests_by_tier if available, else dump all into the matching tier
  const interestsByTier = adSet.interests_by_tier ?? {
    hyper: tier === "hyper" ? (adSet.interests ?? []) : [],
    hot: tier === "hot" ? (adSet.interests ?? []) : [],
    broad: tier === "broad" ? (adSet.interests ?? []) : [],
  };
  const totalInterests =
    (interestsByTier.hyper?.length ?? 0) +
    (interestsByTier.hot?.length ?? 0) +
    (interestsByTier.broad?.length ?? 0);

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
          gridTemplateColumns: "28px 1fr auto auto auto auto auto 28px",
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
        <span
          style={{
            fontSize: 11,
            color: "#8A8A8E",
            whiteSpace: "nowrap",
          }}
        >
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
            interests={{
              hyper: interestsByTier.hyper ?? [],
              hot: interestsByTier.hot ?? [],
              broad: interestsByTier.broad ?? [],
            }}
            onChange={(updated) => onUpdate("interests_by_tier", updated)}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/AdSetRow.tsx
git commit -m "feat: add AdSetRow with inline budget/split-test/objective editing"
```

---

### Task 6: MediaStrategyEditor

Main orchestrator that replaces `MediaStrategyTab`. Owns strategy state, wires autosave, renders `ChannelMixEditor` + flat `AdSetRow` list.

**Files:**
- Create: `src/components/MediaStrategyEditor.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useStrategyAutosave } from "@/hooks/useStrategyAutosave";
import type { StrategyAutosaveStatus } from "@/hooks/useStrategyAutosave";
import ChannelMixEditor from "@/components/ChannelMixEditor";
import AdSetRow from "@/components/AdSetRow";
import { toChannel } from "@/lib/platforms";

// ── Types ─────────────────────────────────────────────────────────────

interface Strategy {
  id: string;
  country: string;
  tier: number;
  budget_mode: string;
  monthly_budget: number | null;
  strategy_data: StrategyData;
}

interface StrategyData {
  tier?: number;
  monthly_budget?: number | null;
  budget_mode?: string;
  daily_budget_total?: number | null;
  split_test?: { variable?: string; description?: string; measurement?: string };
  campaigns?: Campaign[];
  scaling_rules?: Record<string, string> | string | null;
  channel_allocation?: Record<string, number>;
}

interface Campaign {
  name?: string;
  objective?: string;
  optimization?: string;
  daily_budget?: number | null;
  ad_sets?: AdSet[];
}

interface AdSet {
  name?: string;
  persona_key?: string;
  targeting_type?: string;
  targeting_tier?: string;
  interests?: string[];
  interests_by_tier?: {
    hyper?: string[];
    hot?: string[];
    broad?: string[];
  };
  placements?: string[];
  daily_budget?: number | null;
  split_test_variable?: string;
  objective?: string;
  kill_rule?: string;
  scale_rule?: string;
  demographics?: Record<string, unknown>;
  creative_assignment_rule?: Record<string, unknown>;
}

interface MediaStrategyEditorProps {
  strategies: Strategy[];
  requestId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Flatten all ad sets from all campaigns, annotated with campaign index, ad set index, and primary channel. */
interface FlatAdSet {
  campaignIndex: number;
  adSetIndex: number;
  adSet: AdSet;
  channel: string;
}

function flattenAdSets(campaigns: Campaign[]): FlatAdSet[] {
  const result: FlatAdSet[] = [];
  for (let ci = 0; ci < campaigns.length; ci++) {
    const adSets = campaigns[ci].ad_sets ?? [];
    for (let ai = 0; ai < adSets.length; ai++) {
      const adSet = adSets[ai];
      const placements = adSet.placements ?? [];
      // Use first placement as primary channel for grouping
      const firstPlacement = placements[0] ?? "";
      const channel = toChannel(firstPlacement) ?? "Other";
      result.push({ campaignIndex: ci, adSetIndex: ai, adSet, channel });
    }
  }
  // Sort by channel grouping, then daily budget descending
  result.sort((a, b) => {
    const chCmp = a.channel.localeCompare(b.channel);
    if (chCmp !== 0) return chCmp;
    return (b.adSet.daily_budget ?? 0) - (a.adSet.daily_budget ?? 0);
  });
  return result;
}

/** Build a channel_allocation map from the flat ad set list or existing allocation. */
function buildAllocation(
  strategyData: StrategyData,
): Record<string, number> {
  // Use existing channel_allocation if present
  if (strategyData.channel_allocation && Object.keys(strategyData.channel_allocation).length > 0) {
    return { ...strategyData.channel_allocation };
  }
  // Fallback: derive from ad set budgets
  const byChannel: Record<string, number> = {};
  for (const camp of strategyData.campaigns ?? []) {
    for (const adSet of camp.ad_sets ?? []) {
      const ch = toChannel(adSet.placements?.[0] ?? "") ?? "Other";
      byChannel[ch] = (byChannel[ch] ?? 0) + (adSet.daily_budget ?? 0);
    }
  }
  const total = Object.values(byChannel).reduce((s, v) => s + v, 0);
  if (total === 0) return byChannel;
  for (const ch of Object.keys(byChannel)) {
    byChannel[ch] = byChannel[ch] / total;
  }
  return byChannel;
}

// ── Status dot ────────────────────────────────────────────────────────

function SaveStatusDot({ status }: { status: StrategyAutosaveStatus }) {
  if (status === "idle") return null;
  const config: Record<string, { color: string; label: string }> = {
    saving: { color: "#d97706", label: "Saving..." },
    saved: { color: "#16a34a", label: "Saved" },
    error: { color: "#dc2626", label: "Error — click to retry" },
  };
  const c = config[status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.color }} />
      <span style={{ fontSize: 11, fontWeight: 500, color: c.color }}>{c.label}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function MediaStrategyEditor({
  strategies,
  requestId,
}: MediaStrategyEditorProps) {
  const sortedStrategies = useMemo(
    () => [...(strategies ?? [])].sort((a, b) => (b.monthly_budget ?? 0) - (a.monthly_budget ?? 0)),
    [strategies],
  );

  const [activeCountry, setActiveCountry] = useState(sortedStrategies[0]?.country ?? "");

  const activeStrategy = useMemo(
    () => sortedStrategies.find((s) => s.country === activeCountry) ?? sortedStrategies[0],
    [sortedStrategies, activeCountry],
  );

  // Deep clone strategy_data into mutable local state
  const [strategyData, setStrategyData] = useState<StrategyData>(() =>
    JSON.parse(JSON.stringify(activeStrategy?.strategy_data ?? {})),
  );

  // Reset local state when active country changes
  useEffect(() => {
    if (activeStrategy) {
      setStrategyData(JSON.parse(JSON.stringify(activeStrategy.strategy_data ?? {})));
    }
  }, [activeStrategy]);

  // Autosave
  const { save, status } = useStrategyAutosave(
    requestId,
    activeStrategy?.id ?? "",
  );

  // Update helper — mutates local state and triggers autosave
  const updateStrategyData = useCallback(
    (updater: (draft: StrategyData) => void) => {
      setStrategyData((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as StrategyData;
        updater(next);
        save(next as unknown as Record<string, unknown>);
        return next;
      });
    },
    [save],
  );

  // ── Channel allocation change ──────────────────────────────────────

  function handleAllocationChange(updated: Record<string, number>) {
    updateStrategyData((draft) => {
      draft.channel_allocation = updated;
    });
  }

  // ── Ad set field change ────────────────────────────────────────────

  function handleAdSetUpdate(
    campaignIndex: number,
    adSetIndex: number,
    field: string,
    value: unknown,
  ) {
    updateStrategyData((draft) => {
      const campaigns = draft.campaigns ?? [];
      if (!campaigns[campaignIndex]) return;
      const adSets = campaigns[campaignIndex].ad_sets ?? [];
      if (!adSets[adSetIndex]) return;
      (adSets[adSetIndex] as Record<string, unknown>)[field] = value;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (!sortedStrategies || sortedStrategies.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#8A8A8E", fontStyle: "italic" }}>
        Media strategy hasn&apos;t been generated yet.
      </p>
    );
  }

  const allocation = buildAllocation(strategyData);
  const flatAdSets = flattenAdSets(strategyData.campaigns ?? []);
  const monthlyBudget = activeStrategy?.monthly_budget ?? strategyData.monthly_budget ?? null;

  return (
    <div>
      {/* Country tabs + save status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #E8E8EA",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 2, overflow: "auto" }}>
          {sortedStrategies.map((s) => {
            const isActive = s.country === activeCountry;
            const budgetLabel = s.monthly_budget
              ? `$${Number(s.monthly_budget).toLocaleString()}/mo`
              : "ratio";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveCountry(s.country)}
                style={{
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#1A1A1A" : "#8A8A8E",
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #32373C" : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {s.country}
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "#8A8A8E" }}>
                  · {budgetLabel}
                </span>
              </button>
            );
          })}
        </div>
        <SaveStatusDot status={status} />
      </div>

      {/* Channel mix editor */}
      <ChannelMixEditor
        allocation={allocation}
        monthlyBudget={monthlyBudget}
        onChange={handleAllocationChange}
      />

      {/* Ad set header */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#8A8A8E",
          marginBottom: 8,
          marginTop: 8,
        }}
      >
        Ad Sets ({flatAdSets.length})
      </div>

      {/* Flat ad set list */}
      {flatAdSets.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8A8A8E", fontStyle: "italic" }}>
          No ad sets in this strategy.
        </p>
      ) : (
        flatAdSets.map((flat, i) => (
          <AdSetRow
            key={`${flat.campaignIndex}-${flat.adSetIndex}-${i}`}
            adSet={flat.adSet}
            channel={flat.channel}
            onUpdate={(field, value) =>
              handleAdSetUpdate(flat.campaignIndex, flat.adSetIndex, field, value)
            }
          />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyEditor.tsx
git commit -m "feat: add MediaStrategyEditor — main orchestrator with autosave"
```

---

### Task 7: Wire Up & Delete Old

Swap `MediaStrategyTab` for `MediaStrategyEditor` in `CampaignWorkspace`, pass `requestId`, and delete the old file.

**Files:**
- Modify: `src/components/CampaignWorkspace.tsx` (lines 21, 33-46, 849-858)
- Modify: `src/app/intake/[id]/page.tsx` (lines 603-613) — may need to pass `requestId` prop
- Delete: `src/components/MediaStrategyTab.tsx`

- [ ] **Step 1: Update CampaignWorkspace imports**

In `src/components/CampaignWorkspace.tsx`, change line 21:

```
OLD: import MediaStrategyTab from "@/components/MediaStrategyTab";
NEW: import MediaStrategyEditor from "@/components/MediaStrategyEditor";
```

- [ ] **Step 2: Add requestId to CampaignWorkspaceProps**

In `src/components/CampaignWorkspace.tsx`, add `requestId` to the props interface (around line 33):

```ts
interface CampaignWorkspaceProps {
  briefData: Record<string, any>;
  channelResearch?: Record<string, any> | null;
  designDirection?: Record<string, any> | null;
  campaignStrategies?: any[];
  actors: ActorProfile[];
  assets: GeneratedAsset[];
  editable?: boolean;
  requestId?: string;  // ← ADD THIS
  onRefine?: (asset: GeneratedAsset) => void;
  onRetry?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
  section?: "brief" | "personas";
}
```

Also destructure it in the main function signature (around line 692):

```ts
export default function CampaignWorkspace({
  briefData,
  channelResearch,
  designDirection,
  campaignStrategies,
  actors,
  assets,
  editable = false,
  requestId,        // ← ADD THIS
  onRefine,
  onRetry,
  onDelete,
  section,
}: CampaignWorkspaceProps) {
```

- [ ] **Step 3: Swap MediaStrategyTab usage for MediaStrategyEditor**

Around lines 849-858 in `src/components/CampaignWorkspace.tsx`, replace:

```tsx
// OLD:
{
  key: "media",
  label: "Media Strategy",
  content: (
    <MediaStrategyTab
      strategies={campaignStrategies as any}
      assets={assets}
      briefData={briefData}
    />
  ),
},

// NEW:
{
  key: "media",
  label: "Media Strategy",
  content: (
    <MediaStrategyEditor
      strategies={campaignStrategies as any}
      requestId={requestId ?? assets[0]?.request_id ?? ""}
    />
  ),
},
```

- [ ] **Step 4: Pass requestId from the detail page**

In `src/app/intake/[id]/page.tsx`, find BOTH `<CampaignWorkspace` usages (around lines 603 and 629) and add `requestId={id}`:

```tsx
<CampaignWorkspace
  briefData={briefData}
  channelResearch={brief.channel_research as Record<string, any> | null}
  designDirection={brief.design_direction as Record<string, any> | null}
  campaignStrategies={data.campaignStrategies}
  actors={data.actors}
  assets={assets}
  editable={role === "admin"}
  requestId={id}        // ← ADD THIS
  onRefine={(asset) => setRefineAsset(asset)}
  onRetry={(asset) => handleRetry(asset)}
  onDelete={handleDeleteAsset}
/>
```

- [ ] **Step 5: Delete the old MediaStrategyTab file**

```bash
rm src/components/MediaStrategyTab.tsx
```

- [ ] **Step 6: Check for any remaining imports of MediaStrategyTab**

Run: `grep -r "MediaStrategyTab" src/ --include="*.ts" --include="*.tsx"`
Expected: No results. If any remain, update them.

- [ ] **Step 7: Verify everything compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: swap MediaStrategyTab for MediaStrategyEditor, delete old 678-line file"
```

---

### Task 8: Smoke Test & Polish

Verify the editor works visually and fix any rough edges.

**Files:**
- Possibly modify any of the new files based on visual testing

- [ ] **Step 1: Start dev server**

Run: `cd /Users/stevenjunop/centric-intake && npm run dev`

- [ ] **Step 2: Navigate to a campaign with strategy data**

Open a campaign detail page (e.g., `/intake/{id}`) that has campaign strategies generated. Click the "Media Strategy" tab in the Campaign Workspace section.

- [ ] **Step 3: Verify the channel mix bars render**

Confirm:
- Horizontal bars appear with channel names, percentage fill, and monthly budget
- Clicking a percentage opens an inline number input
- Typing a new value and pressing Enter rebalances other channels
- Save status shows "Saving..." → "Saved"

- [ ] **Step 4: Verify ad set rows render**

Confirm:
- Flat list of ad set rows with persona chips, channel chips, budget, interest count
- Budget is click-to-edit with number input
- Split test and objective dropdowns work
- Clicking a row expands to show tiered interest chips

- [ ] **Step 5: Verify interest editing**

Confirm:
- × button removes an interest chip
- "+ Add" opens inline input
- Enter adds the interest
- Escape cancels
- Autosave triggers after each change

- [ ] **Step 6: Fix any visual issues**

Address spacing, alignment, or color issues found during testing.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: media strategy editor visual polish"
```
