# Stage 2 Scene Awareness + Stage 3 Copy Pillar Weighting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Stage 2 images and Stage 3 copy consume `derived_requirements` from Stage 1 briefs — scene-aware images with diverse compositions for credentialed jobs, pillar-weighted copy in the target language with cultural research context.

**Architecture:** Stage 2's `build_persona_actor_prompt()` gains a `visual_direction` parameter that replaces hardcoded scenes with work-environment-aware outfit variations and backdrops. Stage 3's `build_variation_prompts()` gains a `pillar_weighting` parameter that generates 2 relevant pillar variations instead of always generating all 3. Cultural research is injected into copy prompts per-region. Language is derived from target regions when not explicitly set.

**Tech Stack:** Python 3.13 (worker pipeline), Node.js (throwaway verifier scripts), Neon Postgres (data already in place from Phase A+B)

**Important finding:** `composition_engine.py` is ALREADY wired into `build_image_prompt()` (recruitment_actors.py lines 243-286). The exploration report incorrectly flagged it as dead code. No composition engine wiring is needed — it's done.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/verify-stage23-overhaul.mjs` | CREATE | Throwaway Node verifier — pillar filtering, language derivation, scene-to-intent mapping, pillar signal scoring |
| `worker/pipeline/stage2_images.py` | MODIFY | Extract visual_direction from brief, pass to actor prompt builder |
| `worker/pipeline/stage2_images.py:build_persona_actor_prompt()` | MODIFY | Accept visual_direction, generate dynamic scenes/backdrops |
| `worker/pipeline/stage3_copy.py` | MODIFY | Extract pillar_weighting + cultural_research, derive languages, raise threshold, add pillar to metadata |
| `worker/prompts/recruitment_copy.py` | MODIFY | `build_variation_prompts()` accepts pillar_weighting + cultural_context, generates 2 pillar variations |
| `worker/tests/smoke_test.py` | MODIFY | Add smoke tests for visual_direction, pillar weighting, language derivation |

---

## Phase C — Stage 2 Scene Awareness

### Task 1: Throwaway Node verifier (TDD — JS reference first)

**Files:**
- Create: `scripts/verify-stage23-overhaul.mjs`

This verifier covers both Phase C and Phase D logic in one script.

- [ ] **Step 1: Write the verifier script**

```js
// scripts/verify-stage23-overhaul.mjs
import assert from 'node:assert/strict';

// ── 1. Pillar filtering ──────────────────────────────────────────────

function filterPillars(pillarWeighting) {
  const VALID = new Set(['earn', 'grow', 'shape']);
  const ALL = ['earn', 'grow', 'shape'];

  if (!pillarWeighting || typeof pillarWeighting !== 'object') return ALL;

  const primary = pillarWeighting.primary;
  const secondary = pillarWeighting.secondary;

  if (!primary || !VALID.has(primary)) return ALL;
  if (!secondary || !VALID.has(secondary)) return ALL;

  return [primary, secondary];
}

// Valid weighting → 2 pillars
assert.deepStrictEqual(
  filterPillars({ primary: 'shape', secondary: 'earn', reasoning: '...' }),
  ['shape', 'earn'],
  'Should return [primary, secondary] when both valid'
);

// Same pillar twice → still 2 entries
assert.deepStrictEqual(
  filterPillars({ primary: 'earn', secondary: 'earn', reasoning: '...' }),
  ['earn', 'earn'],
  'Should allow same pillar for primary and secondary'
);

// Missing weighting → all 3 fallback
assert.deepStrictEqual(
  filterPillars(null),
  ['earn', 'grow', 'shape'],
  'Should fallback to all 3 when null'
);
assert.deepStrictEqual(
  filterPillars({}),
  ['earn', 'grow', 'shape'],
  'Should fallback to all 3 when empty'
);

// Invalid pillar value → all 3 fallback
assert.deepStrictEqual(
  filterPillars({ primary: 'sharp', secondary: 'earn' }),
  ['earn', 'grow', 'shape'],
  'Should fallback when primary is invalid'
);
assert.deepStrictEqual(
  filterPillars({ primary: 'shape', secondary: 'earns' }),
  ['earn', 'grow', 'shape'],
  'Should fallback when secondary is invalid'
);

console.log('✓ pillar filtering: 6 assertions passed');

// ── 2. Language derivation ───────────────────────────────────────────

const REGION_LANGUAGE_MAP = {
  BR: 'Portuguese', MX: 'Spanish', CO: 'Spanish', AR: 'Spanish',
  CL: 'Spanish', PE: 'Spanish', JP: 'Japanese', KR: 'Korean',
  CN: 'Mandarin Chinese', TW: 'Traditional Chinese', DE: 'German',
  FR: 'French', IT: 'Italian', PT: 'Portuguese', MA: 'French',
  EG: 'Arabic', SA: 'Arabic', AE: 'Arabic', IN: 'Hindi',
  ID: 'Indonesian', PH: 'Filipino', TH: 'Thai', VN: 'Vietnamese',
  TR: 'Turkish', PL: 'Polish', RO: 'Romanian', UA: 'Ukrainian',
  RU: 'Russian', FI: 'Finnish', SE: 'Swedish', NO: 'Norwegian',
  DK: 'Danish', NL: 'Dutch', BE: 'Dutch', GR: 'Greek', IL: 'Hebrew',
  NG: 'English', KE: 'English', ZA: 'English',
  US: 'English', GB: 'English', CA: 'English', AU: 'English', NZ: 'English',
};

function deriveLanguagesFromRegions(regions, targetLanguages) {
  if (targetLanguages && targetLanguages.length > 0) return targetLanguages;
  if (!regions || regions.length === 0) return ['English'];

  const languages = [];
  const seen = new Set();
  for (const region of regions) {
    const lang = REGION_LANGUAGE_MAP[region.toUpperCase()] || 'English';
    if (!seen.has(lang)) {
      languages.push(lang);
      seen.add(lang);
    }
  }
  return languages.length > 0 ? languages : ['English'];
}

// Derive from regions when no languages specified
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['BR', 'MX'], []),
  ['Portuguese', 'Spanish'],
  'Should derive Portuguese + Spanish from BR + MX'
);

// Existing languages take priority
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['BR'], ['English']),
  ['English'],
  'Should keep existing languages when provided'
);

// Empty everything → English
assert.deepStrictEqual(
  deriveLanguagesFromRegions([], []),
  ['English'],
  'Should default to English when no regions or languages'
);

// Dedup: BR + PT both map to Portuguese
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['BR', 'PT'], []),
  ['Portuguese'],
  'Should dedup same language from different regions'
);

// Unknown region → English
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['XX'], []),
  ['English'],
  'Should default to English for unknown region'
);

// Case insensitive
assert.deepStrictEqual(
  deriveLanguagesFromRegions(['fi'], []),
  ['Finnish'],
  'Should handle lowercase region codes'
);

console.log('✓ language derivation: 6 assertions passed');

// ── 3. Scene-to-intent mapping ───────────────────────────────────────

function mapSceneToIntent(sceneKey) {
  const key = sceneKey.toLowerCase();
  if (key.includes('work') || key.includes('active') || key.includes('review') || key.includes('desk') || key.includes('clinical') || key.includes('office')) return 'at_home_working';
  if (key.includes('break') || key.includes('relax') || key.includes('lounge')) return 'at_home_relaxed';
  if (key.includes('cafe') || key.includes('coffee') || key.includes('shop')) return 'cafe_working';
  if (key.includes('celebrat') || key.includes('milestone') || key.includes('earning') || key.includes('reward')) return 'celebrating_earnings';
  if (key.includes('profile') || key.includes('headshot') || key.includes('portrait')) return 'profile';
  if (key.includes('team') || key.includes('collaborat') || key.includes('group')) return 'collaboration';
  if (key.includes('outdoor') || key.includes('walk') || key.includes('commut') || key.includes('street')) return 'aspirational';
  return 'at_home_working';
}

assert.strictEqual(mapSceneToIntent('clinical_active'), 'at_home_working');
assert.strictEqual(mapSceneToIntent('morning_desk_session'), 'at_home_working');
assert.strictEqual(mapSceneToIntent('hospital_break_room'), 'at_home_relaxed');
assert.strictEqual(mapSceneToIntent('cafe_working'), 'cafe_working');
assert.strictEqual(mapSceneToIntent('celebrating_milestone'), 'celebrating_earnings');
assert.strictEqual(mapSceneToIntent('professional_review'), 'at_home_working');
assert.strictEqual(mapSceneToIntent('outdoor_commute'), 'aspirational');
assert.strictEqual(mapSceneToIntent('some_random_thing'), 'at_home_working');

console.log('✓ scene-to-intent mapping: 8 assertions passed');

// ── 4. Pillar signal scoring ─────────────────────────────────────────

const PILLAR_SIGNALS = {
  earn: new Set(['earn', 'paid', 'payout', 'income', 'compensation', 'money', 'financial', 'twice-monthly', 'payoneer', 'paypal']),
  grow: new Set(['grow', 'career', 'skill', 'learn', 'portfolio', 'credential', 'experience', 'develop', 'advance', 'build']),
  shape: new Set(['expert', 'expertise', 'judgment', 'shape', 'influence', 'recognition', 'respected', 'valued', 'contribute', 'impact']),
};

function scorePillarEmbodiment(text, targetPillar) {
  const lower = text.toLowerCase();
  let targetHits = 0;
  for (const word of PILLAR_SIGNALS[targetPillar] || []) {
    if (lower.includes(word)) targetHits++;
  }

  // Check for confusion — does a non-target pillar dominate?
  let maxOtherHits = 0;
  let dominantOther = null;
  for (const [pillar, signals] of Object.entries(PILLAR_SIGNALS)) {
    if (pillar === targetPillar) continue;
    let hits = 0;
    for (const word of signals) {
      if (lower.includes(word)) hits++;
    }
    if (hits > maxOtherHits) {
      maxOtherHits = hits;
      dominantOther = pillar;
    }
  }

  const bonus = Math.min(targetHits * 0.03, 0.09);
  const penalty = (maxOtherHits > targetHits && maxOtherHits > 0) ? 0.05 : 0;
  const confused = penalty > 0 ? dominantOther : null;

  return { bonus, penalty, confused, targetHits, maxOtherHits };
}

// Shape copy with shape signals → positive
const shapeResult = scorePillarEmbodiment(
  'Your expertise in clinical judgment makes you exactly who AI teams need. Be recognized for the impact you bring.',
  'shape'
);
assert.ok(shapeResult.bonus > 0, 'Should get bonus for shape signals');
assert.strictEqual(shapeResult.penalty, 0, 'Should have no confusion penalty');
assert.strictEqual(shapeResult.confused, null, 'Should not be confused');

// Earn copy with earn signals → positive
const earnResult = scorePillarEmbodiment(
  'Get paid twice-monthly via Payoneer. Real income for your native language skills.',
  'earn'
);
assert.ok(earnResult.bonus > 0, 'Should get bonus for earn signals');
assert.strictEqual(earnResult.penalty, 0, 'Should have no confusion penalty');

// "Earn" copy that reads like Shape → confusion penalty
const confusedResult = scorePillarEmbodiment(
  'Your expertise and judgment are valued. Be recognized as a respected contributor who shapes AI.',
  'earn'
);
assert.ok(confusedResult.penalty > 0, 'Should have confusion penalty');
assert.strictEqual(confusedResult.confused, 'shape', 'Should detect shape confusion');

// No signals at all → no bonus, no penalty
const neutralResult = scorePillarEmbodiment(
  'Join our team today and start working on interesting projects.',
  'grow'
);
assert.strictEqual(neutralResult.bonus, 0, 'Should have no bonus');
assert.strictEqual(neutralResult.penalty, 0, 'Should have no penalty');

console.log('✓ pillar signal scoring: 8 assertions passed');

// ── 5. Visual direction scene generation ─────────────────────────────

function buildDynamicSceneKeys(visualDirection) {
  if (!visualDirection || !visualDirection.work_environment) {
    return null; // Signals: use default 4 scenes
  }

  // The LLM generates the actual scenes — we just verify the prompt
  // will contain the visual_direction data
  const hasEnv = !!visualDirection.work_environment;
  const hasWardrobe = !!visualDirection.wardrobe;
  const hasTools = !!visualDirection.visible_tools;
  const hasTone = !!visualDirection.emotional_tone;

  return { hasEnv, hasWardrobe, hasTools, hasTone };
}

// Full visual direction → all flags true
const fullVD = buildDynamicSceneKeys({
  work_environment: 'clinical consultation room',
  wardrobe: 'lab coat over business casual',
  visible_tools: 'dermatoscope, clinical tablet',
  emotional_tone: 'professional confidence',
  cultural_adaptations: '',
});
assert.ok(fullVD.hasEnv, 'Should have environment');
assert.ok(fullVD.hasWardrobe, 'Should have wardrobe');
assert.ok(fullVD.hasTools, 'Should have tools');
assert.ok(fullVD.hasTone, 'Should have tone');

// Partial visual direction → some flags
const partialVD = buildDynamicSceneKeys({
  work_environment: 'home desk',
  wardrobe: '',
  visible_tools: 'laptop, headphones',
  emotional_tone: '',
});
assert.ok(partialVD.hasEnv, 'Should have environment');
assert.ok(!partialVD.hasWardrobe, 'Should not have wardrobe (empty)');
assert.ok(partialVD.hasTools, 'Should have tools');
assert.ok(!partialVD.hasTone, 'Should not have tone (empty)');

// Missing visual direction → null (fallback)
assert.strictEqual(buildDynamicSceneKeys(null), null, 'Should return null for missing VD');
assert.strictEqual(buildDynamicSceneKeys({}), null, 'Should return null for empty VD');
assert.strictEqual(
  buildDynamicSceneKeys({ wardrobe: 'casual' }),
  null,
  'Should return null when work_environment is missing'
);

console.log('✓ visual direction scene generation: 7 assertions passed');

console.log('\n✓ all stage 2/3 overhaul assertions passed (35 total)');
```

- [ ] **Step 2: Run the verifier**

```bash
cd /Users/stevenjunop/centric-intake && node --experimental-strip-types scripts/verify-stage23-overhaul.mjs
```

Expected: `✓ all stage 2/3 overhaul assertions passed (35 total)`

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-stage23-overhaul.mjs
git commit -m "test(tdd): verifier for stage 2/3 overhaul — pillar filtering, language derivation, scene mapping, pillar signals"
```

---

### Task 2: Modify `build_persona_actor_prompt()` to accept visual_direction

**Files:**
- Modify: `worker/pipeline/stage2_images.py:48-144`

The function currently generates 4 hardcoded outfit variations (at_home_working, at_home_relaxed, cafe_working, celebrating_earnings) and 4 generic backdrops. When `visual_direction` is provided (from `derived_requirements`), it should generate scene-aware variations instead.

- [ ] **Step 1: Add visual_direction parameter and build dynamic scene instruction block**

In `worker/pipeline/stage2_images.py`, modify `build_persona_actor_prompt()`:

Change the function signature from:
```python
def build_persona_actor_prompt(
    persona: dict,
    region: str,
    language: str,
) -> str:
```

To:
```python
def build_persona_actor_prompt(
    persona: dict,
    region: str,
    language: str,
    visual_direction: dict | None = None,
) -> str:
```

Then, after the existing variable extraction block (after line 87 where `primary_motivation` is set), add a `scene_guidance` block that replaces the hardcoded outfit_variations JSON schema when visual_direction is present:

```python
    # Build scene guidance from visual_direction (derived_requirements)
    vd = visual_direction or {}
    work_env = vd.get("work_environment", "")
    wardrobe = vd.get("wardrobe", "")
    visible_tools = vd.get("visible_tools", "")
    emotional_tone = vd.get("emotional_tone", "")
    cultural_adapt = vd.get("cultural_adaptations", "")

    if work_env:
        scene_guidance = f"""
VISUAL DIRECTION (from campaign analysis — use these to generate SCENE-AWARE variations):
- Work environment: {work_env}
- Wardrobe: {wardrobe or "contextually appropriate for this work environment"}
- Visible tools/props: {visible_tools or "relevant to the work described"}
- Emotional tone: {emotional_tone or "authentic and natural"}
- Cultural adaptations: {cultural_adapt or "appropriate for " + region}

SCENE GENERATION RULES (visual_direction OVERRIDES the defaults):
- Scene 1 MUST show the person ACTIVELY WORKING in the described work environment wearing the described wardrobe with the described tools visible.
- Scene 2 should show a BREAK or TRANSITION moment — same professional context but relaxed (e.g., break room, stepping outside, reviewing notes).
- Scene 3 should show a DIFFERENT ANGLE on their professional life — could be commuting to the work environment, preparing for work, or in a secondary work setting.
- Scene 4 should show a REWARD/CELEBRATION moment — checking phone for payment notification, telling someone about their work, treating themselves after a shift.
- ALL scenes must use wardrobe and tools from the visual direction above — NOT generic "casual clothes with laptop".
- Backdrops must match the work environment described — NOT generic home offices or cafes (unless the work environment IS a home office or cafe)."""
    else:
        scene_guidance = ""
```

- [ ] **Step 2: Replace the hardcoded outfit_variations JSON schema**

In the same function, replace the hardcoded `"outfit_variations"` JSON block in the return string. Find this section (around lines 125-138):

```python
  "outfit_variations": {{
    "at_home_working": "Work-appropriate casual clothing — annotating data at home",
    "at_home_relaxed": "Relaxed version — couch or bed with laptop",
    "cafe_working": "Slightly more put-together for a cafe",
    "celebrating_earnings": "Same vibe, looking at phone with satisfied expression"
  }},
```

Replace it with a conditional that either uses the old format or instructs the LLM to generate scene-aware variations:

```python
  "scenes": {{
    "scene_key_1": {{
      "name": "Human-readable scene name",
      "setting": "Detailed environment description for the image generator",
      "outfit": "What they're wearing in this specific scene",
      "pose_and_action": "What they're physically doing",
      "emotion": "Facial expression and body language",
      "ad_angle": "What marketing message this scene supports"
    }},
    "scene_key_2": {{ ... same schema ... }},
    "scene_key_3": {{ ... same schema ... }},
    "scene_key_4": {{ ... same schema ... }}
  }},
```

And insert `{scene_guidance}` into the prompt BEFORE the JSON schema (after the PSYCHOLOGY block), so the LLM sees the visual direction context when generating scenes.

The complete return statement should look like:

```python
    return f"""Create an AI UGC actor identity card for a OneForma recruitment ad campaign.

This actor EMBODIES a specific target persona — every detail should make
the target audience think "that looks like ME".

TARGET PERSONA: {persona_name}
ARCHETYPE: {archetype_label}
MATCHED TIER: {persona.get("matched_tier", "")}
AGE: {mid_age} (range {lo}-{hi})
REGION: {region}
LANGUAGE: {language}

PERSONA CONTEXT (the actor must LOOK like this person):
- Lifestyle: {persona.get("lifestyle", "")}
- Primary motivation: {primary_motivation}

PSYCHOLOGY (the image must TRIGGER these responses in the target audience):
- Primary hook: {psychology.get("primary_bias", "social_proof")}
- The viewer should think: "{psychology.get("messaging_angle", "This could be me")}"
- Jobs-to-be-done — functional: {jtbd.get("functional", "Earn money remotely")}
- Jobs-to-be-done — emotional: {jtbd.get("emotional", "Feel productive")}
{scene_guidance}
Return ONLY valid JSON matching this EXACT schema:
{{
  "name": "A culturally appropriate first name for {region}",
  "persona_key": "{persona.get("matched_tier", persona_name)}",
  "face_lock": {{
    "skin_tone_hex": "#HEXCOLOR (realistic for someone from {region})",
    "eye_color": "specific eye color",
    "jawline": "face shape description",
    "hair": "specific hairstyle common in {region} for a {archetype_label}",
    "nose_shape": "specific description",
    "age_range": "{lo}-{hi}",
    "distinguishing_marks": "1-2 unique features"
  }},
  "prompt_seed": "One dense paragraph (80-120 words) describing this EXACT person. Include: ethnicity, age, skin tone hex, face shape, hair, eye color, distinguishing marks, default expression. This person IS a {archetype_label} — their vibe should communicate '{primary_motivation}'.",
  "scenes": {{
    "scene_key_1": {{
      "name": "Short human-readable scene name",
      "setting": "Detailed environment — specific to this persona's work and life in {region}",
      "outfit": "What they're wearing — must match the visual direction if provided",
      "pose_and_action": "What they're physically doing",
      "emotion": "Facial expression and body language",
      "ad_angle": "What marketing message this scene supports"
    }},
    "scene_key_2": {{ ... same structure ... }},
    "scene_key_3": {{ ... same structure ... }},
    "scene_key_4": {{ ... same structure ... }}
  }},
  "signature_accessory": "ONE item they ALWAYS have (relevant to a {archetype_label})",
  "backdrops": [
    "Primary work/life setting appropriate for this persona",
    "A realistic {region} secondary setting",
    "A different {region} environment",
    "A close-up framing for story/portrait format"
  ]
}}

RULES:
- This actor is a {archetype_label} aged {lo}-{hi} in {region}.
- They should look like someone the target persona would IDENTIFY with.
- NOT a stock-photo model. NOT corporate. Real person vibes.
- Generate EXACTLY 4 scenes with unique snake_case keys.
- Setting should match the persona's lifestyle and the visual direction if provided."""
```

- [ ] **Step 3: Verify the function runs**

```bash
cd /Users/stevenjunop/centric-intake/worker && python3 -c "
from pipeline.stage2_images import build_persona_actor_prompt
# With visual direction
result = build_persona_actor_prompt(
    persona={'name': 'Dr. Maria', 'archetype': 'Clinical Specialist', 'matched_tier': 'tier_3_credentialed', 'age_range': '30-40', 'lifestyle': 'Urban medical professional', 'motivations': ['professional recognition'], 'psychology_profile': {'primary_bias': 'authority', 'messaging_angle': 'Your clinical expertise matters'}},
    region='US',
    language='English',
    visual_direction={'work_environment': 'clinical consultation room', 'wardrobe': 'lab coat over business casual', 'visible_tools': 'dermatoscope, clinical tablet', 'emotional_tone': 'professional confidence'}
)
assert 'clinical consultation room' in result, 'visual_direction should appear in prompt'
assert 'scenes' in result, 'Should use scenes schema'
print('OK: visual_direction injected into prompt')

# Without visual direction — fallback
result2 = build_persona_actor_prompt(
    persona={'name': 'Ana', 'archetype': 'Language Expert', 'matched_tier': 'tier_1_gig', 'age_range': '22-30', 'lifestyle': 'Student', 'motivations': ['earn money'], 'psychology_profile': {}},
    region='BR',
    language='Portuguese',
)
assert 'scenes' in result2, 'Should still use scenes schema even without visual_direction'
print('OK: fallback works without visual_direction')
"
```

Expected: Both `OK` messages printed.

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/pipeline/stage2_images.py
git commit -m "feat(stage2): build_persona_actor_prompt accepts visual_direction for scene-aware actor cards"
```

---

### Task 3: Wire visual_direction through `_generate_actor_card()` and `run_stage2()`

**Files:**
- Modify: `worker/pipeline/stage2_images.py:147-306`

- [ ] **Step 1: Extract visual_direction in `run_stage2()` and store in actor jobs**

In `run_stage2()` (around line 147), after `raw_personas` extraction, add:

```python
    # Extract visual_direction from derived_requirements (Phase A+B data)
    derived_req = brief.get("derived_requirements", {})
    if isinstance(derived_req, str):
        try:
            import json as _json
            derived_req = _json.loads(derived_req)
        except (ValueError, TypeError):
            derived_req = {}
    visual_direction = derived_req.get("visual_direction", {}) if isinstance(derived_req, dict) else {}
```

Add this right after `languages: list[str] = context.get("target_languages", [])` (around line 153).

Then in the persona-driven actor_jobs loop (around line 182), add `visual_direction` to each job dict:

Change:
```python
                actor_jobs.append({
                    "region": persona.get("region", regions[0] if regions else "Global"),
                    "language": persona.get("language", languages[0] if languages else "English"),
                    "persona": persona,
                    "actor_index": actor_idx,
                })
```

To:
```python
                actor_jobs.append({
                    "region": persona.get("region", regions[0] if regions else "Global"),
                    "language": persona.get("language", languages[0] if languages else "English"),
                    "persona": persona,
                    "actor_index": actor_idx,
                    "visual_direction": visual_direction,
                })
```

- [ ] **Step 2: Pass visual_direction in `_generate_actor_card()`**

In `_generate_actor_card()` (around line 265), change the `build_persona_actor_prompt` call from:

```python
        actor_prompt = build_persona_actor_prompt(persona, region, language)
```

To:

```python
        visual_direction = job.get("visual_direction", {})
        actor_prompt = build_persona_actor_prompt(persona, region, language, visual_direction=visual_direction)
```

Also update the actor save call (around line 286) to persist `scenes` if present:

Change:
```python
    actor_id = await save_actor(request_id, {
        "name": actor_data.get("name", f"Contributor-{region}"),
        "face_lock": actor_data.get("face_lock", {}),
        "prompt_seed": actor_data.get("prompt_seed", ""),
        "outfit_variations": actor_data.get("outfit_variations", {}),
        "signature_accessory": actor_data.get("signature_accessory", "headphones"),
        "backdrops": actor_data.get("backdrops", []),
        "persona_key": persona.get("archetype_key") if persona else None,
        "persona_name": persona.get("persona_name") if persona else None,
    })
```

To:

```python
    actor_id = await save_actor(request_id, {
        "name": actor_data.get("name", f"Contributor-{region}"),
        "face_lock": actor_data.get("face_lock", {}),
        "prompt_seed": actor_data.get("prompt_seed", ""),
        "outfit_variations": actor_data.get("outfit_variations", {}),
        "scenes": actor_data.get("scenes", {}),
        "signature_accessory": actor_data.get("signature_accessory", "headphones"),
        "backdrops": actor_data.get("backdrops", []),
        "persona_key": persona.get("archetype_key") if persona else None,
        "persona_name": persona.get("persona_name") if persona else None,
    })
```

- [ ] **Step 3: Verify the wiring**

```bash
cd /Users/stevenjunop/centric-intake/worker && python3 -c "
# Just verify imports and function signatures are correct
from pipeline.stage2_images import build_persona_actor_prompt, run_stage2
import inspect
sig = inspect.signature(build_persona_actor_prompt)
assert 'visual_direction' in sig.parameters, 'visual_direction param missing'
print('OK: visual_direction wired through Stage 2')
"
```

- [ ] **Step 4: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/pipeline/stage2_images.py
git commit -m "feat(stage2): wire visual_direction from derived_requirements through run_stage2 → actor card generation"
```

---

### Task 4: Smoke tests for Stage 2 visual_direction

**Files:**
- Modify: `worker/tests/smoke_test.py`

- [ ] **Step 1: Add smoke tests**

Add these test functions to `worker/tests/smoke_test.py` (at the end, before the `if __name__` block):

```python
def test_build_persona_actor_prompt_with_visual_direction():
    """Actor prompt should include visual_direction when provided."""
    from pipeline.stage2_images import build_persona_actor_prompt
    persona = {
        "name": "Dr. Sofia",
        "archetype": "Clinical Specialist",
        "matched_tier": "tier_3_credentialed",
        "age_range": "30-40",
        "lifestyle": "Urban medical professional in São Paulo",
        "motivations": ["professional recognition", "career growth"],
        "psychology_profile": {
            "primary_bias": "authority",
            "secondary_bias": "social_proof",
            "messaging_angle": "Your clinical expertise is valued",
        },
        "jobs_to_be_done": {
            "functional": "Document dermatology cases for AI training",
            "emotional": "Feel recognized as a medical expert",
        },
    }
    visual_direction = {
        "work_environment": "clinical consultation room with examination equipment",
        "wardrobe": "lab coat over smart business casual",
        "visible_tools": "dermatoscope, clinical tablet, medical charts",
        "emotional_tone": "professional confidence and focus",
        "cultural_adaptations": "Brazilian medical professional setting",
    }
    result = build_persona_actor_prompt(persona, "BR", "Portuguese", visual_direction=visual_direction)
    assert "clinical consultation room" in result, "work_environment should be in prompt"
    assert "lab coat" in result, "wardrobe should be in prompt"
    assert "dermatoscope" in result, "visible_tools should be in prompt"
    assert "scenes" in result.lower(), "Should use scenes schema"
    print("  ✓ test_build_persona_actor_prompt_with_visual_direction")


def test_build_persona_actor_prompt_without_visual_direction():
    """Actor prompt should work without visual_direction (fallback)."""
    from pipeline.stage2_images import build_persona_actor_prompt
    persona = {
        "name": "Ana",
        "archetype": "Language Expert",
        "matched_tier": "tier_1_gig",
        "age_range": "22-28",
        "lifestyle": "University student in Helsinki",
        "motivations": ["earn money for tuition"],
        "psychology_profile": {"primary_bias": "practicality"},
        "jobs_to_be_done": {"functional": "OCR annotation in Finnish"},
    }
    result = build_persona_actor_prompt(persona, "FI", "Finnish")
    assert "Ana" in result or "Language Expert" in result, "Persona info should be in prompt"
    assert "VISUAL DIRECTION" not in result, "No visual direction block when not provided"
    assert "scenes" in result.lower(), "Should still use scenes schema"
    print("  ✓ test_build_persona_actor_prompt_without_visual_direction")
```

- [ ] **Step 2: Run the smoke tests**

```bash
cd /Users/stevenjunop/centric-intake/worker && python3 tests/smoke_test.py 2>&1 | tail -20
```

Expected: Both new tests pass. Pre-existing KLING_API_KEY skip is fine.

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/tests/smoke_test.py
git commit -m "test(stage2): smoke tests for visual_direction in build_persona_actor_prompt"
```

---

## Phase D — Stage 3 Copy Pillar Weighting

### Task 5: `derive_languages_from_regions()` helper

**Files:**
- Modify: `worker/pipeline/stage3_copy.py:1-57`

- [ ] **Step 1: Add the language derivation helper and region map**

In `worker/pipeline/stage3_copy.py`, after the existing imports and before `logger = logging.getLogger(__name__)`, add:

```python
# ── Region → Language mapping ─────────────────────────────────────────
# Used when target_languages is empty but target_regions is populated.

REGION_LANGUAGE_MAP: dict[str, str] = {
    "BR": "Portuguese", "MX": "Spanish", "CO": "Spanish", "AR": "Spanish",
    "CL": "Spanish", "PE": "Spanish", "JP": "Japanese", "KR": "Korean",
    "CN": "Mandarin Chinese", "TW": "Traditional Chinese", "DE": "German",
    "FR": "French", "IT": "Italian", "PT": "Portuguese", "MA": "French",
    "EG": "Arabic", "SA": "Arabic", "AE": "Arabic", "IN": "Hindi",
    "ID": "Indonesian", "PH": "Filipino", "TH": "Thai", "VN": "Vietnamese",
    "TR": "Turkish", "PL": "Polish", "RO": "Romanian", "UA": "Ukrainian",
    "RU": "Russian", "FI": "Finnish", "SE": "Swedish", "NO": "Norwegian",
    "DK": "Danish", "NL": "Dutch", "BE": "Dutch", "GR": "Greek",
    "IL": "Hebrew", "NG": "English", "KE": "English", "ZA": "English",
    "US": "English", "GB": "English", "CA": "English", "AU": "English",
    "NZ": "English",
}


def derive_languages_from_regions(
    regions: list[str],
    target_languages: list[str],
) -> list[str]:
    """Derive target languages from regions when target_languages is empty.

    If target_languages is provided (non-empty), returns it as-is.
    Otherwise, maps each region to its primary professional language,
    deduplicating while preserving order.
    """
    if target_languages:
        return target_languages
    if not regions:
        return ["English"]

    languages: list[str] = []
    seen: set[str] = set()
    for region in regions:
        lang = REGION_LANGUAGE_MAP.get(region.upper(), "English")
        if lang not in seen:
            languages.append(lang)
            seen.add(lang)
    return languages or ["English"]
```

- [ ] **Step 2: Verify it imports and runs**

```bash
cd /Users/stevenjunop/centric-intake/worker && python3 -c "
from pipeline.stage3_copy import derive_languages_from_regions
assert derive_languages_from_regions(['BR', 'MX'], []) == ['Portuguese', 'Spanish']
assert derive_languages_from_regions(['BR'], ['English']) == ['English']
assert derive_languages_from_regions([], []) == ['English']
assert derive_languages_from_regions(['FI'], []) == ['Finnish']
print('OK: derive_languages_from_regions works')
"
```

- [ ] **Step 3: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/pipeline/stage3_copy.py
git commit -m "feat(stage3): derive_languages_from_regions helper — auto-derive language from target regions"
```

---

### Task 6: `build_variation_prompts()` pillar weighting

**Files:**
- Modify: `worker/prompts/recruitment_copy.py:1303-1409`

- [ ] **Step 1: Add `pillar_weighting` and `cultural_context` parameters**

In `worker/prompts/recruitment_copy.py`, modify `build_variation_prompts()` signature from:

```python
def build_variation_prompts(
    persona: dict,
    brief: dict,
    channel: str,
    language: str,
    regions: list[str] | None = None,
    form_data: dict | None = None,
) -> list[dict[str, str]]:
```

To:

```python
def build_variation_prompts(
    persona: dict,
    brief: dict,
    channel: str,
    language: str,
    regions: list[str] | None = None,
    form_data: dict | None = None,
    pillar_weighting: dict | None = None,
    cultural_context: str | None = None,
) -> list[dict[str, str]]:
```

- [ ] **Step 2: Replace `_PILLAR_ORDER` iteration with pillar filtering**

In the same function, replace the pillar iteration logic. Find (around line 1371):

```python
    for pillar_key in _PILLAR_ORDER:
```

Replace the block before this loop (add pillar filtering) and modify the loop:

```python
    # Determine which pillars to generate based on pillar_weighting
    VALID_PILLARS = {"earn", "grow", "shape"}
    if (
        pillar_weighting
        and isinstance(pillar_weighting, dict)
        and pillar_weighting.get("primary") in VALID_PILLARS
        and pillar_weighting.get("secondary") in VALID_PILLARS
    ):
        active_pillars = [pillar_weighting["primary"], pillar_weighting["secondary"]]
    else:
        active_pillars = list(_PILLAR_ORDER)

    variations: list[dict[str, str]] = []

    for pillar_key in active_pillars:
```

- [ ] **Step 3: Insert cultural_context into the user prompt**

In the same function, find where the user prompt is assembled (around line 1401-1406):

```python
        variations.append({
            "angle": f"pillar_{pillar_key}",
            "pillar": pillar_key,
            "bias": sub_bias,
            "cta": cta_str,
            "system": system,
            "user": f"""{angle_instruction}
{facts_block}

{persona_block}
---
{base_prompt}""",
        })
```

Add the cultural context block between persona_block and the platform spec:

```python
        # Cultural context (if provided)
        cultural_block = ""
        if cultural_context:
            cultural_block = f"\n\nCULTURAL CONTEXT FOR THIS REGION:\n{cultural_context}\n\nUse these cultural insights to make the copy feel native to this region — not just translated, but culturally resonant."

        variations.append({
            "angle": f"pillar_{pillar_key}",
            "pillar": pillar_key,
            "bias": sub_bias,
            "cta": cta_str,
            "system": system,
            "user": f"""{angle_instruction}
{facts_block}

{persona_block}
{cultural_block}
---
{base_prompt}""",
        })
```

- [ ] **Step 4: Verify the function works**

```bash
cd /Users/stevenjunop/centric-intake/worker && python3 -c "
from prompts.recruitment_copy import build_variation_prompts
# With pillar weighting → 2 variations
result = build_variation_prompts(
    persona={'persona_name': 'Test', 'name': 'Test', 'psychology_profile': {'primary_bias': 'authority', 'secondary_bias': 'growth', 'messaging_angle': 'expertise'}, 'motivations': ['recognition'], 'pain_points': ['undervalued'], 'objections': ['skeptical'], 'age_range': '30-40', 'lifestyle': 'professional', 'archetype': 'expert', 'matched_tier': 'tier_3', 'jobs_to_be_done': {}},
    brief={'task_type': 'annotation', 'campaign_objective': 'recruit experts'},
    channel='linkedin_feed',
    language='English',
    pillar_weighting={'primary': 'shape', 'secondary': 'earn'},
)
assert len(result) == 2, f'Expected 2 variations, got {len(result)}'
assert result[0]['pillar'] == 'shape', f'First should be shape, got {result[0][\"pillar\"]}'
assert result[1]['pillar'] == 'earn', f'Second should be earn, got {result[1][\"pillar\"]}'
print(f'OK: 2 pillar-weighted variations (shape, earn)')

# Without pillar weighting → 3 variations (fallback)
result2 = build_variation_prompts(
    persona={'persona_name': 'Test', 'name': 'Test', 'psychology_profile': {}, 'motivations': [], 'pain_points': [], 'objections': [], 'age_range': '22-28', 'lifestyle': 'student', 'archetype': 'gig', 'matched_tier': 'tier_1', 'jobs_to_be_done': {}},
    brief={'task_type': 'ocr', 'campaign_objective': 'recruit annotators'},
    channel='facebook_feed',
    language='Finnish',
)
assert len(result2) == 3, f'Expected 3 variations (fallback), got {len(result2)}'
print(f'OK: 3 fallback variations (earn, grow, shape)')
"
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/prompts/recruitment_copy.py
git commit -m "feat(stage3): build_variation_prompts accepts pillar_weighting + cultural_context — generates 2 relevant pillars"
```

---

### Task 7: `PASS_THRESHOLD` → 0.85 + pillar embodiment scoring + `pillar` in asset metadata

**Files:**
- Modify: `worker/pipeline/stage3_copy.py:31,44-119,200-216`

- [ ] **Step 1: Raise PASS_THRESHOLD**

Change line 31 from:

```python
PASS_THRESHOLD = 0.70
```

To:

```python
PASS_THRESHOLD = 0.85
```

- [ ] **Step 2: Add PILLAR_SIGNALS constant and pillar embodiment scoring**

After the existing `ANTI_PATTERNS` dict (around line 56), add:

```python
# ── Pillar embodiment signals ─────────────────────────────────────────
# Used to verify that copy actually embodies the intended brand pillar.

PILLAR_SIGNALS: dict[str, set[str]] = {
    "earn": {"earn", "paid", "payout", "income", "compensation", "money", "financial", "twice-monthly", "payoneer", "paypal"},
    "grow": {"grow", "career", "skill", "learn", "portfolio", "credential", "experience", "develop", "advance", "build"},
    "shape": {"expert", "expertise", "judgment", "shape", "influence", "recognition", "respected", "valued", "contribute", "impact"},
}
```

- [ ] **Step 3: Add pillar scoring to `_score_copy_quality()`**

Modify `_score_copy_quality()` to accept an optional `pillar` parameter. Change signature from:

```python
def _score_copy_quality(copy_data: dict, persona: dict | None = None) -> tuple[float, list[str]]:
```

To:

```python
def _score_copy_quality(copy_data: dict, persona: dict | None = None, pillar: str | None = None) -> tuple[float, list[str]]:
```

Then, before the final `score = min(max(score, 0.0), 1.0)` line (around line 118), add the pillar embodiment check:

```python
    # Pillar embodiment scoring
    if pillar and pillar in PILLAR_SIGNALS:
        target_signals = PILLAR_SIGNALS[pillar]
        target_hits = sum(1 for w in target_signals if w in all_text)
        score += min(target_hits * 0.03, 0.09)

        # Check for pillar confusion — does a non-target pillar dominate?
        max_other_hits = 0
        dominant_other = None
        for other_pillar, other_signals in PILLAR_SIGNALS.items():
            if other_pillar == pillar:
                continue
            other_hits = sum(1 for w in other_signals if w in all_text)
            if other_hits > max_other_hits:
                max_other_hits = other_hits
                dominant_other = other_pillar

        if max_other_hits > target_hits and max_other_hits > 0:
            score -= 0.05
            issues.append(
                f"Pillar confusion: copy reads more like '{dominant_other}' "
                f"than target pillar '{pillar}' ({max_other_hits} vs {target_hits} signal hits)"
            )
```

- [ ] **Step 4: Update the `_score_copy_quality()` calls in `run_stage3()` to pass pillar**

In `run_stage3()`, find the two scoring calls.

First call (around line 174):
```python
                        score, eval_issues = _score_copy_quality(copy_data, persona)
```
Change to:
```python
                        score, eval_issues = _score_copy_quality(copy_data, persona, pillar=var.get("pillar"))
```

Second call — the retry scoring (around line 193):
```python
                            score, eval_issues = _score_copy_quality(copy_data, persona)
```
Change to:
```python
                            score, eval_issues = _score_copy_quality(copy_data, persona, pillar=var.get("pillar"))
```

- [ ] **Step 5: Add `pillar` to asset metadata**

In `run_stage3()`, find the `save_asset` call inside the persona loop (around line 200-216). Change the metadata dict from:

```python
                        await save_asset(request_id, {
                            "asset_type": "copy",
                            "platform": channel,
                            "format": "text",
                            "language": language,
                            "blob_url": "",
                            "metadata": {
                                "copy_data": copy_data,
                                "eval_score": score,
                                "eval_issues": eval_issues,
                                "persona_key": persona_key,
                                "persona_name": persona_name,
                                "copy_angle": var["angle"],
                                "psychology_bias": var["bias"],
                            },
                        })
```

To:

```python
                        await save_asset(request_id, {
                            "asset_type": "copy",
                            "platform": channel,
                            "format": "text",
                            "language": language,
                            "blob_url": "",
                            "metadata": {
                                "copy_data": copy_data,
                                "eval_score": score,
                                "eval_issues": eval_issues,
                                "persona_key": persona_key,
                                "persona_name": persona_name,
                                "copy_angle": var["angle"],
                                "psychology_bias": var["bias"],
                                "pillar": var.get("pillar", ""),
                            },
                        })
```

- [ ] **Step 6: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/pipeline/stage3_copy.py
git commit -m "feat(stage3): PASS_THRESHOLD 0.85, pillar embodiment scoring, pillar in asset metadata"
```

---

### Task 8: Wire pillar_weighting + cultural_research + language derivation into `run_stage3()`

**Files:**
- Modify: `worker/pipeline/stage3_copy.py:122-160`

- [ ] **Step 1: Extract pillar_weighting and cultural_research in `run_stage3()`**

In `run_stage3()`, after the existing context extraction (around line 130), add:

```python
    # Extract derived_requirements for pillar weighting (Phase A+B data)
    derived_req = brief.get("derived_requirements", {})
    if isinstance(derived_req, str):
        try:
            derived_req = json.loads(derived_req)
        except (ValueError, TypeError):
            derived_req = {}
    pillar_weighting = derived_req.get("pillar_weighting", {}) if isinstance(derived_req, dict) else {}

    # Cultural research — region-specific insights for copy adaptation
    cultural_research: dict = context.get("cultural_research", {})
```

- [ ] **Step 2: Replace hardcoded language fallback with `derive_languages_from_regions()`**

Find line 127:
```python
    languages: list[str] = context.get("target_languages", []) or ["English"]
```

Replace with:
```python
    languages: list[str] = derive_languages_from_regions(
        regions,
        context.get("target_languages", []),
    )
```

- [ ] **Step 3: Build cultural context per persona and pass to `build_variation_prompts()`**

In the persona loop, before the `build_variation_prompts()` call (around line 152), add cultural context extraction:

```python
            # Build cultural context for this persona's region
            persona_region = persona.get("region", regions[0] if regions else "")
            region_research = cultural_research.get(persona_region, {})
            if isinstance(region_research, dict):
                # Format research summary — truncate to avoid token bloat
                research_lines = []
                for dim_key, dim_data in region_research.items():
                    if dim_key.startswith("_"):
                        continue
                    if isinstance(dim_data, dict):
                        summary = dim_data.get("summary", dim_data.get("key_finding", ""))
                    elif isinstance(dim_data, str):
                        summary = dim_data
                    else:
                        continue
                    if summary:
                        research_lines.append(f"- {dim_key}: {summary[:200]}")
                cultural_context = "\n".join(research_lines)[:2000] if research_lines else None
            elif isinstance(region_research, str):
                cultural_context = region_research[:2000]
            else:
                cultural_context = None
```

Then modify the `build_variation_prompts()` call from:

```python
                    variations = build_variation_prompts(
                        persona=persona,
                        brief=brief,
                        channel=channel,
                        language=language,
                        regions=regions,
                        form_data=form_data,
                    )
```

To:

```python
                    variations = build_variation_prompts(
                        persona=persona,
                        brief=brief,
                        channel=channel,
                        language=language,
                        regions=regions,
                        form_data=form_data,
                        pillar_weighting=pillar_weighting,
                        cultural_context=cultural_context,
                    )
```

- [ ] **Step 4: Log the pillar weighting decision**

Right after the `pillar_weighting` extraction, add a log line:

```python
    if pillar_weighting:
        logger.info(
            "Pillar weighting active: primary=%s, secondary=%s",
            pillar_weighting.get("primary"), pillar_weighting.get("secondary"),
        )
    else:
        logger.info("No pillar weighting — generating all 3 pillars (fallback)")
```

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/pipeline/stage3_copy.py
git commit -m "feat(stage3): wire pillar_weighting + cultural_research + language derivation into run_stage3"
```

---

### Task 9: Smoke tests for Stage 3 changes

**Files:**
- Modify: `worker/tests/smoke_test.py`

- [ ] **Step 1: Add smoke tests**

Add these test functions to `worker/tests/smoke_test.py`:

```python
def test_derive_languages_from_regions():
    """Language derivation from regions."""
    from pipeline.stage3_copy import derive_languages_from_regions
    # Derive from regions
    assert derive_languages_from_regions(["BR", "MX"], []) == ["Portuguese", "Spanish"]
    # Existing languages preserved
    assert derive_languages_from_regions(["BR"], ["English"]) == ["English"]
    # Empty → English
    assert derive_languages_from_regions([], []) == ["English"]
    # Dedup
    assert derive_languages_from_regions(["BR", "PT"], []) == ["Portuguese"]
    # Unknown → English
    assert derive_languages_from_regions(["XX"], []) == ["English"]
    # Case insensitive
    assert derive_languages_from_regions(["fi"], []) == ["Finnish"]
    print("  ✓ test_derive_languages_from_regions")


def test_build_variation_prompts_pillar_weighted():
    """Pillar weighting generates 2 variations, not 3."""
    from prompts.recruitment_copy import build_variation_prompts
    persona = {
        "persona_name": "Dr. Sofia",
        "name": "Dr. Sofia",
        "psychology_profile": {"primary_bias": "authority", "secondary_bias": "growth", "messaging_angle": "expertise"},
        "motivations": ["recognition"],
        "pain_points": ["undervalued"],
        "objections": [],
        "age_range": "30-40",
        "lifestyle": "medical professional",
        "archetype": "Clinical Specialist",
        "matched_tier": "tier_3_credentialed",
        "jobs_to_be_done": {"functional": "Document cases"},
    }
    result = build_variation_prompts(
        persona=persona,
        brief={"task_type": "medical_documentation", "campaign_objective": "recruit credentialed experts"},
        channel="linkedin_feed",
        language="Portuguese",
        pillar_weighting={"primary": "shape", "secondary": "earn"},
    )
    assert len(result) == 2, f"Expected 2 variations, got {len(result)}"
    assert result[0]["pillar"] == "shape"
    assert result[1]["pillar"] == "earn"
    print("  ✓ test_build_variation_prompts_pillar_weighted")


def test_build_variation_prompts_no_weighting():
    """Without pillar weighting, generates all 3 variations."""
    from prompts.recruitment_copy import build_variation_prompts
    persona = {
        "persona_name": "Ana",
        "name": "Ana",
        "psychology_profile": {},
        "motivations": [],
        "pain_points": [],
        "objections": [],
        "age_range": "22-28",
        "lifestyle": "student",
        "archetype": "gig worker",
        "matched_tier": "tier_1_gig",
        "jobs_to_be_done": {},
    }
    result = build_variation_prompts(
        persona=persona,
        brief={"task_type": "ocr", "campaign_objective": "recruit annotators"},
        channel="facebook_feed",
        language="Finnish",
    )
    assert len(result) == 3, f"Expected 3 variations, got {len(result)}"
    print("  ✓ test_build_variation_prompts_no_weighting")


def test_build_variation_prompts_with_cultural_context():
    """Cultural context should appear in the user prompt."""
    from prompts.recruitment_copy import build_variation_prompts
    persona = {
        "persona_name": "Youssef",
        "name": "Youssef",
        "psychology_profile": {"primary_bias": "practicality"},
        "motivations": ["income"],
        "pain_points": [],
        "objections": [],
        "age_range": "25-35",
        "lifestyle": "multilingual professional",
        "archetype": "translator",
        "matched_tier": "tier_2",
        "jobs_to_be_done": {},
    }
    cultural = "- ai_fatigue: Low awareness of AI gig work in Morocco\n- payment_pref: Mobile money preferred"
    result = build_variation_prompts(
        persona=persona,
        brief={"task_type": "translation", "campaign_objective": "recruit translators"},
        channel="facebook_feed",
        language="French",
        cultural_context=cultural,
    )
    assert any("ai_fatigue" in v["user"] for v in result), "Cultural context should be in user prompt"
    assert any("CULTURAL CONTEXT" in v["user"] for v in result), "Cultural context header should be present"
    print("  ✓ test_build_variation_prompts_with_cultural_context")


def test_score_copy_quality_pillar_signals():
    """Pillar embodiment scoring."""
    from pipeline.stage3_copy import _score_copy_quality
    # Shape copy with shape signals → bonus
    shape_copy = {"primary_text": "Your expertise in clinical judgment is exactly what AI teams need. Be recognized for the impact you bring."}
    score, issues = _score_copy_quality(shape_copy, pillar="shape")
    assert score > 0.60, f"Shape copy should score well, got {score}"
    assert not any("confusion" in i.lower() for i in issues), "Should not have confusion"

    # Earn copy that reads like Shape → confusion
    confused_copy = {"primary_text": "Your expertise and judgment are valued. Be recognized as a respected contributor who shapes AI."}
    score2, issues2 = _score_copy_quality(confused_copy, pillar="earn")
    assert any("confusion" in i.lower() for i in issues2), "Should detect pillar confusion"
    print("  ✓ test_score_copy_quality_pillar_signals")
```

- [ ] **Step 2: Run the full smoke test suite**

```bash
cd /Users/stevenjunop/centric-intake/worker && python3 tests/smoke_test.py 2>&1 | tail -25
```

Expected: All new tests pass. Pre-existing KLING_API_KEY skip is fine.

- [ ] **Step 3: Run the Node verifier one more time**

```bash
cd /Users/stevenjunop/centric-intake && node --experimental-strip-types scripts/verify-stage23-overhaul.mjs
```

Expected: `✓ all stage 2/3 overhaul assertions passed (35 total)`

- [ ] **Step 4: Run Next.js build (sanity — should be unaffected)**

```bash
cd /Users/stevenjunop/centric-intake && npm run build 2>&1 | tail -10
```

Expected: Builds cleanly. Phase C+D only touches Python.

- [ ] **Step 5: Commit**

```bash
cd /Users/stevenjunop/centric-intake && git add worker/tests/smoke_test.py
git commit -m "test(stage3): smoke tests for language derivation, pillar weighting, cultural context, pillar scoring"
```

---

## Phase — Deploy + Verification

### Task 10: Merge + deploy + end-to-end verification

- [ ] **Step 1: Verify branch state**

```bash
cd /Users/stevenjunop/centric-intake
git log --oneline -15
echo "---"
cd worker && python3 tests/smoke_test.py 2>&1 | tail -10 && cd ..
echo "---"
node --experimental-strip-types scripts/verify-stage23-overhaul.mjs
```

Expected: all commits visible, smoke tests pass, verifier passes.

- [ ] **Step 2: Deploy to Vercel prod**

```bash
vercel --prod --yes 2>&1 | tail -20
```

- [ ] **Step 3: Alias to nova-intake.vercel.app**

```bash
vercel alias set <DEPLOYMENT_URL> nova-intake.vercel.app 2>&1 | tail -3
```

Replace `<DEPLOYMENT_URL>` with the URL from step 2.

- [ ] **Step 4: Restart the worker**

```bash
ps aux | grep "python.*main.py" | grep -v grep
# Kill existing worker (adapt PID)
# Restart:
cd /Users/stevenjunop/centric-intake/worker && python3 main.py &
```

- [ ] **Step 5: End-to-end verification on Cutis**

1. Open https://nova-intake.vercel.app
2. Navigate to the Cutis campaign
3. Trigger Stage 1 regenerate (to produce fresh derived_requirements)
4. Wait for completion
5. Trigger Stage 2 regenerate → verify:
   - Actor cards have clinical scenes (not home office)
   - Images show diverse compositions (not all centered)
   - Backdrops match medical environments
6. Trigger Stage 3 regenerate → verify:
   - Only 2 copy variations per persona (Shape + Earn — NOT Grow)
   - Copy references expertise, clinical judgment, recognition
   - Copy asset metadata includes `"pillar": "shape"` or `"pillar": "earn"`

- [ ] **Step 6: Verify a contrasting gig job**

Create a new intake for Finnish OCR → verify:
- Copy generated in Finnish (derived from "FI" region)
- Only Earn + Grow variations (NOT Shape)
- Images show casual home/cafe scenes

- [ ] **Step 7: Write memory checkpoint**

Create a new memory file documenting what shipped.

---

## Self-Review

### Spec coverage check

| Spec section | Covered by task |
|---|---|
| § 1.1 Visual direction data shape | Task 2 (prompt reads all 5 fields) |
| § 1.2 Actor card prompt rewrite | Task 2 (dynamic scenes + visual_direction block) |
| § 1.3 REGION_SETTINGS demotion | Task 2 (visual_direction is primary, REGION_SETTINGS untouched as fallback) |
| § 1.4 Composition engine integration | **Already done** — noted in plan header |
| § 1.5 Data flow | Task 3 (wiring through run_stage2 → _generate_actor_card) |
| § 1.6 Passing derived_requirements | Task 3 (extracted in run_stage2, passed via job dict) |
| § 2.1 Pillar weighting data shape | Task 6 (validated in build_variation_prompts) |
| § 2.2 Variation generation changes | Task 6 (2 variations when pillar_weighting present) |
| § 2.3 Stage 3 orchestrator changes | Task 8 (wiring in run_stage3) |
| § 2.4 Cultural research injection | Task 8 (per-persona region lookup + truncation) |
| § 2.5 Language derivation | Task 5 (helper function + REGION_LANGUAGE_MAP) |
| § 2.6 Copy quality threshold | Task 7 (0.70 → 0.85) |
| § 2.7 Pillar embodiment scoring | Task 7 (PILLAR_SIGNALS + confusion detection) |
| § 2.8 Asset metadata extension | Task 7 (`pillar` field added) |
| § 5 Error handling / fallbacks | Tasks 2, 3, 5, 6, 7, 8 (all have fallback paths) |
| § 6 Testing strategy | Tasks 1 (verifier), 4 (Stage 2 smoke), 9 (Stage 3 smoke) |
| § 7 E2E verification | Task 10 (deploy + verify on Cutis + contrasting job) |

### Placeholder scan

No TBDs, TODOs, or vague instructions found. All code blocks are complete.

### Type consistency

- `pillar_weighting: dict | None` — consistent across Tasks 6, 7, 8
- `cultural_context: str | None` — consistent across Tasks 6, 8
- `visual_direction: dict | None` — consistent across Tasks 2, 3
- `derive_languages_from_regions(regions, target_languages)` — signature matches in Tasks 5, 8
- `_score_copy_quality(copy_data, persona, pillar)` — signature matches in Tasks 7, 9
- `build_variation_prompts(..., pillar_weighting, cultural_context)` — signature matches in Tasks 6, 8
