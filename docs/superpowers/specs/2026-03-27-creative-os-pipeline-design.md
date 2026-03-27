# Centric Creative OS Pipeline — Design Spec

**Date:** 2026-03-27
**Author:** Steven Junop + Claude
**Status:** Draft — awaiting review

## Overview

A 5-stage AI creative generation pipeline for OneForma/Centific recruitment marketing. Recruiter submits an intake form, the pipeline generates a complete multi-platform ad package with culturally authentic imagery, evaluated copy, and platform-specific layouts — all gated by verification at every stage.

**Architecture:** Option C — Vercel frontend (Next.js 16) + local VYRA Creative API sidecar (FastAPI on Mac, MLX models on Apple Silicon). Kimi K2.5 channel research via OpenRouter API.

## Architecture

```
VERCEL (Frontend + API Proxy)              LOCAL MAC (VYRA Creative API)
┌──────────────────────────────┐          ┌──────────────────────────────┐
│ Next.js 16 App Router        │          │ FastAPI Server               │
│ ├── Dashboard UI             │   HTTP   │ ├── Seedream 4.5 (image gen) │
│ ├── Intake Form              │─────────>│ ├── Qwen3-VL-8B (visual QA) │
│ ├── Detail/Approval View     │          │ ├── Qwen3.5-9B (orchestrator)│
│ ├── Designer Magic Link      │          │ ├── Gemma 3 12B (copy writer)│
│ ├── /api/intake/* (CRUD)     │          │ ├── Compositor (HTML→PNG)    │
│ ├── /api/generate/* (proxy)  │          │ ├── Evaluator (7-dim gate)   │
│ └── /api/research/* (OpenRouter)        │ └── Font Cache (OneForma)    │
│                              │          │                              │
│ Neon Postgres (data)         │          │ MLX on Apple Silicon         │
│ Clerk (auth + MS SSO)        │          │ GPU-locked, thread-safe      │
│ Vercel Blob (asset storage)  │          └──────────────────────────────┘
│ OpenRouter (Kimi K2.5)       │
└──────────────────────────────┘
```

### Communication Pattern

1. Vercel API route receives intake form data
2. For Stage 1 (brief + research): Next.js calls OpenRouter (Kimi K2.5) directly + proxies to VYRA for Qwen3.5-9B brief generation
3. For Stages 2-4 (image gen, copy, layout): Next.js proxies to VYRA Creative API at `VYRA_API_URL` (e.g., `http://localhost:8000` or ngrok tunnel for remote)
4. Generated images uploaded to Vercel Blob, metadata stored in Neon
5. Status updates pushed to UI via polling (v1) or SSE (v2)

### Environment Variables

```
# Vercel (.env.local)
VYRA_API_URL=http://localhost:8000          # Local VYRA sidecar
OPENROUTER_API_KEY=sk-or-...               # For Kimi K2.5 channel research
DATABASE_URL=postgresql://...               # Neon Postgres
BLOB_READ_WRITE_TOKEN=vercel_blob_...      # Vercel Blob
CLERK_SECRET_KEY=sk_...                     # Clerk auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

---

## The 5-Stage Pipeline

### Stage 1: Strategic Intelligence

**Purpose:** Generate creative brief, messaging strategy, target audience definition, channel research with regional intelligence, and design direction — all verified before any creative work begins.

**Models used:**
- Qwen3.5-9B (via VYRA API) — brief, messaging, audience, design direction
- Kimi K2.5 (via OpenRouter) — web-grounded channel research per region

#### Stage 1a: Creative Brief Generation (Qwen3.5-9B)

**Input:** Intake form data (role title, department, location, urgency, requirements, budget notes, special instructions)

**Output:**
```json
{
  "campaign_objective": "Fill Senior AI Engineer role in Casablanca office",
  "messaging_strategy": {
    "primary_message": "Build AI that impacts 300+ languages",
    "value_propositions": [
      "Work on cutting-edge AI/ML projects",
      "Remote-first, global team across 50+ countries",
      "Career growth in AI-first company",
      "Competitive compensation + benefits"
    ],
    "tone": "Professional but approachable, tech-forward, inclusive"
  },
  "target_audience": {
    "persona": "Young IT professional, 24-32, Morocco-based",
    "experience_level": "3-5 years in ML/AI or full-stack",
    "motivations": ["Career growth", "Meaningful AI work", "International exposure"],
    "pain_points": ["Limited local AI opportunities", "Stagnant roles", "Lack of remote options"]
  },
  "content_language": {
    "primary": "fr",
    "secondary": "ar",
    "rationale": "Morocco: French dominant in tech/professional, Arabic for broader reach"
  }
}
```

#### Stage 1b: Channel Research (Kimi K2.5 via OpenRouter)

**Input:** Country, job type, target demographics from 1a

**OpenRouter API call:**
```typescript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'moonshotai/kimi-k2.5',
    messages: [{
      role: 'system',
      content: 'You are a recruitment marketing channel strategist with deep knowledge of regional job markets, social media penetration, and digital advertising platforms worldwide.'
    }, {
      role: 'user',
      content: `Research the most effective recruitment advertising channels for hiring a ${roleTitle} in ${country}. Consider: local job platforms, social media usage, messaging apps, professional networks. Provide channel recommendations with estimated effectiveness percentages and cite your sources.`
    }]
  })
});
```

**Output:**
```json
{
  "channels": [
    {
      "platform": "LinkedIn",
      "format_types": ["in_feed", "carousel"],
      "effectiveness_pct": 38,
      "rationale": "Primary professional network in Morocco, 2.8M users",
      "sources": ["LinkedIn Economic Graph 2025", "Statista Morocco Digital"]
    },
    {
      "platform": "Telegram",
      "format_types": ["image_card"],
      "effectiveness_pct": 22,
      "rationale": "Growing tech community in Morocco, IT-specific groups",
      "sources": ["Datareportal Morocco 2026"]
    },
    {
      "platform": "Facebook",
      "format_types": ["in_feed", "stories"],
      "effectiveness_pct": 20,
      "rationale": "Highest social media penetration in Morocco (73%)",
      "sources": ["Meta Business Suite Morocco Insights"]
    },
    {
      "platform": "Bayt.com",
      "format_types": ["banner"],
      "effectiveness_pct": 15,
      "rationale": "Leading MENA job board, strong in Morocco tech",
      "sources": ["Bayt.com MENA Job Market Report 2025"]
    },
    {
      "platform": "Indeed Morocco",
      "format_types": ["banner"],
      "effectiveness_pct": 5,
      "rationale": "Secondary reach, lower tech penetration",
      "sources": ["Indeed Hiring Lab EMEA"]
    }
  ],
  "format_matrix": {
    "linkedin": ["in_feed_1200x627", "carousel_1080x1080"],
    "telegram": ["image_card_1280x720"],
    "facebook": ["feed_1080x1080", "stories_1080x1920"],
    "bayt": ["banner_1200x628"],
    "indeed": ["banner_1200x628"]
  }
}
```

#### Stage 1 Gate: Strategic Evaluation (Qwen3.5-9B)

The evaluation agent reviews the complete Stage 1 output:

1. **Fact-check external sources** — Are the cited sources real? Are the statistics plausible?
2. **Realistic feasibility eval** — Given budget constraints, team size (Steven + designer), and timeline, is this brief achievable?
3. **Channel validation** — Are recommended platforms actually available and used for job ads in the target region? (e.g., LinkedIn is accessible in Morocco but blocked in some countries)
4. **Audience definition specificity** — Is the persona specific enough to drive creative decisions?
5. **Language check** — Is the content language appropriate for the target region and platform?

**Pass threshold:** Overall score >= 0.85. Failed dimensions enter amend loop (max 3 cycles).

#### Stage 1c: Design Direction (Qwen3.5-9B)

**Input:** Approved brief + OneForma brand guidelines

**Output:**
```json
{
  "visual_style": "light_clean",
  "color_treatment": "OneForma charcoal (#32373C) primary, accent gradient for highlights",
  "photography_direction": "Authentic workplace, Moroccan coworking space, natural light",
  "template_preferences": {
    "linkedin_feed": "BOTTOM_BAND",
    "linkedin_carousel": ["COVER", "STAT", "FEATURE", "TESTIMONIAL", "CTA"],
    "facebook_feed": "HERO_HEADLINE",
    "facebook_stories": "CENTERED_OVERLAY",
    "telegram": "MINIMAL_CTA"
  },
  "gradient_usage": "Accent only — progress bars, status indicators, not backgrounds",
  "brand_elements": {
    "logo_position": "bottom-left",
    "logo_variant": "color on white, white on dark overlays",
    "font_family": "system-ui (matches OneForma site)"
  }
}
```

---

### Stage 2: Character-Driven Image Generation

**Purpose:** Generate photorealistic, culturally authentic images of relatable characters using the UGC actor system with 10 realism anchors.

**Models used:**
- Qwen3.5-9B (via VYRA) — actor identity card generation + image prompt crafting
- Seedream 4.5 (via VYRA) — image generation
- Qwen3-VL-8B (via VYRA) — visual QA + cultural authenticity + realism validation

#### Stage 2a: Actor Creation (Qwen3.5-9B)

**Input:** Target audience from Stage 1 (persona, region, demographics)

**Output:** Actor Identity Card(s)
```json
{
  "actors": [
    {
      "name": "Youssef",
      "face_lock": {
        "skin_tone_hex": "#8B6914",
        "eye_color": "dark brown",
        "jawline": "defined, youthful",
        "hair": "short dark curly fade",
        "nose_shape": "broad bridge, natural",
        "age_range": "24-28",
        "distinguishing_marks": "light stubble, warm confident smile"
      },
      "prompt_seed": "Young proud Moroccan man, 26, warm brown skin tone #8B6914, short dark curly fade haircut, defined jawline, broad nose bridge, light stubble, warm confident smile, natural confident expression, slight asymmetry in smile, real skin texture with visible pores on nose and forehead",
      "outfit_variations": {
        "casual_office": "smart casual polo shirt, laptop messenger bag, silver wristwatch",
        "working": "dark hoodie, dual monitor setup, focused expression, slight lean forward",
        "celebrating": "button-up shirt sleeves rolled, team lunch setting, laughing genuinely, Moroccan cafe background",
        "professional": "crisp button-up shirt, conference or meeting room, presenting"
      },
      "signature_accessory": "silver wristwatch (always visible)",
      "backdrops": [
        "Casablanca coworking space with large windows, natural light",
        "Home office with dual monitors, coffee cup, sticky notes on wall",
        "Moroccan cafe with mosaic tiles, laptop open, mint tea"
      ]
    },
    {
      "name": "Amina",
      "face_lock": {
        "skin_tone_hex": "#A0784C",
        "eye_color": "dark brown, expressive",
        "jawline": "soft, oval face",
        "hair": "dark wavy, sometimes covered with hijab (optional per variant)",
        "nose_shape": "delicate, slightly upturned",
        "age_range": "25-29",
        "distinguishing_marks": "small beauty mark near left eye, genuine laugh lines"
      },
      "prompt_seed": "Young Moroccan woman, 27, warm olive-brown skin tone #A0784C, dark wavy hair, oval face, expressive dark brown eyes, small beauty mark near left eye, genuine warm expression, real skin texture, natural under-eye shadows",
      "outfit_variations": {
        "casual_office": "modern blazer over simple top, minimal jewelry, tote bag",
        "working": "comfortable sweater, headphones around neck, code on screen behind",
        "celebrating": "colorful top, team setting, animated hand gestures",
        "professional": "tailored suit jacket, speaking at whiteboard, confident posture"
      },
      "signature_accessory": "delicate gold necklace",
      "backdrops": [
        "Modern Casablanca tech office, glass walls, collaborative space",
        "Home setup with plants, organized desk, warm lighting",
        "Conference room presenting to diverse team"
      ]
    }
  ]
}
```

#### Stage 2b: Image Generation (Seedream 4.5)

**Input:** Actor prompt seed + outfit variation + backdrop + 10 realism anchors

The image prompt is constructed by Qwen3.5-9B combining:
1. Actor prompt seed (face lock + distinguishing marks)
2. Selected outfit variation (based on ad context)
3. Backdrop from actor's backdrop list
4. **Mandatory realism anchor instructions:**

```
REALISM ANCHORS (apply ALL 10 to every generation):
1. SKIN PORES: Visible on forehead, nose, cheeks. Never smooth or airbrushed.
2. STRAY HAIRS: Baby hairs at temples, flyaways catching backlight, imperfect part line.
3. UNDER-EYE TEXTURE: Slight shadows, fine lines, natural discoloration.
4. UNEVEN SKIN TONE: Natural variation, not color-corrected. Real blemishes OK.
5. FABRIC TEXTURE: Visible weave, wrinkles where body bends, pilling on worn fabrics.
6. ENVIRONMENTAL NOISE: Real objects in scene — charger cable, water bottle, earbuds, sticky notes, coffee cup.
7. LIGHTING IMPERFECTIONS: Mixed color temperatures, window overexposure, wall color cast.
8. CAMERA ARTIFACTS: Shallow noise, edge softness, chromatic aberration, slight motion blur. iPhone selfie aesthetic.
9. NAIL DETAIL: Natural ridges, cuticles visible if hands shown.
10. JEWELRY PHYSICS: Watch/necklace catches light unevenly, chains drape with gravity.

ANTI-PATTERNS (block these):
- No perfect facial symmetry
- No uniform studio lighting
- No stock-photo poses (arms crossed, thumbs up)
- No plastic/airbrushed skin
- No floating objects or melted text
- No extra fingers or limbs
```

**Camera simulation:** Selfie (for stories/social), rear cam (for workplace shots), overhead (for desk setups)

**Output:** Base image URL(s) — one per actor × outfit combination needed

#### Stage 2c: Visual QA Gate (Qwen3-VL-8B)

Qwen3-VL reviews each generated image against three rubrics:

**Cultural Authenticity:**
- Does the person look like they belong in the target region?
- Are environmental details culturally appropriate? (Moroccan cafe, not generic American office)
- Is the setting relatable to the target demographic?

**Realism Check (10 anchors):**
- Skin texture present (not airbrushed)?
- Lighting imperfections present?
- Environmental noise present?
- No AI tell-tales (extra fingers, melted text, impossible reflections)?

**Marketing Effectiveness:**
- Aspirational but relatable?
- Emotional resonance with target audience?
- Platform-appropriate composition?

**Pass threshold:** Score >= 0.85. Failed images regenerate with VL feedback (max 3 cycles).

---

### Stage 3: Copy Generation

**Purpose:** Generate recruitment ad copy in the target language, adapted per channel and format, with evaluation.

**Model:** Gemma 3 12B (via VYRA API)

#### Input
- Approved brief from Stage 1 (messaging strategy, value props, tone)
- Target language(s) from Stage 1 (e.g., French primary, Arabic secondary)
- Channel list from Stage 1 (e.g., LinkedIn, Telegram, Facebook, Bayt)
- Actor context from Stage 2 (for narrative-style copy: "Youssef landed his dream AI role...")

#### Output (per channel × language)
```json
{
  "channel": "linkedin",
  "language": "fr",
  "variants": [
    {
      "headline": "L'IA qui parle 300+ langues",
      "description": "Rejoignez OneForma et construisez l'avenir de l'IA multilingue",
      "primary_text": "Youssef a trouve son role de reve en IA. Et vous?",
      "cta": "Postuler maintenant",
      "rationale": "Aspirational hook using actor narrative + key differentiator (300+ languages)"
    }
  ]
}
```

**Copy constraints (recruitment-adapted):**
- Headlines: max 30 chars, speak to candidate aspirations not company needs
- Descriptions: max 90 chars, highlight ONE differentiator
- Primary text: 125 chars, open with candidate's dream scenario
- CTA: "Apply Now" / "Learn More" / "Join Our Team" (localized)
- AVOID: corporate jargon, "we are looking for", passive voice

#### Stage 3 Gate: Copy Evaluation (Qwen3.5-9B)

| Dimension | Threshold | What's Checked |
|-----------|-----------|----------------|
| candidate_hook | 0.65 | Would a job seeker stop scrolling? |
| readability | 0.70 | Clear, concise, scannable, no jargon |
| cta_clarity | 0.70 | Is the apply action clear and compelling? |
| platform_fit | 0.75 | Copy length/format suits the specific platform |
| language_quality | 0.70 | Natural fluency in target language, not machine-translated |

**Pass threshold:** Overall >= 0.70. Failed copy enters amend loop (max 3 cycles).

---

### Stage 4: Layout Generation (Multi-Platform x Multi-Format)

**Purpose:** Compose approved images + approved copy into platform-specific ad creatives across all formats determined in Stage 1.

**Models:**
- Qwen3.5-9B (via VYRA) — template selection per format
- Compositor (VYRA) — HTML/CSS overlay assembly
- Playwright (VYRA) — headless render to PNG

#### Format Matrix (Dynamic from Stage 1)

The format matrix is NOT hardcoded — it's determined by Stage 1 channel research. Example for Morocco:

| Channel | In-Feed | Story | Carousel | Image Card | Banner |
|---------|---------|-------|----------|------------|--------|
| LinkedIn | 1200x627 | -- | 1080x1080 (5 panels) | -- | -- |
| Facebook | 1080x1080 | 1080x1920 | 1080x1080 (5 panels) | -- | -- |
| Telegram | -- | -- | -- | 1280x720 | -- |
| Bayt.com | -- | -- | -- | -- | 1200x628 |
| Indeed | -- | -- | -- | -- | 1200x628 |

#### Overlay Templates (9 types, from VYRA)

| Template | Best For | Description |
|----------|----------|-------------|
| HERO_HEADLINE | In-feed ads | Full-bleed image + headline + CTA bottom |
| SPLIT_LEFT_TEXT | Banners | Left text panel + right image |
| SPLIT_RIGHT_TEXT | Banners | Left image + right text panel |
| BOTTOM_BAND | LinkedIn feed | Image top + gradient band bottom |
| TOP_BAND | Alternate layout | Gradient band top + image bottom |
| CENTERED_OVERLAY | Stories, TikTok | Image bg + centered text overlay |
| CAROUSEL_STAT | Carousel panels | Big number + label ("300+ languages") |
| CAROUSEL_TESTIMONIAL | Carousel panels | Employee quote + avatar |
| MINIMAL_CTA | Telegram, minimal | Image + small CTA chip |

#### Carousel Panel Sequence (Recruitment-Adapted)

Default 5-panel sequence:
1. **COVER** — Actor (Youssef) at desk, role title + OneForma branding
2. **STAT** — "300+ languages" / "50+ countries" / key differentiator
3. **FEATURE** — Benefits: remote-first, AI projects, career growth
4. **TESTIMONIAL** — Actor (Amina) quote about working at OneForma
5. **CTA** — "Apply Now" + role link + OneForma logo

#### Composition Props

Each creative variant gets a `CompositionProps` object:
```json
{
  "hero_image_url": "https://vyra-local/generated/youssef-casual-office.png",
  "template": "BOTTOM_BAND",
  "platform": "linkedin_single",
  "headline": "L'IA qui parle 300+ langues",
  "subheadline": "Rejoignez OneForma",
  "cta_text": "Postuler maintenant",
  "brand": {
    "primary_color": "#32373C",
    "secondary_color": "#F5F5F5",
    "accent_color": "rgb(6,147,227)",
    "text_color": "#FFFFFF",
    "font_family": "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
    "logo_url": "https://blob.vercel-storage.com/oneforma-logo.svg",
    "logo_position": "bottom-left"
  },
  "visual_style": "light_clean",
  "gradient_opacity": 0.65
}
```

#### Stage 4 Gate: Creative Evaluation (7 Dimensions)

| Dimension | Threshold | Recruitment Adaptation |
|-----------|-----------|----------------------|
| employer_brand_fit | 0.70 | Matches OneForma voice, culture-forward |
| candidate_hook | 0.65 | Would a job seeker stop scrolling? |
| readability | 0.70 | Clear, scannable text with good contrast |
| visual_text_harmony | 0.60 | Template + style complement copy |
| application_cta | 0.70 | "Apply Now" action is clear and compelling |
| platform_compliance | 0.75 | Dimensions, text length, safe margins correct |
| culture_proof | 0.50 | Feels authentic, not corporate stock |

**Overall pass threshold:** 0.70. Failed dimensions enter amend loop (max 3 cycles).

---

### Stage 5: Surface & Distribute

**Purpose:** Upload approved creatives, store metadata, notify stakeholders, and present for approval.

#### 5a: Asset Upload
- All approved PNGs uploaded to Vercel Blob
- Blob URLs stored in `generated_assets` table in Neon
- Each asset tagged with: request_id, platform, format, language, evaluation scores

#### 5b: Status Update
- `intake_requests.status` updated to `review`
- `intake_requests.updated_at` set to current timestamp

#### 5c: Notification
- **Slack webhook:** Message to designated channel with request summary + preview link
- **Outlook email (Microsoft Graph):** Email to designer with download link
- Both notifications include: role title, urgency, number of creatives generated, approval link

#### 5d: Approval UI
Steven's detail view (`/intake/[id]`) displays:

1. **Creative Brief** — from Stage 1 (messaging, audience, channels with sources)
2. **Channel Strategy** — ranked channels with effectiveness %, cited sources
3. **Actor Profiles** — identity cards for generated characters
4. **Creatives Grid** — grouped by channel x format:
   - LinkedIn: feed variant, carousel (5 panels)
   - Facebook: feed variant, stories variant
   - Telegram: image card
   - Etc.
5. **Evaluation Scores** — per creative, per dimension, visual progress bars
6. **Actions:**
   - "Approve" (green) → triggers designer notification + moves to "approved"
   - "Request Changes" (orange) → adds note, moves back to "generating" for re-run
   - "Reject" (red) → marks as rejected with reason

#### 5e: Designer Magic Link
- Generated on approval, no account needed
- URL format: `/designer/[request_id]?token=[magic_token]`
- Token expires in 7 days
- Designer can: view all creatives, download individual or ZIP, upload refined versions

#### 5f: Agency Export (ZIP)
On final approval after designer refinement:
- **PNGs:** All creatives organized by channel/format folders
- **Brief PDF:** Creative brief from Stage 1
- **Copy CSV:** All headlines, descriptions, CTAs per channel/language
- **Targeting specs:** Audience definition, channel recommendations, budget allocation
- **Evaluation report:** Scores per creative for quality documentation

---

## Database Schema

```sql
-- Intake requests from recruiting team
CREATE TABLE intake_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  department      TEXT,
  location        TEXT,
  urgency         TEXT CHECK (urgency IN ('urgent', 'standard', 'pipeline')),
  requirements    TEXT,
  budget_notes    TEXT,
  special_notes   TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'review', 'approved', 'sent', 'rejected')),
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Stage 1 output: strategic intelligence
CREATE TABLE creative_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  brief_data      JSONB NOT NULL,
  channel_research JSONB,
  design_direction JSONB,
  content_languages TEXT[],
  evaluation_score FLOAT,
  evaluation_data  JSONB,
  version         INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Stage 2 output: actor identity cards
CREATE TABLE actor_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  face_lock       JSONB NOT NULL,
  prompt_seed     TEXT NOT NULL,
  outfit_variations JSONB,
  signature_accessory TEXT,
  backdrops       TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Generated creative assets (Stages 2-4)
CREATE TABLE generated_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES actor_profiles(id),
  asset_type      TEXT NOT NULL CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel')),
  platform        TEXT NOT NULL,
  format          TEXT NOT NULL,
  language        TEXT DEFAULT 'en',
  content         JSONB,
  copy_data       JSONB,
  blob_url        TEXT,
  evaluation_score FLOAT,
  evaluation_data  JSONB,
  evaluation_passed BOOLEAN DEFAULT FALSE,
  stage           INT NOT NULL,
  version         INT DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Approval workflow
CREATE TABLE approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  approved_by     TEXT NOT NULL,
  status          TEXT CHECK (status IN ('approved', 'changes_requested', 'rejected')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Designer uploads (refined creatives)
CREATE TABLE designer_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  original_asset_id UUID REFERENCES generated_assets(id),
  file_name       TEXT NOT NULL,
  blob_url        TEXT NOT NULL,
  uploaded_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Magic link tokens for designer access
CREATE TABLE magic_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Notification log
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  channel         TEXT CHECK (channel IN ('slack', 'outlook')),
  recipient       TEXT,
  status          TEXT CHECK (status IN ('sent', 'delivered', 'failed')),
  payload         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Pipeline execution log (tracks each stage)
CREATE TABLE pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  stage           INT NOT NULL,
  stage_name      TEXT NOT NULL,
  status          TEXT CHECK (status IN ('running', 'passed', 'failed', 'retrying')),
  attempt         INT DEFAULT 1,
  input_data      JSONB,
  output_data     JSONB,
  evaluation_data JSONB,
  duration_ms     INT,
  error_message   TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
```

---

## Model Assignment Summary

| Role | Model | Location | Stage |
|------|-------|----------|-------|
| Brief + Messaging + Audience | Qwen3.5-9B | VYRA (local) | 1a |
| Channel Research (web-grounded) | Kimi K2.5 | OpenRouter API | 1b |
| Strategic Eval + Fact-checking | Qwen3.5-9B | VYRA (local) | 1 Gate |
| Design Direction | Qwen3.5-9B | VYRA (local) | 1c |
| Actor Identity Card Generation | Qwen3.5-9B | VYRA (local) | 2a |
| Image Prompt Crafting | Qwen3.5-9B | VYRA (local) | 2b |
| Image Generation | Seedream 4.5 | VYRA (Volcengine API) | 2b |
| Visual QA + Cultural Auth | Qwen3-VL-8B | VYRA (local) | 2c Gate |
| Ad Copy Writing (multilingual) | Gemma 3 12B | VYRA (local) | 3 |
| Copy Evaluation | Qwen3.5-9B | VYRA (local) | 3 Gate |
| Template Selection | Qwen3.5-9B | VYRA (local) | 4 |
| HTML Composition | Compositor | VYRA (local) | 4 |
| PNG Rendering | Playwright | VYRA (local) | 4 |
| Creative Evaluation (7-dim) | Qwen3.5-9B | VYRA (local) | 4 Gate |

---

## API Routes (Next.js)

```
/api/intake
  POST   /api/intake              → Create new intake request
  GET    /api/intake              → List all requests (with filters)
  GET    /api/intake/[id]         → Get request detail
  PATCH  /api/intake/[id]         → Update request (status, notes)
  DELETE /api/intake/[id]         → Delete request

/api/generate
  POST   /api/generate/[id]       → Trigger full pipeline for request
  GET    /api/generate/[id]/status → Get pipeline stage status (polling)
  POST   /api/generate/[id]/retry  → Retry failed stage

/api/generate/stages (proxy to VYRA)
  POST   /api/generate/[id]/brief        → Stage 1a: Generate brief
  POST   /api/generate/[id]/research     → Stage 1b: Channel research (OpenRouter)
  POST   /api/generate/[id]/evaluate     → Stage 1 Gate: Evaluate brief
  POST   /api/generate/[id]/actors       → Stage 2a: Generate actor cards
  POST   /api/generate/[id]/images       → Stage 2b+2c: Generate + QA images
  POST   /api/generate/[id]/copy         → Stage 3: Generate + evaluate copy
  POST   /api/generate/[id]/compose      → Stage 4: Layout + evaluate creatives

/api/approve
  POST   /api/approve/[id]        → Approve request
  POST   /api/approve/[id]/changes → Request changes

/api/designer
  GET    /api/designer/[id]       → Validate magic link + get assets
  POST   /api/designer/[id]/upload → Upload refined creative

/api/export
  GET    /api/export/[id]         → Generate and download ZIP package

/api/notify
  POST   /api/notify/[id]/slack   → Send Slack notification
  POST   /api/notify/[id]/outlook → Send Outlook notification
```

---

## Phased Implementation

### Phase 1: Foundation (March 27-28)
- Neon database setup with full schema (8 tables)
- CRUD API routes for intake requests
- Replace mock data with real Postgres queries
- Wire existing UI to real data
- VYRA API health check endpoint

### Phase 2: Pipeline Core (March 29-30)
- Stage 1: Brief generation + OpenRouter Kimi K2.5 research + evaluation gate
- Stage 2: Actor creation + Seedream image gen + Qwen3-VL QA gate
- Stage 3: Copy generation + evaluation gate
- Pipeline orchestrator (runs stages sequentially, handles retries)
- Pipeline status tracking (pipeline_runs table)

### Phase 3: Layout & Composition (March 31 - April 1)
- Stage 4: Template selection + compositor + Playwright render + evaluation gate
- Multi-format generation (feed, stories, carousel, banner)
- Vercel Blob upload for generated assets
- Updated detail view showing real generated creatives with scores

### Phase 4: Workflow & Distribution (April 2-3)
- Approval workflow (approve / request changes / reject)
- Designer magic link (no-account access)
- Slack webhook notifications
- Outlook email notifications (Microsoft Graph)
- ZIP export for agency

### Phase 5: Polish & Deploy (April 4-5)
- Error handling and edge cases across all stages
- Pipeline retry UI (retry individual failed stages)
- Real Clerk SSO (Microsoft SAML)
- Production Vercel deploy
- VYRA API accessible from Vercel (ngrok tunnel or VPS deploy)

---

## VYRA Code Copy Manifest

Files copied from `/Users/stevenjunop/vyra/` (NEVER modified in VYRA repo):

| VYRA Source | Centric Usage | Adaptation |
|-------------|--------------|------------|
| `apps/api/app/services/optimize/creative_pipeline.py` | Called via HTTP API | Add Stage 1 (brief+research) before existing pipeline |
| `apps/api/app/services/optimize/creative_compositor.py` | Called via HTTP API | Add recruitment templates, OneForma brand kit |
| `apps/api/app/services/optimize/creative_evaluator.py` | Called via HTTP API | Rename dimensions for recruitment |
| `apps/api/app/services/optimize/asset_generator.py` | Called via HTTP API | Add UGC actor system + realism anchors |
| `apps/api/app/services/optimize/font_cache.py` | Called via HTTP API | Cache system fonts (OneForma uses system stack) |
| `apps/api/app/providers/local_llm.py` | Called via HTTP API | No changes needed (Qwen3.5-9B + Gemma 3 12B) |
| `apps/api/app/providers/local_vlm.py` | Called via HTTP API | No changes needed (Qwen3-VL-8B) |
| `packages/llm-engine/vyra_llm/providers/seedream.py` | Called via HTTP API | No changes needed |
| `apps/api/app/services/optimize/creative_intelligence_workflows.py` | Reference only | Adapt Flow 1 (generate) for recruitment |
| `apps/api/app/routes/optimize/creative.py` | Reference for API shape | Build matching Next.js proxy routes |

**Key decision:** We do NOT rewrite VYRA Python in TypeScript. VYRA runs as-is as a local FastAPI server. The Centric Next.js app is a thin API proxy + UI layer that transforms intake data into VYRA API calls and stores/displays results.

---

## Success Criteria

1. Recruiter fills form (< 5 minutes)
2. Pipeline generates complete multi-platform package (< 10 minutes)
3. Steven reviews with evaluation scores and approves (< 5 minutes)
4. Designer gets notified and downloads package (< 1 minute)
5. Agency receives ZIP with all assets (< 1 minute)
6. **Total: 30 minutes, down from 3-5 days**
7. Every generated asset has a quality score with dimensional breakdown
8. Characters are culturally authentic for the target region
9. Copy is in the correct language for the target market
10. Channel recommendations are region-specific with cited sources
