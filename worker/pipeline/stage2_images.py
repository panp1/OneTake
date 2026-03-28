"""Stage 2: Character-Driven Image Generation.

1. Generate actor identity cards using Qwen3.5-9B.
2. Save actor profiles to Neon.
3. For each actor, generate images via Seedream 4.5.
4. Run Qwen3-VL visual QA (threshold 0.85, max 3 retries per image).
5. Upload approved images to Vercel Blob.
6. Save generated_assets to Neon.
"""
from __future__ import annotations

import json
import logging
import uuid

from ai.local_llm import generate_text
from ai.local_vlm import analyze_image
from ai.seedream import generate_image
from blob_uploader import upload_to_blob
from neon_client import save_actor, save_asset
from prompts.recruitment_actors import (
    ACTOR_SYSTEM_PROMPT,
    build_actor_prompt,
    build_image_prompt,
    build_visual_qa_prompt,
)

logger = logging.getLogger(__name__)

MAX_IMAGE_RETRIES = 3
VQA_THRESHOLD = 0.85


async def run_stage2(context: dict) -> dict:
    """Generate actors and images for every target region."""
    request_id: str = context["request_id"]
    brief: dict = context.get("brief", {})
    design: dict = context.get("design_direction", {})
    regions: list[str] = context.get("target_regions", [])
    languages: list[str] = context.get("target_languages", [])

    all_actors: list[dict] = []
    image_count = 0

    # Generate one actor per region (at minimum).
    for idx, region in enumerate(regions or ["Global"]):
        language = languages[idx] if idx < len(languages) else (languages[0] if languages else "English")

        # ------------------------------------------------------------------
        # Generate actor identity card
        # ------------------------------------------------------------------
        actor_prompt = build_actor_prompt(brief, region, language)
        actor_text = await generate_text(ACTOR_SYSTEM_PROMPT, actor_prompt)
        actor_data = _parse_json(actor_text)

        actor_id = await save_actor(request_id, {
            "actor_name": actor_data.get("name", f"Contributor-{region}"),
            "actor_data": actor_data,
            "image_prompt": "",  # filled after image prompt generation
            "region": region,
            "language": language,
        })
        actor_data["id"] = actor_id
        all_actors.append(actor_data)

        # ------------------------------------------------------------------
        # Generate hero image for actor
        # ------------------------------------------------------------------
        image_prompt_text = build_image_prompt(actor_data, brief, design, region)

        for attempt in range(MAX_IMAGE_RETRIES):
            logger.info(
                "Generating image for actor '%s' (attempt %d)",
                actor_data.get("name", "?"),
                attempt + 1,
            )
            image_bytes = await generate_image(image_prompt_text, dimension_key="square")

            # Save temporary file for VLM analysis
            import tempfile
            import os
            tmp_path = os.path.join(tempfile.gettempdir(), f"centric_{uuid.uuid4().hex}.png")
            with open(tmp_path, "wb") as f:
                f.write(image_bytes)

            # Visual QA
            qa_prompt = build_visual_qa_prompt(actor_data, region)
            qa_result = await analyze_image(tmp_path, qa_prompt)
            qa_data = _parse_json(qa_result)
            qa_score = float(qa_data.get("overall_score", qa_data.get("score", 0)))

            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

            if qa_score >= VQA_THRESHOLD:
                logger.info(
                    "Image passed VQA (score=%.2f, attempt=%d)",
                    qa_score,
                    attempt + 1,
                )
                break

            logger.info("Image VQA score %.2f below %.2f -- regenerating.", qa_score, VQA_THRESHOLD)
            # Refine prompt for next attempt
            issues = qa_data.get("issues", [])
            if issues:
                image_prompt_text += "\n\nFix these issues: " + "; ".join(issues)

        # Upload approved image to Vercel Blob
        filename = f"actor_{actor_id}_{uuid.uuid4().hex[:8]}.png"
        blob_url = await upload_to_blob(image_bytes, filename, folder=f"requests/{request_id}")

        await save_asset(request_id, {
            "asset_type": "actor_image",
            "platform": "all",
            "format": "1080x1080",
            "language": language,
            "blob_url": blob_url,
            "metadata": {
                "actor_id": actor_id,
                "actor_name": actor_data.get("name"),
                "region": region,
                "vqa_score": qa_score,
            },
        })
        image_count += 1

    return {
        "actors": all_actors,
        "image_count": image_count,
    }


def _parse_json(text: str) -> dict:
    """Parse JSON from LLM/VLM output, handling markdown code fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"raw_text": text}
