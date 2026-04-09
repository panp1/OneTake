# Stage 2 Scene Awareness + Stage 3 Copy Pillar Weighting — Design Spec

> **Prerequisite:** Phase A+B (intake schema + persona engine refactor) must be shipped. Merge commit `cfe9aa2` on main.
>
> **Sequel to:** `docs/superpowers/specs/2026-04-08-intake-schema-persona-refactor-design.md` — this spec implements the deferred Phase C + Phase D described in § 11 of that document.

## Goal

Make Stage 2 (images) and Stage 3 (copy) consume the `derived_requirements` data that Stage 1 now produces. Currently, Stage 1 calculates pillar weighting, visual direction, persona constraints, and narrative angle — then Stages 2 and 3 ignore all of it. After this spec ships:

- Stage 2 images show credentialed professionals in contextually correct environments (clinical rooms for Cutis, home desks for OCR gigs) instead of generic centered headshots
- Stage 2 images use diverse photography compositions (rule of thirds, low angle, overhead, etc.) instead of the default AI dead-center framing
- Stage 3 copy generates only the 2 relevant pillar variations (e.g., Shape + Earn for credentialed work) instead of always producing all 3 (Earn + Grow + Shape)
- Stage 3 copy adapts per region using cultural research data (Morocco-French reads differently from France-French)
- Stage 3 copy is generated in the target language when language or country is specified
- Copy quality threshold raised from 0.70 to 0.85

## Scope

### Phase C — Stage 2 Scene Awareness + Composition Engine

1. **Visual direction injection** — `build_persona_actor_prompt()` in `stage2_images.py` reads `derived_requirements.visual_direction` and uses work_environment, wardrobe, visible_tools, emotional_tone, and cultural_adaptations to generate contextually correct actor cards
2. **Dynamic outfit variations / backdrops** — the actor card JSON schema's `outfit_variations` and `backdrops` fields become dynamic based on visual_direction instead of 4 hardcoded scenes
3. **REGION_SETTINGS demotion** — `REGION_SETTINGS` dict in `recruitment_actors.py` becomes a fallback only; visual_direction is the primary source of backdrop ideas
4. **Composition engine integration** — `composition_engine.py` (384 lines, currently dead code) wired into `build_image_prompt()` in `recruitment_actors.py`; every Seedream prompt gets a composition instruction block with technique, camera angle, and angle variation
5. **Composition diversity enforcement** — each image in a set gets a different composition technique (tracked via `used_compositions` list)

### Phase D — Stage 3 Copy Pillar Weighting + Cultural Research + Language

1. **Pillar weighting** — `build_variation_prompts()` reads `derived_requirements.pillar_weighting` and generates only 2 variations (primary + secondary pillar) instead of always generating all 3
2. **Cultural research injection** — Stage 3 reads `context["cultural_research"]` and injects region-specific research summary into the copy user prompt
3. **Language derivation** — new `derive_languages_from_regions()` helper auto-derives target languages from regions when `target_languages` is empty
4. **Copy in target language** — enforced by existing LLM instruction `"Be in {language} and feel native"` plus the language derivation ensuring the correct language is always set
5. **Pillar embodiment scoring** — `_score_copy_quality()` gains pillar-signal validation: checks that copy embodies the intended pillar's themes
6. **Copy quality threshold** — `PASS_THRESHOLD` raised from 0.70 to 0.85
7. **Asset metadata** — `pillar` field added to copy asset metadata for downstream Stage 4 consumption

### Explicitly NOT in scope

- **Stage 4 composition / HTML template library** — Phase E, separate spec cycle
- **Stage 4 overlay copy** — currently uses hardcoded `_build_overlay_copy()`; Phase E will replace with `HERO_TEMPLATES_BY_PILLAR` from brand module
- **Evaluator updates** — `recruitment_evaluation.py` and `eval_brief.py` were already updated in Phase 1 (brand voice) and need no changes for C+D
- **Persona engine** — already refactored in Phase B, no changes needed
- **Brand module** — `worker/brand/oneforma.py` is read-only for this spec; no modifications

---

## § 1 — Phase C: Stage 2 Scene Awareness

### 1.1 Visual Direction Data Shape

`derived_requirements.visual_direction` is a dict produced by Stage 1 (already shipping since Phase A+B). Its schema:

```python
visual_direction = {
    "work_environment": str,       # e.g. "clinical consultation room", "home desk setup"
    "wardrobe": str,               # e.g. "lab coat over business casual", "casual t-shirt"
    "visible_tools": str,          # e.g. "dermatoscope, clinical tablet", "laptop, headphones"
    "emotional_tone": str,         # e.g. "professional confidence", "relaxed casual"
    "cultural_adaptations": str,   # e.g. "modest professional attire for MENA region"
}
```

All fields are free-text strings. Any field may be empty/missing — the system must degrade gracefully.

### 1.2 Actor Card Prompt Rewrite

**File:** `worker/pipeline/stage2_images.py` — `build_persona_actor_prompt()`

Current behavior: hardcodes 4 outfit variations (`at_home_working`, `at_home_relaxed`, `cafe_working`, `celebrating_earnings`) and 4 generic backdrops.

New behavior:
- Accept optional `visual_direction: dict` parameter
- When `visual_direction` is present and has `work_environment`:
  - Generate **scene-aware outfit variations** derived from work_environment + wardrobe + visible_tools
  - Generate **scene-aware backdrops** derived from work_environment + cultural_adaptations
  - The JSON schema output still has `outfit_variations` (dict of scene_key → description) and `backdrops` (list of 4 strings), but the content is dynamic
- When `visual_direction` is absent or empty: fall back to current hardcoded 4 scenes (backward compat)

Example for Cutis (clinical dermatology):
```json
{
  "outfit_variations": {
    "clinical_active": "Lab coat over smart business casual, dermatoscope clipped to pocket, clinical tablet in hand — actively examining or documenting",
    "clinical_break": "Lab coat draped over chair, professional attire visible, in hospital break room with coffee",
    "professional_review": "Business casual without lab coat, reviewing clinical images on laptop in a modern office",
    "celebrating_milestone": "Same professional attire, looking at phone with satisfied expression — project milestone achieved"
  },
  "backdrops": [
    "Modern clinical consultation room with examination chair and medical equipment visible",
    "Hospital break room or staff lounge with natural light",
    "Medical office with clean desk, clinical reference materials on shelf",
    "Corridor of a modern healthcare facility, natural framing from doorway"
  ]
}
```

Example for Finnish OCR (language gig):
```json
{
  "outfit_variations": {
    "at_home_working": "Casual comfortable clothing — annotating OCR data at home desk",
    "at_home_relaxed": "Relaxed version — couch with laptop, headphones on",
    "cafe_working": "Slightly more put-together for a Finnish cafe",
    "celebrating_earnings": "Same vibe, looking at phone with satisfied expression"
  },
  "backdrops": [
    "Finnish apartment with light wood furniture and large window",
    "A Helsinki cafe with minimalist Scandinavian design",
    "Home desk setup near window with winter light",
    "Close-up framing for story/portrait format"
  ]
}
```

### 1.3 REGION_SETTINGS Demotion

**File:** `worker/prompts/recruitment_actors.py`

`REGION_SETTINGS` dict (lines 65-120) stays in the file but is demoted to fallback. The `build_image_prompt()` function gains logic:

```python
# Primary: visual_direction backdrops (from derived_requirements)
# Fallback: REGION_SETTINGS[region] (legacy, for campaigns without derived_requirements)
```

No deletion of `REGION_SETTINGS` — it's the safety net for legacy campaigns.

### 1.4 Composition Engine Integration

**File:** `worker/prompts/recruitment_actors.py` — `build_image_prompt()`

Currently `build_image_prompt()` generates a Seedream prompt with realism anchors but no composition guidance. After Phase C:

- Import `build_composition_block` from `prompts.composition_engine`
- For each image, determine the `intent` from the outfit variation key (e.g., `"clinical_active"` maps to `"at_home_working"` intent, or a new intent if needed)
- Call `build_composition_block(intent, image_index, used_compositions)` to get composition instructions + the composition key used
- Append the composition block to the Seedream prompt (before the anti-gloss instruction)
- Track `used_compositions` across all images for an actor to enforce diversity

**Intent mapping for scene-aware variations:**

When visual_direction produces custom scene keys (like `"clinical_active"`), we need to map them to composition engine intents. Strategy:

- New helper: `_map_scene_to_intent(scene_key: str, visual_direction: dict) -> str`
- Heuristic mapping based on keywords in the scene key and visual_direction:
  - Contains "work" or "active" or "review" → `"at_home_working"`
  - Contains "break" or "relax" → `"at_home_relaxed"`
  - Contains "cafe" or "coffee" → `"cafe_working"`
  - Contains "celebrat" or "milestone" → `"celebrating_earnings"`
  - Contains "profile" or "headshot" → `"profile"`
  - Contains "team" or "collaborat" → `"collaboration"`
  - Default → `"at_home_working"`
- This is a best-effort mapping; the composition engine already handles unknown intents by falling back to `"at_home_working"`

### 1.5 Data Flow

```
Stage 1 → creative_briefs.derived_requirements (JSONB)
         └→ visual_direction: {work_environment, wardrobe, visible_tools, emotional_tone, cultural_adaptations}

Stage 1 → context["brief"]["derived_requirements"]["visual_direction"]
         ↓
Stage 2 → build_persona_actor_prompt(persona, region, language, visual_direction=...)
         ↓
         → Dynamic actor card (scene-aware outfit_variations + backdrops)
         ↓
Stage 2 → build_image_prompt(actor_data, scene_key, ...)
         ↓
         → Seedream prompt + composition_engine block + realism anchors + anti-gloss
```

### 1.6 Passing derived_requirements to Stage 2

In `run_stage2()` (stage2_images.py), extract visual_direction from the brief:

```python
derived_req = brief.get("derived_requirements", {})
visual_direction = derived_req.get("visual_direction", {})
```

Pass to `build_persona_actor_prompt()` and through to `_generate_actor_card()`.

---

## § 2 — Phase D: Stage 3 Copy Pillar Weighting

### 2.1 Pillar Weighting Data Shape

`derived_requirements.pillar_weighting` is a dict produced by Stage 1:

```python
pillar_weighting = {
    "primary": "shape",      # one of: "earn", "grow", "shape"
    "secondary": "earn",     # one of: "earn", "grow", "shape"
    "reasoning": "Credentialed medical documentation requires expertise recognition..."
}
```

### 2.2 Variation Generation Changes

**File:** `worker/prompts/recruitment_copy.py` — `build_variation_prompts()`

Current behavior: always iterates `_PILLAR_ORDER = ["earn", "grow", "shape"]` → 3 variations.

New behavior:
- Accept optional `pillar_weighting: dict | None` parameter
- When `pillar_weighting` is present and has `primary` + `secondary`:
  - Build a 2-element pillar list: `[pillar_weighting["primary"], pillar_weighting["secondary"]]`
  - Validate both values are in `{"earn", "grow", "shape"}` — if invalid, fall back to `_PILLAR_ORDER`
  - Generate **2 variations** instead of 3
- When `pillar_weighting` is absent: fall back to current behavior (all 3 pillars)
- The `_PILLAR_ORDER` constant stays in the file as the fallback

Example for Cutis: generates Shape variation + Earn variation (skips Grow).
Example for Finnish OCR: generates Earn variation + Grow variation (skips Shape).

### 2.3 Stage 3 Orchestrator Changes

**File:** `worker/pipeline/stage3_copy.py` — `run_stage3()`

Extract pillar_weighting and pass through:

```python
derived_req = brief.get("derived_requirements", {})
pillar_weighting = derived_req.get("pillar_weighting", {})
```

Pass to `build_variation_prompts(... pillar_weighting=pillar_weighting)`.

### 2.4 Cultural Research Injection

**File:** `worker/pipeline/stage3_copy.py` — `run_stage3()`

Currently `context["cultural_research"]` is carried in the context dict (produced by Stage 1) but never read by Stage 3.

New behavior:
- Extract: `cultural_research = context.get("cultural_research", {})`
- For each persona, determine the persona's region: `persona.get("region", regions[0] if regions else "Global")`
- Look up the region's research summary: `cultural_research.get(region, {})`
- Format a `CULTURAL_CONTEXT` block (truncated to 2000 chars max to avoid token bloat)
- Pass as a new parameter to `build_variation_prompts()` or inject directly into the user prompt

**Cultural context block format:**

```
CULTURAL CONTEXT FOR THIS REGION ({region}):
{truncated summary of cultural research findings — AI fatigue, gig perception,
language nuance, payment preferences, professional community platforms, etc.}

Use these cultural insights to make the copy feel native to this region —
not just translated, but culturally resonant. Adapt tone, references, and
social proof to what matters in this specific market.
```

**File:** `worker/prompts/recruitment_copy.py` — `build_variation_prompts()`

New optional parameter: `cultural_context: str | None = None`

When present, the cultural context block is inserted into the user prompt between the persona block and the platform spec block.

### 2.5 Language Derivation

**File:** `worker/pipeline/stage3_copy.py`

New helper function at module level:

```python
REGION_LANGUAGE_MAP: dict[str, str] = {
    "BR": "Portuguese",
    "MX": "Spanish",
    "CO": "Spanish",
    "AR": "Spanish",
    "CL": "Spanish",
    "PE": "Spanish",
    "JP": "Japanese",
    "KR": "Korean",
    "CN": "Mandarin Chinese",
    "TW": "Traditional Chinese",
    "DE": "German",
    "FR": "French",
    "IT": "Italian",
    "PT": "Portuguese",
    "MA": "French",  # Morocco — French is the professional lingua franca
    "EG": "Arabic",
    "SA": "Arabic",
    "AE": "Arabic",
    "IN": "Hindi",
    "ID": "Indonesian",
    "PH": "Filipino",
    "TH": "Thai",
    "VN": "Vietnamese",
    "TR": "Turkish",
    "PL": "Polish",
    "RO": "Romanian",
    "UA": "Ukrainian",
    "RU": "Russian",
    "FI": "Finnish",
    "SE": "Swedish",
    "NO": "Norwegian",
    "DK": "Danish",
    "NL": "Dutch",
    "BE": "Dutch",  # Belgium — Dutch/French split, default Dutch
    "GR": "Greek",
    "IL": "Hebrew",
    "NG": "English",  # Nigeria — English is the professional language
    "KE": "English",  # Kenya — English
    "ZA": "English",  # South Africa — English
    "US": "English",
    "GB": "English",
    "CA": "English",
    "AU": "English",
    "NZ": "English",
}

def derive_languages_from_regions(regions: list[str], target_languages: list[str]) -> list[str]:
    """Derive target languages from regions when target_languages is empty."""
    if target_languages:
        return target_languages
    if not regions:
        return ["English"]

    languages = []
    seen = set()
    for region in regions:
        lang = REGION_LANGUAGE_MAP.get(region.upper(), "English")
        if lang not in seen:
            languages.append(lang)
            seen.add(lang)
    return languages or ["English"]
```

Called at the top of `run_stage3()`:

```python
languages = derive_languages_from_regions(regions, context.get("target_languages", []))
```

### 2.6 Copy Quality Threshold

**File:** `worker/pipeline/stage3_copy.py`

Change: `PASS_THRESHOLD = 0.70` → `PASS_THRESHOLD = 0.85`

This means copy must score 85%+ on the quality rubric to pass without retry. The retry loop (1 retry with feedback) stays the same.

### 2.7 Pillar Embodiment Scoring

**File:** `worker/pipeline/stage3_copy.py` — `_score_copy_quality()`

New scoring dimension added to the existing function:

```python
# Pillar signal words — check that copy embodies the intended pillar
PILLAR_SIGNALS: dict[str, set[str]] = {
    "earn": {"earn", "paid", "payout", "income", "compensation", "money", "financial", "twice-monthly", "payoneer", "paypal"},
    "grow": {"grow", "career", "skill", "learn", "portfolio", "credential", "experience", "develop", "advance", "build"},
    "shape": {"expert", "expertise", "judgment", "shape", "influence", "recognition", "respected", "valued", "contribute", "impact"},
}
```

Scoring:
- If `pillar` metadata is present on the variation:
  - Check for pillar-specific signal word hits: +0.03 each, max +0.09
  - Check for wrong-pillar dominance: if the non-target pillar has MORE signal hits than the target pillar, -0.05 and add issue "Pillar confusion: copy reads more like {wrong_pillar} than {target_pillar}"
- If no `pillar` metadata: skip this check (backward compat)

### 2.8 Asset Metadata Extension

**File:** `worker/pipeline/stage3_copy.py` — `save_asset()` call

Current metadata:
```python
"metadata": {
    "copy_data": copy_data,
    "eval_score": score,
    "eval_issues": eval_issues,
    "persona_key": persona_key,
    "persona_name": persona_name,
    "copy_angle": var["angle"],
    "psychology_bias": var["bias"],
}
```

Add `"pillar"` field:
```python
"metadata": {
    ...existing fields...,
    "pillar": var["pillar"],
}
```

This allows Stage 4 to filter/match copy assets by pillar when selecting which copy to pair with which creative.

---

## § 3 — Data Flow Overview

```
┌─ Stage 1 (already shipped) ─────────────────────────────────────────┐
│  Produces:                                                           │
│  • creative_briefs.derived_requirements:                             │
│    ├─ pillar_weighting: {primary, secondary, reasoning}             │
│    ├─ visual_direction: {work_environment, wardrobe, visible_tools, │
│    │                     emotional_tone, cultural_adaptations}       │
│    ├─ persona_constraints: {excluded_archetypes, ...}               │
│    └─ narrative_angle: str                                          │
│  • creative_briefs.pillar_primary / pillar_secondary (TEXT columns) │
│  • context["cultural_research"]: {region → research_summary}        │
│  • context["personas"]: [dynamic persona dicts]                     │
└──────────────────────────────────────────────────────────────────────┘
            │                                    │
            ▼                                    ▼
┌─ Stage 2 (Phase C changes) ──────┐  ┌─ Stage 3 (Phase D changes) ──────┐
│                                   │  │                                   │
│  READS:                           │  │  READS:                           │
│  • visual_direction               │  │  • pillar_weighting               │
│  • personas (dynamic)             │  │  • cultural_research per region   │
│  • composition_engine             │  │  • personas (dynamic)             │
│                                   │  │  • target_languages OR            │
│  PRODUCES:                        │  │    derive_languages_from_regions  │
│  • Scene-aware actor cards        │  │                                   │
│  • Composition-diverse images     │  │  PRODUCES:                        │
│  • Context-correct environments   │  │  • 2 pillar-weighted variations   │
│                                   │  │  • Region-adapted copy            │
│  FALLBACK (no visual_direction):  │  │  • Target-language copy            │
│  • REGION_SETTINGS dict           │  │  • Pillar metadata on assets      │
│  • Default 4 scenes               │  │                                   │
│                                   │  │  FALLBACK (no pillar_weighting):  │
│                                   │  │  • All 3 pillars (current)        │
│                                   │  │  • English (current)              │
└───────────────────────────────────┘  └───────────────────────────────────┘
```

---

## § 4 — Files Changed

| File | Action | Description |
|------|--------|-------------|
| `worker/pipeline/stage2_images.py` | MODIFY | Extract visual_direction from brief, pass to actor prompt builder |
| `worker/pipeline/stage2_images.py` → `build_persona_actor_prompt()` | MODIFY | Accept visual_direction, generate dynamic outfit_variations + backdrops |
| `worker/prompts/recruitment_actors.py` → `build_image_prompt()` | MODIFY | Integrate composition_engine, accept visual_direction for backdrop selection, demote REGION_SETTINGS to fallback |
| `worker/prompts/composition_engine.py` | READ-ONLY | Already complete — `build_composition_block()` and `select_composition()` are ready to use |
| `worker/pipeline/stage3_copy.py` | MODIFY | Extract pillar_weighting + cultural_research from context, add derive_languages_from_regions, raise PASS_THRESHOLD to 0.85, add pillar to asset metadata |
| `worker/pipeline/stage3_copy.py` → `_score_copy_quality()` | MODIFY | Add pillar embodiment scoring with PILLAR_SIGNALS |
| `worker/prompts/recruitment_copy.py` → `build_variation_prompts()` | MODIFY | Accept pillar_weighting + cultural_context params, generate 2 pillar variations instead of 3 when pillar_weighting present |

**New files: 1**
| File | Action | Description |
|------|--------|-------------|
| `scripts/verify-pillar-weighting.mjs` | CREATE | Throwaway Node verifier — tests pillar filtering logic, language derivation, pillar signal scoring |

**Untouched files:**
- `worker/brand/oneforma.py` — read-only, no changes
- `worker/prompts/recruitment_evaluation.py` — already updated in Phase 1
- `worker/prompts/eval_brief.py` — already updated in Phase 1
- `worker/prompts/persona_engine.py` — already refactored in Phase B
- `worker/pipeline/stage1_intelligence.py` — already produces derived_requirements
- `worker/pipeline/stage4_compose.py` — deferred to Phase E
- `worker/neon_client.py` — no schema changes needed (derived_requirements already stored as JSONB)

---

## § 5 — Error Handling & Fallbacks

| Scenario | Handling |
|----------|----------|
| `derived_requirements` missing from brief (legacy campaign) | Stage 2: use REGION_SETTINGS + default 4 scenes. Stage 3: generate all 3 pillars. |
| `visual_direction` present but partially empty | Use available fields; skip missing ones. Empty `work_environment` → fall back to REGION_SETTINGS. |
| `pillar_weighting.primary` or `.secondary` invalid (not earn/grow/shape) | Log warning, fall back to full `_PILLAR_ORDER` |
| `pillar_weighting.primary == pillar_weighting.secondary` | Generate 2 variations of the same pillar with different psychology sub-signals |
| `cultural_research` missing for a region | Skip cultural context block for that persona; copy generates without regional adaptation |
| `target_languages` empty AND `target_regions` empty | Default to `["English"]` |
| `composition_engine` intent not found | Falls back to `"at_home_working"` intent (already implemented in composition_engine.py line 333) |
| Copy score below 0.85 after retry | Asset still saved (with low score), logged as warning. No infinite retry. |

---

## § 6 — Testing Strategy

### Throwaway Node Verifier: `scripts/verify-pillar-weighting.mjs`

Tests the JavaScript reference implementations of:
1. **Pillar filtering**: given `{primary: "shape", secondary: "earn"}`, output should be `["shape", "earn"]` (not `["earn", "grow", "shape"]`)
2. **Pillar filtering fallback**: given `{}`, output should be `["earn", "grow", "shape"]`
3. **Pillar filtering invalid**: given `{primary: "sharp", secondary: "earn"}`, output should be `["earn", "grow", "shape"]` (fallback)
4. **Language derivation**: given regions `["BR", "MX"]` and empty languages, output should be `["Portuguese", "Spanish"]`
5. **Language derivation with existing languages**: given regions `["BR"]` and languages `["English"]`, output should be `["English"]` (no override)
6. **Language derivation empty**: given no regions and no languages, output should be `["English"]`
7. **Pillar signal scoring**: "earn" copy with "paid twice-monthly, real income" scores positive for earn signals
8. **Pillar confusion detection**: "earn" copy that reads "expertise recognized, judgment valued" triggers confusion penalty
9. **Scene-to-intent mapping**: `"clinical_active"` with work_environment containing "clinical" maps to `"at_home_working"` intent

### Python Smoke Tests

Extend `worker/tests/smoke_test.py` with:
1. `test_build_persona_actor_prompt_with_visual_direction` — passes visual_direction dict, asserts dynamic output (not hardcoded 4 scenes)
2. `test_build_persona_actor_prompt_without_visual_direction` — passes empty dict, asserts fallback to default 4 scenes
3. `test_build_variation_prompts_pillar_weighted` — passes pillar_weighting, asserts 2 variations returned (not 3)
4. `test_build_variation_prompts_no_weighting` — passes None, asserts 3 variations returned
5. `test_derive_languages_from_regions` — basic mapping test
6. `test_score_copy_quality_pillar_signals` — verify pillar embodiment scoring

### Build Verification

```bash
cd worker && python3 tests/smoke_test.py 2>&1 | tail -15
node --experimental-strip-types scripts/verify-pillar-weighting.mjs
npm run build 2>&1 | tail -10  # Sanity — Stage 2/3 are Python, shouldn't affect TS
```

---

## § 7 — Verification: End-to-End

After deployment, verify on two contrasting campaigns:

### Cutis (credentialed medical documentation)

1. Trigger Stage 1 regenerate → verify `derived_requirements` has:
   - `pillar_primary = "shape"`, `pillar_secondary = "earn"`
   - `visual_direction.work_environment` mentions clinical/medical
   - `visual_direction.wardrobe` mentions lab coat or professional attire
   - `visual_direction.visible_tools` mentions medical equipment

2. Trigger Stage 2 → verify:
   - Actor cards have scene-aware outfit variations (clinical settings, not home office)
   - Images use diverse compositions (not all centered headshots)
   - Backdrops match clinical/medical environments

3. Trigger Stage 3 → verify:
   - Only 2 copy variations generated per persona (Shape + Earn, NOT Grow)
   - Copy references expertise, clinical judgment, professional recognition (Shape signals)
   - No "side hustle", "gig worker", or "earn extra income" language
   - Copy asset metadata includes `"pillar": "shape"` or `"pillar": "earn"`

### Finnish OCR (language-only gig work)

1. Trigger Stage 1 regenerate → verify:
   - `pillar_primary = "earn"`, `pillar_secondary = "grow"`
   - `visual_direction.work_environment` mentions home desk or casual
   - `visual_direction.wardrobe` mentions casual/comfortable

2. Trigger Stage 2 → verify:
   - Actor cards have casual home/cafe scenes
   - Images use diverse compositions

3. Trigger Stage 3 → verify:
   - Only 2 copy variations (Earn + Grow, NOT Shape)
   - Copy generated in Finnish (if target_regions includes "FI")
   - Copy references payout, flexibility, schedule (Earn signals)
   - Cultural research for Finland influences copy tone

---

## § 8 — Migration & Backward Compatibility

**No DB migration required.** All data consumed by Phases C+D already exists:
- `derived_requirements` JSONB column on `creative_briefs` — shipped in Phase A+B
- `pillar_primary` / `pillar_secondary` TEXT columns — shipped in Phase A+B
- `cultural_research` in Stage 1 context dict — always been there
- Copy asset `metadata` JSONB — adding `pillar` field is non-breaking (additive)

**Backward compatibility:**
- Campaigns processed before Phase A+B have no `derived_requirements` → all fallbacks fire, behavior identical to current
- The only user-visible change for NEW campaigns is: better images + fewer but more relevant copy variations
