"""
OneForma Brand Voice — package entrypoint.

Re-exports the constants and helper functions from oneforma.py so prompt files
can import them concisely:

    from worker.brand import TAGLINE, TONE_RULES, get_cta

See oneforma.py for the full content and governance policy.
"""
from worker.brand.oneforma import (
    TAGLINE,
    POSITIONING,
    MISSION,
    VISION,
    UNIQUE_VALUE,
    TONE_RULES,
    WORDS_TO_USE,
    WORDS_TO_AVOID,
    PILLARS,
    HERO_TEMPLATES_BY_PILLAR,
    CTA_PRIMARY,
    CTA_SECONDARY,
    APPROVED_LOCALES,
    get_cta,
    TRUST_STRIP,
    SERVICE_CATEGORIES,
    OPERATIONAL_CONTEXT,
    PALETTE,
    TYPOGRAPHY,
    DESIGN_MOTIFS,
    ANTI_EXAMPLES,
    build_brand_voice_block,
)

__all__ = [
    "TAGLINE",
    "POSITIONING",
    "MISSION",
    "VISION",
    "UNIQUE_VALUE",
    "TONE_RULES",
    "WORDS_TO_USE",
    "WORDS_TO_AVOID",
    "PILLARS",
    "HERO_TEMPLATES_BY_PILLAR",
    "CTA_PRIMARY",
    "CTA_SECONDARY",
    "APPROVED_LOCALES",
    "get_cta",
    "TRUST_STRIP",
    "SERVICE_CATEGORIES",
    "OPERATIONAL_CONTEXT",
    "PALETTE",
    "TYPOGRAPHY",
    "DESIGN_MOTIFS",
    "ANTI_EXAMPLES",
    "build_brand_voice_block",
]
