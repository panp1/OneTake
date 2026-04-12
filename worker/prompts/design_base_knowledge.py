"""Layer 1: Design Base Knowledge — consolidated psychology + brand.

~2K tokens. Injected into Stage 4 Phase 1 (graphic copy) and Phase 2 (composition).
Replaces scattered CONVERSION_SCIENCE + DESIGN_PSYCHOLOGY from creative_overlay.py.
"""

# ── Persona Archetypes (principles, not rules) ──────────────────────

PERSONA_ARCHETYPES = """
TWO BASE PERSONA ARCHETYPES (adapt creatively to each project's specifics):

GIG WORKER ARCHETYPE:
  Who: Flexible workers, freelancers, students, side-hustlers. Age 18-35 typically.
  What stops their scroll: Specific earnings ($60/hr, R$280/dia), low barrier to entry,
    flexibility proof, social proof (contributor count), concrete task description.
  Design energy: Dynamic, bold, numbers-forward, badge-rich, modern feel.
  Headline style: Question + specific number. "Speak Portuguese? Earn $12/hr."
  CTA: Action-oriented, low-friction. "Apply in 2 Minutes →"
  Psychology: social_proof + effort_minimization + concrete_specificity.
  Visual: Floating badges, avatar-stack prominent, stat callouts, bright CTA contrast.

PROFESSIONAL ARCHETYPE:
  Who: Licensed/credentialed workers, medical professionals, engineers, specialists. Age 28-55.
  What stops their scroll: Identity affirmation, research impact, peer credibility,
    institutional trust signals, extension of existing expertise.
  Design energy: Clean, editorial, portrait-dominant, generous whitespace, authority.
  Headline style: Declarative, expertise-affirming. "Your Clinical Expertise Advances AI."
  CTA: Credibility-first, no urgency. "Learn More" or "Join Our Research Team"
  Psychology: identity_appeal + authority + loss_aversion.
  Visual: Large portrait, serif headlines, minimal decoration, muted palette, trust badges.
"""

# ── Core Conversion Science (always true) ────────────────────────────

CONVERSION_SCIENCE = """
CONVERSION SCIENCE (7 rules — apply to EVERY creative):

1. ONE LARGE FACE (50-55% canvas height). Fusiform face area = instant attention.
   NOT multiple small faces. Object-fit: cover, zoom to face.

2. SPLIT LAYOUT (50-55% photo | 45-50% text zone). Z-pattern eye flow.
   Alternate photo left/right across variations for visual diversity.

3. SPECIFIC NUMBERS IN LOCAL CURRENCY. "$60/hr" not "competitive pay."
   R$280/dia for Brazil, €15/Stunde for Germany. Denomination effect + anchoring.

4. QUESTION HEADLINES or SPECIFIC CLAIMS. Self-referencing effect.
   "[Skill]? [Earn $X/hr]" or "[Number] [experts] already [doing thing]."
   Max 7 words on the graphic. Every word must earn its place.

5. TRIPLE BARRIER REMOVAL. What + How paid + What you DON'T need.
   "Review AI translations from home. Weekly pay. No experience needed."

6. AVATAR-STACK SOCIAL PROOF. 3-4 overlapping circles + "+50K contributors."
   Bandwagon effect. 50K is the optimal anchor — large but believable.

7. FRICTION-REDUCING CTA. "Apply in 2 Minutes →" not "Start Earning."
   Time anchor + arrow = action. Pill-shaped, high contrast.
"""

# ── Design Psychology (9 principles) ─────────────────────────────────

DESIGN_PSYCHOLOGY = """
DESIGN PSYCHOLOGY (9 principles — guide your layout decisions):

1. VON RESTORFF (Isolation): ONE visually unique element — the CTA gets pink/purple gradient.
2. F/Z-PATTERN: Headline top-left → photo center → CTA bottom-center.
3. GESTALT PROXIMITY: Headline + sub: 8-12px gap. CTA: 24-40px gap above.
4. HICK'S LAW: ONE headline, ONE sub (optional), ONE CTA. Maximum.
5. COLOR PSYCHOLOGY: Purple = authority/ambition. Pink = energy/action. White = trust.
6. DEPTH LAYERING: 3+ layers (background → semi-transparent overlay → text) = depth illusion.
7. SERIAL POSITION: People remember FIRST (headline) + LAST (CTA). Sub goes in middle.
8. WHITESPACE AS DESIGN: 20-30% empty canvas. Breathing room = trust.
9. AESTHETIC-USABILITY: Smooth radii + subtle shadows + consistent spacing = perceived quality.
"""

# ── OneForma Brand Constants ─────────────────────────────────────────

BRAND_CONSTRAINTS = """
ONEFORMA BRAND (violations auto-fail VQA):
- Colors: deep purple #3D1059→#6B21A8, hot pink CTA #E91E8C. NO gold, NO yellow, NO orange.
- Typography: system fonts (-apple-system, system-ui, "Segoe UI", Roboto). Georgia for serif headlines.
- CTA: pill buttons (border-radius: 9999px), gradient or filled, white uppercase text.
- Photo: ONE LARGE FACE (50-55% canvas height). Not multiple small faces.
- Whitespace: 20-30% intentional blank space.
- Social proof: avatar-stack MANDATORY (3-4 circles + "+50K contributors").
- Blob shapes: NEVER >15% of canvas area. They are accents, not features.
- Text overlay: MUST be under 25% of canvas area. Keep it SHORT.
"""

# ── Template Recommendations by Persona Type ─────────────────────────

TEMPLATE_RECS = {
    "gig": [
        "conversion_split",
        "dark_purple_split",
        "stat_callout",
        "contained_card",
        "conversion_split_reverse",
        "hero_polish",
    ],
    "professional": [
        "editorial_serif_hero",
        "split_zone",
        "photo_minimal",
        "fullbleed_testimonial",
        "editorial_magazine",
        "wavy_mask_split",
    ],
}


def get_base_knowledge() -> str:
    """Return the full base knowledge block (~2K tokens)."""
    return f"""{PERSONA_ARCHETYPES}

{CONVERSION_SCIENCE}

{DESIGN_PSYCHOLOGY}

{BRAND_CONSTRAINTS}"""


def get_template_recs(persona_type: str) -> list[str]:
    """Return recommended template keys for a persona type (gig or professional)."""
    return TEMPLATE_RECS.get(persona_type, TEMPLATE_RECS["gig"])


def classify_persona_type(persona: dict) -> str:
    """Classify a persona as 'gig' or 'professional' based on signals."""
    quals = (persona.get("archetype", "") + " " + persona.get("matched_tier", "")).lower()
    pro_signals = ["licensed", "certified", "degree", "professional", "nurse", "doctor",
                   "engineer", "specialist", "credential", "resident", "researcher",
                   "clinical", "physician", "therapist", "pharmacist"]
    if any(s in quals for s in pro_signals):
        return "professional"
    return "gig"
