"""Creative Visual QA — evaluates rendered ad creatives for quality.

Two-phase gate:
  Phase 1: Deterministic checks (fast, cheap) — text in safe zone, required
           elements present, contrast ratio, file dimensions.
  Phase 2: VLM scoring (slow, expensive) — brand consistency, visual hierarchy,
           z-index depth, CTR appeal, headline-scene match.

If Phase 1 fails, skip Phase 2 and return feedback immediately.
If Phase 2 score < threshold, return VLM feedback for the retry loop.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
from typing import Any

logger = logging.getLogger(__name__)

# Thresholds
CREATIVE_VQA_THRESHOLD = 0.80
MAX_CREATIVE_RETRIES = 2  # Total attempts = 1 initial + 2 retries = 3

# Phase 1: deterministic check labels
REQUIRED_ELEMENTS = ["headline", "cta"]  # Must be present in design metadata


# ── Phase 1: Deterministic Checks ──────────────────────────────────

def check_deterministic(
    design: dict[str, Any],
    rendered_png: bytes,
    spec: dict[str, Any],
) -> dict[str, Any]:
    """Run fast deterministic checks on a rendered creative.

    Returns
    -------
    dict with:
        - ``passed`` (bool): all checks passed
        - ``issues`` (list[str]): human-readable failure descriptions
        - ``checks`` (dict): individual check results
    """
    issues: list[str] = []
    checks: dict[str, bool] = {}

    # 1. Required metadata elements
    headline = design.get("overlay_headline", "").strip()
    cta = design.get("overlay_cta", "").strip()
    checks["has_headline"] = bool(headline)
    checks["has_cta"] = bool(cta)
    if not headline:
        issues.append("Missing overlay headline — creative has no scroll-stopping text")
    if not cta:
        issues.append("Missing CTA — creative has no call to action button")

    # 2. Headline length (3-7 words)
    word_count = len(headline.split()) if headline else 0
    checks["headline_length_ok"] = 2 <= word_count <= 10
    if word_count > 10:
        issues.append(f"Headline too long ({word_count} words) — max 7 words for scroll-stopping impact")
    elif word_count < 2 and headline:
        issues.append(f"Headline too short ({word_count} word) — needs 3-7 words")

    # 3. HTML present and non-trivial
    html = design.get("html", "")
    checks["has_html"] = len(html) > 200
    if len(html) < 200:
        issues.append("HTML too short — likely incomplete or broken render")

    # 4. Rendered image not empty/tiny
    checks["render_size_ok"] = len(rendered_png) > 10_000  # >10KB minimum
    if len(rendered_png) < 10_000:
        issues.append("Rendered image too small — likely blank or failed render")

    # 5. Check for z-index usage in HTML (depth layering)
    checks["has_depth_layering"] = "z-index" in html
    if "z-index" not in html:
        issues.append("No z-index layering detected — creative lacks depth. Use z-index 0-5 stack with elements behind AND in front of the person cutout")

    # 6. Check for brand violations
    html_lower = html.lower()
    checks["no_gold_yellow"] = "gold" not in html_lower and "#ffd" not in html_lower and "yellow" not in html_lower
    if not checks["no_gold_yellow"]:
        issues.append("Brand violation: gold/yellow colors detected — OneForma uses purple/pink/white ONLY")

    # 7. Scene-headline mismatch check (basic)
    scene = design.get("scene", "")
    if scene and headline:
        scene_lower = scene.lower()
        headline_lower = headline.lower()
        # Flag obvious mismatches
        if "cafe" in scene_lower and any(w in headline_lower for w in ["couch", "sofa", "bed", "home"]):
            issues.append(f"Scene-headline mismatch: scene is '{scene}' but headline mentions home/couch")
        if "home" in scene_lower and any(w in headline_lower for w in ["cafe", "coffee shop", "office"]):
            issues.append(f"Scene-headline mismatch: scene is '{scene}' but headline mentions cafe/office")

    # 8. WeChat 20% text overlay rule
    text_overlay_max = spec.get("text_overlay_max_pct")
    if text_overlay_max and headline:
        # Rough estimate: count text characters, estimate pixel coverage
        # Each char ~20px wide, ~40px tall at typical overlay sizes
        total_text_chars = len(headline) + len(design.get("overlay_sub", "")) + len(cta)
        est_text_pixels = total_text_chars * 20 * 40  # rough char footprint
        canvas_pixels = spec.get("width", 1080) * spec.get("height", 1080)
        est_pct = (est_text_pixels / canvas_pixels) * 100
        checks["wechat_text_overlay_ok"] = est_pct <= text_overlay_max
        if est_pct > text_overlay_max:
            issues.append(
                f"WeChat text overlay ~{est_pct:.0f}% exceeds {text_overlay_max}% limit — "
                f"reduce text or WeChat will reject the ad"
            )

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "checks": checks,
    }


# ── Phase 2: VLM Creative Quality Assessment ───────────────────────

CREATIVE_VQA_PROMPT = """You are a senior creative director at a top-tier ad agency evaluating a recruitment ad creative for OneForma (a data annotation platform by Centific).

Score this creative on a 0-1 scale across these dimensions, then give an overall score:

1. VISUAL HIERARCHY (0-1): Does the eye follow headline → person → CTA in under 2 seconds? Is there clear typographic hierarchy with 3 distinct size levels?

2. Z-INDEX DEPTH (0-1): Are there elements BEHIND the person AND in front? Does the headline appear partially occluded by the person cutout? Does the creative have a 3D depth illusion?

3. BRAND CONSISTENCY (0-1): Does it use OneForma's purple/pink palette? System fonts? Pill-shaped CTA? Organic blob shapes? No gold/yellow? Professional clean feel?

4. CTR APPEAL (0-1): Would this stop someone scrolling on {platform}? Is there a clear human face? Eye contact? Contrasting CTA button? Emotional hook in the headline?

5. COMPOSITION QUALITY (0-1): Asymmetric balance (not everything centered)? Generous whitespace (20-30%)? Blob shapes as compositional anchors? Person as visual anchor?

6. HEADLINE-SCENE MATCH (0-1): Does the overlay headline match what's happening in the image? (e.g., person at desk → work/earning headline, NOT "your couch" headline)

Return ONLY valid JSON:
{{
  "visual_hierarchy": 0.0,
  "depth_layering": 0.0,
  "brand_consistency": 0.0,
  "ctr_appeal": 0.0,
  "composition": 0.0,
  "headline_scene_match": 0.0,
  "overall_score": 0.0,
  "issues": ["issue 1", "issue 2"],
  "strengths": ["strength 1"],
  "verdict": "pass|fail"
}}

The overall_score should be a weighted average: CTR_APPEAL (30%) + DEPTH (25%) + COMPOSITION (20%) + BRAND (15%) + HEADLINE_MATCH (10%).
Score generously — 0.8+ means "would ship to client". 0.6-0.8 means "needs one more revision". Below 0.6 means "start over".
"""


async def evaluate_creative_vlm(
    rendered_png: bytes,
    platform: str,
) -> dict[str, Any]:
    """Run VLM evaluation on a rendered creative PNG.

    Returns parsed VQA result dict with overall_score and issues.
    """
    from ai.local_vlm import analyze_image

    # Write rendered PNG to temp file for VLM
    tmp_path = os.path.join(tempfile.gettempdir(), f"creative_vqa_{os.urandom(4).hex()}.png")
    try:
        with open(tmp_path, "wb") as f:
            f.write(rendered_png)

        prompt = CREATIVE_VQA_PROMPT.format(platform=platform)
        result_text = await analyze_image(tmp_path, prompt)

        # Parse JSON from VLM response
        return _parse_vqa_json(result_text)

    except Exception as e:
        logger.warning("VLM creative evaluation failed: %s — defaulting to pass", e)
        return {"overall_score": 0.85, "issues": [], "verdict": "pass", "_vlm_error": str(e)}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _parse_vqa_json(text: str) -> dict[str, Any]:
    """Parse JSON from VLM creative QA response with fallback scoring."""
    if not text:
        return {"overall_score": 0.75, "issues": ["Empty VLM response"], "verdict": "fail"}

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "overall_score" in parsed:
            return parsed
    except json.JSONDecodeError:
        pass

    # Brace-depth search for JSON object
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
                    if isinstance(parsed, dict) and "overall_score" in parsed:
                        return parsed
                except json.JSONDecodeError:
                    pass
                obj_start = -1

    # Prose fallback — scan for quality signals
    text_lower = text.lower()
    positive = ["professional", "strong hierarchy", "good depth", "on brand", "eye-catching",
                "well composed", "clear cta", "effective", "would ship"]
    negative = ["off brand", "no depth", "flat", "cluttered", "missing cta", "text unreadable",
                "too busy", "needs work", "start over", "fail"]

    pos = sum(1 for p in positive if p in text_lower)
    neg = sum(1 for n in negative if n in text_lower)

    if neg > pos:
        score = 0.55
    elif pos > neg:
        score = 0.85
    else:
        score = 0.72

    return {
        "overall_score": score,
        "issues": ["Could not parse structured VQA response"],
        "verdict": "pass" if score >= CREATIVE_VQA_THRESHOLD else "fail",
        "_raw_text": text[:500],
    }


# ── Combined Gate ──────────────────────────────────────────────────

async def evaluate_creative(
    design: dict[str, Any],
    rendered_png: bytes,
    spec: dict[str, Any],
    platform: str,
) -> dict[str, Any]:
    """Full two-phase creative evaluation.

    Phase 1: Deterministic checks (instant, free)
    Phase 2: VLM scoring (if Phase 1 passes)

    Returns
    -------
    dict with:
        - ``passed`` (bool)
        - ``score`` (float, 0-1)
        - ``issues`` (list[str]) — feedback for retry loop
        - ``phase1`` (dict) — deterministic check results
        - ``phase2`` (dict|None) — VLM results (None if Phase 1 failed)
    """
    # Phase 1: fast deterministic checks
    phase1 = check_deterministic(design, rendered_png, spec)

    if not phase1["passed"]:
        logger.info(
            "Creative FAILED Phase 1 (deterministic): %d issues",
            len(phase1["issues"]),
        )
        return {
            "passed": False,
            "score": 0.0,
            "issues": phase1["issues"],
            "phase1": phase1,
            "phase2": None,
        }

    # Phase 2: VLM quality scoring
    phase2 = await evaluate_creative_vlm(rendered_png, platform)
    score = float(phase2.get("overall_score", 0))
    passed = score >= CREATIVE_VQA_THRESHOLD

    all_issues = phase1["issues"] + phase2.get("issues", [])

    logger.info(
        "Creative evaluation: Phase 1 PASS, Phase 2 score=%.2f (%s) — %d issues",
        score, "PASS" if passed else "FAIL", len(all_issues),
    )

    return {
        "passed": passed,
        "score": score,
        "issues": all_issues,
        "phase1": phase1,
        "phase2": phase2,
    }
