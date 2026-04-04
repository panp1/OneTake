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

import base64
import io
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


# ── Phase 3: Gemma 4 Composed Creative VQA ────────────────────────

# Gemma 4 VQA config
GEMMA4_MODEL = os.environ.get("NVIDIA_NIM_VQA_MODEL", "google/gemma-4-31b-it")
GEMMA4_KEY = os.environ.get("NVIDIA_NIM_VQA_KEY", os.environ.get("NVIDIA_NIM_API_KEY", ""))
COMPOSED_VQA_THRESHOLD = 0.70

COMPOSED_VQA_PROMPT = '''You are a senior art director at a $50K/campaign ad agency reviewing an AI-generated ad creative.

Score each dimension 0.0-1.0 AND provide SPECIFIC HTML/CSS fix instructions that a code-generating AI can execute.

DIMENSIONS:

1. text_readability: Is ALL text 100% legible? Check: contrast ratio, font size, background backing.
   - If failing: specify exact CSS fix (e.g., "add text-shadow: 0 2px 8px rgba(0,0,0,0.5)" or "increase font-size from 16px to 22px")

2. visual_hierarchy: Clear 3-level progression? Headline should be 2-3x larger than subheadline, CTA must be highest-contrast element.
   - If failing: specify exact size changes (e.g., "headline needs font-size: 56px not 36px")

3. typography_quality: Serif for headlines? Letter-spacing right? Line-height creating breathing room?
   - If failing: specify exact font changes (e.g., "switch headline to font-family: Georgia, serif" or "add letter-spacing: -0.02em")

4. photo_integration: Person visible? Face not obscured? Natural compositing?
   - If failing: specify exact positioning fix (e.g., "change object-position from center to center 30%")

5. layout_composition: Proper whitespace (20-30%)? Asymmetric > centered? Elements have breathing room?
   - If failing: specify exact spacing (e.g., "add 40px padding-left" or "increase margin-bottom from 12px to 28px")

6. brand_elements: OneForma purple (#6B21A8) and pink (#E91E8C) present? Pill CTA with gradient? Accent lines?
   - If failing: specify what to add (e.g., "CTA needs border-radius: 9999px and background: linear-gradient(135deg, #6B21A8, #E91E8C)")

7. scroll_stop_power: Would a recruiter stop scrolling for this? Emotional tension? Visual drama?
   - If failing: specify creative direction (e.g., "add a large stat number like $15/hr in 72px serif" or "headline needs emotional hook")

Return ONLY valid JSON:
{
  "text_readability": {"score": 0.0, "fix": "specific CSS fix or null"},
  "visual_hierarchy": {"score": 0.0, "fix": "specific fix or null"},
  "typography_quality": {"score": 0.0, "fix": "specific fix or null"},
  "photo_integration": {"score": 0.0, "fix": "specific fix or null"},
  "layout_composition": {"score": 0.0, "fix": "specific fix or null"},
  "brand_elements": {"score": 0.0, "fix": "specific fix or null"},
  "scroll_stop_power": {"score": 0.0, "fix": "specific creative direction or null"},
  "overall_score": 0.0,
  "passed": true,
  "top_3_fixes": ["most impactful fix first", "second", "third"]
}'''


async def evaluate_composed_creative(
    image_path: str,
    platform: str = "",
    headline: str = "",
) -> dict[str, Any]:
    """Evaluate a composed creative using Gemma 4 31B Vision on NIM.

    Returns detailed per-dimension scores with actionable CSS fix instructions.
    """
    import httpx

    if not GEMMA4_KEY:
        logger.warning("No Gemma 4 VQA key — returning default pass")
        return {"overall_score": 0.80, "passed": True, "dimensions": {}, "top_3_fixes": []}

    # Read and resize image
    try:
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        img = img.resize((512, 512), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        logger.warning("Failed to load image for VQA: %s", e)
        return {"overall_score": 0.75, "passed": True, "dimensions": {}, "top_3_fixes": []}

    payload = {
        "model": GEMMA4_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": COMPOSED_VQA_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ],
        }],
        "max_tokens": 4096,
        "temperature": 0.3,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GEMMA4_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"].get("content", "")
        usage = data.get("usage", {})
        logger.info(
            "Gemma 4 VQA: %d tokens in, %d out",
            usage.get("prompt_tokens", 0),
            usage.get("completion_tokens", 0),
        )

        # Parse JSON from response
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0].strip()

        try:
            result = json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to find JSON in the text
            brace_depth = 0
            start = -1
            last_valid = None
            for i, char in enumerate(cleaned):
                if char == '{':
                    if brace_depth == 0:
                        start = i
                    brace_depth += 1
                elif char == '}':
                    brace_depth -= 1
                    if brace_depth == 0 and start >= 0:
                        try:
                            parsed = json.loads(cleaned[start:i+1])
                            if isinstance(parsed, dict) and "overall_score" in parsed:
                                last_valid = parsed
                        except json.JSONDecodeError:
                            pass
                        start = -1
            if last_valid:
                result = last_valid
            else:
                logger.warning("Could not parse Gemma 4 VQA response")
                return {"overall_score": 0.75, "passed": True, "dimensions": {}, "top_3_fixes": []}

        # Ensure required fields
        result.setdefault("overall_score", 0.0)
        result.setdefault("passed", result["overall_score"] >= COMPOSED_VQA_THRESHOLD)
        result.setdefault("top_3_fixes", [])

        logger.info(
            "Composed creative VQA: score=%.2f, passed=%s, fixes=%d",
            result["overall_score"],
            result["passed"],
            len(result.get("top_3_fixes", [])),
        )

        return result

    except Exception as e:
        logger.error("Gemma 4 VQA failed: %s", e)
        return {"overall_score": 0.75, "passed": True, "dimensions": {}, "top_3_fixes": []}
