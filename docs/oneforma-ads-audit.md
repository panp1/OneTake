# OneForma Meta Ads Library — Design Audit (March 29, 2026)

Source: https://www.facebook.com/ads/library/?view_all_page_id=442340255625011
Analyzed: ~31 active ads across Facebook & Instagram

## Current Design Language

### Color Palette
| Role | Color | Hex (estimated) |
|------|-------|-----------------|
| Primary background | Deep purple gradient | `#3D1059` → `#6B21A8` |
| CTA buttons | Hot pink/magenta | `#E91E8C` |
| Money highlight | Bright yellow/gold | `#FFD700` / `#FFC107` |
| Text | White | `#FFFFFF` |
| Secondary accent | Teal/cyan (logo gradient) | `#0693E3` → `#9B51E0` |
| Logo watermark | White on purple | `#FFFFFF` at 80% opacity |

### Typography
- Headlines: Bold geometric sans-serif (Poppins-like), ALL CAPS or Title Case
- Body: Regular weight, white, 14-16px equivalent
- Dollar amounts: Oversized (2-3x body), bold, yellow/gold highlight
- CTA: White on magenta, bold, ALL CAPS

### Layout Templates (3 patterns observed)
1. **Portrait Stack (80%)**: Logo top → Headline → Photo → CTA button → Watermark
2. **Split Composition (15%)**: Photo bleeds left, text overlay right (purple bg)
3. **Illustration Style (5%)**: Map/pins for mapping projects, less photo-driven

### CTA Style
- Pill-shaped (border-radius: 9999px)
- Magenta/hot pink background
- White bold text
- Right arrow icon (→)
- Text: "JOIN NOW", "APPLY TODAY", "APPLY NOW"

### Photography
- Real contributors (not stock)
- Family/twin focus (current campaign)
- Warm lighting, natural settings
- Casual poses, genuine smiles
- Mixed ethnicities

### Copy Patterns
- Dollar amount ALWAYS the visual anchor
- Time commitment specified ("2-3 Hour Session")
- Low barrier language ("Simple", "Easy", "No experience")
- Urgency ("Limited Sessions")

## Strengths
1. Strong value proposition clarity — money is the hook
2. Consistent brand identity — purple + pink = OneForma
3. Real people build trust
4. Clear CTA placement
5. Portrait-first (correct for mobile)

## Weaknesses
1. **Template fatigue** — 31 ads, 1 layout. Ad blindness guaranteed.
2. **No composition sophistication** — flat text-photo-button stacks
3. **Oversaturated purple** — no breathing room
4. **Generic typography** — no hierarchy beyond size
5. **No lifestyle context** — studio/posed, not "real life"
6. **Weak copy hierarchy** — headline and body compete
7. **Zero motion** — all static in a video feed
8. **No social proof** on creative itself
9. **Watermark too subtle** — doesn't build recognition
10. **No localization** — English-only for global recruitment

## Opportunities for Stage 4 Composition Engine
1. **11 composition techniques** for visual variety
2. **Deglosser UGC realism** vs their studio polish
3. **Lifestyle scenes** from outfit_variations
4. **Typographic hierarchy** — 3-level reading order
5. **7+ layout variants** per actor instead of 1
6. **Trust signals** baked into creative
7. **Multilingual** from copy engine
8. **Breathing room** — white space, gradient softening
9. **Text legibility** — semi-transparent overlays
10. **Platform-native dimensions**

## Design Rules for Stage 4 Templates

### Keep (from OneForma's identity)
- Purple gradient as primary palette anchor
- Pink/magenta CTAs (recognizable brand element)
- Yellow/gold money highlights
- Pill-shaped CTA buttons with arrow
- Portrait-first (9:16) as primary format
- Dollar amount as visual hook
- OneForma logo placement

### Improve
- Add 6+ distinct layout templates (not just portrait stack)
- Use composition engine for photo placement variety
- Add semi-transparent overlays for text legibility
- Create typographic hierarchy (3 font weights/sizes)
- Add trust badges (Centific backing, contributor count)
- Add breathing room (20-30% more whitespace)
- Soften purple gradient (add warm tones, reduce saturation)
- Localize copy + cultural elements per region

### Add (new to their system)
- Split-screen layouts (lifestyle left, text right)
- Quote/testimonial overlays
- Stat callouts (contributor count, countries)
- Subtle texture/grain (matches our deglosser output)
- Dynamic text positioning (not always centered)
- Social proof badges
- Platform-specific aspect ratios
