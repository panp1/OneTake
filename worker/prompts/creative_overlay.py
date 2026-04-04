"""Prompt templates for Stage 4 v2 LLM-designed creative overlays.

Contains:
- OneForma brand kit (from Meta Ads Library audit)
- Design audit (strengths/weaknesses/opportunities)
- Overlay generation instructions
- Frontend-design skill content (loaded from file at startup)

Pure data module — no logic, no API calls.
"""
from __future__ import annotations

# ── OneForma Brand Kit ───────────────────────────────────────────
# Extracted from Meta Ads Library audit (March 29, 2026)

BRAND_KIT = """
## OneForma Brand Kit

### Colors
- Primary background: White (#FFFFFF) or light gray (#F8F9FA) — clean, professional
- Accent gradient: Deep purple (#3D1059) → Medium purple (#6B21A8) → Bright purple (#9B51E0)
- CTA gradient: Purple (#6B21A8) → Hot pink (#E91E8C) — pill-shaped buttons
- Emphasis/highlight: Hot pink (#E91E8C) or white bold — NO gold, NO yellow. Stay on-brand.
- Text on light bg: Dark (#1A1A1A)
- Text on dark/gradient: White (#FFFFFF)
- Badge backgrounds: Light pink (#FCE4EC), light purple (#F3E5F5), light gray (#F0F0F0)

### Conversion Elements (MANDATORY — every creative needs these)
- Avatar-stack social proof: 3-4 overlapping circles (22px) with "+50K" badge. "50,000+ contributors"
- Pix payment badge (Brazil): green diamond icon + "Paid via Pix every Friday" — localized trust
- Star rating alternative: ★★★★½ "Rated 4.5/5 by 50,000+ contributors" (4.5 > 5.0 for credibility)
- Split layout: 50-55% photo / 45-50% text panel — default composition
- Purple accent bar: 32px × 3px line above headline for editorial feel

### Typography
- Font family: -apple-system, 'Segoe UI', Roboto, sans-serif (system fonts, no Google Fonts)
- Headlines: font-weight 800, large size, dark on light bg or white on dark
- Subheadlines: font-weight 400, 50-60% of headline size
- CTA text: font-weight 700, uppercase, white on gradient pill, letter-spacing 0.5px

### CTA Buttons
- Shape: pill (border-radius: 9999px)
- Background: linear-gradient(135deg, #6B21A8, #E91E8C) or solid #E91E8C
- Text: white, uppercase, with right arrow (→)
- Box shadow: 0 4px 16px rgba(233, 30, 140, 0.3)

### Logo
- "OneForma" text only (font-size:13px, font-weight:800, color:#5B21B6)
- Placement: top of text panel (in split layouts) or top-left corner
- NEVER use "Powered by Centific" — zero brand recognition with target audience

### Photo Treatment Options (pick one per creative):
1. CUTOUT POPOUT: Person with background removed, popping out of a card frame or blob shape. Most dynamic.
2. CONTAINED FRAME: Photo inside a rounded rectangle (16px radius) with subtle shadow. Clean and professional.
3. FULL BACKGROUND: Photo as full background with gradient overlay for text readability. Most immersive.
"""

DESIGN_AUDIT = """
## Design Audit: What to Keep, What Was Eliminated, and What to Add

### KEEP (from OneForma's identity)
- Purple gradient as primary palette anchor
- Pink/magenta CTAs (recognizable brand element)
- Pink (#E91E8C) or white bold for emphasis — NO gold/yellow
- Pill-shaped CTA buttons with arrow and box-shadow glow
- Real people (UGC style, not stock photos)

### ELIMINATED (proven failures from creative audit)
- Decorative pink/purple blob shapes — occupy prime canvas space, communicate zero information
- Dot-pattern background textures — add visual complexity without value
- White-to-magenta gradients — don't create useful text zones
- Cascading/repeated photo layouts — 5 small faces < 1 large face
- "Powered by Centific" — zero brand recognition with target audience, wastes space
- Internal jargon ("human review", "secure payments") — means nothing to cold audiences
- Oversized white/empty canvas areas — invisible in social feeds at scroll speed

### ADD (proven conversion elements from redesign audit)
- Avatar-stack social proof ("50,000+ contributors worldwide") on EVERY creative
- Pix payment badge (green diamond icon + "Paid via Pix every Friday") for Brazil market
- Specific dollar/currency amounts in headlines (R$60/hr, $12/hr — NOT "extra income")
- Barrier removal in subheadline ("No experience needed", "Apply in 2 Minutes")
- Task description clarity ("Review AI translations from home")
- Variety in composition: split panels, full-bleed testimonial, wavy mask edge
"""

# ── Conversion Science from Before→After Redesign Audit ──────────

CONVERSION_SCIENCE = """
## Conversion Science — WHY These Changes Work (GLM-5 MUST Internalize)

These rules come from a before/after audit of 6 OneForma creatives. Scores went from
F/D (22-59) to A (86-91). Every change has conversion psychology behind it.

### RULE 1: ONE LARGE FACE > MANY SMALL FACES
WHY: The brain's fusiform face area detects faces fastest when they're large and unambiguous.
     Five 60px faces at scroll speed = invisible. One face filling 50-55% of canvas = scroll-stop.
WHAT: Use object-fit:cover + object-position to crop the photo to show ONE clear face.
     Scale: transform:scale(1.5-2.8) to zoom into the person from a wider shot.
     The face should fill 50-55% of the canvas width.

### RULE 2: SPLIT LAYOUT IS THE DEFAULT (50-55% photo / 45-50% text)
WHY: Creates Z-pattern reading flow: photo catches eye → headline → proof → CTA.
     Aligns with natural left-to-right scanning on feed content.
WHAT: CSS flexbox with photo panel width:52-55% and text panel width:45-48%.
     Photo on LEFT (catches eye first), text on RIGHT (delivers message).
     Alternative: text LEFT, photo RIGHT (also works — vary for A/B testing).
     NEVER center everything vertically — that's the template look.

### RULE 3: SPECIFIC NUMBERS IN LOCAL CURRENCY
WHY: "R$60/hr" hits harder than "$12/hr" for Brazilian audiences.
     The "denomination effect" — larger numbers feel more impressive.
     R$60 vs R$7.50 minimum wage is viscerally motivating.
WHAT: Render the dollar/currency amount in var(--purple-deep) color at 1.2-1.3em size.
     The number becomes the visual anchor — the first thing the eye locks onto.
     ALWAYS include: currency symbol + amount + timeframe ("R$60/hr", "$500/mo").

### RULE 4: QUESTION HEADLINES TRIGGER SELF-REFERENCING
WHY: "Speak Portuguese?" forces the brain to answer "yes" — creating involuntary engagement.
     The self-referencing effect means questions about the viewer outperform statements.
WHAT: Structure: "[Do you/Speak/Have] [specific skill]? [Earn $X/hr]."
     The question names WHO (the viewer's skill), the answer gives WHAT (the reward).
     Max 8 words. Break across 2 lines for dramatic stacking.

### RULE 5: TRIPLE BARRIER REMOVAL IN SUBHEADLINE
WHY: Cold audiences self-select out before clicking. "No experience needed" widens the funnel.
     Each "No" statement removes a friction point.
WHAT: Pattern: "[What you'll do]. [How you'll get paid]. [What you DON'T need]."
     Examples:
     - "Review AI translations from home. Paid weekly via Pix."
     - "Work from your phone. No resume. No interview. Just start."
     Keep to 2-3 SHORT sentences, under 60 characters total.

### RULE 6: AVATAR-STACK SOCIAL PROOF (MANDATORY)
WHY: Cold audiences don't trust you. The avatar stack creates "bandwagon effect" —
     seeing other people who've already joined triggers FOMO.
     50,000 communicates scale without feeling unbelievably large.
WHAT: 3-4 overlapping circles (22px, margin-left:-6px) with initials.
     Last circle: "+50K" in brand purple. Text: "50,000+ contributors worldwide"
     CSS: display:flex, each .proof-avatar has border:2px solid white.
     Alternative: star rating (★★★★½ "Rated 4.5/5 by 50,000+ contributors").
     4.5 stars MORE credible than 5.0 — perfect scores feel fake.

### RULE 7: CTA COPY MUST BE FRICTION-REDUCING, NOT GENERIC
WHY: "Start Earning" over-promises. "Learn More" is lazy. "Apply in 2 Minutes"
     tells the viewer EXACTLY what happens next AND anchors the time commitment.
WHAT: Pattern: "[Specific action] in [time]" or "[Get outcome] [now qualifier]"
     GOOD: "Apply in 2 Minutes →", "Get Your First Task →", "Join Lucas & 50,000+ Contributors →"
     BAD: "Start Earning →", "Join Now", "Learn More", "Sign Up", "Click Here"
     Button: padding:12px 24px, border-radius:50px, box-shadow with brand color glow.

### RULE 8: GREEN CTA ON PURPLE BACKGROUND = MAXIMUM CONTRAST
WHY: Complementary colors (opposite on color wheel) create maximum visual tension.
     The green CTA becomes the single most prominent element on a purple canvas.
WHAT: On dark purple backgrounds → use background:var(--green-cta) (#16A34A) for CTA.
     On white backgrounds → keep purple gradient CTA (standard).
     Green CTA box-shadow: 0 4px 14px rgba(22, 163, 74, 0.4).

### RULE 9: FULL-BLEED TESTIMONIAL FORMAT (for social proof creatives)
WHY: Full-bleed photos look like organic content. Gradient overlay makes text readable.
     This is the same technique as Instagram Stories and Netflix thumbnails.
WHAT: Photo fills entire canvas via position:absolute; inset:0.
     4-stop gradient overlay: rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 30%,
     rgba(0,0,0,0.75) 70%, rgba(0,0,0,0.9) 100%.
     Content positioned at bottom (position:absolute; bottom:0).
     Quote in large serif font + attribution with small avatar + "✓ Verified" badge.

### RULE 10: PIX PAYMENT BADGE = LOCALIZED TRUST SIGNAL
WHY: Naming the local payment method signals "this company knows how business works
     in my country." Pix is Brazil's dominant instant payment system.
WHAT: Green badge with rotated diamond icon (Pix brand shape).
     Text: "Paid via Pix every Friday" — names the day (more vivid than "weekly").
     CSS: display:inline-flex; background:#F0FDF4; color:var(--green-cta);
     padding:4px 10px; border-radius:20px; font-size:10px; font-weight:600.
"""

DESIGN_PSYCHOLOGY = """
## Design Psychology Principles (Apply These in Every Creative)

### Von Restorff Effect (Isolation Effect)
ONE element must be visually different from everything else — this is what the eye locks onto.
CSS: Make the CTA button the ONLY element with the pink-purple gradient. Make the headline the ONLY serif text. The isolated element gets remembered.

### Visual Hierarchy (F-Pattern / Z-Pattern)
Eyes scan top-left → top-right → down-left → down-right (Z-pattern) or top-left → down the left side (F-pattern).
CSS: Place headline top-left or center-top. CTA at bottom-left or bottom-center. Never bury the headline at bottom-right.

### Gestalt Proximity
Elements near each other are perceived as a group. Headline + subheadline should be close together. CTA should have MORE space above it (separating it from the text group).
CSS: margin-bottom between headline and sub: 8-12px. margin-top above CTA: 24-40px.

### Hick's Law (Reduce Choices)
ONE headline. ONE subheadline (optional). ONE CTA. Nothing else competing for attention.
CSS: Remove any element that doesn't serve headline, sub, CTA, or photo. If you added decorative text, stat badge, AND trust badge — that's too many. Pick 1-2.

### Color Psychology for Recruitment Ads
- Purple (#6B21A8): authority, ambition, creativity — "this is a real company"
- Pink (#E91E8C): energy, action, urgency — "act now"
- White: clean, trustworthy, professional — "we're legitimate"
- Avoid red (scam association in gig economy), avoid yellow (cheap feeling)

### Layering for Depth (3-Layer Minimum)
Every premium creative has at least 3 visual layers creating depth:
1. BACK: Background (photo or solid color)
2. MIDDLE: Semi-transparent shape, gradient, or blur overlay
3. FRONT: Text + CTA (highest z-index, sharpest contrast)
CSS: Use z-index: 1/2/3. The middle layer (gradient/shape) at opacity 0.6-0.85 creates the depth illusion.

### Serial Position Effect
People remember the FIRST and LAST things they see. First = headline (top). Last = CTA (bottom).
CSS: Headline at top of text zone. CTA at very bottom. Subheadline in the middle (least remembered — keep it short).

### Whitespace as Design Element
20-30% of canvas should be empty. Whitespace around the headline makes it feel more important.
CSS: padding: 40-60px around text blocks. Don't fill every pixel. The emptiness IS the design.

### Aesthetic-Usability Effect
Attractive designs are perceived as more usable and trustworthy. Invest in clean details.
CSS: Smooth border-radius: 12-20px. Subtle box-shadow: 0 4px 16px rgba(0,0,0,0.08). Consistent spacing. Smooth gradients (not harsh).
"""

OVERLAY_INSTRUCTIONS = """
## Creative Overlay Generation Instructions

You are designing a recruitment ad creative for OneForma as a single self-contained HTML file.

### CRITICAL RULES:
1. Output ONLY valid HTML. No markdown, no explanation, no commentary.
2. Canvas size must be EXACTLY {width}x{height} pixels.
3. All text must be within {safe_margin}px of edges (safe area).
4. Background can be white (#FFFFFF), light gray (#F8F9FA), or transparent — NOT always dark.
5. Use the provided image URLs via <img> tags with absolute positioning.
6. All styles must be INLINE (no external CSS, no <style> blocks with class selectors).
7. Use only system fonts: -apple-system, 'Segoe UI', Roboto, sans-serif.
8. Decorative SVG elements (blobs, dots) must be inline SVG, not external files.
9. The HTML must render correctly in a headless Chromium browser.
10. NO gold or yellow colors. ONLY purple, pink, white, dark gray. Stay on-brand.

### LAYOUT COMPOSITION:
The photo is the visual anchor. Text and brand elements FRAME the photo — never obscure it.

RULE #1: ALL TEXT MUST BE 100% READABLE. Never place text where it overlaps the person's face or body.
RULE #2: The person's face must be FULLY VISIBLE — no text, blobs, or elements covering it.
RULE #3: Use gradient overlays or solid-color text zones to guarantee readability.

Layout patterns (pick one per creative):
  A. GRADIENT OVERLAY: Photo fills canvas. Dark gradient from bottom (or side) creates a text-safe zone.
     Headline + CTA sit in the gradient zone. Person visible in the clear area.
  B. SPLIT LAYOUT: Photo on one side (~60%), brand zone on other side (~40%).
     All text in the brand zone on solid/gradient bg. Photo untouched.
  C. CARD FRAME: Photo in a rounded rect, smaller than canvas. Text + blobs around the frame.
     Professional, clean. Photo contained but prominent.

Decorative elements:
- 1-2 subtle blob shapes (purple-pink gradient, low opacity ~0.15) for brand identity.
- Blobs should be BACKGROUND decoration, not competing with the photo or text.
- NO blobs overlapping the person's face or body.
- Keep blobs in corners/edges where they add composition without distraction.

### TYPOGRAPHY:
- Headline: Bold system font, weight 800, large but NOT overlapping the photo subject.
- Subheadline: Regular weight, 50-60% of headline size.
- CTA: Bold uppercase in a pill button with gradient bg and box-shadow.
- Clear hierarchy: headline > sub > CTA, all in the designated text zone.
- Font sizes: headline 36-56px, sub 16-22px, CTA 14-18px (adjust for canvas size).

### SERIF HEADLINE RULE (MANDATORY for premium feel):
- Headlines MUST use font-family: Georgia, 'Times New Roman', serif — NOT sans-serif
- Weight: 700-800, NOT 400
- Line-height: 1.05-1.15 (tight, dramatic)
- Letter-spacing: -0.02em (slightly tightened)
- Break headline into 2-3 WORDS PER LINE, stacked vertically for dramatic effect
- Example: instead of "Bilingual: Earn From Home" on one line, use line breaks:
  "Bilingual:\nEarn From\nHome" stacked across 3 lines
- Subheadline stays in sans-serif (system fonts), creating contrast with the serif headline

### DESIGN BALANCE:
- Keep at least 20% whitespace — let the design breathe.
- The person's face is the visual anchor. Everything else supports it.
- Clean, premium, intentional feel. Every element has a purpose.
- If in doubt, use LESS decoration. Simplicity > complexity.

### OVERLAY COPY RULES:
- Headline: 3-8 words MAXIMUM. MUST contain at least ONE of: dollar amount, timeframe, geography, or question.
- Subheadline: 1-2 short sentences. Task description + barrier removal. Under 60 chars.
- CTA: 3-5 words. Friction-reducing + time anchor. NOT "Learn More" or "Join Now".
- The overlay copy must be DIFFERENT from the platform ad copy provided.
- The overlay copy must target THIS persona's specific pain points.
- The overlay copy MUST match what's happening in THE SCENE (the image).
- Each actor has a SCENE DESCRIPTION that tells you exactly what's in the photo.
- READ THE SCENE DESCRIPTION CAREFULLY before writing ANY headline.

### COPY BENCHMARKS — Words That Convert vs Words That Don't:

USE THESE (proven to convert):
- Specific dollar amounts: "$12/hr", "R$60/hr", "$500/mo", "$15/task"
- Payment method by market: "Pix", "PayPal", "Payoneer", "bank transfer"
- "Paid weekly" / "Paid every Friday" (NOT "weekly payouts" — sounds corporate)
- "No experience needed" / "Just your language skills"
- "Work from your phone" / "Work from anywhere"
- Contributor counts: "Join 50,000+ contributors"
- Time-to-start: "Get your first task in 24 hours"
- Task clarity: "Review AI translations", "Rate chatbot responses"
- Question openers: "Speak Portuguese?", "Bilingual?", "Know [language]?"
- "Apply in 2 Minutes" / "Get Your First Task" (specific CTA)

STOP USING THESE (proven failures):
- "Human review" / "human-reviewed" — internal jargon, means nothing
- "Secure payments" / "secure platform" — table stakes, not a selling point
- "Powered by Centific" — zero brand recognition with target audience
- "Flexible hours" — every gig platform says this, zero differentiation
- "Start earning" without a number — empty promise
- "Skip the commute" — outdated post-COVID angle
- "Extra income" without quantifying — too vague
- "Learn More" / "Sign Up" / "Join Now" — generic CTA
- "Languages pay. Seriously." — no specificity, no number, a competitor could use it

### IMAGE USAGE:
You receive ONE image per actor: full_image_url (the original photo with background).
DO NOT attempt background removal, cutouts, or transparent overlays on the image.

Use the FULL IMAGE in one of these treatments:
1. FULL BACKGROUND: Photo fills the entire canvas. Gradient overlay (bottom-to-top or side) creates readable text zones. Most immersive — best for TikTok, Stories, IG feed.
2. CONTAINED FRAME: Photo inside a rounded rectangle (border-radius: 16px) positioned to one side. Text + decorative elements fill the other side. Clean, professional — best for LinkedIn, Facebook.
3. SPLIT PANEL: Canvas divided ~60/40. Photo fills one side, text + brand elements fill the other on a solid/gradient bg. Modern editorial feel.

For ALL treatments:
- Photo must be displayed at its NATURAL aspect ratio — no stretching or squishing.
- Use object-fit: cover with strategic object-position to focus on the person's face.
- Add a semi-transparent gradient overlay where text appears (e.g., linear-gradient(to top, rgba(0,0,0,0.7), transparent)) to ensure text readability.
- The person's face must be FULLY VISIBLE and not obscured by text or decorative elements.

### RETURN FORMAT:
Return a JSON array. Each element has:
{{
  "actor_name": "Name",
  "scene": "scene_key",
  "overlay_headline": "3-7 word headline",
  "overlay_sub": "optional subheadline",
  "overlay_cta": "CTA text",
  "image_treatment": "full_background|contained_frame|split_panel",
  "html": "<!DOCTYPE html><html>...</html>"
}}

### LAYOUT PATTERN CONSTRAINT:
{pattern_instruction}
"""

# ── Creative Design Skill (refined for recruitment ad creatives) ──

CREATIVE_DESIGN_SKILL = """
## $50K Designer Creative Skill — Recruitment Ad Creatives

You are an elite creative director designing scroll-stopping recruitment ad
creatives. Your output competes with $50K agency work. Every pixel serves conversion.

### DESIGN PHILOSOPHY: Face + Number + Proof + CTA
The face is the scroll-stop. The number is the hook. The proof is the trust.
The CTA is the action. Nothing else belongs on the canvas unless it serves one of these.

### THE 6 PROVEN LAYOUT FORMATS (from before/after audit, F→A scores):

**FORMAT 1: SPLIT PANEL (default — use 40% of the time)**
Photo 55% left, text 45% right on white/off-white bg.
Photo uses object-fit:cover + object-position to crop into ONE large face.
Text panel: logo top → headline → subheadline → social proof → CTA bottom.
CSS: display:flex; Photo: width:55%; Text: width:45%; padding:8%;

**FORMAT 2: REVERSE SPLIT (use 15% of the time)**
Text 45% left, photo 55% right. Same logic, reversed.
Purple accent bar (32px wide, 3px tall) above headline for editorial feel.

**FORMAT 3: DARK PURPLE SPLIT (use 15% of the time)**
Same split layout but text panel on deep purple (#5B21B6) background.
All text inverted to white/light purple (#C4B5FD).
Green CTA (#16A34A) for maximum complementary contrast against purple.
Use when the photo has a bright/light background — the dark panel contrasts.

**FORMAT 4: FULL-BLEED TESTIMONIAL (use 15% of the time)**
Photo fills entire canvas. 4-stop gradient overlay creates dark reading surface at bottom.
Content at bottom: large serif quote + attribution (name, city, "✓ Verified") + full-width CTA.
Best for social proof/testimonial creatives. Looks like organic IG content.

**FORMAT 5: WAVY MASK SPLIT (use 10% of the time)**
Same as Format 1 but photo panel has organic wavy edge mask via CSS mask-image.
The wavy edge is a BRAND SIGNATURE — unique to OneForma, no competitor uses it.
Creates visual interest at the photo/text boundary.

**FORMAT 6: HERO POLISH (use 5% — when original is already 70%+ quality)**
Minimal changes: crop photo tighter, convert USD to local currency, add social proof.
Use CSS filters (brightness:1.08, saturate:1.1) to warm flat photos.
Keep what works. Fix only the weakest 2-3 elements.

### WHAT MAKES IT LOOK CHEAP (AVOID — these are proven failures):
- Decorative blobs/circles that serve no conversion purpose
- "Powered by Centific" — zero brand recognition with target audience
- Text floating over busy photo areas with no backdrop
- Every element centered and stacked vertically (template look)
- Headline with no number, no specificity, no audience naming
- CTA that says "Learn More" or "Join Now" (generic)
- Canvas with 60%+ empty white space (invisible in feed)
- Multiple small photos instead of one commanding face
- "Flexible hours" / "Secure payments" / "Extra income" — table stakes, not selling points
- Internal jargon: "human review", "secure platform", "weekly payouts"

### MANDATORY ELEMENTS (every creative MUST have):
1. ONE large face (50-55% of canvas width)
2. Specific headline with at least ONE of: dollar amount, timeframe, or question targeting the viewer
3. Subheadline with task description + barrier removal
4. Social proof (avatar-stack OR star-rating — NEVER skip this)
5. CTA with specific action + time anchor ("Apply in 2 Minutes →")
6. OneForma logo (text, not an image — top of text panel)

### CTR OPTIMIZATION SIGNALS:
- Human face visible and prominent (2x higher CTR than no face)
- Eye contact with camera when possible (1.5x engagement boost)
- Contrasting CTA button (green on purple, pink on white)
- Numbers in headline ALWAYS ("R$60/hr", "$12/hr", "50K+ contributors")
- Question headlines outperform statements for recruitment
- Local currency > USD for non-US markets (denomination effect)
- "No experience needed" is the #1 barrier-removal statement for gig-economy ads
"""
