"""Ethical positioning engine for sensitive campaign messaging.

When OneForma campaigns touch sensitive areas (children's data, medical
records, content moderation, biometrics, etc.), the ad copy must frame the
work positively and accurately.  These are LEGITIMATE tasks --- making AI
safer for kids, improving medical diagnostics, cleaning up toxic content ---
but the contributor-facing messaging must always lead with the *positive
impact* of the work, never the raw mechanics.

Think pharmaceutical ads: the product is real and helpful, and the copy
makes the experience sound as pleasant as the outcome truly is.
"""
from __future__ import annotations

import re
from typing import Any

# ---------------------------------------------------------------------------
# 1. SENSITIVITY_CATEGORIES
# ---------------------------------------------------------------------------

SENSITIVITY_CATEGORIES: dict[str, dict[str, Any]] = {
    "children_data": {
        "triggers": [
            "children",
            "kids",
            "minor",
            "youth",
            "child safety",
            "COPPA",
            "under 18",
            "pediatric",
        ],
        "risk": "Looks like surveilling children",
        "reposition_as": "Helping build AI that PROTECTS children online",
        "positive_framing": [
            "Help make the internet safer for kids",
            "Your work protects children from harmful content",
            "Join the team building AI safety shields for young people",
            "Be part of creating a safer digital world for the next generation",
        ],
        "avoid_phrases": [
            "labeling children",
            "annotating kids",
            "tracking minors",
            "child data collection",
        ],
        "use_instead": [
            "child safety AI",
            "protecting young people",
            "digital safety",
            "content safety",
        ],
    },
    "medical_data": {
        "triggers": [
            "medical",
            "health",
            "patient",
            "clinical",
            "diagnostic",
            "X-ray",
            "pathology",
            "HIPAA",
        ],
        "risk": "Looks like exploiting patient data",
        "reposition_as": "Helping AI save lives through better diagnostics",
        "positive_framing": [
            "Help AI detect diseases earlier and save lives",
            "Your annotations could help diagnose cancer faster",
            "Be part of the AI healthcare revolution",
            "Help bring world-class diagnostics to underserved communities",
        ],
        "avoid_phrases": [
            "patient data labeling",
            "medical record annotation",
            "health data collection",
        ],
        "use_instead": [
            "medical AI breakthroughs",
            "life-saving diagnostics",
            "healthcare innovation",
        ],
    },
    "content_moderation": {
        "triggers": [
            "moderation",
            "harmful content",
            "toxic",
            "abuse",
            "graphic",
            "NSFW",
            "violence",
            "hate speech",
        ],
        "risk": "Looks like exposing workers to disturbing content",
        "reposition_as": "Making online platforms safer for everyone",
        "positive_framing": [
            "Help clean up the internet for millions of users",
            "Your judgment makes social media safer",
            "Join the frontline of online safety",
            "Be the human intelligence behind AI safety systems",
        ],
        "avoid_phrases": [
            "reviewing graphic content",
            "labeling toxic posts",
            "exposure to disturbing material",
        ],
        "use_instead": [
            "online safety",
            "platform protection",
            "digital wellbeing",
            "community safety",
        ],
    },
    "biometric_data": {
        "triggers": [
            "biometric",
            "facial recognition",
            "fingerprint",
            "voice print",
            "iris",
            "face detection",
        ],
        "risk": "Looks like surveillance",
        "reposition_as": "Building inclusive AI that works for everyone",
        "positive_framing": [
            "Help AI recognize every face \u2014 regardless of skin tone or features",
            "Make technology more inclusive and accessible",
            "Your data helps eliminate AI bias",
            "Be part of building AI that truly represents everyone",
        ],
        "avoid_phrases": [
            "facial recognition training",
            "surveillance data",
            "biometric collection",
        ],
        "use_instead": [
            "AI inclusivity",
            "reducing bias",
            "representing diversity",
            "accessible technology",
        ],
    },
    "personal_data_collection": {
        "triggers": [
            "personal photos",
            "selfies",
            "voice recording",
            "handwriting sample",
            "personal information",
        ],
        "risk": "Looks like harvesting personal data",
        "reposition_as": "Teaching AI to understand human diversity",
        "positive_framing": [
            "Your voice helps AI understand accents from around the world",
            "Share your handwriting to make AI smarter and more inclusive",
            "Help AI learn from real human diversity \u2014 not just textbooks",
            "Your contribution makes technology work better for people like you",
        ],
        "avoid_phrases": [
            "collecting personal data",
            "harvesting photos",
            "recording individuals",
        ],
        "use_instead": [
            "contributing to AI learning",
            "representing your culture",
            "teaching AI",
            "sharing your perspective",
        ],
    },
    "military_defense": {
        "triggers": [
            "military",
            "defense",
            "weapons",
            "drone",
            "surveillance",
            "intelligence",
        ],
        "risk": "Looks like weapons/warfare",
        "reposition_as": "Supporting safety and security technology",
        "positive_framing": [
            "Help build technology that keeps communities safe",
            "Your work supports cutting-edge safety systems",
            "Be part of advancing security technology",
        ],
        "avoid_phrases": [
            "weapons AI",
            "military targeting",
            "defense intelligence",
        ],
        "use_instead": [
            "safety technology",
            "security systems",
            "protective technology",
        ],
    },
}

# ---------------------------------------------------------------------------
# 2. BRAND_PERSONALITY
# ---------------------------------------------------------------------------

BRAND_PERSONALITY: dict[str, Any] = {
    "voice": (
        "Friendly, inviting, warm \u2014 like a helpful friend telling you "
        "about an opportunity"
    ),
    "tone_spectrum": {
        "formal_casual": 0.3,       # 0=very formal, 1=very casual -> lean casual
        "serious_playful": 0.4,     # lean slightly serious but approachable
        "technical_simple": 0.2,    # lean very simple -- no jargon
    },
    "always": [
        "Speak to the contributor's benefit, never the company's need",
        "Lead with what they GAIN (income, flexibility, meaning)",
        "Use 'you/your' language, not 'we need/we're looking for'",
        "Keep it human \u2014 real names, real scenarios, real feelings",
        "Mention flexibility and autonomy early \u2014 it's the #1 motivator",
    ],
    "never": [
        "Corporate jargon (synergy, leverage, optimize, stakeholder)",
        "Desperate/urgent hiring language (IMMEDIATELY, ASAP, URGENT NEED)",
        "Passive voice (workers are needed \u2192 you can start earning)",
        "Degree/certification requirements (unless truly required)",
        "Implying the work is easy or mindless \u2014 respect the contributor",
    ],
}

# ---------------------------------------------------------------------------
# 3. detect_sensitivity
# ---------------------------------------------------------------------------


def detect_sensitivity(intake_data: dict) -> list[dict[str, Any]]:
    """Scan intake form data for trigger words and return matched categories.

    Parameters
    ----------
    intake_data:
        The intake request dict.  The function searches across the ``title``,
        ``task_type``, ``task_description`` (or ``form_data.task_description``),
        and ``form_data`` fields.

    Returns
    -------
    list[dict]
        Each dict contains the category key, the matched triggers, and the
        full repositioning strategy from ``SENSITIVITY_CATEGORIES``.
    """
    # Build a single searchable blob from all relevant fields.
    searchable_parts: list[str] = []
    for key in ("title", "task_type", "task_description"):
        val = intake_data.get(key)
        if val and isinstance(val, str):
            searchable_parts.append(val)

    form_data = intake_data.get("form_data")
    if isinstance(form_data, dict):
        for val in form_data.values():
            if isinstance(val, str):
                searchable_parts.append(val)
    elif isinstance(form_data, str):
        searchable_parts.append(form_data)

    searchable_text = " ".join(searchable_parts).lower()

    matched: list[dict[str, Any]] = []
    for category_key, category in SENSITIVITY_CATEGORIES.items():
        hits = [
            trigger
            for trigger in category["triggers"]
            if trigger.lower() in searchable_text
        ]
        if hits:
            matched.append(
                {
                    "category": category_key,
                    "matched_triggers": hits,
                    **category,
                }
            )

    return matched


# ---------------------------------------------------------------------------
# 4. apply_ethical_framing
# ---------------------------------------------------------------------------


def apply_ethical_framing(
    copy_data: dict,
    categories: list[dict[str, Any]],
) -> dict:
    """Rewrite problematic phrases in generated copy using positive framing.

    Parameters
    ----------
    copy_data:
        The generated ad-copy dict (headline, body, subheadline, etc.).
    categories:
        The list of matched sensitivity categories returned by
        ``detect_sensitivity``.

    Returns
    -------
    dict
        A *new* copy dict with avoid-phrases replaced by their
        ``use_instead`` alternatives.
    """
    if not categories:
        return copy_data

    # Build a combined replacement map (avoid_phrase -> preferred phrase).
    replacements: list[tuple[str, str]] = []
    for cat in categories:
        avoid = cat.get("avoid_phrases", [])
        preferred = cat.get("use_instead", [])
        for idx, phrase in enumerate(avoid):
            replacement = preferred[idx % len(preferred)] if preferred else ""
            replacements.append((phrase, replacement))

    cleaned = {}
    for key, value in copy_data.items():
        if not isinstance(value, str):
            cleaned[key] = value
            continue
        text = value
        for bad, good in replacements:
            pattern = re.compile(re.escape(bad), re.IGNORECASE)
            text = pattern.sub(good, text)
        cleaned[key] = text

    return cleaned


# ---------------------------------------------------------------------------
# 5. build_ethical_copy_prompt
# ---------------------------------------------------------------------------


def build_ethical_copy_prompt(
    brief: dict,
    detected_categories: list[dict[str, Any]],
) -> str:
    """Return additional prompt instructions when sensitive categories apply.

    These instructions are injected into the copy-generation prompt so that
    the LLM produces ethically-framed copy from the start, rather than
    relying solely on post-hoc replacement.

    Parameters
    ----------
    brief:
        The creative brief dict.
    detected_categories:
        Output of ``detect_sensitivity``.

    Returns
    -------
    str
        A block of text that can be appended to the copy-generation prompt.
        Returns an empty string when no sensitive categories were detected.
    """
    if not detected_categories:
        return ""

    sections: list[str] = [
        "\n\nETHICAL POSITIONING GUIDELINES (MANDATORY):",
        "This campaign touches sensitive subject matter. You MUST follow "
        "these framing rules precisely.",
    ]

    for cat in detected_categories:
        category_label = cat["category"].replace("_", " ").title()
        sections.append(f"\n--- {category_label} ---")
        sections.append(f"Frame this as: {cat['reposition_as']}")

        framing_examples = " | ".join(cat["positive_framing"])
        sections.append(f"Use phrases like: {framing_examples}")

        avoid_list = ", ".join(f'"{p}"' for p in cat["avoid_phrases"])
        sections.append(f"NEVER use: {avoid_list}")

        use_list = ", ".join(f'"{p}"' for p in cat["use_instead"])
        sections.append(f"Use instead: {use_list}")

    # Append brand personality guardrails.
    sections.append("\n--- Brand Voice ---")
    sections.append(f"Voice: {BRAND_PERSONALITY['voice']}")
    sections.append("ALWAYS:")
    for rule in BRAND_PERSONALITY["always"]:
        sections.append(f"  - {rule}")
    sections.append("NEVER:")
    for rule in BRAND_PERSONALITY["never"]:
        sections.append(f"  - {rule}")

    return "\n".join(sections)
