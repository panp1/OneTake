"""Local compute worker for Centric Intake App.

Polls Neon for pending compute_jobs, runs Creative OS pipeline locally,
posts results back to Neon. All AI inference runs on Apple Silicon via MLX.

Usage:
    cd worker/
    pip install -r requirements.txt
    python main.py
"""
import asyncio
import logging

from config import POLL_INTERVAL_SECONDS
from neon_client import (
    fetch_pending_jobs,
    mark_job_complete,
    mark_job_failed,
    mark_job_processing,
)
from pipeline.orchestrator import run_pipeline

logger = logging.getLogger(__name__)


async def main():
    """Run the polling loop forever."""
    logger.info(
        "Centric local worker started. Polling every %ds.",
        POLL_INTERVAL_SECONDS,
    )

    while True:
        try:
            jobs = await fetch_pending_jobs()

            for job in jobs:
                logger.info(
                    "Processing job %s (type=%s, request=%s)",
                    job["id"],
                    job["job_type"],
                    job["request_id"],
                )
                await mark_job_processing(job["id"])

                try:
                    await run_pipeline(job)
                    await mark_job_complete(job["id"])
                    logger.info("Job %s complete.", job["id"])
                except Exception as exc:
                    logger.error("Job %s failed: %s", job["id"], exc, exc_info=True)
                    await mark_job_failed(job["id"], str(exc))

        except Exception as exc:
            logger.error("Poll cycle error: %s", exc, exc_info=True)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    asyncio.run(main())
