"""Pipeline orchestrator -- runs stages 1-4 sequentially.

Handles full generation and single-stage regeneration. Each stage
receives a shared *context* dict that accumulates results. On failure
the request is returned to 'draft' status and Teams is notified.
"""
import logging

from neon_client import update_request_status
from pipeline.stage1_intelligence import run_stage1
from pipeline.stage2_images import run_stage2
from pipeline.stage3_copy import run_stage3
from pipeline.stage4_compose import run_stage4
from teams_notify import notify_generation_complete, notify_generation_failed

logger = logging.getLogger(__name__)


async def run_pipeline(job: dict) -> None:
    """Run the full Creative OS pipeline for a compute job.

    Parameters
    ----------
    job:
        A dict from ``fetch_pending_jobs`` containing at minimum
        ``request_id``, ``job_type``, and optionally ``stage_target``
        and ``feedback``.
    """
    request_id: str = job["request_id"]
    job_type: str = job["job_type"]
    stage_target = job.get("stage_target")
    feedback = job.get("feedback")

    stages = [
        (1, "Strategic Intelligence", run_stage1),
        (2, "Character-Driven Image Generation", run_stage2),
        (3, "Copy Generation", run_stage3),
        (4, "Layout Composition", run_stage4),
    ]

    # If regenerating a specific stage, only run that one.
    if job_type == "regenerate_stage" and stage_target is not None:
        target = int(stage_target)
        stages = [(n, name, fn) for n, name, fn in stages if n == target]

    context: dict = {
        "request_id": request_id,
        "feedback": feedback,
    }

    for stage_num, stage_name, stage_fn in stages:
        logger.info("Running Stage %d: %s", stage_num, stage_name)
        try:
            result = await stage_fn(context)
            context.update(result)  # each stage can pass data to the next
            logger.info("Stage %d passed.", stage_num)
        except Exception as exc:
            logger.error("Stage %d failed: %s", stage_num, exc, exc_info=True)
            await update_request_status(request_id, "draft")
            await notify_generation_failed(
                context.get("request_title", "Unknown"),
                str(exc),
            )
            raise

    # All stages passed.
    await update_request_status(request_id, "review")
    await notify_generation_complete(
        context.get("request_title", "Unknown"),
        context.get("asset_count", 0),
        request_id,
    )
