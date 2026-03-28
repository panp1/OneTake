"""Stage 1: Strategic Intelligence.

1. Load intake request from Neon.
2. Generate creative brief using Qwen3.5-9B.
3. Evaluate brief (gate -- threshold 0.85, max 3 retries).
4. Generate design direction.
5. Save to Neon creative_briefs table.
"""
from __future__ import annotations

import json
import logging

from ai.local_llm import generate_text
from neon_client import get_intake_request, save_brief
from prompts.persona_engine import (
    build_persona_brief_prompt,
    generate_personas,
)
from prompts.recruitment_brief import (
    BRIEF_SYSTEM_PROMPT,
    build_brief_prompt,
    build_design_direction_prompt,
    build_eval_prompt,
)

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
PASS_THRESHOLD = 0.85


async def run_stage1(context: dict) -> dict:
    """Run Strategic Intelligence stage and return enriched context."""
    request_id: str = context["request_id"]
    request = await get_intake_request(request_id)
    context["request_title"] = request.get("title", "Untitled")

    # ------------------------------------------------------------------
    # Generate brief
    # ------------------------------------------------------------------
    brief_prompt = build_brief_prompt(request)
    brief_text = await generate_text(BRIEF_SYSTEM_PROMPT, brief_prompt)
    brief_data = _parse_json(brief_text)

    # ------------------------------------------------------------------
    # Evaluate brief with retry gate
    # ------------------------------------------------------------------
    score = 0.0
    eval_data: dict = {}
    for attempt in range(MAX_RETRIES):
        eval_prompt = build_eval_prompt(brief_data, request)
        eval_text = await generate_text(
            BRIEF_SYSTEM_PROMPT, eval_prompt, temperature=0.2,
        )
        eval_data = _parse_json(eval_text)
        score = float(eval_data.get("overall_score", 0))

        if score >= PASS_THRESHOLD:
            logger.info(
                "Brief passed evaluation (score=%.2f, attempt=%d)",
                score,
                attempt + 1,
            )
            break

        logger.info("Brief score %.2f below %.2f -- retrying...", score, PASS_THRESHOLD)
        feedback = eval_data.get("improvement_suggestions", [])
        brief_prompt = build_brief_prompt(request, feedback=feedback)
        brief_text = await generate_text(BRIEF_SYSTEM_PROMPT, brief_prompt)
        brief_data = _parse_json(brief_text)

    # ------------------------------------------------------------------
    # Generate 3 target personas from intake requirements
    # ------------------------------------------------------------------
    personas = generate_personas(request)
    persona_context = build_persona_brief_prompt(personas, brief_data)
    logger.info(
        "Generated %d personas: %s",
        len(personas),
        [p["archetype_key"] for p in personas],
    )

    # Inject personas into brief_data so downstream stages can access them.
    brief_data["personas"] = personas

    # ------------------------------------------------------------------
    # Generate design direction (now informed by personas)
    # ------------------------------------------------------------------
    design_prompt = build_design_direction_prompt(brief_data, request)
    # Append persona context so design direction accounts for persona lifestyles.
    design_prompt += "\n\n" + persona_context
    design_text = await generate_text(BRIEF_SYSTEM_PROMPT, design_prompt)
    design_data = _parse_json(design_text)

    # ------------------------------------------------------------------
    # Persist to Neon
    # ------------------------------------------------------------------
    await save_brief(
        request_id,
        {
            "brief_data": brief_data,
            "design_direction": design_data,
            "evaluation_score": score,
            "evaluation_data": eval_data,
            "personas": personas,
            "content_languages": request.get("target_languages", []),
        },
    )

    return {
        "brief": brief_data,
        "design_direction": design_data,
        "personas": personas,
        "target_languages": request.get("target_languages", []),
        "target_regions": request.get("target_regions", []),
        "form_data": request.get("form_data", {}),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_json(text: str) -> dict:
    """Parse JSON from LLM output, handling markdown code fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Strip opening fence line
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        # Strip closing fence
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Failed to parse JSON from LLM output; wrapping in raw_text.")
        return {"raw_text": text}
