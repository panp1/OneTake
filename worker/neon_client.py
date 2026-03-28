"""Neon Postgres client for the Centric Intake local worker.

Uses asyncpg with connection pooling. Every public function acquires a
connection from the pool, executes one or more queries, and releases it.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import asyncpg

from config import DATABASE_URL

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def _get_pool() -> asyncpg.Pool:
    """Lazily create and return a connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=5,
            statement_cache_size=0,  # Neon serverless works better without
        )
        logger.info("Connection pool created.")
    return _pool


def _row_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    """Convert an asyncpg Record to a plain dict, serialising JSON columns."""
    d: dict[str, Any] = dict(row)
    for key, val in d.items():
        if isinstance(val, str):
            try:
                d[key] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                pass
    return d


# ---------------------------------------------------------------------------
# Compute jobs
# ---------------------------------------------------------------------------

async def fetch_pending_jobs() -> list[dict[str, Any]]:
    """Fetch up to 5 pending compute jobs, oldest first."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, request_id, job_type, stage_target, feedback,
                   created_at
            FROM compute_jobs
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 5
            """,
        )
    return [_row_to_dict(r) for r in rows]


async def mark_job_processing(job_id: str) -> None:
    """Mark a compute job as processing."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE compute_jobs
            SET status = 'processing', started_at = NOW()
            WHERE id = $1
            """,
            job_id,
        )


async def mark_job_complete(job_id: str) -> None:
    """Mark a compute job as complete."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE compute_jobs
            SET status = 'complete', completed_at = NOW()
            WHERE id = $1
            """,
            job_id,
        )


async def mark_job_failed(job_id: str, error: str) -> None:
    """Mark a compute job as failed with an error message."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE compute_jobs
            SET status = 'failed',
                error_message = $2,
                completed_at = NOW()
            WHERE id = $1
            """,
            job_id,
            error,
        )


# ---------------------------------------------------------------------------
# Intake requests
# ---------------------------------------------------------------------------

async def get_intake_request(request_id: str) -> dict[str, Any]:
    """Read an intake request by ID."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, title, status, task_type,
                   target_languages, target_regions,
                   volume_needed, form_data,
                   created_at, updated_at
            FROM intake_requests
            WHERE id = $1
            """,
            request_id,
        )
    if row is None:
        raise ValueError(f"Intake request {request_id} not found")
    return _row_to_dict(row)


async def update_request_status(request_id: str, status: str) -> None:
    """Update the status of an intake request."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE intake_requests
            SET status = $2, updated_at = NOW()
            WHERE id = $1
            """,
            request_id,
            status,
        )


# ---------------------------------------------------------------------------
# Creative briefs
# ---------------------------------------------------------------------------

async def get_brief(request_id: str) -> dict[str, Any] | None:
    """Read the latest creative brief for a request."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id, request_id, brief_data, design_direction,
                   evaluation_score, evaluation_data, content_languages,
                   created_at
            FROM creative_briefs
            WHERE request_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            request_id,
        )
    return _row_to_dict(row) if row else None


async def save_brief(request_id: str, data: dict[str, Any]) -> str:
    """Insert a creative brief and return its ID."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO creative_briefs
                (request_id, brief_data, design_direction,
                 evaluation_score, evaluation_data, content_languages)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            """,
            request_id,
            json.dumps(data.get("brief_data", {})),
            json.dumps(data.get("design_direction", {})),
            data.get("evaluation_score", 0.0),
            json.dumps(data.get("evaluation_data", {})),
            json.dumps(data.get("content_languages", [])),
        )
    brief_id: str = row["id"]
    logger.info("Saved creative brief %s for request %s", brief_id, request_id)
    return brief_id


# ---------------------------------------------------------------------------
# Actor profiles
# ---------------------------------------------------------------------------

async def save_actor(request_id: str, data: dict[str, Any]) -> str:
    """Insert an actor profile and return its ID."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO actor_profiles
                (request_id, actor_name, actor_data, image_prompt,
                 region, language)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            """,
            request_id,
            data.get("actor_name", "Contributor"),
            json.dumps(data.get("actor_data", {})),
            data.get("image_prompt", ""),
            data.get("region", ""),
            data.get("language", ""),
        )
    return row["id"]


async def get_actors(request_id: str) -> list[dict[str, Any]]:
    """Read all actor profiles for a request."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, request_id, actor_name, actor_data,
                   image_prompt, region, language, created_at
            FROM actor_profiles
            WHERE request_id = $1
            ORDER BY created_at ASC
            """,
            request_id,
        )
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Generated assets
# ---------------------------------------------------------------------------

async def save_asset(request_id: str, data: dict[str, Any]) -> str:
    """Insert a generated asset and return its ID."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO generated_assets
                (request_id, asset_type, platform, format,
                 language, blob_url, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            """,
            request_id,
            data.get("asset_type", "image"),
            data.get("platform", ""),
            data.get("format", ""),
            data.get("language", ""),
            data.get("blob_url", ""),
            json.dumps(data.get("metadata", {})),
        )
    return row["id"]


async def get_assets(request_id: str, asset_type: str | None = None) -> list[dict[str, Any]]:
    """Read generated assets for a request, optionally filtered by type."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        if asset_type:
            rows = await conn.fetch(
                """
                SELECT id, request_id, asset_type, platform, format,
                       language, blob_url, metadata, created_at
                FROM generated_assets
                WHERE request_id = $1 AND asset_type = $2
                ORDER BY created_at ASC
                """,
                request_id,
                asset_type,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, request_id, asset_type, platform, format,
                       language, blob_url, metadata, created_at
                FROM generated_assets
                WHERE request_id = $1
                ORDER BY created_at ASC
                """,
                request_id,
            )
    return [_row_to_dict(r) for r in rows]
