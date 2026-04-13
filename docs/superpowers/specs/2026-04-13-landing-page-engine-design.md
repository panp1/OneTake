# Stage 6: Landing Page Engine — Design Spec

**Date:** 2026-04-13
**Author:** Steven Junop + Claude
**Status:** Approved

## Overview

Add Stage 6 to the Nova pipeline: per-persona landing page generation. Each persona gets a tailored, self-contained HTML landing page with copy derived from intake data + Stage 3 ad copy, assembled into one of 5 layout variant templates, and served via a Next.js route at `/lp/[slug]`.

The designer (Miguel) approved the wireframe at `oneformaseo/mobile-first-lp-v3.html`. That wireframe becomes Template 1 (Dark Gradient Hero) and defines the section inventory all 5 templates share.

## Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Pages per campaign | One per persona | Matches pipeline (per-persona copy, images, targeting). Higher conversion. |
| Template system | 5 layout variants, same sections | Visual variety without information architecture complexity |
| Copy strategy | Hybrid — reuse Stage 3 for hero/CTA, fresh Gemma 4 for informational sections | Message match between ad and landing page + original long-form content |
| Hero image | Best-scoring Stage 4 composed creative | Visual continuity with the ad they clicked |
| Interior images | Stage 2 base actor photos | Authentic, warm feel for informational sections |
| Serving | Next.js route `/lp/[slug]`, HTML stored in DB | Branded URLs, future editability, portable artifact for WP push |
| Templating engine | Jinja2 (Python worker) | Already in the worker stack, proven for HTML generation |

## Section Inventory

All 5 templates share this section structure. Sections marked FIXED are identical across all campaigns. Sections marked PER-PROJECT are filled with generated/sourced copy.

| Section | Type | Content |
|---|---|---|
| Top bar | FIXED | OneForma logo + Apply CTA |
| Hero | PER-PROJECT | Badge, H1, subtitle, meta line (pay/time/format), hero image, CTAs |
| Trust strip | FIXED | 1.8M members, 300+ languages, 222 markets, payouts, no fees |
| Section nav | PER-PROJECT | Anchors for visible sections (auto-generated from included sections) |
| Why carousel | PER-PROJECT | Eyebrow, H2, subtitle, 3 insight cards explaining project purpose |
| Activities carousel | PER-PROJECT | 3-4 activity cards (image + title + description of what contributor does) |
| Session accordion | PER-PROJECT | 3-4 expandable items with session logistics |
| Pay card | PER-PROJECT | Compensation amount, subtitle, 3-4 feature rows, optional rate accordion |
| Safety | FIXED | Encrypted storage, research use only, delete anytime, ethically reviewed |
| Eligibility | PER-PROJECT | 4-6 checklist items from intake qualifications |
| FAQ | PER-PROJECT | 6-10 Q&A pairs |
| Final CTA | PER-PROJECT | H2, subtitle, apply button, sub-line |
| About footer | FIXED | OneForma description, logo |
| Bottom bar | PER-PROJECT | Compensation summary + sticky Apply CTA |

## Data Source Map

### Tier 1: Hard Facts — Injected as Template Variables (NEVER LLM-generated)

| Variable | Source | Maps To |
|---|---|---|
| `{{compensation}}` | `form_data.compensation_rate` + `compensation_model` | Pay card amount, hero meta, bottom bar, final CTA |
| `{{qualifications}}` | `form_data.qualifications_required` (structured list) | Eligibility checklist items (rendered verbatim) |
| `{{preferred_quals}}` | `form_data.qualifications_preferred` | "Nice to have" note in eligibility, FAQ |
| `{{locations}}` | `target_regions` array | Hero meta, eligibility, session accordion |
| `{{apply_url}}` | `campaign_landing_pages.ada_form_url` or `job_posting_url` | Every Apply button href |
| `{{work_mode}}` | `form_data.work_mode` | Conditional sections (onsite details shown/hidden) |
| `{{time_commitment}}` | `form_data.engagement_model` | Hero meta, session accordion, FAQ |
| `{{languages}}` | `form_data.language_requirements` + `target_languages` | Eligibility, page `lang` attribute |
| `{{title}}` | `intake_requests.title` | Page `<title>`, meta description seed |
| `{{payout_schedule}}` | Hardcoded: "Twice-monthly payouts" | Pay features, trust strip (OneForma standard) |

### Tier 2: Reused from Stage 3 (Ad/Landing Page Message Match)

| Field | Source | Maps To |
|---|---|---|
| Hero H1 | Best-scoring Stage 3 headline for this persona | `<h1>` in hero section |
| Hero subtitle | Best Stage 3 body copy | `<p class="hero-sub">` |
| CTA text | Stage 3 CTA copy | All Apply button labels |
| Final CTA H2 | Stage 3 description variant | Final CTA section heading |
| Hero badge | Stage 3 hook type (mapped to label) | `<span class="badge badge-hero">` |

### Tier 3: AI-Generated Fresh by Gemma 4

| Section | Input Context | Constraints |
|---|---|---|
| Why carousel (3 cards) | `task_description` + `cultural_research` | Explain why this work matters. Grounded in brief. |
| Activities carousel (3-4 cards) | `task_description` + `derived_requirements` | What the contributor does. Must match real task steps. |
| Session accordion (3-4 items) | `engagement_model` + `work_mode` + `task_description` | Logistics, day-of expectations. Onsite items only if `work_mode === "onsite"`. |
| FAQ (6-10 Q&A) | ALL intake fields + qualifications + compensation | Pay FAQ must use exact compensation. No vague answers. |
| Meta description | `title` + `task_description` + `compensation` | SEO-friendly, under 160 chars |
| Activity image labels | `task_description` | Descriptive alt text for wireframe image placeholders |

## Template Variants

All 5 templates use the same section inventory. They differ only in visual layout.

| # | Name | Hero Style | Best For |
|---|---|---|---|
| 1 | Dark Gradient | Dark bg, gradient mesh, text-left image-right on desktop | Onsite data collection, premium studies |
| 2 | Full-Bleed Photo | Large hero photo background, overlay text | Video/speech tasks, visual impact |
| 3 | Split Screen | 50/50 text left + image right, light bg | Professional recruitment, B2B feel |
| 4 | Minimal Editorial | White bg, oversized typography, centered | Remote annotation, simple tasks |
| 5 | Card Grid | Bento-style cards, compact hero | Multi-activity tasks, lots of info |

**Template selection logic:** AI picks based on `task_type` + persona archetype:
- `onsite_data_collection` → Template 1 or 3
- `remote_annotation` / `survey` → Template 4
- `audio_speech` / `video` → Template 2
- Default fallback → Template 1

Marketing manager can override in the dashboard (future feature, not v1).

## Image Strategy

| Location | Source | Rationale |
|---|---|---|
| Hero image | Best-scoring Stage 4 composed creative (by `evaluation_score`) | Visual continuity with ad clicked |
| Activity card images | Stage 2 base actor photos (different actors if available) | Authentic, warm, non-ad feel |
| Session accordion images | Stage 2 base actor photos | Same authentic approach |
| Final CTA image | Same as hero composed creative | Bookend reinforcement |

Images are referenced by `blob_url` from the `generated_assets` table. If no composed creative exists for the persona, fall back to the best base image.

## Pipeline Integration

### Stage 6 in the Orchestrator

```python
# worker/pipeline/orchestrator.py — add to stages list
stages = [
    (1, "Strategic Intelligence", run_stage1),
    (2, "Character-Driven Image Generation", run_stage2),
    (3, "Copy Generation", run_stage3),
    (4, "Layout Composition", run_stage4),
    (5, "Video Generation", run_video_stage),
    (6, "Landing Page Generation", run_landing_page_stage),  # NEW
]
```

### Stage 6 Steps (per persona, per language)

1. **Gather inputs** — Load intake form_data, brief, Stage 3 copy assets, Stage 2/4 image assets, campaign_landing_pages URLs
2. **Select template** — Based on `task_type` + persona archetype
3. **Extract hard facts** — Build template variables dict from intake data (Tier 1)
4. **Extract Stage 3 copy** — Find best headline/body/CTA for this persona (Tier 2)
5. **Generate informational copy** — Gemma 4 call for why/activities/sessions/FAQ (Tier 3)
6. **Select images** — Best composed creative for hero, base actor photos for interior
7. **Render template** — Jinja2 with all variables + generated copy + image URLs
8. **Validate** — Cross-check every hard fact against source data (see Drift Prevention)
9. **Upload** — Full HTML to Vercel Blob, get public URL
10. **Save asset** — Insert into `generated_assets` with `asset_type = 'landing_page'`

### Gemma 4 Prompt Structure

```
System: You are a recruitment landing page copywriter for OneForma.
Write landing page copy sections for a {task_type} recruitment campaign.

HARD CONSTRAINTS (do not contradict):
- Compensation: {compensation}
- Location: {locations}
- Work mode: {work_mode}
- Time commitment: {time_commitment}
- Required qualifications: {qualifications}

PROJECT CONTEXT:
{task_description}

CULTURAL CONTEXT:
{cultural_research_summary}

PERSONA:
{persona_name} — {persona_description}

OUTPUT FORMAT (JSON):
{
  "why_cards": [
    {"title": "...", "description": "...", "icon_hint": "users|smile|spark|globe"},
    ...3 total
  ],
  "activities": [
    {"title": "...", "description": "...", "image_label": "..."},
    ...3-4 total
  ],
  "session_details": [
    {"title": "...", "body": "...", "has_image": true},
    ...3-4 total
  ],
  "faq": [
    {"question": "...", "answer": "..."},
    ...6-10 total
  ],
  "meta_description": "..."
}
```

## Drift Prevention

### Template Variables

Hard facts are injected as Jinja2 variables, not written by the LLM:

```html
<!-- Pay card — compensation from intake, not from LLM -->
<div class="pay-num">{{compensation}}</div>
<div class="pay-sub">{{compensation_subtitle}}</div>

<!-- Eligibility — rendered from structured list -->
{% for qual in qualifications %}
<div class="chk">
  <div class="chk-dot">...</div>
  <div><strong>{{qual.title}}</strong><p>{{qual.description}}</p></div>
</div>
{% endfor %}

<!-- CTA buttons — URL from database -->
<a href="{{apply_url}}" class="btn btn-primary">{{cta_text}}</a>

<!-- Conditional onsite sections -->
{% if work_mode == "onsite" %}
  <!-- onsite-specific session details -->
{% endif %}
```

### Post-Generation Validation

After rendering, before upload:

1. Parse the HTML output
2. Extract all text containing `$` or currency patterns → must match `compensation` variable
3. Extract all `<a href>` on Apply buttons → must match `apply_url`
4. Extract all checklist items → must be a subset of `qualifications_required`
5. Check `<html lang="">` → must match `target_language`
6. If `work_mode === "remote"`, verify no onsite-specific sections are rendered
7. If ANY check fails → log error, skip upload, mark asset as `evaluation_passed: false`

## Serving Route

### `/lp/[slug]/route.ts`

Slug format: `{campaign_slug}--{persona_key}` (double-dash separator to avoid ambiguity with hyphenated slugs).
Example: `/lp/twins-ai-study--gig_worker_flex`

```
GET /lp/{campaign_slug}--{persona_key}

1. Split slug on `--` → extract campaign_slug and persona_key
2. Query: SELECT blob_url FROM generated_assets
   WHERE asset_type = 'landing_page'
     AND request_id = (SELECT id FROM intake_requests WHERE campaign_slug = $1)
     AND content->>'persona_key' = $2
     AND evaluation_passed = true
   ORDER BY created_at DESC LIMIT 1
3. Fetch HTML from blob_url
4. Return with Content-Type: text/html
5. 404 if not found
```

No auth required — landing pages are public-facing.

## Database Changes

### generated_assets — Extend asset_type CHECK

```sql
ALTER TABLE generated_assets
DROP CONSTRAINT IF EXISTS generated_assets_asset_type_check;

ALTER TABLE generated_assets
ADD CONSTRAINT generated_assets_asset_type_check
CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel', 'landing_page'));
```

### campaign_landing_pages — Add generated URL column

```sql
ALTER TABLE campaign_landing_pages
ADD COLUMN IF NOT EXISTS generated_lp_urls JSONB DEFAULT '{}';
-- Format: { "persona_key": "/lp/slug-persona", ... }
```

## New Files

| File | Purpose | Lines (est.) |
|---|---|---|
| `worker/pipeline/stage6_landing_pages.py` | Stage 6 orchestrator — copy gen, template render, validate, upload | ~250 |
| `worker/prompts/landing_page_copy.py` | Gemma 4 prompt for informational sections | ~80 |
| `worker/templates/lp_base.py` | Jinja2 renderer + shared section partials (trust, safety, footer) | ~120 |
| `worker/templates/lp_dark_gradient.html` | Template 1 — parameterized wireframe | ~400 |
| `worker/templates/lp_fullbleed_photo.html` | Template 2 — photo hero | ~350 |
| `worker/templates/lp_split_screen.html` | Template 3 — 50/50 split | ~350 |
| `worker/templates/lp_minimal_editorial.html` | Template 4 — editorial | ~300 |
| `worker/templates/lp_card_grid.html` | Template 5 — bento grid | ~350 |
| `src/app/lp/[slug]/route.ts` | Next.js route — serves stored HTML | ~50 |

### Modified Files

| File | Changes |
|---|---|
| `worker/pipeline/orchestrator.py` | Add Stage 6 to stages list |
| `src/lib/db/schema.ts` | Extend `asset_type` CHECK, add `generated_lp_urls` column |

## Design System

Landing pages use the OneForma brand system from the wireframe:

- **Colors:** Sapphire `#0452BF`, Pink `#CD128A`, Purple `#7B2DAA`
- **Gradient:** `linear-gradient(135deg, #0452BF 0%, #7B2DAA 50%, #CD128A 100%)`
- **Font:** Roboto (loaded from Google Fonts in each template)
- **Dark bg:** `#001427`
- **Body text:** `#4A5273`
- **Border:** `#E4E8F1`
- **Radius:** Pills for buttons (`999px`), `16px` for cards, `12px` for accordions
- **Mobile-first:** 320px → 640px → 1024px → 1280px breakpoints
- **Max width:** 600px mobile, 1100px desktop, 1200px wide

These are the landing page brand colors (sapphire/pink/purple) which differ slightly from the Nova dashboard colors (charcoal/purple). The landing pages are public-facing OneForma recruitment pages, not internal tooling.

## Out of Scope (v1)

- WordPress REST API push (future — HTML artifact is portable)
- A/B testing between template variants
- Marketing manager template override UI
- Landing page editor in the dashboard
- Analytics/conversion tracking on landing pages
- Multi-language page variants (v1 generates in primary target language only)
