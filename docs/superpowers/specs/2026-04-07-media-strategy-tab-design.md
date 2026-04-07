# Media Strategy Tab Redesign — Design Spec

**Date:** 2026-04-07
**Status:** Approved
**Owner:** Steven Junop
**Affected area:** `src/components/CampaignWorkspace.tsx` — the Media Strategy tab shown in the marketing command center

## Context

The Media Strategy tab in the marketing view today reads as a wall of nested JSON-ish cards. Ad sets are listed flat under a campaign, channel information is buried in `placements[]` arrays, and there is no per-channel breakdown of how budget is distributed or which creatives serve which targeting. The structure mirrors the worker's data shape (country → campaign → ad set) instead of how a marketer actually reasons about a media plan (country → channel mix → per-channel setup → ad sets → creatives).

## Goals

1. Show, for each country, the **channel mix as a percentage of ad spend** (top 4 channels only, renormalized to 100%).
2. Per channel: show the campaign **objective**, **monthly/daily budget**, and the ad sets that run on it.
3. Per ad set: show **targeting** as a visual (age range, interests, geographics) — not a raw JSON dump.
4. Per ad set: show the **creatives assigned** — count plus small thumbnails with the key headline on each.
5. Handle multi-country runs cleanly (country tabs).
6. Keep everything **client-side derivation** — no worker changes, no new API routes.

## Non-Goals

- Editing strategy from this tab (read-only view; editing already lives in the admin / per-asset modals).
- Server-side aggregation or new database columns.
- Replacing the existing `ResearchAccordion` / Regional Intelligence tab.
- Video creative thumbnails (out of scope; Stage 5 is still proof-of-concept).

## Hierarchy (approved Option C with refinement)

```
Country Tabs  (Brazil active · Mexico · Indonesia …)
 └── Country Header           big budget, tier pill, split test, persona/ad-set counts
 └── Channel Mix (per country) stacked bar (top 4 channels, renormalized) + 4-up legend
 └── Channel Block × 4        collapsible, first expanded by default
      ├── Header               logo, objective chips, per-channel $/mo, % of country spend
      └── Body
          └── Ad Set Card × N   (2-up grid on desktop)
               ├── Name + tier badge (hyper/hot/broad)
               ├── Age bar (gradient) + "Age 18-34 · All genders"
               ├── Interest chips
               ├── Geographic chips
               ├── Creative strip (count badge + up to 4 thumbs + overflow tile)
               └── Kill / scale rules (compact row)
```

Country header lives above the channel mix because, per product input, the country heavily affects which channels matter — showing Brazil's mix globally would be misleading.

## Data Flow

All inputs already exist in props passed to the current Media Strategy tab. No new fetches, no worker changes.

### Inputs

- `strategies: CampaignStrategy[]` — one row per country from the `campaign_strategies` table. Each has `strategy_data.campaigns[].ad_sets[]`, `monthly_budget`, `tier`, `budget_mode`, `split_test`, `scaling_rules`.
- `assets: GeneratedAsset[]` — composed creatives from Stage 4 (`asset_type === 'composed_creative'`). Each has `content.persona_key`, `content.platform`, `content.headline`, `blob_url`, `vqa_score`.
- `briefData: BriefData` — `personas[]` with `best_channels[]` and `targeting_profile.budget_weight_pct`.

### Per-country derivations

**1. Channel mix (research-driven, top 4, renormalized):**

```
function computeChannelMix(personas): { channel: string; pct: number }[]
  mix = {}
  for p in personas:
    share = p.targeting_profile.budget_weight_pct / 100
    if not p.best_channels or p.best_channels.length === 0:
      continue  // fallback handled below
    per_channel_share = share / p.best_channels.length
    for ch in p.best_channels:
      normalized = toChannel(ch)      // existing helper
      mix[normalized] = (mix[normalized] || 0) + per_channel_share
  sorted = Object.entries(mix).sort((a,b) => b[1] - a[1])
  top4 = sorted.slice(0, 4)
  total = sum(top4.map(v => v[1]))
  return top4.map(([ch, v]) => ({ channel: ch, pct: v / total }))
```

Fallback: if every persona in the country has empty `best_channels`, union of ad-set `placements[]` is used instead and a small "(from strategy placements)" subtitle is shown below the bar.

**2. Per-channel spend:**

```
channel_monthly = country.monthly_budget × channel_mix_pct
channel_daily = channel_monthly / 30
```

In `budget_mode === 'ratio'` runs, spend numbers become "—" and the header shows a "ratio mode" tag instead of dollar amounts.

**3. Group ad sets under channels:**

```
function groupAdSetsByChannel(campaigns, topChannels):
  result = Map<channel, AdSet[]>
  for camp in campaigns:
    for adSet in camp.ad_sets:
      for placement in adSet.placements:
        ch = toChannel(placement)
        if ch in topChannels:
          result[ch].push({ ...adSet, _campaign: camp })  // carries objective up
  return result
```

An ad set with placements `[facebook_feed, instagram_feed]` appears under **both** Facebook and Instagram. This duplication is intentional — the per-channel story must be self-contained.

**4. Per-channel objective:**

Inherited from the parent campaign via `_campaign.objective`. If multiple campaigns share a channel, objectives are joined (e.g., "Lead Generation · Video Views"). Rare in practice; acceptable for v1.

**5. Match creatives to ad sets:**

```
function matchCreatives(adSet, assets, channel):
  return assets
    .filter(a =>
      a.asset_type === 'composed_creative'
      && a.content?.persona_key === adSet.persona_key
      && toChannel(a.content?.platform) === channel
    )
    .sort((a,b) => (b.vqa_score ?? 0) - (a.vqa_score ?? 0))
```

Creative strip renders up to 4 thumbs; overflow becomes a `+N` tile that opens the platform drill-down (existing route).

## Component Structure

All components live in a single file: **`src/components/MediaStrategyTab.tsx`** (~800 lines). Single-file is chosen because nothing in here is reused elsewhere — splitting would be premature abstraction.

```
MediaStrategyTab (default export, 'use client')
├── state
│   ├── activeCountry: string           (first strategy.country by default)
│   └── expandedChannels: Set<string>   (first channel of active country by default)
│
├── derived (via useMemo keyed on activeCountry)
│   ├── activeStrategy
│   ├── activePersonas                  (filtered from briefData.personas)
│   ├── channelMix: { channel, pct }[]  (top 4 renormalized)
│   └── channelBlocks: { channel, adSets, objectives, monthly }[]
│
├── helper functions (module-level, pure)
│   ├── computeChannelMix(personas): ...
│   ├── groupAdSetsByChannel(campaigns, topChannels): ...
│   └── matchCreatives(adSet, assets, channel): Asset[]
│
└── sub-components (module-level, not nested inside MediaStrategyTab)
    ├── <CountryTabs countries activeCountry onChange />
    ├── <CountryHeader strategy />
    ├── <ChannelMixBar mix totalMonthly />
    ├── <ChannelBlock channel mix adSets objectives expanded onToggle assets />
    │   ├── <ChannelBlockHeader ... />
    │   └── <AdSetCard adSet channel assets />
    │       ├── <TierBadge tier />
    │       ├── <AgeBar min max />
    │       ├── <InterestTags interests />
    │       ├── <GeoTags locations />
    │       ├── <CreativeThumbStrip adSet channel assets />
    │       │   └── <CreativeThumb asset />     (real image or gradient fallback)
    │       └── <RulesRow killRule scaleRule />
```

**React-best-practices honored:**

- `rerender-no-inline-components` — all sub-components defined at module level, never inside the render body.
- `rendering-conditional-render` — ternaries, not `&&`.
- `rerender-derived-state-no-effect` — all derivations live in `useMemo`, never in `useEffect`.
- `rerender-dependencies` — `useMemo` dependencies are primitive (`activeCountry` string) where possible.
- `rendering-hoist-jsx` — static JSX (channel logo SVGs) lives outside the component.
- `rerender-simple-expression-in-memo` — avoided for trivial values.

## Visual Treatment

Matches the approved vertical-slice mockup stored at
`.superpowers/brainstorm/68189-1775565914/content/vertical-slice.html`.

Key brand-respecting choices:

- OneForma LIGHT theme throughout (`#FFFFFF` background, `#1A1A1A` text, `#F5F5F5` muted).
- Channel brand colors used sparingly for the left border on each block (`#1877F2` Facebook, `#E1306C` Instagram, `#000` TikTok, `#0A66C2` LinkedIn, etc.) via `getPlatformMeta()`.
- Accent gradient `linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))` used for the age bar fill and creative thumb fallback background.
- Ad-set card left border encodes tier: Hyper `#6B21A8`, Hot `#f59e0b`, Broad `#22c55e`.
- All buttons pill-shaped (`rounded-full`), interactive elements have `cursor-pointer`.
- System font stack only, no Google Fonts.

## Edge Cases

| Case | Behavior |
|---|---|
| No `campaign_strategies` at all | Empty state: "Media strategy hasn't been generated yet." |
| Country has strategy but every persona has empty `best_channels` | Fall back to union of ad-set `placements[]`, show "(from strategy placements)" subtitle |
| Fewer than 4 unique channels after mix calc | Show only what exists, still renormalize to 100% |
| Ad set has zero matching creatives | `0 creatives` badge + dashed placeholder strip |
| Asset has no `blob_url` | Gradient + headline fallback thumb with the asset's headline baked in |
| `budget_mode === 'ratio'` (no dollar amounts) | Replace all `$X/mo` with `—`, country header shows "ratio mode" tag |
| Multi-campaign country (rare) | Per-channel header shows joined objectives (`"Lead Gen · Video Views"`) |
| Ad set with multi-platform placements (e.g. `[facebook_feed, instagram_feed]`) | Ad set appears under each of its channels — intentional duplication for per-channel storytelling |
| Channel in top-4 has zero ad sets (mix says use it but strategy missed it) | Channel block still renders with a "No ad sets assigned yet" row |

## Testing Strategy

Pure helpers get unit tests; the component gets a render smoke test.

**Unit tests** at `src/components/__tests__/media-strategy-tab.test.tsx`:

- `computeChannelMix`:
  - Even budget weights, 3 personas, each with 3 best_channels → even distribution
  - Uneven weights → weighted distribution
  - More than 4 unique channels → top 4 selected, renormalized to sum exactly 1.0 (within float tolerance)
  - Empty `best_channels` on all personas → returns empty array (triggers fallback path)
  - One persona with `best_channels.length === 1` → full share to that one channel
- `groupAdSetsByChannel`:
  - Ad set with single placement
  - Ad set with 2 placements appears under both channels
  - Placement not in top-4 → dropped
  - Campaign objective propagates onto each grouped ad set
- `matchCreatives`:
  - Persona match filter
  - Platform normalization (e.g. `"Facebook Feed"` and `"facebook_feed"` both match Facebook)
  - VQA score sort order
  - Non-composed asset kinds excluded

**Component smoke test:**

- Render with a realistic fixture (2 countries, 3 personas, 7 ad sets, 50 assets)
- Assert first country tab active, first channel expanded
- Assert channel mix bar has 4 segments summing to ~100%
- Assert creative strip shows correct count badge
- Assert clicking a second country tab updates the header
- Assert clicking a channel header toggles its expanded state

## File Changes Summary

| File | Change | Approx LOC |
|---|---|---|
| `src/lib/platforms.tsx` | New file — extract `PLATFORM_META`, `getPlatformMeta`, `PlatformLogo`, `toChannel` from `CampaignWorkspace.tsx` | +80 |
| `src/components/CampaignWorkspace.tsx` | Remove inline platform helpers, import from new lib, replace inline media tab with `<MediaStrategyTab …>` mount | −220 / +6 |
| `src/components/MediaStrategyTab.tsx` | New file, default export, all sub-components module-level inline | +800 |
| `src/components/__tests__/media-strategy-tab.test.tsx` | New test file | +150 |

Net: roughly +800 lines of focused view code, `CampaignWorkspace.tsx` shrinks by ~220 lines (platform helpers extracted + media tab extracted).

## Open Questions (resolved)

- ~~Hierarchy~~ → Country tabs → per-country channel mix → per-channel drill-down
- ~~Channel mix source~~ → Research-driven (persona `best_channels` × `budget_weight_pct`)
- ~~best_channels weighting~~ → Even split (1 / `best_channels.length`) per persona
- ~~Channel count~~ → Top 4 per country, renormalized to 100%
- ~~Creative thumb image source~~ → Real `blob_url` if present, gradient + headline fallback
- ~~File structure~~ → Single file `MediaStrategyTab.tsx`, no subfolder
- ~~Edit capability~~ → Read-only in v1

## References

- Vertical-slice mockup: `.superpowers/brainstorm/68189-1775565914/content/vertical-slice.html`
- Current Media Strategy tab: `src/components/CampaignWorkspace.tsx:1325-1487`
- Alternate inline view in brief: `src/components/BriefExecutive.tsx:719-872` (separate, not touched by this spec)
- Strategy API: `src/app/api/generate/[id]/strategy/route.ts`
- Strategy data shape: `worker/prompts/campaign_strategy.py:272-324`
- Persona `best_channels` source: `worker/prompts/persona_engine.py:656`
- Platform helpers (to be extracted): `src/components/CampaignWorkspace.tsx:63-120, 606` (`PLATFORM_META`, `getPlatformMeta`, `PlatformLogo`, `toChannel`)
