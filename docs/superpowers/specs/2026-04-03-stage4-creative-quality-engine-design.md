# Stage 4 Creative Quality Engine — Design Spec

## Goal

Elevate Stage 4 composed creatives from 7/10 to agency-quality 9/10 by adding a creative VQA gate with feedback loop, enforcing layout diversity, expanding HTML reference templates with patterns reverse-engineered from $50K brand creatives (Jasper.ai, AmEx, LV, Stripe, Owner.com via Pomelli), and maintaining OneForma's unique brand depth (white backgrounds, purple accents, icons, trust badges, visual layers).

## Philosophy

**Pomelli's editorial sophistication + OneForma's visual richness + agency-level depth.**

Take from Pomelli/brands: serif headlines, stacked 2-3 word lines, zone separation, photo-first hierarchy, editorial magazine feel.

Keep from OneForma: white backgrounds (NOT black — on-brand), purple-to-pink gradient accents, dot grid textures, organic blob shapes, pill CTA buttons, trust badges, stat callouts, icons, multiple visual depth layers.

Add beyond both: creative VQA quality gate, Flux.2 Pro edit retry loop, layout diversity enforcement, competitive-grade typography hierarchy.

## Architecture

Four components, all in the worker pipeline:

1. **Creative VQA Gate** — evaluate rendered composites, retry on failure
2. **Layout Diversity Enforcement** — force different patterns per batch
3. **Expanded HTML Templates** — 10 patterns from brand research
4. **Feedback Loop** — render → VQA → re-prompt GLM-5 → re-render

---

## Part 1: Creative VQA Gate

**New function:** `evaluate_composed_creative()` in `worker/ai/creative_vqa.py`

After Playwright renders each composed creative to PNG, score it on 7 dimensions (0.0-1.0 each):

1. **Text Readability** — all text 100% legible? No text on busy photo without backing?
2. **Visual Hierarchy** — clear headline > sub > CTA size progression? 3 distinct levels?
3. **Brand Consistency** — OneForma purple/pink palette? Pill CTA? System fonts or serif headline?
4. **Photo Integration** — person visible? Face not obscured? Natural compositing?
5. **Layout Quality** — proper whitespace (20-30%)? Not cramped? Elements have purpose?
6. **Safe Zone Compliance** — text within platform safe margins? No clipping?
7. **Scroll-Stop Appeal** — would this stop a thumb in-feed? Emotional impact?

**Threshold:** 0.70 overall score.
**VLM Model:** NIM Kimi K2.5 Vision (same as base image VQA).
**Max retries:** 2 — re-prompt GLM-5 with specific VQA feedback.
**Final fallback:** If still fails after 2 retries, save with low score (don't block pipeline).

## Part 2: Layout Diversity Enforcement

Each batch of 3 creatives per persona×platform MUST use different layout patterns.

**Enforcement:** Pass `required_pattern` parameter to `design_creatives()`:
- Creative 1: Pattern assigned from primary pool (e.g., "editorial_serif_hero")
- Creative 2: Different pattern (e.g., "split_zone_photo_brand")
- Creative 3: Different again (e.g., "bold_stat_callout")

**Pattern pool (10 patterns):** See Part 3 templates. Each batch cycles through 3 different ones. No repeats within a batch.

**Implementation:** In `stage4_compose_v2.py`, when building tasks for each persona×platform, assign patterns round-robin from the pool. Add `"You MUST use the {pattern_name} layout pattern. See the reference template below."` to the GLM-5 prompt.

## Part 3: Expanded HTML Reference Templates

Replace the current 3 templates with 10 patterns derived from Pomelli/brand research. ALL templates use OneForma's LIGHT theme (white backgrounds, purple accents).

### Template 1: EDITORIAL SERIF HERO
**Inspired by:** Jasper "Protect Your Team's Creativity", AmEx "Elevated Business Rewards"
**When:** Vertical formats (Stories, TikTok, WhatsApp)
- Full-bleed photo fills canvas
- Light gradient overlay (bottom 40%, NOT heavy dark — subtle: rgba(255,255,255,0.7) to transparent)
- **Serif headline** (Georgia, weight 700, 48-64px) — 2-3 words per line, stacked
- Light-weight subheadline below (16-18px, regular weight)
- OneForma logo small in top-left corner
- "Powered by Centific" tiny, bottom-right, barely visible
- NO CTA button — headline is the scroll-stopper
- Feels: editorial magazine, premium, intentional

### Template 2: SPLIT ZONE — PHOTO + BRAND PANEL
**Inspired by:** OneForma "Human-Centered Feedback", AmEx "More Than a Transaction"
**When:** Landscape/square (Facebook Feed, LinkedIn, Telegram)
- Photo fills left/top 55-60%
- White or light purple (#F8F5FF) brand zone fills right/bottom 40-45%
- **Curved divider** (SVG wave) between photo and brand zone — not a hard line
- Headline in brand zone: dark charcoal (#1A1A1A), serif or bold sans, 36-48px
- Subheadline: regular weight, #737373
- CTA pill button: purple-to-pink gradient, 16px bold uppercase
- 1-2 subtle blob shapes in corners of brand zone (very low opacity, 0.08)
- Dot grid texture (3px dots, 8% opacity) in brand zone background

### Template 3: BOLD STAT CALLOUT
**Inspired by:** Stripe "1.62826115%", AmEx stat-driven ads
**When:** Any format — performance marketing, social proof hooks
- White background, clean
- **Massive stat number** center-top: "$15/hr" or "500K+" in 72-96px serif bold, purple (#6B21A8)
- Supporting headline below in 24-32px charcoal sans-serif
- Person photo in a **rounded rectangle frame** (border-radius: 20px) offset to one side
- Subtle purple shadow on the photo frame (0 8px 32px rgba(107,33,168,0.15))
- Accent line (3px, pink #E91E8C, 60px wide) above the stat
- CTA pill at bottom
- Trust badge: "Powered by Centific" with small Centific icon

### Template 4: EDITORIAL MAGAZINE LAYOUT
**Inspired by:** LV editorial, Jasper "Reclaim Your Strategic Focus"
**When:** Square/landscape, LinkedIn, premium campaigns
- White background with generous whitespace (30%+)
- Person photo occupying right 50%, **natural crop** (no cutout, no frame)
- Serif headline left-aligned, 40-56px, charcoal, 2-3 words per line stacked vertically
- Thin accent line (2px, purple) above headline
- Subheadline in italic serif, 16px, #737373
- Small OneForma logo bottom-left
- NO decorative elements — whitespace IS the design element
- Feels: Vogue, luxury, intentional restraint

### Template 5: CONTAINED CARD WITH DEPTH
**Inspired by:** OneForma brand kit, modern SaaS ads
**When:** Any format — the OneForma signature look
- Light gray background (#F8F9FA)
- Photo inside a **rounded card** (border-radius: 20px, white bg, subtle shadow)
- Card is slightly smaller than canvas (16px margin all sides)
- Headline above card in bold sans-serif, 36-48px, charcoal
- 1-2 organic blob shapes behind the card (purple-pink gradient, 10% opacity)
- Dot grid pattern visible in background (4px dots, 6% opacity)
- CTA pill button overlapping card bottom edge (50% on card, 50% off)
- Trust badge inside card bottom-right corner
- Feels: premium product, clean, depth through layering

### Template 6: PHOTO-FIRST MINIMAL
**Inspired by:** LV homepage, AmEx "Elevated Business Rewards"
**When:** Vertical (Stories, TikTok) — when the photo is strong enough to carry
- Photo fills 100% of canvas — NO gradient overlay
- White text positioned where photo is naturally dark
- Headline: serif, 48-64px, white, text-shadow for readability (0 2px 12px rgba(0,0,0,0.5))
- Subheadline: 16px, white with 85% opacity
- NOTHING else — no logo, no CTA, no shapes, no badges
- The photo IS the ad. Text is minimal decoration.
- Feels: UGC, authentic, scroll-stop

### Template 7: TOP-TEXT BOTTOM-PHOTO
**Inspired by:** Pomelli "Elevate Your Team's Output", "Stop the 30% Commission Leak"
**When:** Vertical formats — when headline needs prominence over photo
- Top 35%: dark background (#1A1A1A or deep purple #1A0A2E)
- **Huge serif headline** in white, 48-64px, fills the dark zone
- Diagonal or curved clip-path transition
- Bottom 65%: photo fills naturally
- Subheadline at very bottom on the photo (with subtle gradient backing)
- Feels: bold statement, the headline hits first

### Template 8: MULTI-IMAGE DIVERSITY GRID
**Inspired by:** OneForma "Innovate For Every Culture"
**When:** Square, when showing multiple people/scenes
- White background
- 4-6 small rounded photos scattered asymmetrically (not a grid — offset, different sizes)
- Purple-to-pink gradient wave shape at bottom 40%
- Headline in white on the gradient wave
- Subheadline below on white
- Feels: inclusive, global, scale

### Template 9: PRODUCT UI SHOWCASE
**Inspired by:** Owner.com "Stop the 30% Commission Leak", Jasper MCP
**When:** Any format — showing the product/platform in action
- Photo of person holding phone or looking at laptop (the Seedream image)
- **UI overlay card** floating near the device — shows a mock of the OneForma interface
- Headline alongside or above the UI card
- White background or subtle gradient
- The UI card adds credibility — shows it's a real product
- Feels: tech-forward, functional, proof

### Template 10: TESTIMONIAL / SOCIAL PROOF CARD
**Inspired by:** Jasper customer stories, AmEx "More Than a Transaction"
**When:** Any format — trust-building campaigns
- White background
- **Large quote marks** ("") in purple, 120px, decorative
- Quote text in serif italic, 20-28px, charcoal
- Person photo in a circle (border-radius: 50%), 120px, centered below quote
- Name + title below photo, 14px bold + 12px regular
- Star rating or stat below (optional)
- CTA pill at bottom
- OneForma accent line above quote
- Feels: trustworthy, human, credible

---

## Part 4: Feedback Loop

```
GLM-5 generates HTML (with required_pattern constraint)
  → Playwright renders to PNG
  → Creative VQA scores it (7 dimensions)
  → If passes (≥0.70) → degloss → AVIF → upload to Blob → save to Neon
  → If fails:
    → Extract issues from VQA dimensions
    → Re-prompt GLM-5: "Fix these issues: {issues}. Previous HTML attached. Required pattern: {pattern}."
    → Playwright renders v2
    → Creative VQA scores v2
    → If passes → save
    → If still fails → save anyway with low score + flag for designer review
```

**Cost:** VQA calls use NIM (free). Re-prompting GLM-5 uses NIM (free). Only Playwright render is compute (local, free). Total additional cost per creative: $0.

---

## Files to Modify/Create

| File | Change |
|------|--------|
| `worker/ai/creative_vqa.py` | Add `evaluate_composed_creative()` with 7-dimension scoring |
| `worker/pipeline/stage4_compose_v2.py` | Add VQA gate after render, retry loop, pattern assignment |
| `worker/prompts/html_reference_templates.py` | Replace 3 templates with 10 new ones |
| `worker/prompts/creative_overlay.py` | Update OVERLAY_INSTRUCTIONS with serif typography rules, pattern constraint injection |

## What's NOT Changing

- Seedream image generation (Stage 2)
- Flux.2 Pro edit loop for base images
- Copy generation (Stage 3)
- Video generation (Stage 5)
- No new API routes or database changes
- No frontend changes
