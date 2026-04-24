# Unified Campaign Workspace — Design Spec

> Feature: Replace campaign splitting with a single-campaign, multi-country workspace. Country bar as primary navigation across all sections.
> Date: 2026-04-23
> Status: Approved
> Depends on: Country Quotas & Demographics (2026-04-22 spec — intake wizard changes)

---

## Problem

Multi-country campaigns currently split into independent child `intake_requests` via the campaign splitter. This creates:
- Disconnected campaigns that are hard to navigate as a group
- No unified view of a 16-country campaign
- Parent-child relationship complexity in the UI and database
- No aggregate stats or cross-country comparison

## Solution

**One campaign, one `intake_request`, many countries.** The CampaignWorkspace gets a top-level country bar that filters all content — brief, personas, creatives, media strategy, channel mix, videos, and cultural research. An "All Countries" overview shows the full campaign at a glance with per-country status cards.

---

## Schema Changes

### New columns

| Table | Column | Type | Default | Purpose |
|---|---|---|---|---|
| `compute_jobs` | `country` | TEXT | NULL | Which country this job generates for |
| `actor_profiles` | `country` | TEXT | NULL | Which country this actor belongs to |
| `generated_assets` | `country` | TEXT | NULL | Which country this asset was generated for |
| `campaign_landing_pages` | `country` | TEXT | NULL | Per-country landing page URLs |
| `tracked_links` | `country` | TEXT | NULL | Per-country tracked links |
| `notifications` | `country` | TEXT | NULL | Country-specific notifications (e.g., "Morocco complete") |
| `notification_deliveries` | `country` | TEXT | NULL | Country-specific delivery tracking |

### Constraint changes

| Table | Change |
|---|---|
| `campaign_landing_pages` | Remove UNIQUE constraint on `request_id` — now one row per country per campaign |
| `compute_jobs` | Add new `job_type` value: `'generate_country'` to CHECK constraint |

### Tables unchanged

| Table | Why |
|---|---|
| `intake_requests` | One row per campaign. Country data lives in `form_data.country_quotas` |
| `campaign_strategies` | Already has `country` column — no change needed |
| `creative_briefs` | One per campaign (global brief). Per-country brief sections live in `brief_data` JSONB |
| `task_type_schemas` | Global config |
| `option_registry` | Global config |
| `user_roles` | Auth |
| `magic_links` | Auth |
| `approvals` | Per-campaign |

### Migration SQL

```sql
-- Add country columns
ALTER TABLE compute_jobs ADD COLUMN country TEXT;
ALTER TABLE actor_profiles ADD COLUMN country TEXT;
ALTER TABLE generated_assets ADD COLUMN country TEXT;
ALTER TABLE campaign_landing_pages ADD COLUMN country TEXT;
ALTER TABLE tracked_links ADD COLUMN country TEXT;
ALTER TABLE notifications ADD COLUMN country TEXT;
ALTER TABLE notification_deliveries ADD COLUMN country TEXT;

-- Remove unique constraint on campaign_landing_pages.request_id
ALTER TABLE campaign_landing_pages DROP CONSTRAINT IF EXISTS campaign_landing_pages_request_id_key;

-- Add generate_country to compute_jobs job_type check
ALTER TABLE compute_jobs DROP CONSTRAINT IF EXISTS compute_jobs_job_type_check;
ALTER TABLE compute_jobs ADD CONSTRAINT compute_jobs_job_type_check
  CHECK (job_type IN ('generate', 'generate_country', 'regenerate', 'regenerate_stage', 'regenerate_asset', 'resume_from'));

-- Indexes for country-filtered queries
CREATE INDEX idx_generated_assets_country ON generated_assets (request_id, country);
CREATE INDEX idx_actor_profiles_country ON actor_profiles (request_id, country);
CREATE INDEX idx_compute_jobs_country ON compute_jobs (request_id, country);
```

### Query patterns

```sql
-- All assets for Morocco in this campaign
SELECT * FROM generated_assets
WHERE request_id = $1 AND country = 'Morocco';

-- All actors for Morocco
SELECT * FROM actor_profiles
WHERE request_id = $1 AND country = 'Morocco';

-- Strategy for Morocco (already works — no change)
SELECT * FROM campaign_strategies
WHERE request_id = $1 AND country = 'Morocco';

-- "All Countries" view — drop the country filter
SELECT * FROM generated_assets WHERE request_id = $1;

-- Per-country job status
SELECT country, status, stage_target FROM compute_jobs
WHERE request_id = $1 AND job_type = 'generate_country';

-- Campaign overall status (all countries done?)
SELECT COUNT(*) FILTER (WHERE status != 'complete') AS remaining
FROM compute_jobs
WHERE request_id = $1 AND job_type = 'generate_country';
```

---

## Pipeline Orchestration

### Current flow (retired)

```
intake_request → orchestrator → should_split() → YES
  → campaign_splitter creates 16 CHILD intake_requests + 16 compute_jobs
  → parent marked 'split'
  → each child runs full pipeline independently
```

### New flow

```
intake_request → orchestrator → has_country_quotas() → YES
  → create_country_jobs() creates 16 compute_jobs (job_type: 'generate_country')
  → each job has: request_id (SAME), country, persona_count, actors_per_persona
  → intake_request stays status: 'generating'
  → worker picks up jobs, runs pipeline per country
  → each job writes to actor_profiles/generated_assets with country column
  → when ALL 16 jobs complete → intake_request status: 'review'
```

### Orchestrator changes

Replace `campaign_splitter.py` with `country_job_creator.py`:

```python
async def has_country_quotas(request: dict) -> bool:
    quotas = request.get("form_data", {}).get("country_quotas", [])
    return len(quotas) >= 1

async def create_country_jobs(request: dict, request_id: str) -> list[dict]:
    quotas = request["form_data"]["country_quotas"]
    country_count = len(quotas)
    scaling = get_persona_scaling(country_count)

    jobs = []
    for quota in quotas:
        job_id = str(uuid.uuid4())
        await insert_compute_job(
            id=job_id,
            request_id=request_id,
            job_type='generate_country',
            country=quota["country"],
            # Store scaling + quota data in feedback_data JSONB
            feedback_data={
                "persona_count": scaling["personas"],
                "actors_per_persona": scaling["actors_per_persona"],
                "total_volume": quota["total_volume"],
                "rate": quota["rate"],
                "currency": quota["currency"],
                "demographics": quota.get("demographics", []),
                "locale": quota.get("locale", ""),
            },
        )
        jobs.append({"job_id": job_id, "country": quota["country"]})

    return jobs
```

### Persona scaling rule

```python
PERSONA_SCALING = {
    1: {"personas": 2, "actors_per_persona": 2},
    2: {"personas": 2, "actors_per_persona": 2},
}
PERSONA_SCALING_DEFAULT = {"personas": 1, "actors_per_persona": 1}  # 3+ countries
```

### Per-country pipeline execution

When the worker picks up a `generate_country` job:
1. Read `country` from the job row
2. Read scaling + quota data from `feedback_data`
3. Run the full Stage 1-4 pipeline scoped to that country
4. All writes to `actor_profiles` and `generated_assets` include the `country` column
5. `campaign_strategies` writes already include `country` — no change
6. On completion, mark the job as `complete`
7. Check if all country jobs for this request are complete → if so, update `intake_request.status` to `review`

### Single-country campaigns

Campaigns with 1-2 countries in `country_quotas` still create per-country jobs but with higher persona/actor counts (2/2). Campaigns with no `country_quotas` run the legacy single pipeline (backwards compatible).

### Campaign splitter retirement

`worker/pipeline/campaign_splitter.py` is no longer called by the orchestrator. It can be kept for reference but the `should_split()` / `split_campaign()` path is removed from `orchestrator.py`.

---

## Frontend Architecture

### Component hierarchy

```
Detail Page (/intake/[id])
└── CampaignWorkspace
    ├── Campaign Summary Banner (title, aggregate stats, status counts)
    ├── CountryBar (primary nav — "All Countries" + country tabs with status badges)
    │
    ├── [selectedCountry === null] → AllCountriesOverview
    │   ├── Status filter pills (All / Done / Generating / Pending)
    │   ├── Country cards grid (4 columns)
    │   │   └── Per-country: name, status, volume, rate, languages, demographics, asset counts, progress bar
    │   └── Aggregate stats footer
    │
    └── [selectedCountry !== null] → Country detail view
        ├── CountryHeader (volume, rate, languages, demographics, asset counts, status)
        ├── Section pills (Brief / Personas / Creatives / Media Strategy / Channel Mix / Videos / Cultural Research)
        └── Section content (filtered by country)
            ├── Brief → campaign brief scoped to country
            ├── Personas → actor_profiles WHERE country = selected
            ├── Creatives → ChannelCreativeGallery WHERE country = selected
            ├── Media Strategy → campaign_strategies WHERE country = selected
            ├── Channel Mix → budget split from strategy_data WHERE country = selected
            ├── Videos → generated_assets WHERE asset_type='video' AND country = selected
            └── Cultural Research → cultural research for this country
```

### New components

| Component | File | Purpose |
|---|---|---|
| `CountryBar` | `src/components/campaign/CountryBar.tsx` | Horizontal scrollable tab bar. Props: `countries: {name, status}[]`, `selected: string | null`, `onChange: (country | null) => void`. Shows status badges inline. |
| `AllCountriesOverview` | `src/components/campaign/AllCountriesOverview.tsx` | Grid of country cards with status filters + aggregate stats. Props: `quotas: CountryQuota[]`, `jobs: ComputeJob[]`, `assets: GeneratedAsset[]`, `onSelectCountry: (country) => void`. |
| `CountryHeader` | `src/components/campaign/CountryHeader.tsx` | Per-country summary bar. Props: `quota: CountryQuota`, `job: ComputeJob`, `assetCounts: {images, creatives, copy, videos}`. |
| `SectionPills` | `src/components/campaign/SectionPills.tsx` | Horizontal pill nav for Brief/Personas/Creatives/etc. Replaces old MiniTabs in the country detail view. |

### Modified components

| Component | File | Change |
|---|---|---|
| `CampaignWorkspace` | `src/components/CampaignWorkspace.tsx` | Add `CountryBar` as primary nav. Replace MiniTabs with `SectionPills`. Pass `selectedCountry` to all child sections. Filter actors/assets by country via `useMemo`. |
| `ChannelCreativeGallery` | `src/components/creative-gallery/ChannelCreativeGallery.tsx` | Accept `country` prop, filter assets by country before rendering. |
| Detail page | `src/app/intake/[id]/page.tsx` | Add `selectedCountry` state. Fetch all data once. Pass country filter to CampaignWorkspace. |

### Data fetching strategy

Load ALL data for the campaign in one fetch (brief, actors, assets, strategies, compute_jobs). Country filtering happens **client-side** via `useMemo`:

```typescript
const countryActors = useMemo(
  () => selectedCountry
    ? actors.filter(a => a.country === selectedCountry)
    : actors,
  [actors, selectedCountry]
);

const countryAssets = useMemo(
  () => selectedCountry
    ? assets.filter(a => a.country === selectedCountry)
    : assets,
  [assets, selectedCountry]
);

const countryStrategies = useMemo(
  () => selectedCountry
    ? strategies.filter(s => s.country === selectedCountry)
    : strategies,
  [strategies, selectedCountry]
);
```

No extra API calls when switching countries. Instant tab switching.

### Country bar behavior

- **Scrollable** — horizontal scroll for 16+ countries, no wrapping
- **Status badges** inline per country: DONE (green), GEN/STAGE N (blue), PEND (gray)
- **"All Countries"** always first, active by default
- **Clicking a country card** in AllCountriesOverview switches the country bar to that country
- **Auto-refresh** — compute_job status polled every 10s, country badges update live

### "All Countries" overview behavior

- **Status filter pills** — filter the card grid (All / Done / Generating / Pending)
- **Country cards** — 4-column grid, each shows: name, status badge, volume, rate, languages, demographic quotas, asset counts (if done), progress bar (if generating), queue position (if pending)
- **Generating cards** — blue tinted border, gradient progress bar showing current stage
- **Pending cards** — slightly faded (opacity 0.7), show queue position
- **Aggregate stats footer** — total countries, contributors, assets, personas, completion counts

---

## Design System

All new components follow the existing OneForma brand:

| Element | Style |
|---|---|
| Country bar | White background, `border-bottom: 2px solid #E5E5E5`, active tab has `border-bottom: 2px solid #32373C` + `font-weight: 700` |
| Status badges | DONE: `bg: #dcfce7, color: #15803d`. GEN: `bg: #dbeafe, color: #1d4ed8`. PEND: `bg: #f5f5f5, color: #737373`. All `border-radius: 9999px`, `font-size: 9px` |
| Country cards | `border: 1px solid #E5E5E5`, `border-radius: 12px`, `box-shadow: 0 2px 8px rgba(0,0,0,0.04)`, `padding: 16px` |
| Generating cards | `border-color: #dbeafe`, `background: rgba(219,234,254,0.15)` |
| Progress bar | `height: 4px`, `background: #e5e5e5`, fill: `linear-gradient(135deg, #0693E3, #9B51E0)` |
| Section pills | Active: `bg: #32373C, color: #fff`. Inactive: `bg: #F5F5F5, color: #1A1A1A`. All `border-radius: 9999px`, `font-size: 12px` |
| Summary banner | `background: linear-gradient(135deg, rgba(6,147,227,0.06), rgba(155,81,224,0.06))` |
| Country header | `background: #F5F5F5`, `border-radius: 10px`, `padding: 16px 20px` |
| Aggregate footer | `background: #F5F5F5`, `border-radius: 10px`, 6-column grid, centered stats |

---

## Files to Create / Modify

### New files

| File | Purpose |
|---|---|
| `src/components/campaign/CountryBar.tsx` | Country tab bar component |
| `src/components/campaign/AllCountriesOverview.tsx` | "All Countries" grid view |
| `src/components/campaign/CountryHeader.tsx` | Per-country summary header |
| `src/components/campaign/SectionPills.tsx` | Section navigation pills |
| `worker/pipeline/country_job_creator.py` | Replaces campaign_splitter — creates per-country compute_jobs |
| `migrations/2026-04-23-country-columns.sql` | Schema migration for country columns |

### Modified files

| File | Change |
|---|---|
| `src/components/CampaignWorkspace.tsx` | Add CountryBar, replace MiniTabs with SectionPills, pass selectedCountry to children |
| `src/components/creative-gallery/ChannelCreativeGallery.tsx` | Accept `country` prop, filter assets |
| `src/app/intake/[id]/page.tsx` | Add selectedCountry state, pass to CampaignWorkspace |
| `src/lib/types.ts` | Add `country` field to ComputeJob, ActorProfile, GeneratedAsset interfaces |
| `src/lib/db/schema.ts` | Add country columns to table definitions |
| `worker/pipeline/orchestrator.py` | Replace campaign_splitter calls with country_job_creator |
| `worker/pipeline/stage1_intelligence.py` | Read persona_count from job data, write country to actor_profiles |
| `worker/pipeline/stage2_images.py` | Read actors_per_persona from job data, write country to generated_assets |
| `worker/pipeline/stage3_copy.py` | Write country to generated_assets |
| `worker/pipeline/stage4_compose_v3.py` | Write country to generated_assets |
| `worker/main.py` | Handle `generate_country` job type, status rollup when all country jobs complete |
| `src/app/api/intake/route.ts` | Auto-calculate volume_needed from country quotas |

### Retired files

| File | Reason |
|---|---|
| `worker/pipeline/campaign_splitter.py` | Replaced by country_job_creator.py. No longer called by orchestrator. Keep for reference. |

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| No country_quotas in form_data | Legacy single pipeline (no country bar, no splitting). Backwards compatible. |
| 1 country in quotas | Creates 1 compute_job with generate_country. Country bar shows with just "All Countries" + the single country. 2 personas, 2 actors. |
| 2 countries | 2 compute_jobs. Country bar shows 3 tabs (All + 2 countries). 2 personas, 2 actors each. |
| 3+ countries | N compute_jobs. 1 persona, 1 actor each. |
| Country job fails | That country's badge shows "FAILED" (red). Other countries continue. Retry available per-country. |
| All countries complete | intake_request.status flips to 'review'. Teams notification sent. |
| Country selected but no assets yet | CountryHeader shows quota info. Content sections show "Generating..." or "Pending" state. |
| Country bar overflow (16+ tabs) | Horizontal scroll with fade gradient on right edge. "+N" button scrolls to show remaining. |

---

## Out of Scope

- Per-country approval workflow (approve Morocco independently) — future enhancement
- Recruiter workspace country filtering — separate spec
- Designer portal country filtering — separate spec
- Agency view country filtering — separate spec
- Command Center ROAS per country — separate spec (SRC Command Center port)
- Phase 2: Persona engine demographic integration
