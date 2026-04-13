# Media Strategy Editor — Design Spec

**Date:** 2026-04-13
**Author:** Steven Junop + Claude
**Status:** Approved

## Overview

Replace the chunky 678-line `MediaStrategyTab` with a clean, inline-editable `MediaStrategyEditor`. The marketing manager sees a flat overview of all ad sets with editable budgets, interests, split tests, and objectives. No tabs, no mode switching — the view IS the editor.

## Layout

### Channel Mix Bar Chart (top, always visible)
- Horizontal bars: channel name (100px) | bar with % fill | percentage text | monthly budget
- **EDITABLE:** Click percentage to type a new value. Bars auto-rebalance to sum to 100%.
- Bar fills: charcoal → gray gradient (same as agency/dashboard views)
- Compact: ~120px total for 5 channels
- Autosaves on change

### Ad Set List (below, flat — no tabs)
- Each ad set as a compact collapsible row (~60px collapsed)
- All rows visible simultaneously — marketing manager sees full picture
- Sorted by: channel grouping, then daily budget descending

## Ad Set Row — Collapsed (~60px)

```
[▸] [Healthcare Professionals — Meta]  [Maria G. · Shape]  [$45/day]  [12 interests]  [Creative ▾]  [Lead Gen ▾]
```

| Element | Style | Editable |
|---|---|---|
| Priority bar | 4px left border, colored by spend tier | No |
| Name | 14px semibold, truncated | No (auto-generated) |
| Persona chip | Purple tint pill, 10px | No |
| Channel chip | Charcoal pill, 10px | No |
| Daily budget | `$` prefix, number input on click, 13px mono bold | **Yes** — click to edit |
| Interest count | "12 interests" muted badge | No (summary) |
| Split test | Dropdown: Creative / Audience / Placement | **Yes** |
| Objective | Dropdown: Lead Gen / Traffic / Conversions | **Yes** |
| Expand chevron | Rotates on expand | Click to expand |

**Inline edit behavior:**
- Budget: click the `$45` → transforms to `<input type="number">` → blur/Enter saves → autosave PATCH
- Split test: `<select>` dropdown, change triggers autosave
- Objective: `<select>` dropdown, change triggers autosave

## Ad Set Row — Expanded

When expanded, reveals 3 interest tiers:

```
  HYPER (Exact Match)                     HOT (Strong Signal)                    BROAD (Reach)
  [Clinical Research ×] [Dermatology ×]   [Medical Research ×] [Healthcare ×]    [Science ×] [Health ×]
  [+ Add]                                 [+ Add]                                [+ Add]
```

| Tier | Chip Color | Background | Border |
|---|---|---|---|
| Hyper | Gold text `#92400e` | `#fef3c7` | `#fde68a` |
| Hot | Pink text `#9d174d` | `#fce7f3` | `#fbcfe8` |
| Broad | Charcoal text `#32373C` | `#F7F7F8` | `#E8E8EA` |

**Interest editing:**
- Click `×` on a chip → removes interest → autosave
- Click `+ Add` → inline text input appears → type → Enter adds → autosave
- Escape cancels the add input

## Autosave System

- Every edit triggers a debounced (800ms) PATCH to `/api/generate/[id]/strategy`
- Status indicator in the section header: green "Saved" / amber "Saving..." / red "Error — click to retry"
- Uses existing `useAutosave` hook pattern from the studio editor

## Editable vs Locked Fields

| Field | Editable | Why |
|---|---|---|
| Channel mix % | ✅ | Shift budget between channels |
| Ad set daily budget | ✅ | Fine-tune spend |
| Targeting interests | ✅ | Add/remove per tier |
| Split test variable | ✅ | Creative / Audience / Placement |
| Campaign objective | ✅ | Lead Gen / Traffic / Conversions |
| Ad set name | ❌ | Auto-generated from persona + channel |
| Persona assignment | ❌ | Set by Stage 1, changing breaks routing |
| Tier (1/2/3) | ❌ | Determined by budget analysis |

## Data Flow

### Read
Existing: `GET /api/generate/[id]/strategy` → returns `{ strategies: [...] }`

Each strategy has `strategy_data` JSONB containing:
```json
{
  "campaigns": [{
    "name": "...",
    "ad_sets": [{
      "name": "...",
      "persona_key": "...",
      "daily_budget": 45,
      "targeting_tier": "hyper",
      "interests": ["Clinical Research", "Dermatology"],
      "placements": ["ig_feed", "ig_story"],
      "split_test_variable": "creative",
      "objective": "lead_generation"
    }]
  }],
  "monthly_budget": 10000,
  "channel_allocation": { "Meta": 0.42, "LinkedIn": 0.28, ... }
}
```

### Write
NEW: `PATCH /api/generate/[id]/strategy`

**Request body:**
```json
{
  "strategy_id": "uuid",
  "updates": {
    "channel_allocation": { "Meta": 0.45, "LinkedIn": 0.25, ... },
    "ad_sets": {
      "ad_set_index": 0,
      "field": "daily_budget",
      "value": 50
    }
  }
}
```

Or simpler — send the full updated `strategy_data` JSONB:
```json
{
  "strategy_id": "uuid",
  "strategy_data": { ... full updated object ... }
}
```

The simpler approach avoids complex partial update logic. The frontend maintains the full strategy object in state, mutates it on each edit, and sends the whole thing on save.

## Components

### New Files
| Component | Purpose | Lines (est.) |
|---|---|---|
| `src/components/MediaStrategyEditor.tsx` | Main editor — replaces MediaStrategyTab | ~400 |
| `src/components/ChannelMixEditor.tsx` | Editable horizontal bar chart | ~150 |
| `src/components/AdSetRow.tsx` | Compact expandable row with inline editing | ~250 |
| `src/components/InterestChipEditor.tsx` | Tiered interest chips with add/remove | ~120 |
| `src/app/api/generate/[id]/strategy/route.ts` | MODIFY — add PATCH handler | ~50 |

### Modified Files
| File | Changes |
|---|---|
| `src/components/CampaignWorkspace.tsx` | Swap `MediaStrategyTab` for `MediaStrategyEditor` |

### Deleted Files
| File | Reason |
|---|---|
| `src/components/MediaStrategyTab.tsx` | Replaced by MediaStrategyEditor (678 lines → ~400 lines in new components) |

## Design System

Same enterprise OneForma light theme as the rest of the marketing view:
- Background: `#FFFFFF`, cards: `#F7F7F8` borders
- Text: `#1A1A1A` primary, `#8A8A8E` muted
- Charcoal buttons `#32373C`, pill-shaped
- Interest tiers: gold/pink/gray (matching agency view)
- Inline inputs: `borderRadius: 8px`, `border: 1px solid #E8E8EA`, focus: purple ring
- Autosave indicator: green dot / amber dot / red dot + text
