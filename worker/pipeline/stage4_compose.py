"""Stage 4: Layout Composition.

1. Load brief + actors + images + copy from context/Neon.
2. For each channel x format, select template (Qwen3.5-9B).
3. Build HTML composition (compositor).
4. Render via Playwright to PNG.
5. Evaluate creative (7 dimensions, threshold 0.70, max 3 retries).
6. Upload composed PNGs to Vercel Blob.
7. Save as generated_assets to Neon.
"""
from __future__ import annotations

import json
import logging
import uuid

from ai.compositor import PLATFORM_SPECS, compose_creative
from ai.evaluator import evaluate_creative
from ai.local_llm import generate_text
from blob_uploader import upload_to_blob
from neon_client import get_actors, get_assets, save_asset

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
EVAL_THRESHOLD = 0.70

TEMPLATE_SELECTION_SYSTEM = """You are a creative director. Select the best template for a recruitment ad.
Available templates: HERO_HEADLINE, BOTTOM_BAND, CENTERED_OVERLAY, SPLIT_LEFT_TEXT, MINIMAL_CTA, CAROUSEL_STAT, CAROUSEL_TESTIMONIAL.
Return JSON: {"template": "TEMPLATE_NAME", "rationale": "..."}"""


async def run_stage4(context: dict) -> dict:
    """Compose final creatives for every channel x actor combination."""
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    design: dict = context.get("design_direction", {})

    # Load actors and assets from Neon.
    actors = await get_actors(request_id)
    image_assets = await get_assets(request_id, asset_type="actor_image")
    copy_assets = await get_assets(request_id, asset_type="copy")

    # Build lookup tables.
    actor_images: dict[str, str] = {}  # actor_id -> blob_url
    for asset in image_assets:
        meta = asset.get("metadata", {})
        if isinstance(meta, str):
            meta = json.loads(meta)
        aid = meta.get("actor_id")
        if aid:
            actor_images[aid] = asset.get("blob_url", "")

    channel_copy: dict[str, dict] = {}  # channel -> copy_data
    for asset in copy_assets:
        meta = asset.get("metadata", {})
        if isinstance(meta, str):
            meta = json.loads(meta)
        channel_copy[asset.get("platform", "")] = meta.get("copy_data", {})

    # Determine platforms to compose.
    format_matrix: dict = design.get("format_matrix", {})
    platforms = list(format_matrix.keys()) if format_matrix else list(PLATFORM_SPECS.keys())

    asset_count = 0

    for platform in platforms:
        spec = PLATFORM_SPECS.get(platform)
        if not spec:
            logger.warning("Unknown platform %s -- skipping.", platform)
            continue

        for actor in actors:
            actor_id = actor.get("id", "")
            hero_url = actor_images.get(actor_id, "")
            copy_data = channel_copy.get(platform, {})

            headline = (
                copy_data.get("headline")
                or copy_data.get("primary_text", "")[:60]
                or brief.get("messaging_strategy", {}).get("primary_message", "Join OneForma")
            )
            subheadline = copy_data.get("subheadline", copy_data.get("body", ""))
            cta_text = copy_data.get("cta_text", copy_data.get("cta", "Start Earning"))

            # ------------------------------------------------------------------
            # Select template via LLM
            # ------------------------------------------------------------------
            selection_prompt = (
                f"Platform: {platform}\n"
                f"Headline length: {len(headline)} chars\n"
                f"Has subheadline: {'yes' if subheadline else 'no'}\n"
                f"Actor region: {actor.get('region', 'global')}\n"
                f"Brief tone: {brief.get('messaging_strategy', {}).get('tone', 'friendly')}\n"
                "Select the best template."
            )
            selection_text = await generate_text(
                TEMPLATE_SELECTION_SYSTEM,
                selection_prompt,
                temperature=0.3,
            )
            selection = _parse_json(selection_text)
            template = selection.get("template", "HERO_HEADLINE")

            # ------------------------------------------------------------------
            # Compose and evaluate with retry gate
            # ------------------------------------------------------------------
            props = {
                "platform": platform,
                "template": template,
                "hero_image_url": hero_url,
                "headline": headline,
                "subheadline": subheadline,
                "cta_text": cta_text,
                "cta_color": "#32373C",
                "gradient_opacity": 0.65,
                "logo_url": "",  # OneForma logo URL can be added later
            }

            for attempt in range(MAX_RETRIES):
                png_bytes = await compose_creative(props)

                eval_result = await evaluate_creative({
                    "headline": headline,
                    "subheadline": subheadline,
                    "cta_text": cta_text,
                    "platform": platform,
                    "template": template,
                    "actor_region": actor.get("region", ""),
                })

                if eval_result["passed"]:
                    logger.info(
                        "Creative passed eval (platform=%s, actor=%s, score=%.2f, attempt=%d)",
                        platform,
                        actor.get("name", "?"),
                        eval_result["overall_score"],
                        attempt + 1,
                    )
                    break

                logger.info(
                    "Creative eval %.2f below threshold -- refining (attempt %d).",
                    eval_result["overall_score"],
                    attempt + 1,
                )
                # Apply suggestions to props.
                suggestions = eval_result.get("improvement_suggestions", [])
                if suggestions:
                    # Ask LLM for revised headline/subheadline.
                    revision_prompt = (
                        f"Current headline: {headline}\n"
                        f"Current subheadline: {subheadline}\n"
                        f"Feedback: {'; '.join(suggestions)}\n\n"
                        "Return JSON: {\"headline\": \"...\", \"subheadline\": \"...\", \"cta_text\": \"...\"}"
                    )
                    revision_text = await generate_text(
                        "You are a recruitment copywriter for OneForma.",
                        revision_prompt,
                        temperature=0.5,
                    )
                    revision = _parse_json(revision_text)
                    headline = revision.get("headline", headline)
                    subheadline = revision.get("subheadline", subheadline)
                    cta_text = revision.get("cta_text", cta_text)
                    props["headline"] = headline
                    props["subheadline"] = subheadline
                    props["cta_text"] = cta_text

            # ------------------------------------------------------------------
            # Upload and persist
            # ------------------------------------------------------------------
            filename = f"creative_{platform}_{uuid.uuid4().hex[:8]}.png"
            blob_url = await upload_to_blob(
                png_bytes, filename, folder=f"requests/{request_id}",
            )

            await save_asset(request_id, {
                "asset_type": "composed_creative",
                "platform": platform,
                "format": f"{spec['width']}x{spec['height']}",
                "language": copy_data.get("language", ""),
                "blob_url": blob_url,
                "metadata": {
                    "actor_id": actor_id,
                    "template": template,
                    "headline": headline,
                    "subheadline": subheadline,
                    "cta_text": cta_text,
                    "eval_score": eval_result.get("overall_score", 0),
                    "eval_dimensions": eval_result.get("dimensions", {}),
                },
            })
            asset_count += 1

    return {"asset_count": asset_count}


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output, handling markdown code fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw_text": text}
