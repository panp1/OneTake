"""
OneForma Brand Voice — package entrypoint.

Re-exports the constants and helper functions from oneforma.py so prompt files
can import them concisely:

    from brand import TAGLINE, TONE_RULES, get_cta

(The worker process launches with `cd worker && python main.py`, which puts
`worker/` on sys.path[0]. So `brand/` is a top-level package — same convention
as `config`, `pipeline`, `prompts`, etc. used throughout the worker.)

See oneforma.py for the full content and governance policy.
"""
from .oneforma import (
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
