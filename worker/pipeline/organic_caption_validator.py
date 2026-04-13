"""Organic caption drift validator — deterministic, no LLM.

Scans generated recruiter captions for factual drift:
1. Dollar amounts must match source compensation
2. Work mode claims must match source (no "remote" if onsite, vice versa)
3. No forbidden promises (guaranteed income, career growth, etc.)
4. No qualification invention (future: cross-check against quals list)

Returns (passed: bool, issues: list[str]).
If issues is non-empty, the caption has drift and should be regenerated.
"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

FORBIDDEN_PHRASES = [
    "guaranteed income",
    "guaranteed pay",
    "guaranteed earnings",
    "career growth",
    "career advancement",
    "life-changing",
    "life changing",
    "get rich",
    "unlimited earning",
    "unlimited income",
    "no experience needed",
    "no skills required",
    "no qualifications needed",
    "anyone can do this",
    "easy money",
    "passive income",
    "side hustle gold",
    "financial freedom",
]


def validate_caption(
    caption: str,
    hard_facts: dict[str, Any],
) -> tuple[bool, list[str]]:
    """Validate a recruiter caption against source data.

    Parameters
    ----------
    caption : str
        The generated caption text.
    hard_facts : dict
        Source data with keys:
        - compensation_amount: str (e.g., "$15")
        - work_mode: str ("remote" or "onsite")
        - qualifications_required: str (optional, for future cross-check)

    Returns
    -------
    tuple[bool, list[str]]
        (passed, issues). Empty issues list = passed.
    """
    issues: list[str] = []
    caption_lower = caption.lower()

    # ── 1. Compensation consistency ──────────────────────────────────
    compensation = str(hard_facts.get("compensation_amount", "")).strip()
    if compensation and compensation not in ("$", ""):
        comp_clean = compensation.replace("$", "").replace(",", "").strip()
        if comp_clean:
            # Find all dollar amounts in the caption
            dollar_pattern = re.compile(r"\$[\d,]+(?:\.\d{2})?")
            found_amounts = dollar_pattern.findall(caption)
            for amount in found_amounts:
                amount_clean = amount.replace("$", "").replace(",", "").strip()
                if amount_clean and amount_clean != comp_clean:
                    issues.append(
                        f"Compensation drift: caption says '{amount}' but source is '{compensation}'"
                    )

    # ── 2. Work mode consistency ─────────────────────────────────────
    work_mode = str(hard_facts.get("work_mode", "")).lower().strip()

    if work_mode == "remote":
        onsite_signals = [
            "come to our office",
            "in-person required",
            "onsite only",
            "must be local",
            "visit our facility",
            "in-office",
            "on-site mandatory",
        ]
        for signal in onsite_signals:
            if signal in caption_lower:
                issues.append(
                    f"Work mode drift: caption says '{signal}' but work_mode is 'remote'"
                )

    elif work_mode == "onsite":
        remote_signals = [
            "work from home",
            "work from anywhere",
            "fully remote",
            "100% remote",
            "no commute",
            "work in your pajamas",
            "remote position",
        ]
        for signal in remote_signals:
            if signal in caption_lower:
                issues.append(
                    f"Work mode drift: caption says '{signal}' but work_mode is 'onsite'"
                )

    # ── 3. Forbidden promises ────────────────────────────────────────
    for phrase in FORBIDDEN_PHRASES:
        if phrase in caption_lower:
            issues.append(f"Forbidden promise: caption contains '{phrase}'")

    # ── Result ───────────────────────────────────────────────────────
    passed = len(issues) == 0
    if passed:
        logger.info("Caption drift validation PASSED")
    else:
        logger.warning("Caption drift validation FAILED — %d issues: %s", len(issues), issues)

    return passed, issues
