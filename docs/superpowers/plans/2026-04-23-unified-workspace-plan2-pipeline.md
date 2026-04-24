# Unified Campaign Workspace — Plan 2: Pipeline Orchestration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the campaign splitter with a country job creator that produces per-country compute_jobs on a single intake_request. Each country job runs the full pipeline independently, writing country-tagged actors and assets. When all country jobs complete, the campaign moves to 'review'.

**Architecture:** New `country_job_creator.py` creates N compute_jobs (one per country quota). Orchestrator routes `generate_country` jobs through the same Stage 1-4 pipeline but with country context injected. Each stage writes the `country` column on actors/assets. Worker status rollup checks all country jobs on completion.

**Tech Stack:** Python 3, asyncpg (Neon), NIM inference

**Depends on:** Plan 1 (Schema) must be complete — country columns and `generate_country` job type must exist.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `worker/pipeline/country_job_creator.py` | Create | Create per-country compute_jobs from country_quotas, apply persona scaling |
| `worker/pipeline/orchestrator.py` | Modify | Replace campaign_splitter with country_job_creator, handle `generate_country` job type |
| `worker/pipeline/stage1_intelligence.py` | Modify | Read persona_count from job, write country to actor_profiles |
| `worker/pipeline/stage2_images.py` | Modify | Read actors_per_persona from job, write country to generated_assets |
| `worker/pipeline/stage3_copy.py` | Modify | Write country to generated_assets |
| `worker/pipeline/stage4_compose_v3.py` | Modify | Write country to generated_assets |
| `worker/neon_client.py` | Modify | Add helper to check all country jobs complete + update request status |

---

### Task 1: Create country_job_creator.py

**Files:**
- Create: `worker/pipeline/country_job_creator.py`

- [ ] **Step 1: Create the module**

```python
"""Country Job Creator — replaces campaign_splitter.

Instead of creating child intake_requests, creates per-country
compute_jobs on the SAME intake_request. Each job runs the full
pipeline for one country.
"""
from __future__ import annotations

import json
import logging
import uuid

logger = logging.getLogger(__name__)

# Persona/actor scaling by country count.
PERSONA_SCALING = {
    1: {"personas": 2, "actors_per_persona": 2},
    2: {"personas": 2, "actors_per_persona": 2},
}
PERSONA_SCALING_DEFAULT = {"personas": 1, "actors_per_persona": 1}


def get_persona_scaling(country_count: int) -> dict:
    """Return persona/actor counts for a given number of target countries."""
    return PERSONA_SCALING.get(country_count, PERSONA_SCALING_DEFAULT)


def has_country_quotas(request: dict) -> bool:
    """Check if an intake request has structured country quotas."""
    quotas = request.get("form_data", {}).get("country_quotas", [])
    return isinstance(quotas, list) and len(quotas) >= 1


async def create_country_jobs(request: dict, request_id: str) -> list[dict]:
    """Create per-country compute_jobs for a multi-country campaign.

    Parameters
    ----------
    request : dict
        The intake request from Neon.
    request_id : str
        The intake request ID (same for all country jobs).

    Returns
    -------
    list[dict]
        List of created job dicts with job_id and country.
    """
    from neon_client import _get_pool

    quotas = request["form_data"]["country_quotas"]
    country_count = len(quotas)
    scaling = get_persona_scaling(country_count)

    logger.info(
        "Creating %d country jobs for campaign '%s' (scaling: %d personas, %d actors/persona)",
        country_count,
        request.get("title", "Untitled"),
        scaling["personas"],
        scaling["actors_per_persona"],
    )

    pool = await _get_pool()
    jobs = []

    for quota in quotas:
        if not isinstance(quota, dict) or not quota.get("country"):
            logger.warning("Skipping invalid quota entry: %s", quota)
            continue

        job_id = str(uuid.uuid4())
        country = quota["country"]

        feedback_data = {
            "persona_count": scaling["personas"],
            "actors_per_persona": scaling["actors_per_persona"],
            "total_volume": quota.get("total_volume", 0),
            "rate": quota.get("rate", 0),
            "currency": quota.get("currency", "USD"),
            "demographics": quota.get("demographics", []),
            "locale": quota.get("locale", ""),
        }

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO compute_jobs (id, request_id, job_type, country, status, feedback_data, created_at)
                VALUES ($1::uuid, $2::uuid, 'generate_country', $3, 'pending', $4::jsonb, NOW())
                """,
                job_id,
                request_id,
                country,
                json.dumps(feedback_data),
            )

        jobs.append({"job_id": job_id, "country": country})
        logger.info("  Created job for %s (volume=%d, rate=$%.2f)", country, quota.get("total_volume", 0), quota.get("rate", 0))

    logger.info("Country job creation complete: %d jobs queued", len(jobs))
    return jobs
```

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.country_job_creator; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/country_job_creator.py
git commit -m "feat: add country_job_creator — replaces campaign_splitter for unified campaigns"
```

---

### Task 2: Add status rollup helper to neon_client

**Files:**
- Modify: `worker/neon_client.py`

- [ ] **Step 1: Add check_all_country_jobs_complete function**

Add at the end of `neon_client.py`:

```python
async def check_all_country_jobs_complete(request_id: str) -> bool:
    """Check if all generate_country jobs for a request are complete.

    Returns True if every generate_country job has status='complete'.
    Returns False if any are still pending/processing, or if there are no country jobs.
    """
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'complete') AS done
            FROM compute_jobs
            WHERE request_id = $1::uuid AND job_type = 'generate_country'
            """,
            request_id,
        )
    if row is None or row["total"] == 0:
        return False
    return row["done"] == row["total"]
```

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import neon_client; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/neon_client.py
git commit -m "feat: add check_all_country_jobs_complete helper for status rollup"
```

---

### Task 3: Update orchestrator to use country_job_creator

**Files:**
- Modify: `worker/pipeline/orchestrator.py:40-57`

- [ ] **Step 1: Replace campaign_splitter with country_job_creator**

Replace the campaign splitter block (lines 40-57):

```python
    # ── Campaign Splitter: check if multinational RFP needs splitting ──
    # If 3+ countries, split into per-country child campaigns.
    # Each child gets its own pipeline run with city-level targeting.
    if job_type == "generate":
        from neon_client import get_intake_request as _get_request

        from pipeline.campaign_splitter import should_split, split_campaign
        request = await _get_request(request_id)
        if await should_split(request):
            logger.info("Multinational campaign detected — splitting into per-country campaigns")
            children = await split_campaign(request, request_id)
            logger.info(
                "Split complete: %d child campaigns. Parent job done. "
                "Children will be picked up on next poll cycle.",
                len(children),
            )
            # Mark parent job as complete (children are independent jobs)
            return
```

With:

```python
    # ── Country Job Creator: create per-country jobs on the SAME request ──
    # If country_quotas exist, create one compute_job per country.
    # Each country job runs the full pipeline independently.
    if job_type == "generate":
        from neon_client import get_intake_request as _get_request

        from pipeline.country_job_creator import has_country_quotas, create_country_jobs
        request = await _get_request(request_id)
        if has_country_quotas(request):
            logger.info("Multi-country campaign detected — creating per-country jobs")
            country_jobs = await create_country_jobs(request, request_id)
            logger.info(
                "Created %d country jobs. Parent job done. "
                "Country jobs will be picked up on next poll cycle.",
                len(country_jobs),
            )
            return

    # ── Country Job: inject country context into pipeline ──
    if job_type == "generate_country":
        from neon_client import get_intake_request as _get_request
        request = await _get_request(request_id)
        country = job.get("country", "")
        feedback_data = job.get("feedback_data", {})
        if isinstance(feedback_data, str):
            import json as _json
            feedback_data = _json.loads(feedback_data)

        # Inject country + scaling into context so stages can read it
        context["country"] = country
        context["persona_count"] = feedback_data.get("persona_count", 2)
        context["actors_per_persona"] = feedback_data.get("actors_per_persona", 2)
        context["country_quota"] = feedback_data
        # Override target_regions to just this country
        context["target_regions"] = [country]
        context["form_data"] = request.get("form_data", {})
        logger.info("Running pipeline for country: %s (personas=%d, actors=%d)",
                     country, context["persona_count"], context["actors_per_persona"])
```

- [ ] **Step 2: Update the post-pipeline status rollup**

Find the line `await update_request_status(request_id, "review")` at the end of `run_pipeline()` (around line 157). Replace it with:

```python
    # Status rollup: for country jobs, only move to 'review' when ALL countries are done
    if job_type == "generate_country":
        from neon_client import check_all_country_jobs_complete
        if await check_all_country_jobs_complete(request_id):
            await update_request_status(request_id, "review")
            await notify_generation_complete(context.get("request_title", "Unknown"))
            logger.info("All country jobs complete — campaign moved to 'review'")
        else:
            logger.info("Country job done, but other countries still processing")
    else:
        await update_request_status(request_id, "review")
        await notify_generation_complete(context.get("request_title", "Unknown"))
```

- [ ] **Step 3: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.orchestrator; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/orchestrator.py
git commit -m "feat: replace campaign_splitter with country_job_creator in orchestrator"
```

---

### Task 4: Update Stage 1 — persona_count + country tagging

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Read persona_count from context**

Find where `_generate_personas_dynamic` is called (around line 161). Before that call, add:

```python
    persona_count = context.get("persona_count", 2)
    country = context.get("country")
```

Pass `persona_count` to the function call:

```python
    personas = await _generate_personas_dynamic(
        request,
        cultural_research,
        persona_constraints={},
        persona_count=persona_count,
    )
```

- [ ] **Step 2: Update _generate_personas_dynamic signature and cap**

Update the function signature (line 602) to accept `persona_count`:

```python
async def _generate_personas_dynamic(
    request: dict,
    cultural_research: dict | None,
    persona_constraints: dict,
    persona_count: int = 2,
) -> list[dict]:
```

Update the return cap (line 650) from `return personas[:3]` to:

```python
    return personas[:persona_count]
```

- [ ] **Step 3: Write country to actor_profiles**

Find where actor stubs are saved (the `INSERT INTO actor_profiles` or `neon_client` call for saving actors). Add the `country` field. The specific location is where `persona["actor_id"] = actor_id` is set (around line 198). Update the insert to include `country`:

In the actor stub creation block, ensure the country from context is passed to the actor insert. Find the SQL insert or neon_client call and add `country` to the columns and values.

- [ ] **Step 4: Also pass persona_count to retry calls**

Find the retry loop (around line 503) and update the `_generate_personas_dynamic` call:

```python
                personas = await _generate_personas_dynamic(
                    request,
                    cultural_research,
                    persona_constraints=persona_constraints,
                    persona_count=persona_count,
                )
```

- [ ] **Step 5: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.stage1_intelligence; print('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add worker/pipeline/stage1_intelligence.py
git commit -m "feat: stage1 reads persona_count from context, writes country to actors"
```

---

### Task 5: Update Stage 2 — actors_per_persona + country tagging

**Files:**
- Modify: `worker/pipeline/stage2_images.py`

- [ ] **Step 1: Read actors_per_persona and country from context**

At the start of the main stage 2 function, add:

```python
    actors_per_persona = context.get("actors_per_persona", 2)
    country = context.get("country")
```

Use `actors_per_persona` wherever the number of actors to generate per persona is determined (replace any hardcoded count).

- [ ] **Step 2: Write country to generated_assets**

Find all `INSERT INTO generated_assets` statements or neon_client calls that save images. Add `country` to the column list and pass the `country` value.

- [ ] **Step 3: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.stage2_images; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/stage2_images.py
git commit -m "feat: stage2 reads actors_per_persona from context, writes country to assets"
```

---

### Task 6: Update Stage 3 — country tagging on copy assets

**Files:**
- Modify: `worker/pipeline/stage3_copy.py`

- [ ] **Step 1: Read country from context and write to copy assets**

At the start of the main stage 3 function, add:

```python
    country = context.get("country")
```

Find all `INSERT INTO generated_assets` statements where `asset_type='copy'` and add `country` to the column list.

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.stage3_copy; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage3_copy.py
git commit -m "feat: stage3 writes country to copy assets"
```

---

### Task 7: Update Stage 4 — country tagging on composed creatives

**Files:**
- Modify: `worker/pipeline/stage4_compose_v3.py`

- [ ] **Step 1: Read country from context and write to composition assets**

At the start of the main stage 4 function, add:

```python
    country = context.get("country")
```

Find all `INSERT INTO generated_assets` statements where `asset_type='composed_creative'` and add `country` to the column list.

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.stage4_compose_v3; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage4_compose_v3.py
git commit -m "feat: stage4 writes country to composed creatives"
```

---

### Task 8: End-to-end pipeline test

- [ ] **Step 1: Start the worker**

```bash
cd /Users/stevenjunop/centric-intake/worker && python3 main.py &
```

- [ ] **Step 2: Create a test intake with country_quotas**

Submit an intake via the dev server (`http://localhost:3003`) with:
- 3+ target regions (e.g., Morocco, France, Germany)
- Country quotas filled in (volume + rate per country)

- [ ] **Step 3: Verify country jobs created**

```bash
psql $DATABASE_URL -c "SELECT id, job_type, country, status FROM compute_jobs WHERE job_type = 'generate_country' ORDER BY created_at DESC LIMIT 10"
```

Expected: 3 rows with `generate_country` job type, one per country, status `pending`

- [ ] **Step 4: Verify country-tagged assets after completion**

After jobs complete:

```bash
psql $DATABASE_URL -c "SELECT country, asset_type, COUNT(*) FROM generated_assets WHERE request_id = '<request_id>' GROUP BY country, asset_type ORDER BY country"
```

Expected: Assets grouped by country with non-null country values

- [ ] **Step 5: Verify status rollup**

```bash
psql $DATABASE_URL -c "SELECT status FROM intake_requests WHERE id = '<request_id>'"
```

Expected: `review` (only after all country jobs complete)

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: pipeline end-to-end test fixes for country jobs"
```
