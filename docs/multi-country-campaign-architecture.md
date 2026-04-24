# Multi-Country Campaign Architecture

> Internal documentation for Nova's multi-country/multi-locale campaign pipeline.
> Last updated: 2026-04-22

---

## Table of Contents

1. [Overview](#overview)
2. [Intake Flow](#intake-flow)
3. [Campaign Splitter](#campaign-splitter)
4. [Pipeline Stages — Per-Country Behavior](#pipeline-stages--per-country-behavior)
5. [Database Schema](#database-schema)
6. [Asset Volume Projections](#asset-volume-projections)
7. [Locale Rate Integration](#locale-rate-integration)
8. [Known Bottlenecks](#known-bottlenecks)
9. [Open Architecture Decisions](#open-architecture-decisions)
10. [Appendix: File Reference](#appendix-file-reference)

---

## Overview

Nova handles multi-country recruitment campaigns through an **automatic campaign splitter**. When a recruiter submits a campaign targeting 3 or more countries, the system splits it into independent per-country child campaigns, each running the full 6-stage generation pipeline.

```
Recruiter submits intake (16 countries)
         |
         v
  Campaign Splitter (threshold: 3+ countries)
         |
         v
  Parent request --> status: 'split'
         |
         v
  16 child campaigns created
  (one per country, each with its own compute_job)
         |
         v
  Worker picks up children sequentially
  Each child runs full Stage 1-6 pipeline
```

**Split threshold:** `SPLIT_THRESHOLD = 3` (configurable in `campaign_splitter.py`)

---

## Intake Flow

### How Multi-Country Data Enters the System

The intake wizard captures multi-country campaigns via three fields:

| Field | Type | Location | Example |
|-------|------|----------|---------|
| `target_regions` | TEXT[] | StepDetails | `["Morocco", "France", "Brazil", "Germany"]` |
| `target_languages` | TEXT[] | StepDetails | `["Arabic", "French", "Portuguese", "German"]` |
| `locale_links` | JSONB (in form_data) | StepRequirements (Excel upload) | Array of `LocaleLink` objects with locale, language, URL, rate |

### LocaleLink Schema

Parsed from Excel upload via `LocaleLinksUpload.tsx`:

```typescript
interface LocaleLink {
  locale: string;           // e.g., "bg_BG"
  language: string;         // e.g., "Bulgarian (Bulgaria)"
  url: string;              // OneForma job posting URL
  location: string;         // e.g., "Sofia"
  rate: string;             // e.g., "$ 17.5" (currently stored as string)
  payment_qualification: string;
  additional_url?: string;
  additional_purpose?: string;
}
```

### Submission

1. Recruiter fills intake form with multiple countries/languages
2. `POST /api/intake` creates one `intake_requests` row
3. API auto-queues a `compute_jobs` row (job_type: `generate`, status: `pending`)
4. Worker claims the job on next poll cycle

---

## Campaign Splitter

**File:** `worker/pipeline/campaign_splitter.py`

### Split Logic

```python
SPLIT_THRESHOLD = 3  # campaigns with 3+ unique countries are split
```

When the orchestrator receives a generation job, it calls `should_split(request)`. If the campaign targets 3+ countries:

1. **Region normalization** — `REGION_TO_COUNTRY` mapping handles edge cases (e.g., "South Tyrol" maps to "Italy")
2. **City identification** — For each country, an LLM identifies the top 3 recruitment cities:
   - Largest metro area
   - College town / university hub
   - Suburban / secondary metro
3. **Language assignment** — `COUNTRY_LANGUAGE_MAP` assigns relevant languages per country
4. **Child campaign creation** — For each country:
   - New `intake_requests` row (status: `generating`, inherits parent data)
   - Country-specific `target_languages` filtered from parent
   - Filtered `locale_links` (only those relevant to the country)
   - New `compute_jobs` row (status: `pending`)
5. **Parent update** — Parent request marked `status='split'`, child campaign IDs stored in `form_data.child_campaigns`

### Country-Language Map (Examples)

```python
COUNTRY_LANGUAGE_MAP = {
    "Morocco": ["Arabic", "French"],
    "Brazil": ["Portuguese", "English"],
    "Spain": ["Spanish", "Catalan", "Basque"],
    "Finland": ["Finnish", "Swedish"],
    "Germany": ["German"],
    "United States": ["English"],
    ...
}
```

### Post-Split Behavior

The parent job returns early. Child campaigns are picked up independently by the worker on subsequent poll cycles. Each child runs the complete 6-stage pipeline as if it were a standalone campaign.

---

## Pipeline Stages — Per-Country Behavior

Each child campaign (single country) runs through all 6 stages:

### Stage 1: Cultural Research + Brief

**File:** `worker/pipeline/stage1_intelligence.py`

| Component | Scope | Details |
|-----------|-------|---------|
| Cultural Research | Per-country | Kimi K2.5 researches 8 dimensions: AI fatigue, gig perception, trust, platform reality, economic context, cultural sensitivities, tech literacy, language nuance |
| Personas | Per-campaign (3 total) | Psychology-informed by cultural research. 3 personas generated per campaign |
| Campaign Strategy | Per-country | LLM generates unique media plan: budget allocation, channel strategy, persona weights, split test variable |

**Output:**
- 1 `creative_briefs` row (global brief + personas)
- 1 `campaign_strategies` row per country (media plan as JSONB)
- 3 `actor_profiles` stubs with targeting profile per persona

### Stage 2: Image Generation

**File:** `worker/pipeline/stage2_images.py`

| Component | Scope | Details |
|-----------|-------|---------|
| Actor Identity Cards | Per-persona, region-aware | Qwen LLM generates identity (considers region, language, cultural context) |
| Hero Seed Images | Per-actor (9 total) | Seedream generation with VQA validation (0.85 threshold) |
| Outfit/Backdrop Variations | Per-actor (3x per outfit) | Regional visual direction applied |

**Output per country:** ~27 base images (3 personas x 3 actors x 3 outfit variations)

### Stage 3: Copy Generation

**File:** `worker/pipeline/stage3_copy.py`

| Component | Scope | Details |
|-----------|-------|---------|
| Copy Variations | Per persona x channel x language | 3 psychological angle variations per combination |
| Cultural Injection | Per-country | Cultural research for persona's region injected into prompt |
| Quality Gate | Per-variation | Score against persona fit + conversion benchmarks (0.85 threshold) |

**Language derivation:** Languages derived from `target_languages` or `REGION_LANGUAGE_MAP`. Each copy asset tagged with its `language` field.

**Output per country:** ~150+ copy assets (3 personas x ~10 channels x languages x 3 variations)

### Stage 4: Composition

**File:** `worker/pipeline/stage4_compose_v3.py`

| Component | Scope | Details |
|-----------|-------|---------|
| HTML Generation | Per actor x top 2 pillars x platform | GLM-5 generates HTML creative |
| Rendering | Per composition | Playwright renders HTML to PNG |
| VQA Evaluation | Per composition | 0.75 threshold, retry up to 3x with feedback |

**Copy matching:** Compositions pull language-specific copy from the copy lookup, ensuring each creative uses the correct language for its target market.

**Output per country:** ~200+ composed creatives

### Stage 5: Video Generation

Per-country video assets using actors, copy, and regional context.

### Stage 6: Landing Pages

Per-country landing pages using copy, strategy, and locale_links for multilingual job posting URLs.

---

## Database Schema

### Core Tables for Multi-Country Campaigns

```
intake_requests (parent)
  |-- status: 'split'
  |-- form_data.child_campaigns: [child_id_1, child_id_2, ...]
  |
  |-- intake_requests (child 1 - Morocco)
  |     |-- campaign_strategies (Morocco media plan)
  |     |-- creative_briefs (brief + personas)
  |     |-- actor_profiles (9 actors)
  |     |-- generated_assets (images, copy, compositions)
  |
  |-- intake_requests (child 2 - France)
  |     |-- campaign_strategies (France media plan)
  |     |-- creative_briefs (brief + personas)
  |     |-- actor_profiles (9 actors)
  |     |-- generated_assets (images, copy, compositions)
  |
  |-- ... (child 3-16)
```

### Key Table Schemas

**campaign_strategies** — One row per country:

```sql
campaign_strategies (
  id UUID PRIMARY KEY,
  request_id UUID REFERENCES intake_requests(id),
  country TEXT,                    -- "Morocco", "France", etc.
  strategy_data JSONB,             -- channel strategy, persona weights, split test
  monthly_budget NUMERIC,          -- budget allocation for this country
  tier TEXT,                       -- budget tier classification
  budget_mode TEXT,                -- 'fixed' or 'ratio'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**generated_assets** — Tagged by language:

```sql
generated_assets (
  id UUID PRIMARY KEY,
  request_id UUID REFERENCES intake_requests(id),
  actor_id UUID REFERENCES actor_profiles(id),
  asset_type TEXT,                 -- 'base_image', 'composed_creative', 'copy', 'video'
  platform TEXT,                   -- 'instagram', 'facebook', 'linkedin', etc.
  format TEXT,                     -- 'image/png', 'text', 'video/mp4'
  language TEXT DEFAULT 'en',      -- language tag for the asset
  content JSONB,
  copy_data JSONB,
  blob_url TEXT,
  evaluation_score FLOAT,
  evaluation_data JSONB,
  evaluation_passed BOOLEAN,
  stage INT,
  created_at TIMESTAMPTZ
)
```

---

## Asset Volume Projections

### Per-Country Output

| Asset Type | Count | Details |
|------------|-------|---------|
| Base images | ~27 | 3 personas x 3 actors x 3 outfit variations |
| Copy variants | ~150 | 3 personas x ~10 channels x languages x 3 angles |
| Composed creatives | ~200 | actors x 2 pillars x platforms |
| Strategies | 1 | One media plan per country |
| **Subtotal** | **~378** | |

### Scaling by Campaign Size

| Countries | Child Campaigns | Total Assets (est.) | Pipeline Runs |
|-----------|----------------|---------------------|---------------|
| 1-2 | None (no split) | ~378 | 1 |
| 3 | 3 | ~1,134 | 3 |
| 5 | 5 | ~1,890 | 5 |
| 10 | 10 | ~3,780 | 10 |
| 16 | 16 | ~6,048 | 16 |
| 30 | 30 | ~11,340 | 30 |

### Real-World Example: Centaurus (16 Countries)

```
Centaurus Data Collection
  bg_BG  Bulgarian (Bulgaria)        $17.50
  hr_HR  Croatian (Croatia)          $27.50
  cs_CZ  Czech (Czech Republic)      $25.00
  en_CA  English (Canada)            $37.50
  en_IE  English (Ireland)           $37.50
  en_ZA  English (South Africa)      $25.00
  en_US  English (United States)     $30.00
  fr_CA  French (Canada)             $37.50
  de_DE  German (Germany)            $37.50
  el_GR  Greek (Greece)              $20.00
  it_IT  Italian (Italy)             $27.50
  ms_MY  Malaysian (Malaysia)        $10.00
  pl_PL  Polish (Poland)             $20.00
  ro_RO  Romanian (Romania)          $17.50
  es_CL  Spanish (Chile)             $17.50
  es_CO  Spanish (Colombia)          $15.00

Total child campaigns: 16
Estimated total assets: ~6,048
Estimated pipeline time: ~4-8 hours (sequential on NIM)
```

---

## Locale Rate Integration

### Current State

- `locale_links[].rate` stores pay rates as **strings** (e.g., `"$ 17.5"`)
- `compensation_rate` in form_data stores a **single flat rate** for the campaign
- No connection between per-locale rates and ROAS calculations
- RFP extraction prompt does not target per-locale rate tables

### Planned Enhancement

**Three ingestion methods for locale rates:**

1. **AI extraction** — Update extraction prompt to identify rate tables in RFPs (structured as locale/language/rate rows)
2. **Excel upload** — Existing `LocaleLinksUpload` already parses rate column (needs numeric conversion)
3. **Manual entry** — New editable table component for row-by-row rate entry

**Structured data model:**

```typescript
interface LocaleRate {
  locale: string;        // "bg_BG"
  language: string;      // "Bulgarian (Bulgaria)"
  country: string;       // "Bulgaria"
  rate: number;          // 17.50 (numeric, not string)
  currency: string;      // "USD"
}
```

**ROAS integration:** Per-locale rate becomes the RPP (Revenue Per Participant) in the ROAS framework:

```
ROAS = (Completions x Fulfillment Rate x Net RPP) / Ad Spend

Where Net RPP = locale_rate - variable_cost_per_participant
```

Each child campaign inherits its country-specific rate, enabling per-country ROAS calculations in the Command Center dashboard.

---

## Known Bottlenecks

### 1. Sequential Processing

**Problem:** The worker processes child campaigns one at a time. A 16-country campaign requires 16 sequential pipeline runs, which can take 4-8 hours on NIM.

**Impact:** Recruiter waits hours for full campaign completion. Time scales linearly with country count.

**Potential solutions:**
- Parallel worker instances (Azure Container Apps can auto-scale)
- Priority queuing (urgent campaigns processed first)
- Progressive rendering (show completed countries while others generate)

### 2. Review Overwhelm

**Problem:** A 16-country campaign produces ~6,000+ assets. No human can review all of these individually.

**Impact:** Approval workflow becomes the bottleneck after generation completes.

**Potential solutions:**
- Country-level filtering in the review UI
- Bulk approval per country (approve all assets for Morocco at once)
- AI-assisted review (auto-approve assets above quality threshold, flag only borderline)
- Top-N surfacing (show best 3 creatives per country, hide the rest)

### 3. Rate Data Not Wired In

**Problem:** Per-locale rates exist in `locale_links` but aren't carried into child campaigns or connected to ROAS calculations.

**Impact:** Cannot calculate per-country profitability. Command Center ROAS metrics are incomplete without locale-specific RPP.

**Solution:** Locale rate integration (see section above).

### 4. Parent-Child Navigation

**Problem:** When a campaign splits into 16 children, the UI needs clear navigation between the parent overview and individual country campaigns.

**Impact:** Recruiters and marketers lose context when switching between child campaigns.

**Potential solutions:**
- Grouped campaign view with country tabs
- Parent dashboard showing completion status per country
- Drill-down from parent to child with breadcrumb navigation

---

## Open Architecture Decisions

### Split Model vs. Consolidated Model

**Current (Split):** Each country becomes an independent campaign with its own pipeline run, assets, and approval flow.

| Pros | Cons |
|------|------|
| Clean isolation per country | Sequential processing (slow for 16+ countries) |
| Independent approval per country | Duplicated personas across children |
| Simple pipeline logic (one country = one run) | Parent-child navigation complexity |
| Failure isolation (one country failing doesn't block others) | Review overwhelm at scale |

**Alternative (Consolidated):** Single campaign with per-country views. Pipeline runs once with country-aware branching at each stage.

| Pros | Cons |
|------|------|
| Single campaign to manage | More complex pipeline orchestration |
| Shared personas across countries | Failure in one country could block the pipeline |
| Unified approval view with country filters | Larger single job (memory/timeout risk) |
| Faster (shared Stage 1 research) | Harder to parallelize |

**Decision pending.** Current split model works for campaigns up to ~10 countries. At 30+ countries, consolidated model with parallel per-country stages may be necessary.

### Parallel Worker Scaling

When deployed on Azure Container Apps:
- Multiple worker instances can claim different child jobs concurrently
- `FOR UPDATE SKIP LOCKED` in the job query prevents race conditions
- A 16-country campaign with 4 workers finishes in ~25% of the time

**This is the strongest argument for the Azure migration** — auto-scaling workers turn a 4-8 hour sequential job into a 1-2 hour parallel job.

### Bulk Approval Workflow

Options under consideration:
- **Per-country approval** — Approve/reject all assets for a country at once
- **Per-stage approval** — Approve all images, then all copy, then all compositions
- **Threshold-based auto-approval** — Assets scoring above 0.90 auto-approved, only borderline assets shown for review
- **Parent-level cascade** — Approve at parent level, cascade to all children

---

## Appendix: File Reference

### Intake Wizard
| File | Purpose |
|------|---------|
| `src/components/intake/IntakeWizard.tsx` | Main wizard orchestrator (5 steps) |
| `src/components/intake/StepStart.tsx` | RFP upload / paste + AI extraction |
| `src/components/intake/StepTaskMode.tsx` | Task type + work mode selection |
| `src/components/intake/StepDetails.tsx` | Title, regions, languages, compensation |
| `src/components/intake/StepRequirements.tsx` | Job requirements + locale links upload |
| `src/components/intake/StepReview.tsx` | Summary review before submission |
| `src/components/intake/LocaleLinksUpload.tsx` | Excel parser for locale/rate data |

### Pipeline
| File | Purpose |
|------|---------|
| `worker/pipeline/orchestrator.py` | Pipeline orchestration + split check |
| `worker/pipeline/campaign_splitter.py` | Multi-country split logic |
| `worker/pipeline/stage1_intelligence.py` | Cultural research + brief + strategy |
| `worker/pipeline/stage2_images.py` | Actor generation + image pipeline |
| `worker/pipeline/stage3_copy.py` | Per-language copy generation |
| `worker/pipeline/stage4_compose_v3.py` | HTML composition + rendering |

### API Routes
| File | Purpose |
|------|---------|
| `src/app/api/intake/route.ts` | Intake CRUD + auto-queue generation |
| `src/app/api/generate/[id]/route.ts` | Generation job management |
| `src/app/api/generate/[id]/strategy/route.ts` | Campaign strategy CRUD |
| `src/app/api/extract/rfp/route.ts` | RFP file extraction |
| `src/app/api/extract/paste/route.ts` | Text paste extraction |

### Database
| File | Purpose |
|------|---------|
| `src/lib/db/intake.ts` | Intake request queries |
| `src/lib/db/schema.ts` | Table definitions |
| `src/lib/db/schemas.ts` | Task type schema management |
| `src/lib/shared-schema-modules.ts` | Job Requirements field definitions |
| `src/lib/types.ts` | TypeScript interfaces (IntakeRequest, LocaleLink, etc.) |
