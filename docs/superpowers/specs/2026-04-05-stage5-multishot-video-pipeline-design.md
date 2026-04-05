# Stage 5: Multishot UGC Video Pipeline — Design Spec

## Goal

Generate hyper-realistic UGC-style recruitment videos for OneForma that look like organic influencer content, not paid ads. Each video is persona-targeted, uses per-shot storyboard reference images for maximum Kling character consistency, and is scored against a 6-dimension rubric before shipping.

**Core principle:** Paid media disguised as inbound organic. GRWM, Storytime, "I just found out" — formats that the algorithm treats as organic content.

## Architecture

Neurogen-style layered system adapted for recruitment UGC:

```
┌─────────────────────────────────────────────────────────────┐
│ INPUTS (from Stages 1-4)                                    │
│ • Persona (psychology, trigger words, pain points, region)  │
│ • Actor (face_lock, approved images, seed URL)              │
│ • Brief (campaign objective, compensation, task type)       │
│ • Copy variations (3 angles from Stage 3)                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ TEMPLATE SELECTOR                                           │
│ Pick genre template + 2-3 random locations from pool        │
│ Template defines: beat structure, shot count, camera flow,  │
│ energy arc, which beats carry dialogue vs visual-only       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 5A: QWEN 397B — Script Writer                        │
│ Input: persona + brief + template + locations               │
│ Output: JSON array of shots, each with:                     │
│   dialogue, camera, action, acting_direction, setting,      │
│   duration_s, energy_level, transition                      │
│                                                              │
│ EVALUATOR GATE (6 dimensions, rewrite loop, max 2 retries) │
│ Script must score ≥8.0 overall, ≥7 per dimension            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 5B: GEMMA 4 31B — Storyboard Generator + VQA Gate    │
│ For EACH shot:                                               │
│   1. Write Seedream prompt (actor face_lock + shot details) │
│   2. Generate image via Seedream 4.5                        │
│   3. VQA: Gemma 4 reviews image against script              │
│   4. If fail → rewrite prompt with visual feedback → retry  │
│   5. VQA-passed frame enters the reference set              │
│                                                              │
│ Output: 4-6 storyboard frames, all VQA-verified             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ STAGE 5C: KLING 3.0 MULTISHOT — Video Generation           │
│ Input: multishot payload with:                               │
│   • Per-shot prompts (camera + subject + action + env)      │
│   • ALL storyboard frames as references                     │
│   • sound=on (native audio generation)                      │
│ Output: 12-15s video with synchronized audio                │
│                                                              │
│ Constraints: ≤6 shots, dialogue before 10s,                 │
│ 12s minimum / 15s maximum duration                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ UPLOAD + SAVE                                                │
│ Upload to Vercel Blob → Save asset to Neon with metadata    │
│ (script, storyboard URLs, persona_key, template, locations) │
└─────────────────────────────────────────────────────────────┘
```

## UGC Genre Templates (8)

Each template defines the structural skeleton. The LLM fills in persona-specific content.

### 1. GRWM (Get Ready With Me)
- **Shots:** 4-5 (14-15s)
- **Beat structure:** Bathroom/vanity mirror routine → getting dressed/makeup → casual "oh btw" mention → show phone/reaction → CTA while leaving
- **Energy arc:** 3 → 4 → 6 → 7 → 8
- **Camera:** Close-up mirror → medium getting ready → medium-close casual → close-up phone → wide walking out
- **Dialogue window:** Shots 2-4 (before 10s)
- **Location pool:** bedroom_vanity, bathroom_mirror, bedroom_morning, kitchen_counter
- **Feels like:** Creator sharing a tip during their morning routine

### 2. Storytime
- **Shots:** 4 (13-15s)
- **Beat structure:** Close-up hook ("so this happened...") → problem build with gestures → discovery reaction → excited CTA
- **Energy arc:** 7 → 5 → 8 → 9
- **Camera:** Extreme close-up → medium animated → medium-close surprised → close-up direct
- **Dialogue window:** All shots (front-load critical dialogue in shots 1-3)
- **Location pool:** couch_home, car_selfie, bedroom_morning, cafe_window
- **Feels like:** Creator telling friends about an amazing find

### 3. Just Found Out
- **Shots:** 3-4 (12-14s)
- **Beat structure:** Urgent selfie "you guys..." → explain discovery rapidly → show proof/reaction → "you NEED to try this"
- **Energy arc:** 8 → 7 → 9 → 10
- **Camera:** Handheld selfie (shaky) → medium frantic → close-up eyes wide → direct to camera
- **Dialogue window:** Shots 1-3 (all urgent, fast-paced)
- **Location pool:** car_selfie, walking_street, couch_home, kitchen_counter
- **Feels like:** Excited friend who can't contain the news

### 4. Day In My Life
- **Shots:** 5-6 (14-15s)
- **Beat structure:** Morning wake/routine → commute/walk → work session → break + check earnings → evening flex → recommend
- **Energy arc:** 3 → 4 → 5 → 7 → 8 → 9
- **Camera:** Wide morning → tracking walk → desk medium → close-up phone → medium celebration → direct CTA
- **Dialogue window:** Shots 3-5 (voiceover feel for 1-2, spoken for 3-5)
- **Location pool:** bedroom_morning, walking_street, desk_workspace, cafe_window, couch_home, park_bench
- **Feels like:** Lifestyle vlog with naturally embedded pitch

### 5. POV: You Discover
- **Shots:** 3 (12-13s)
- **Beat structure:** POV scrolling phone moment → reaction face → celebration + CTA
- **Energy arc:** 4 → 8 → 10
- **Camera:** Over-shoulder/POV angle → close-up reaction → medium celebration
- **Dialogue window:** Shots 2-3 only
- **Location pool:** couch_home, desk_workspace, bedroom_morning, car_selfie
- **Feels like:** Second-person immersion, viewer IS the character

### 6. Reply To Comment
- **Shots:** 3-4 (12-14s)
- **Beat structure:** Read "comment" aloud with skepticism → address it directly → show proof/experience → CTA
- **Energy arc:** 5 → 7 → 8 → 9
- **Camera:** Close-up reading → medium explaining → close-up proof → direct CTA
- **Dialogue window:** All shots (conversational, responding to imaginary commenter)
- **Location pool:** couch_home, desk_workspace, kitchen_counter, car_selfie
- **Feels like:** Organic engagement response, creator defending their choice

### 7. Before/After
- **Shots:** 4 (13-15s)
- **Beat structure:** "Before" struggling/frustrated → discovery moment → "After" thriving/happy → recommend
- **Energy arc:** 3 → 5 → 9 → 8
- **Camera:** Desaturated/dim "before" → transition flash → bright/warm "after" → direct CTA
- **Dialogue window:** Shots 1-3
- **Location pool:** desk_workspace (before), bedroom_morning (before), cafe_window (after), park_bench (after), couch_home
- **Feels like:** Transformation story, relatable struggle to success

### 8. Whisper/Confession
- **Shots:** 3 (12-13s)
- **Beat structure:** Lean in close "don't tell anyone but..." → reveal opportunity in hushed excitement → "seriously go do this" with intensity
- **Energy arc:** 6 → 8 → 9
- **Camera:** Extreme close-up whisper → medium conspiratorial → close-up direct intense
- **Dialogue window:** All shots (intimate, low volume building to normal)
- **Location pool:** bedroom_vanity, bedroom_morning, couch_home, car_selfie
- **Feels like:** Intimate secret sharing, insider knowledge

## Location System

Each location has environmental_pressure (subconscious communication) and mood_bias (lighting/color/energy). Videos randomly select 2-3 locations from the template's pool to prevent repetition across videos.

```json
{
  "bedroom_vanity": {
    "environmental_pressure": ["beauty routine", "self-care", "confidence building"],
    "mood_bias": ["ring light or warm lamp", "close-up face", "mirror POV"],
    "seedream_hints": "Young woman at vanity table, ring light reflection in eyes, makeup products visible, warm bedroom background, front-facing camera angle as if camera IS the mirror"
  },
  "bathroom_mirror": {
    "environmental_pressure": ["routine", "authenticity", "vulnerability"],
    "mood_bias": ["warm soft lighting", "intimate", "morning glow"],
    "seedream_hints": "Person in bathroom, mirror selfie angle, warm overhead light, toothbrush/skincare visible, natural morning appearance"
  },
  "kitchen_counter": {
    "environmental_pressure": ["home comfort", "casual", "daily life"],
    "mood_bias": ["bright natural window light", "domestic", "approachable"],
    "seedream_hints": "Person leaning on kitchen counter, bright window behind, coffee mug visible, casual clothes, relaxed posture"
  },
  "car_selfie": {
    "environmental_pressure": ["urgency", "mobility", "spontaneity"],
    "mood_bias": ["variable natural light", "handheld shake", "raw energy"],
    "seedream_hints": "Person in car driver/passenger seat, seatbelt visible, dashboard blurred behind, selfie angle from phone on dash, excited expression"
  },
  "couch_home": {
    "environmental_pressure": ["relaxation", "trust", "personal space"],
    "mood_bias": ["warm lamp glow", "cozy", "confessional"],
    "seedream_hints": "Person on couch with throw blanket, warm lamp light, living room background, legs tucked up, casual intimate pose"
  },
  "desk_workspace": {
    "environmental_pressure": ["productivity", "earning", "professional"],
    "mood_bias": ["focused task lighting", "clean background", "competent"],
    "seedream_hints": "Person at desk, laptop closed/angled away, desk lamp, organized space, smart-casual clothes, slightly leaning forward"
  },
  "cafe_window": {
    "environmental_pressure": ["social", "aspirational", "freedom"],
    "mood_bias": ["golden natural light", "bokeh background", "lifestyle"],
    "seedream_hints": "Person at cafe window seat, golden light streaming in, coffee cup, busy street bokeh behind, relaxed confident smile"
  },
  "walking_street": {
    "environmental_pressure": ["movement", "energy", "real world"],
    "mood_bias": ["overcast or golden", "handheld shake", "dynamic"],
    "seedream_hints": "Person walking on urban street, camera tracking at eye level, slight motion blur, buildings behind, mid-stride energy"
  },
  "bedroom_morning": {
    "environmental_pressure": ["fresh start", "genuine", "unfiltered"],
    "mood_bias": ["soft morning window light", "messy-real", "intimate"],
    "seedream_hints": "Person sitting on bed edge, morning light through curtains, rumpled sheets, natural hair, just-woke-up authentic"
  },
  "park_bench": {
    "environmental_pressure": ["freedom", "flexibility", "outdoors"],
    "mood_bias": ["bright daylight", "green background", "relaxed"],
    "seedream_hints": "Person on park bench, trees and grass behind, dappled sunlight, casual outdoor clothes, open relaxed posture"
  }
}
```

## Script Evaluator (6 Dimensions)

Ported from Neurogen's `script_evaluator.py` architecture — hard gating independent of LLM self-assessment, rewrite loop on failure.

### Dimensions

| Dimension | Weight | Min Score | What it catches |
|---|---|---|---|
| `scroll_stop_hook` | 20% | ≥7 | Weak openers, generic "hey guys", no pattern interrupt, no visual tension |
| `energy_arc` | 15% | ≥7 | Flat energy, no build across beats, disconnected scenes, anticlimactic ending |
| `pain_point_resonance` | 20% | ≥7 | Generic problems, not persona-specific, no emotional nerve, could apply to anyone |
| `cta_urgency` | 15% | ≥7 | No OneForma mention, vague CTA, "check it out", trailing off, no reason to act now |
| `persona_authenticity` | 20% | ≥7 | Wrong tone for age/region, no trigger words, sounds corporate not peer, translated-feeling |
| `filmability` | 10% | ≥8 | Screen content described, >6 shots, dialogue after 10s, physically impossible actions, total <12s or >15s |

### Gate Rules

- Overall score ≥ 8.0 AND every dimension ≥ its min threshold → **accept**
- Otherwise → **rewrite** with per-dimension feedback (max 2 retries)
- Safety gate: reject platform-guideline violations
- Hard gating independent of LLM's self-reported verdict (Neurogen pattern)

### Auto-Fail Triggers (instant reject)

- No "OneForma" in dialogue
- CTA is "check it out" / "link in bio" / "learn more" with no specificity
- Dialogue extends past 10s mark (lip sync breaks)
- Script describes readable screen content (Kling can't render UIs)
- Total duration <12s or >15s
- More than 6 shots
- No camera direction specified for any shot
- Generic gig-economy language ("flexible hours", "extra income")

### Rewrite Loop

On failure, evaluator feeds back the exact dimension scores + reasons (same as Neurogen's `build_rewrite_prompt`):

```json
{
  "overall_score": 6.8,
  "scores": {
    "scroll_stop_hook": 8,
    "energy_arc": 5,
    "pain_point_resonance": 7,
    "cta_urgency": 6,
    "persona_authenticity": 8,
    "filmability": 9
  },
  "reason": "energy_arc flat — beats 2 and 3 have same intensity. cta_urgency weak — 'try it out' is generic, needs specific action + time anchor."
}
```

Qwen rewrites with this feedback, preserving structure but fixing weak dimensions.

## Per-Shot Storyboard Generation

For each shot in the approved script:

1. **Gemma 4 writes Seedream prompt** — combines actor's face_lock data (hair, skin tone, eye color, age) with the shot's camera direction, setting, action, and location's `seedream_hints`
2. **Seedream 4.5 generates the frame** — $0.04/image via OpenRouter
3. **Gemma 4 VQA reviews** — checks: does the person match the actor? Is the camera angle right? Does the setting match the location? Is the expression/action correct?
4. **If VQA fails** → Gemma 4 rewrites the Seedream prompt with specific visual feedback → re-generate → re-gate (max 2 retries)
5. **VQA-passed frame** enters the Kling reference set for that shot

Cost per video storyboard: 4-6 shots × $0.04/image × ~1.5 retries avg = **$0.24-0.36**

## Kling Multishot Payload

All VQA-passed storyboard frames are passed as references in a single multishot call:

```python
payload = {
    "model_name": "kling-v3",
    "multi_shot": True,
    "shot_type": "customize",
    "multi_prompt": [
        {"index": 1, "prompt": "[CAMERA: extreme close-up] [SUBJECT: Camila...] [ACTION: leans into mirror...]", "duration": "3"},
        {"index": 2, "prompt": "[CAMERA: medium shot] [SUBJECT: same person...] [ACTION: applying makeup, casually mentions...]", "duration": "4"},
        {"index": 3, "prompt": "[CAMERA: close-up] [SUBJECT: same person...] [ACTION: eyes light up, genuine excitement...]", "duration": "3"},
        {"index": 4, "prompt": "[CAMERA: medium-wide] [SUBJECT: same person...] [ACTION: grabs bag, walks to door, looks back with smile...]", "duration": "3"},
    ],
    "duration": "13",
    "mode": "pro",
    "aspect_ratio": "9:16",
    "sound": "on",
    "image_list": [
        {"image_url": "storyboard_shot1.png"},
        {"image_url": "storyboard_shot2.png"},
        {"image_url": "storyboard_shot3.png"},
        {"image_url": "storyboard_shot4.png"},
    ],
}
```

Each shot's prompt uses the Kling formula: `[CAMERA] + [SUBJECT] + [ACTION] + [ENVIRONMENT] + [LIGHTING] + [TEXTURE]`

The storyboard images in `image_list` give Kling visual reference for EACH shot — this is what the YT creators identified as the key to hyper-real consistency.

## Duration & Dialogue Constraints

```
|-- DIALOGUE ZONE (0-10s) --|-- VISUAL-ONLY CTA (10-15s) --|
    Lip sync safe              Action + expression + text overlay
    Spoken pitch lands here    Brand moment, no spoken dialogue needed
```

- **Minimum total duration:** 12 seconds
- **Maximum total duration:** 15 seconds
- **Dialogue cutoff:** 10 seconds (lip sync safe zone)
- **Last 2-5 seconds:** Visual-only CTA beat — smile, fist pump, walk away confident, with text overlay for CTA. No lip sync needed.

## Cost Model

Per video (one persona × one template):

| Step | Model | Cost |
|---|---|---|
| Script generation | Qwen 397B (NIM free) | $0.00 |
| Script evaluation | Qwen 397B (NIM free) | $0.00 |
| Seedream prompts | Gemma 4 31B (NIM free) | $0.00 |
| Storyboard images (5 avg) | Seedream 4.5 ($0.04/img) | $0.20 |
| Storyboard VQA | Gemma 4 31B (NIM free) | $0.00 |
| Re-gen failed frames (~2) | Seedream 4.5 | $0.08 |
| Kling multishot (1080p, 13s) | Kling 3.0 | ~$0.40 |
| **Total per video** | | **~$0.68** |

Per campaign (3 personas × 2 templates each = 6 videos): **~$4.08**

## Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `worker/prompts/video_templates.py` | Create | 8 UGC genre templates + location system (Neurogen-style) |
| `worker/prompts/video_evaluator.py` | Create | 6-dimension rubric + gate logic + rewrite prompt builder |
| `worker/prompts/video_storyboard.py` | Create | Gemma 4 Seedream prompt writer + VQA for storyboard frames |
| `worker/pipeline/stage5_video.py` | Create | Full pipeline orchestrator (template select → script → storyboard → Kling → upload) |
| `worker/ai/kling_client.py` | Modify | Ensure multishot accepts per-shot image references correctly |
| `worker/prompts/video_script.py` | Modify | Update templates to output per-shot JSON with location + Seedream hints |
| `worker/prompts/video_director.py` | Keep | Camera vocabulary, lighting presets, texture presets already solid |

## Tech Stack

- **Script writer:** Qwen 3.5 397B on NIM (free, 128K context, thinking mode)
- **Storyboard prompter + VQA:** Gemma 4 31B on NIM (free, multimodal, fast)
- **Storyboard images:** Seedream 4.5 via OpenRouter ($0.04/image)
- **Video generation:** Kling 3.0 multishot with sound=on
- **Storage:** Vercel Blob (videos) + Neon (metadata)
