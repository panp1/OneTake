# Agency View Redesign — Design Spec

**Date:** 2026-04-12
**Author:** Steven Junop + Claude
**Status:** Approved
**Mockup:** `.superpowers/brainstorm/97455-1776000958/content/03-agency-stacked-v3.html`

## Overview

Redesign the agency magic-link portal from a massive scroll dump into a structured, enterprise-grade 2-tab experience. The current view overwhelms with all personas/creatives in one flat page. The redesign organizes content into Overview & Strategy + Channels & Ad Sets tabs.

**Current state:** Single scrolling page in `src/app/agency/[id]/page.tsx` (~497 lines) that dumps strategy, then all personas with flat creative grids grouped by platform.

**Target state:** 2-tab layout with channel mix, persona overview, and per-channel ad set cards with accordion V-groups containing stacked thumbnails + ad copy + pre-generated UTM links.

## Design System

Same enterprise OneForma tokens as recruiter view redesign:
- Charcoal `#32373C`, Muted `#8A8A8E`, Border `#E8E8EA`, Purple `#6D28D9`
- Grayscale dominant, purple sparingly
- Lucide icons only
- All inline styles (matching existing agency page pattern)

## Tab Structure

```
[Overview & Strategy]  [Channels & Ad Sets]
      ↑ default              ↑ new
```

### Tab 1: Overview & Strategy

**Channel Mix & Budget Split panel:**
- Horizontal bar chart (charcoal → gray gradient, same as recruiter dashboard)
- Each row: channel label (100px) | bar with percentage | percentage text | monthly budget
- Data source: computed from `brief.brief_data.personas` — each persona has `best_channels[]` and `budget_weight_pct`, distributed across channels

**Persona Overview panel:**
- 3-column grid of persona cards
- Each card: persona name + archetype, demographics, budget weight, pool size, expected CPL, pillar, channel chips
- Data source: `brief.brief_data.personas[]` with `targeting_profile` sub-object

### Tab 2: Channels & Ad Sets

**Channel sub-tabs:**
- Pill tabs: "Meta · 3 ad sets", "LinkedIn · 2 ad sets", etc.
- Active: charcoal fill. Inactive: white with border.
- Only show channels that have creatives
- Channels derived from: `getActiveChannels()` in `src/lib/channels.ts`

**Per ad set card:**
- **Header:** Ad set name, persona chip (purple tint), "Download Ad Set" button
- **Meta row:** Objective, daily budget, split test variable (from `brief.brief_data.campaign_strategies_summary`)
- **Targeting Interests:** 3-column grid (Hyper/Hot/Broad) with color-coded chips
  - Hyper (gold `#fef3c7`): exact match interests
  - Hot (pink `#fce7f3`): strong signal interests
  - Broad (gray `#F7F7F8`): reach interests
  - Source: `persona.targeting_profile.interests.hyper[]`, `.hot[]`, `.broad[]`

**Version accordions (collapsed by default):**
- **Trigger row:** Chevron, V-badge, headline, format pills, VQA score, "Download VN" button
- **Padding:** `14px 18px` on trigger, `12px` gap, button has `7px 16px` padding + `8px` left margin
- **Expanded body (stacked layout):**
  1. **Thumbnails** (top) — format thumbnails at true aspect ratios with labels (Feed 1:1, Story 9:16, Carousel 4:5), separated by bottom border
  2. **Ad Copy** (below thumbnails):
     - Primary Text — full multi-line in bordered text block, `user-select: all` for easy copy
     - Headline + Description — side-by-side 2-column grid
     - CTA — single field
  3. **UTM Link** (bottom) — dark bar with green dot, pre-built URL, "Copy Link" button

**Version grouping:** Same V1/V2/V3 convention as marketing view — grouped by `(actor_name + pillar)` combination via `groupCreativesByVersion()` from `src/lib/channels.ts`

**Creative-to-adset routing:** Match creatives to ad sets by persona key + channel. Each ad set is associated with one persona, and creatives are filtered to that persona's versions for the active channel.

## UTM Link Generation

**Pre-generated on page load** (not on-click). Each creative version gets a tracked link.

**UTM params:**
- `utm_campaign` = campaign_slug
- `utm_source` = channel name (meta, linkedin, reddit, etc.)
- `utm_medium` = "paid" (NOT "referral" — this is for paid media team)
- `utm_term` = ad set name (slugified)
- `utm_content` = version label (v1, v2, v3)

**Base URL priority:** Landing Page URL > Job Posting URL > **NEVER** ADA form URL.
- Source: `campaign_landing_pages` table via `/api/intake/[id]/landing-pages`
- If neither landing_page_url nor job_posting_url exists, show "No tracking URL available" instead of a link

**Implementation:** Build UTM URLs client-side using `buildDestinationUrl()` from `src/lib/tracked-links/build-url.ts`. These are NOT tracked links (no slug/redirect) — they're plain UTM-tagged URLs for the agency to paste into ad managers. The tracking happens via the UTM params in the ad platform's analytics.

## Download Buttons

3 levels of download:
1. **"Download All"** (header) — full package ZIP via existing `/api/export/[id]` endpoint
2. **"Download Ad Set"** (per ad set card) — ZIP containing all versions for that ad set. Filter by persona + channel.
3. **"Download VN"** (per version accordion) — ZIP containing all format variants for that version. Named folder: `V1-MariaG-Shape-Feed-Story-Carousel/`

Downloads use existing `/api/export/[id]` with query params for filtering, or client-side ZIP generation via individual blob_url downloads.

## Components to Create/Modify

### New Components
| Component | Purpose |
|---|---|
| `src/components/agency/AgencyOverviewTab.tsx` | Channel mix + persona overview |
| `src/components/agency/AgencyChannelsTab.tsx` | Channel sub-tabs + ad set cards |
| `src/components/agency/AdSetCard.tsx` | Single ad set with targeting + version accordions |
| `src/components/agency/VersionAccordion.tsx` | Collapsible V-group with thumbnails + copy + UTM |
| `src/components/agency/ChannelMixChart.tsx` | Horizontal bar chart for channel budget split |

### Modified Files
| File | Changes |
|---|---|
| `src/app/agency/[id]/page.tsx` | Replace monolithic render with 2-tab layout using new components |

### Data Flow
```
page.tsx fetches: request, brief, assets, actors, strategies
  → passes to tab components
    → AgencyOverviewTab: brief.brief_data (personas, channels)
    → AgencyChannelsTab: assets, brief, strategies
      → groups by channel via getActiveChannels()
      → groups by ad set via campaign_strategies_summary + persona mapping
      → groups creatives by version via groupCreativesByVersion()
      → AdSetCard per ad set
        → VersionAccordion per V-group
          → thumbnails + copy + UTM link
```

## File Count Estimate
- ~5 new component files
- ~1 modified page file
- **Total:** ~6 files, ~1200-1500 new lines
