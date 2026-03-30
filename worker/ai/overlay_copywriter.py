"""Phase 1: Overlay copy generation via Gemma 3 27B.

Generates SHORT, PUNCHY overlay copy (headline, sub, CTA) for ad creatives.
Separate from HTML design — copy is approved FIRST, then passed to the designer.

Copy length rules are STRICT per platform:
- Social ads (IG, FB, TikTok, Snap, Twitter): 3-5 word headline, 0-6 word sub, 2-3 word CTA
- LinkedIn carousel: up to 10 word headline, 15 word sub (thought leadership needs more room)
- TikTok carousel: up to 8 word headline, 10 word sub (polished-casual allows more)
- All others: short and punchy wins. Always.

Marketing skills injected: paid-ads + social-content + ad-creative + copywriting
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Copy length rules per platform ─────────────────────────────────

COPY_RULES: dict[str, dict[str, Any]] = {
    # Social ad formats — SHORT AND PUNCHY
    "ig_feed":           {"headline_max": 5, "sub_max": 6,  "cta_max": 3, "tone": "emotional, aspirational"},
    "ig_story":          {"headline_max": 4, "sub_max": 5,  "cta_max": 3, "tone": "urgent, FOMO"},
    "ig_carousel":       {"headline_max": 6, "sub_max": 8,  "cta_max": 3, "tone": "story-driven, emotional"},
    "facebook_feed":     {"headline_max": 5, "sub_max": 6,  "cta_max": 3, "tone": "relatable, benefit-first"},
    "facebook_stories":  {"headline_max": 4, "sub_max": 5,  "cta_max": 3, "tone": "casual, quick"},
    "tiktok_feed":       {"headline_max": 5, "sub_max": 6,  "cta_max": 3, "tone": "raw, authentic, meme-adjacent"},
    "tiktok_carousel":   {"headline_max": 8, "sub_max": 10, "cta_max": 3, "tone": "bold, direct, conversational"},
    "twitter_post":      {"headline_max": 5, "sub_max": 6,  "cta_max": 3, "tone": "witty, sharp"},
    "whatsapp_story":    {"headline_max": 4, "sub_max": 5,  "cta_max": 3, "tone": "personal, direct"},
    "telegram_card":     {"headline_max": 5, "sub_max": 6,  "cta_max": 3, "tone": "informative, clear"},
    "google_display":    {"headline_max": 5, "sub_max": 6,  "cta_max": 3, "tone": "benefit-driven, clear"},
    "indeed_banner":     {"headline_max": 5, "sub_max": 6,  "cta_max": 3, "tone": "professional, opportunity"},
    # WeChat — EXTRA SHORT: 20% text overlay limit enforced by platform
    "wechat_moments":    {"headline_max": 4, "sub_max": 0,  "cta_max": 2, "tone": "visual-first, minimal text, premium feel. WeChat 20% text rule."},
    "wechat_channels":   {"headline_max": 4, "sub_max": 5,  "cta_max": 2, "tone": "Douyin-style, punchy, youth-oriented"},
    "wechat_carousel":   {"headline_max": 4, "sub_max": 0,  "cta_max": 2, "tone": "visual-first, minimal text per card. WeChat 20% text rule applies PER SLIDE."},
    # LinkedIn — the exception, thought leadership needs room
    "linkedin_feed":     {"headline_max": 7, "sub_max": 10, "cta_max": 3, "tone": "authoritative, professional"},
    "linkedin_carousel": {"headline_max": 10, "sub_max": 15, "cta_max": 4, "tone": "thought-leadership, data-driven, educational"},
}

# Default for unknown platforms
DEFAULT_COPY_RULE = {"headline_max": 5, "sub_max": 6, "cta_max": 3, "tone": "punchy, benefit-first"}

# Quality thresholds
COPY_EVAL_THRESHOLD = 0.80
MAX_COPY_RETRIES = 2

# ── System prompt ──────────────────────────────────────────────────

OVERLAY_COPY_SYSTEM = """You are an elite direct-response copywriter specializing in recruitment ads for OneForma (a data annotation platform by Centific).

You write overlay copy that goes ON TOP of ad creative images. This is NOT the ad description/caption — this is the TEXT ON THE IMAGE ITSELF.

RULES — NON-NEGOTIABLE:
1. HEADLINE: {headline_max} words MAXIMUM. Not one word more. Count them.
2. SUBHEADLINE: {sub_max} words MAXIMUM. Can be empty ("") for cleaner designs.
3. CTA: {cta_max} words MAXIMUM. Action verb + object. (e.g., "Join Now", "Start Earning", "Apply Today")
4. Every word must EARN its place. If a word can be cut, cut it.
5. The headline must STOP THE SCROLL. Question, bold claim, or number.
6. The copy must match THE SCENE in the image. Read the scene description carefully.
7. No exclamation marks. No ALL CAPS. No emoji. Professional but human.
8. Platform tone: {tone}

WHAT MAKES GREAT OVERLAY COPY:
- Numbers: "$25/hr" beats "competitive pay" every time
- Questions: "Still job hunting?" beats "Find your next role"
- Specificity: "Test smart glasses" beats "Work with AI"
- Benefit-first: "Work from your couch" beats "Remote data tasks"
- Tension: "Your degree + their data = $$$" (unexpected combo)

WHAT MAKES BAD OVERLAY COPY:
- Generic: "Join our team" (says nothing)
- Long: "Start your journey to financial freedom today" (too many words)
- Mismatched: scene shows a cafe, copy says "work from home" (read the scene!)
- Corporate: "Leverage cutting-edge opportunities" (nobody talks like this)
- Duplicate: copy repeats the platform ad description (they're shown together!)
"""

OVERLAY_COPY_USER = """Generate overlay copy for {num_creatives} ad creatives.

CAMPAIGN: {campaign}
TASK TYPE: {task_type}
PLATFORM: {platform} ({width}x{height}px)

PERSONA: {persona_text}

ACTORS & SCENES:
{actors_text}

PLATFORM AD COPY (DO NOT DUPLICATE — overlay must be DIFFERENT):
{platform_copy}

Return ONLY a JSON array. Each object:
{{
  "actor_name": "Name",
  "scene": "scene_key",
  "headline": "3-5 word headline",
  "sub": "optional subheadline or empty string",
  "cta": "2-3 word CTA",
  "hook_type": "earnings|identity|curiosity|social_proof|effort_min|loss_aversion",
  "rationale": "1 sentence — why this copy works for this persona + scene"
}}

WORD COUNT IS STRICTLY ENFORCED:
- Headline: max {headline_max} words
- Subheadline: max {sub_max} words
- CTA: max {cta_max} words

Generate {num_creatives} DIFFERENT copy sets. Each must use a different actor, scene, and hook type.
"""


async def generate_overlay_copy(
    *,
    persona: dict[str, Any],
    actors: list[dict[str, Any]],
    platform: str,
    platform_spec: dict[str, Any],
    brief: dict[str, Any],
    platform_copy: dict[str, Any],
    num_creatives: int = 3,
    feedback: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Generate overlay copy for ad creatives using Gemma 3 27B.

    Returns a list of approved copy sets, each with headline, sub, cta.
    Marketing skills (paid-ads, social-content, ad-creative, copywriting)
    are automatically injected.
    """
    from ai.local_llm import generate_copy

    rules = COPY_RULES.get(platform, DEFAULT_COPY_RULE)
    w, h = platform_spec["width"], platform_spec["height"]

    # Build persona text
    persona_text = (
        f"Archetype: {persona.get('archetype_key', 'contributor')}\n"
        f"Pain points: {json.dumps(persona.get('pain_points', []), default=str)[:300]}\n"
        f"Motivations: {json.dumps(persona.get('motivations', []), default=str)[:300]}\n"
        f"Trigger words: {json.dumps(persona.get('trigger_words', []), default=str)[:200]}"
    )

    # Build actor/scene text
    actor_lines = []
    for actor in actors[:3]:
        name = actor.get("name", "Contributor")
        images = actor.get("images", {})
        for scene_key, scene_data in images.items():
            desc = scene_data.get("scene_description", "person in frame")
            actor_lines.append(f"  {name} — scene '{scene_key}': {desc}")
    actors_text = "\n".join(actor_lines) if actor_lines else "  No scene descriptions available"

    # Platform copy ref (avoid duplication)
    copy_ref = json.dumps(platform_copy, default=str)[:400] if platform_copy else "None"

    # Format prompts with copy rules
    system = OVERLAY_COPY_SYSTEM.format(**rules)
    user = OVERLAY_COPY_USER.format(
        num_creatives=num_creatives,
        campaign=brief.get("campaign_objective", "Recruit contributors"),
        task_type=brief.get("task_type", "data annotation"),
        platform=platform,
        width=w, height=h,
        persona_text=persona_text,
        actors_text=actors_text,
        platform_copy=copy_ref,
        **rules,
    )

    # Inject feedback from previous attempt
    if feedback:
        user += (
            "\n\n⚠️ PREVIOUS COPY FAILED REVIEW. Fix these issues:\n"
            + "\n".join(f"- {f}" for f in feedback)
        )

    # Generate via Gemma 27B with full marketing skills stack
    raw = await generate_copy(
        system, user,
        skill_stage="creative",
        temperature=0.8,
        max_tokens=4096,
    )

    # Parse JSON
    copy_sets = _parse_copy_json(raw)

    if not copy_sets:
        logger.warning("No copy sets parsed for %s", platform)
        return []

    # Validate word counts + run eval
    validated = []
    for cs in copy_sets:
        issues = _validate_copy(cs, rules)
        if issues:
            logger.info("Copy validation issues: %s", "; ".join(issues))
            # Auto-fix: truncate if over limit
            cs = _auto_fix_copy(cs, rules)

        validated.append(cs)

    logger.info(
        "Generated %d copy sets for %s (headline_max=%d, sub_max=%d)",
        len(validated), platform, rules["headline_max"], rules["sub_max"],
    )
    return validated


def _validate_copy(copy_set: dict, rules: dict) -> list[str]:
    """Validate a copy set against platform word count rules."""
    issues = []
    headline = copy_set.get("headline", "")
    sub = copy_set.get("sub", "")
    cta = copy_set.get("cta", "")

    h_words = len(headline.split()) if headline else 0
    s_words = len(sub.split()) if sub else 0
    c_words = len(cta.split()) if cta else 0

    if h_words > rules["headline_max"]:
        issues.append(f"Headline too long: {h_words} words (max {rules['headline_max']})")
    if h_words < 2 and headline:
        issues.append(f"Headline too short: {h_words} word (min 2)")
    if s_words > rules["sub_max"]:
        issues.append(f"Subheadline too long: {s_words} words (max {rules['sub_max']})")
    if c_words > rules["cta_max"]:
        issues.append(f"CTA too long: {c_words} words (max {rules['cta_max']})")
    if not cta:
        issues.append("Missing CTA")
    if not headline:
        issues.append("Missing headline")

    return issues


def _auto_fix_copy(copy_set: dict, rules: dict) -> dict:
    """Auto-truncate copy that exceeds word limits."""
    fixed = dict(copy_set)

    headline_words = fixed.get("headline", "").split()
    if len(headline_words) > rules["headline_max"]:
        fixed["headline"] = " ".join(headline_words[:rules["headline_max"]])
        logger.info("Auto-truncated headline to %d words", rules["headline_max"])

    sub_words = fixed.get("sub", "").split()
    if len(sub_words) > rules["sub_max"]:
        fixed["sub"] = " ".join(sub_words[:rules["sub_max"]])
        logger.info("Auto-truncated subheadline to %d words", rules["sub_max"])

    cta_words = fixed.get("cta", "").split()
    if len(cta_words) > rules["cta_max"]:
        fixed["cta"] = " ".join(cta_words[:rules["cta_max"]])
        logger.info("Auto-truncated CTA to %d words", rules["cta_max"])

    return fixed


def _parse_copy_json(text: str) -> list[dict]:
    """Parse JSON array of copy sets from LLM output."""
    if not text:
        return []

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    # Direct parse
    try:
        result = json.loads(cleaned)
        if isinstance(result, list):
            return [d for d in result if isinstance(d, dict) and "headline" in d]
        if isinstance(result, dict) and "headline" in result:
            return [result]
    except json.JSONDecodeError:
        pass

    # Search for JSON array
    bracket_depth = 0
    arr_start = -1
    for i, char in enumerate(cleaned):
        if char == '[':
            if bracket_depth == 0:
                arr_start = i
            bracket_depth += 1
        elif char == ']':
            bracket_depth -= 1
            if bracket_depth == 0 and arr_start >= 0:
                try:
                    parsed = json.loads(cleaned[arr_start:i + 1])
                    if isinstance(parsed, list):
                        return [d for d in parsed if isinstance(d, dict) and "headline" in d]
                except json.JSONDecodeError:
                    pass
                arr_start = -1

    # Individual objects
    results = []
    brace_depth = 0
    obj_start = -1
    for i, char in enumerate(cleaned):
        if char == '{':
            if brace_depth == 0:
                obj_start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and obj_start >= 0:
                try:
                    parsed = json.loads(cleaned[obj_start:i + 1])
                    if isinstance(parsed, dict) and "headline" in parsed:
                        results.append(parsed)
                except json.JSONDecodeError:
                    pass
                obj_start = -1

    return results
