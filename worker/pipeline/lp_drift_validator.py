"""Landing page drift validator — deterministic, no LLM.

After rendering, parses the HTML output and cross-checks every hard fact
against the intake source data. This catches any case where:
  1. The LLM hallucinated a different compensation amount
  2. CTA buttons point to wrong URLs
  3. Onsite-specific content appears on a remote job page
  4. The page language doesn't match the target language

Returns (passed: bool, issues: list[str]).
"""
from __future__ import annotations

import logging
import re
from html.parser import HTMLParser
from typing import Any

logger = logging.getLogger(__name__)

# ── Language code mapping ──────────────────────────────────────────────

LANG_CODES: dict[str, str] = {
    "English": "en", "Spanish": "es", "Portuguese": "pt", "French": "fr",
    "German": "de", "Italian": "it", "Arabic": "ar", "Japanese": "ja",
    "Korean": "ko", "Hindi": "hi", "Indonesian": "id", "Thai": "th",
    "Vietnamese": "vi", "Turkish": "tr", "Polish": "pl", "Dutch": "nl",
    "Russian": "ru", "Ukrainian": "uk", "Filipino": "fil", "Romanian": "ro",
    "Mandarin Chinese": "zh", "Traditional Chinese": "zh-TW",
    "Finnish": "fi", "Swedish": "sv", "Norwegian": "no", "Danish": "da",
    "Greek": "el", "Hebrew": "he",
}


class _ButtonHrefExtractor(HTMLParser):
    """Extract href from elements with 'btn' in their class."""

    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_dict = dict(attrs)
        classes = attr_dict.get("class", "")
        href = attr_dict.get("href", "")
        if tag == "a" and "btn" in classes and href:
            self.hrefs.append(href)


def validate_landing_page(
    html: str,
    hard_facts: dict[str, Any],
) -> tuple[bool, list[str]]:
    """Validate rendered LP HTML against source hard facts.

    Parameters
    ----------
    html:
        The complete rendered HTML string.
    hard_facts:
        Source data dict with compensation_amount, apply_url, work_mode,
        page_lang, qualifications, etc.

    Returns
    -------
    tuple[bool, list[str]]
        (passed, issues). If issues is non-empty, the LP has drift.
    """
    issues: list[str] = []

    compensation = str(hard_facts.get("compensation_amount", "")).strip()
    apply_url = str(hard_facts.get("apply_url", "")).strip()
    work_mode = str(hard_facts.get("work_mode", "remote")).strip().lower()
    page_lang = str(hard_facts.get("page_lang", "en")).strip()

    html_lower = html.lower()

    # ── 1. Compensation consistency ──────────────────────────────────
    if compensation and compensation != "$":
        # Extract the numeric part for comparison
        comp_clean = compensation.replace("$", "").replace(",", "").strip()
        if comp_clean:
            # Find all dollar amounts in the rendered HTML
            dollar_pattern = re.compile(r"\$[\d,]+(?:\.\d{2})?")
            found_amounts = dollar_pattern.findall(html)
            for amount in found_amounts:
                amount_clean = amount.replace("$", "").replace(",", "").strip()
                if amount_clean and amount_clean != comp_clean and amount_clean != "0":
                    issues.append(
                        f"Compensation drift: found '{amount}' but source is '{compensation}'"
                    )

    # ── 2. CTA URL consistency ───────────────────────────────────────
    if apply_url and apply_url != "#apply":
        extractor = _ButtonHrefExtractor()
        extractor.feed(html)
        for href in extractor.hrefs:
            # Skip internal anchors
            if href.startswith("#"):
                continue
            # Skip the oneforma.com homepage link (logo)
            if href == "https://www.oneforma.com":
                continue
            if href != apply_url:
                issues.append(
                    f"CTA URL drift: button points to '{href}' but apply_url is '{apply_url}'"
                )

    # ── 3. Work mode consistency ─────────────────────────────────────
    if work_mode == "remote":
        onsite_markers = [
            "onsite studio",
            "visit our facility",
            "in-person at our",
            "come to our office",
            "physical location required",
        ]
        for marker in onsite_markers:
            if marker in html_lower:
                issues.append(
                    f"Work mode drift: found onsite language '{marker}' but work_mode is 'remote'"
                )

    if work_mode == "onsite":
        remote_markers = [
            "work from home",
            "no travel required",
            "fully remote position",
            "work from anywhere",
        ]
        for marker in remote_markers:
            if marker in html_lower:
                issues.append(
                    f"Work mode drift: found remote language '{marker}' but work_mode is 'onsite'"
                )

    # ── 4. Page language attribute ───────────────────────────────────
    lang_match = re.search(r'<html[^>]*\slang="([^"]+)"', html)
    if lang_match:
        found_lang = lang_match.group(1).strip().lower()
        expected_lang = page_lang.strip().lower()
        if found_lang != expected_lang:
            issues.append(
                f"Page lang drift: found lang='{found_lang}' but expected '{expected_lang}'"
            )

    # ── Result ───────────────────────────────────────────────────────
    passed = len(issues) == 0
    if passed:
        logger.info("LP drift validation PASSED — all hard facts match source")
    else:
        logger.warning("LP drift validation FAILED — %d issues: %s", len(issues), issues)

    return passed, issues
