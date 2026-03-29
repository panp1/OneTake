# Stage 4 v2: LLM-Designed Creative Compositor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static HTML template compositor with an LLM-designed creative system where Kimi K2.5 generates unique, persona-driven, scene-matched HTML/CSS ad overlays that are rendered via Playwright into production-ready creatives with overlay-only exports for designers.

**Architecture:** Kimi K2.5 acts as the creative designer — receiving the full brief context, persona psychology, OneForma brand kit, and frontend-design skill instructions — and generates complete HTML/CSS for each creative. Playwright renders two versions: final composite and overlay-only transparent export. Background removal via rembg creates person cutouts for popout/floating effects. All renders run in parallel via asyncio.Semaphore.

**Tech Stack:** Python (asyncio), Kimi K2.5 via OpenRouter, Playwright (headless Chromium), rembg (U2-Net), Pillow (compositing fallback), Vercel Blob (storage), Neon (metadata).

---

## 1. Pipeline Overview

```
STAGE 4 v2 PIPELINE:

Step 1: BACKGROUND REMOVAL
  36 actor images → rembg → 36 cutout PNGs (transparent bg)
  + 36 cutout-with-shadow PNGs (floating effect)
  Uses: ai/bg_remover.py (already built)

Step 2: LLM CREATIVE DESIGN (Kimi K2.5)
  Per persona × platform (3 personas × 5 platforms = 15 API calls):
    Kimi receives full context (see §3 Prompt Context)
    Kimi returns 2-3 HTML/CSS designs per call
    Each uses different actor + scene + persona-driven hook
    Kimi decides: cutout vs full image vs both per creative
  Total: ~15 Kimi calls → ~38 HTML designs

Step 3: DUAL RENDER (Playwright)
  Per HTML design, render TWO PNGs:
    1. Final creative (complete with images)
    2. Overlay-only (same HTML, image URLs set to transparent)
  Total: ~76 Playwright renders → ~76 PNGs

Step 4: PLATFORM REFLOW
  Each HTML design adapts to platform's native dimensions
  Not cropping — full repositioning via CSS adaptive sizing
  Text, CTAs, badges, blobs all reposition per aspect ratio

Step 5: UPLOAD + SAVE
  All PNGs → Vercel Blob
  Metadata → Neon generated_assets table
  Both overlay copy AND platform copy tracked per asset
```

## 2. Input/Output Matrix

### Inputs (from Stages 1-3)

| Source | Data | Count |
|--------|------|-------|
| Stage 1 | Creative brief, 3 personas (psychology profiles, pain points, trigger words), cultural research, design direction | 1 brief |
| Stage 2 | 9 actors (3 per persona), each with 4 scene images (seed + 3 variations). Each image has VQA score + deglosser applied | 36 base images |
| Stage 3 | Platform ad copy for 5 channels (LinkedIn, Facebook, IG, Telegram, Google Display) | 5 copy sets |

### Outputs

| Asset | Count | Format |
|-------|-------|--------|
| Background-removed cutouts | 36 | Transparent PNG |
| Cutouts with shadow | 36 | Transparent PNG |
| Composed creatives (final) | ~150 | Platform-native PNG |
| Overlay-only exports | ~150 | Transparent PNG |
| **Total PNGs** | **~372** | Uploaded to Vercel Blob |

### Volume Distribution

- 3 personas × 3 actors each = 9 actors
- Fixed creative volume PER PERSONA (~50 creatives each)
- Actors within a persona ROTATE — each gets ~17 creatives
- Prevents ad fatigue while maintaining persona consistency

### Cost & Performance

| Metric | Value |
|--------|-------|
| Kimi K2.5 API calls | ~15 (batched per persona × platform) |
| Est. API cost | ~$1.80 |
| Playwright renders | ~300 (150 final + 150 overlay) |
| Background removals | 36 (rembg, local, free) |
| Concurrency | Configurable via `COMPOSE_CONCURRENCY` env var (default 5) |
| Est. wall time | ~3 min at 5× concurrency |

## 3. Prompt Context (injected into every Kimi K2.5 call)

All 7 context sources, assembled per persona × platform:

### 3.1 OneForma Brand Kit
Extracted from Meta Ads Library audit (March 29, 2026):
- Colors: deep purple gradient (#3D1059 → #6B21A8), hot pink CTA (#E91E8C), gold money (#FFD700), white backgrounds
- Shapes: organic blob SVGs (purple/pink gradient fill), dot grid patterns
- Typography: system sans-serif, weight 800 headlines, weight 400 body
- CTAs: pill-shaped (border-radius: 9999px), gradient purple-to-pink
- Highlight badges: key words get colored pill backgrounds
- Photo treatment: contained in rounded frames OR person cutout popout from card
- White background option (not always dark)
- OneForma logo placement

### 3.2 Frontend-Design Skill
The full `/frontend-design` skill markdown injected as system context. Teaches Kimi:
- Visual hierarchy and spacing principles
- Typography scale and weight relationships
- Composition and layout patterns
- Scroll-stopping design techniques
- Color theory and contrast
- Whitespace and breathing room

### 3.3 Overlay Copy Context
Short scroll-stopping phrases for the image overlay (3-7 words). NOT the platform ad copy.
- Kimi generates these dynamically based on persona psychology + scene context
- Must complement (not duplicate) the Stage 3 platform copy
- Scene-matched: "Earn While They Nap" for at_home_relaxed, "Your Corner Office. Anywhere." for cafe_working

### 3.4 Platform Dimensions + Safe Areas
Exact specs per platform:
- `ig_feed`: 1080×1080, 60px safe margin
- `ig_story`: 1080×1920, 80px safe margin
- `linkedin_feed`: 1200×627, 48px safe margin
- `facebook_feed`: 1200×628, 48px safe margin
- `telegram_card`: 1280×720, 48px safe margin

### 3.5 Image URLs
Per creative, Kimi receives:
- Full UGC image URL (with background, deglosser applied)
- Cutout PNG URL (background removed, transparent)
- Cutout-with-shadow PNG URL (floating effect)
- Kimi decides which to use per creative (cutout popout on white bg, full image as background, or both for depth)

### 3.6 Actor & Persona Context
- Actor name, region, persona archetype
- Persona psychology profile: motivations, pain points, trigger words, objection handlers
- Scene description: what outfit variation this is (at_home_working, cafe_working, etc.)
- Cultural context from Stage 1 research

### 3.7 Design Audit (Strengths/Weaknesses/Opportunities)
The full OneForma ads audit findings:
- Strengths to maintain: purple brand identity, money as visual anchor, real people
- Weaknesses to fix: template fatigue, no composition variety, oversaturated purple
- Opportunities: composition engine variety, UGC realism, lifestyle scenes, typographic hierarchy, trust signals, breathing room

## 4. Kimi K2.5 Prompt Structure

```
SYSTEM PROMPT:
  [Frontend-design skill markdown — full content]
  [OneForma brand kit — colors, shapes, typography, CTA styles]
  [Design audit — strengths to keep, weaknesses to fix, opportunities]

USER PROMPT:
  You are designing recruitment ad creatives for OneForma.

  CAMPAIGN BRIEF:
  [Brief summary — objective, task type, compensation]

  PERSONA: [archetype name]
  Psychology: [motivations, pain points, trigger words]
  Region: [target region]
  Cultural context: [relevant cultural research]

  ACTORS FOR THIS PERSONA:
  Actor 1: [name] — [scene descriptions + image URLs (cutout + full)]
  Actor 2: [name] — [scene descriptions + image URLs]
  Actor 3: [name] — [scene descriptions + image URLs]

  PLATFORM: [platform name] ([width]×[height], [safe_margin]px safe area)

  PLATFORM AD COPY (for reference — do NOT duplicate on creative):
  [Stage 3 copy for this platform — headline, description, CTA]

  INSTRUCTIONS:
  Design 2-3 unique ad creatives as complete HTML/CSS.
  Each creative must:
  - Use a DIFFERENT actor from this persona
  - Use a DIFFERENT scene (outfit variation) per actor
  - Generate SHORT overlay copy (3-7 words) that matches the scene
  - Hook copy must target THIS persona's specific pain points
  - Overlay copy must COMPLEMENT (not duplicate) the platform ad copy
  - Use OneForma brand elements: blob shapes, dot patterns, highlight badges, pill CTAs
  - White OR gradient background (not always dark)
  - Person can be: cutout popout, full image background, or contained in rounded frame
  - Include "Powered by Centific" trust badge
  - All text must be within [safe_margin]px safe area
  - Canvas size: exactly [width]×[height]px
  - Background must work on both white and transparent (for overlay export)

  Return a JSON array of objects:
  [
    {
      "actor_name": "...",
      "scene": "...",
      "hook_type": "...",
      "overlay_headline": "...",
      "overlay_sub": "...",
      "overlay_cta": "...",
      "html": "<!DOCTYPE html>..."
    }
  ]
```

## 5. Rendering Pipeline

### 5.1 Background Removal (pre-render, once per image)
```python
# For each of the 36 actor images:
cutout_bytes = await remove_background(image_bytes)      # rembg, transparent PNG
shadow_bytes = await create_cutout_with_shadow(image_bytes)  # floating effect
# Upload both to Vercel Blob, store URLs
```

### 5.2 Dual Playwright Render (per HTML design)
```python
# Render 1: Final creative (with all images)
final_png = await render_html_to_png(html, width, height)

# Render 2: Overlay-only (replace image URLs with transparent)
overlay_html = html.replace(cutout_url, "").replace(full_image_url, "")
# Set background to transparent
overlay_html = overlay_html.replace("background-image:url(", "background-image:url(data:image/png;base64,")
overlay_png = await render_html_to_png(overlay_html, width, height)
```

### 5.3 Concurrency
```python
semaphore = asyncio.Semaphore(int(os.environ.get("COMPOSE_CONCURRENCY", "5")))

async def compose_one(creative_spec):
    async with semaphore:
        html = creative_spec["html"]
        final_png = await render_html_to_png(html, w, h)
        overlay_png = await render_overlay_only(html, w, h)
        await upload_both(final_png, overlay_png)
        await save_to_neon(creative_spec, final_url, overlay_url)

# Fire all creatives in parallel
await asyncio.gather(*[compose_one(spec) for spec in all_specs])
```

## 6. File Structure

### New files
- `worker/pipeline/stage4_compose_v2.py` — New Stage 4 orchestrator with LLM creative design
- `worker/ai/creative_designer.py` — Kimi K2.5 prompt builder + response parser
- `worker/prompts/creative_overlay.py` — Prompt templates, brand kit, design audit context

### Modified files
- `worker/pipeline/orchestrator.py` — Point Stage 4 to `stage4_compose_v2.run_stage4`
- `worker/pipeline/stage2_images.py` — Generate 3 actors per persona (currently 1)
- `worker/ai/compositor.py` — Add `render_overlay_only()` function, reduce grain opacity
- `worker/config.py` — Add `COMPOSE_CONCURRENCY` env var

### Existing files (used as-is)
- `worker/ai/bg_remover.py` — rembg background removal + shadow cutouts
- `worker/ai/graphic_compositor.py` — Pillow fallback (not primary path but kept)
- `worker/ai/deglosser.py` — Anti-AI gloss (runs in Stage 2, before Stage 4)
- `worker/blob_uploader.py` — Vercel Blob upload
- `worker/neon_client.py` — Asset persistence

## 7. Design Language Reference (OneForma)

Elements Kimi should use in overlays:
- **Organic blob shapes**: rounded, flowing SVG paths with purple-to-pink gradient fill
- **Dot grid pattern**: subtle decorative dot matrix texture (CSS radial-gradient)
- **Contained photo frames**: photos in rounded rectangles (border-radius: 16px)
- **Highlight badges**: key words get colored pill backgrounds (e.g., "AI Study" in pink)
- **UI mockup elements**: camera icons, checklists, task previews (contextual to task type)
- **Stat callouts**: big numbers with labels (1.8M Members, 300+ Languages)
- **Gradient pill CTAs**: purple-to-pink gradient buttons with arrow
- **Person popout**: cutout overlapping card/frame boundary
- **White backgrounds**: clean, professional, breathing room (not always dark)
- **Trust badges**: "Powered by Centific" with backdrop-filter blur

## 8. Overlay vs Platform Copy

Two distinct copy layers that complement each other:

| Layer | Where | Length | Purpose |
|-------|-------|--------|---------|
| **Overlay copy** (Stage 4) | Burned into the image | 3-7 words | Stop the scroll, intrigue |
| **Platform copy** (Stage 3) | Ad manager text fields | 50-500 chars | Persuade, detail, convert |

Overlay copy is persona-driven AND scene-matched:
- the_parent + at_home_relaxed → "Earn While They Nap."
- the_student + cafe_working → "Your Corner Office. Anywhere."
- the_multilingual + celebrating_earnings → "First Payout. Real Money."

Platform copy provides the detail: "Join 500K+ contributors earning $15-25/hr annotating data from home..."

They NEVER duplicate. The creative tells you to stop scrolling. The platform copy tells you why to click.

## 9. Error Handling

- **Kimi returns invalid HTML**: Log error, skip creative, continue with remaining. Track failure count.
- **Kimi returns fewer than 2 creatives**: Accept what's returned, log warning.
- **Playwright render fails**: Retry once, then skip. Log the HTML for debugging.
- **rembg fails on an image**: Use full image (no cutout) as fallback.
- **OpenRouter rate limit**: Exponential backoff with max 3 retries per call.
- **Concurrency errors**: Semaphore prevents overload. Individual failures don't crash the batch.

## 10. Future Enhancements (not in this spec)

- **Remotion animated overlays**: MP4 export with text animations, Ken Burns on photos
- **LLM template selection**: `use_llm=True` flag already wired in compositor
- **A/B test tracking**: Tag creatives by hook type for performance measurement
- **Multilingual overlay copy**: Arabic/French overlay text from brief's target languages
- **Carousel generation**: Multi-panel creative sets (stat → feature → CTA flow)
