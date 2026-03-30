# Parallel Worker System — Design Spec

**Date:** 2026-03-30
**Author:** Steven Junop + Claude
**Status:** Approved, ready for implementation
**Target:** April 6, 2026 (Day 1 at Centific)

## Problem

The Creative OS pipeline takes ~45 minutes per campaign. When a multinational RFP is split into 5 country campaigns (or multiple RFPs are submitted), serial execution takes 3-5 hours. This is unacceptable for a team that needs results in 30 minutes.

## Solution

A supervisor process that reactively spawns worker subprocesses based on demand. Each worker has its own NIM API key (the rate-limit bottleneck), claims jobs atomically from Neon, and runs the full pipeline independently.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Supervisor (supervisor.py)          │
│  - Reactive scaling (spawn on demand)           │
│  - Health monitoring (heartbeat every 30s)      │
│  - Crash recovery (restart + mark job failed)   │
│  - Graceful shutdown (SIGTERM → drain → exit)   │
│  - Stale job cleanup on startup                 │
└──────────────────┬──────────────────────────────┘
                   │ multiprocessing.Process
       ┌───────────┼───────────┬───────────┐
       │           │           │           │
  ┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
  │Worker 1 │ │Worker 2 │ │Worker 3 │ │Worker N │
  │.env.w1  │ │.env.w2  │ │.env.w3  │ │.env.wN  │
  │NIM key A│ │NIM key B│ │NIM key C│ │NIM key N│
  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
       │           │           │           │
       └───────────┴─────┬─────┴───────────┘
                         │
              ┌──────────▼──────────┐
              │   Neon (Job Queue)  │
              │  claim_next_job()   │
              │  FOR UPDATE         │
              │  SKIP LOCKED        │
              └─────────────────────┘
```

## Spawn Rules (Reactive, Not Always-On)

Workers are spawned ONLY when there's work to do. Two triggers:

1. **Campaign splitter fires** — multinational RFP split into N child jobs
2. **Multiple RFPs submitted** — N independent intake requests queued

```
pending_jobs = 0  → 1 warm worker (idle polling)
pending_jobs = 1  → 1 worker
pending_jobs >= 2 → min(pending_jobs, max_workers) workers
```

Scale-down: workers exit after finishing their job if no more pending jobs exist. Supervisor doesn't restart idle workers.

## Components

### 1. Atomic Job Claiming (neon_client.py)

Replace `fetch_pending_jobs()` + `mark_job_processing()` with a single atomic operation:

```sql
UPDATE compute_jobs
SET status = 'processing',
    started_at = NOW(),
    worker_id = $1
WHERE id = (
    SELECT id FROM compute_jobs
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
RETURNING id, request_id, job_type, stage_target, feedback, created_at
```

`FOR UPDATE SKIP LOCKED` guarantees two workers polling simultaneously will NEVER grab the same job. This is the foundation — everything else is built on this guarantee.

Add `worker_id TEXT` column to `compute_jobs` table for debugging/monitoring.

### 2. Worker Identity (config.py)

Each worker loads its own env file based on `WORKER_ID`:

```python
# config.py changes
WORKER_ID = os.environ.get("WORKER_ID", "worker-0")
env_file = os.environ.get("ENV_FILE", ".env")
load_dotenv(env_file)
```

The env file provides the worker-specific NIM API key:
```
# .env.worker1
NVIDIA_NIM_API_KEY=nvapi-key-aaaa-1111
OPENROUTER_API_KEY=sk-or-shared-key  # shared across workers (higher limits)
WORKER_ID=worker-1
```

Shared across all workers (same key is fine):
- `DATABASE_URL` — Neon (connection pooled)
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob (stateless)
- `OPENROUTER_API_KEY` — OpenRouter (high rate limits)
- `KLING_ACCESS_KEY` / `KLING_SECRET_KEY` — Kling (JWT auth)
- `TEAMS_WEBHOOK_URL` — Teams notifications

Different per worker:
- `NVIDIA_NIM_API_KEY` — NIM (rate limited per key)
- `WORKER_ID` — identity for logs and job claiming

### 3. Worker Config (worker_config.json)

```json
{
  "max_workers": 5,
  "workers": [
    {"id": "worker-1", "env_file": ".env.worker1"},
    {"id": "worker-2", "env_file": ".env.worker2"},
    {"id": "worker-3", "env_file": ".env.worker3"},
    {"id": "worker-4", "env_file": ".env.worker4"},
    {"id": "worker-5", "env_file": ".env.worker5"}
  ],
  "poll_interval_s": 10,
  "health_check_interval_s": 30,
  "max_restarts_per_worker": 3,
  "drain_timeout_s": 300,
  "stale_job_threshold_minutes": 30
}
```

### 4. Supervisor (supervisor.py)

Responsibilities:
- **Startup:** Read `worker_config.json`, scan for stale `processing` jobs (>30min) and reset to `pending`
- **Poll loop:** Every 10s, count pending jobs, decide how many workers needed
- **Spawn:** Launch worker as `multiprocessing.Process` with target `worker_main(worker_id, env_file)`
- **Health check:** Every 30s, verify each worker PID is alive via `process.is_alive()`
- **Crash recovery:** If worker dead + had a job in `processing` with its `worker_id`, mark that job `failed` and restart worker (up to `max_restarts_per_worker`)
- **Scale down:** When a worker finishes and no pending jobs, let it exit (don't restart)
- **Graceful shutdown:** On SIGTERM/SIGINT, send SIGTERM to all workers, wait up to `drain_timeout_s` for them to finish current job, then force-kill

Supervisor state:
```python
{
    "workers": {
        "worker-1": {"process": Process, "started_at": datetime, "restart_count": 0, "current_job_id": str | None},
        "worker-2": {...},
    }
}
```

### 5. Worker Main Loop (main.py modifications)

```python
async def worker_main(worker_id: str, env_file: str):
    """Entry point for a supervised worker subprocess."""
    os.environ["WORKER_ID"] = worker_id
    os.environ["ENV_FILE"] = env_file

    # Reload config with worker-specific env
    importlib.reload(config)

    # Setup logging to worker-specific file
    setup_logging(f"logs/{worker_id}.log")

    while True:
        job = await claim_next_job(worker_id)
        if job is None:
            # No work — exit cleanly (supervisor decides whether to restart)
            break

        try:
            await run_pipeline(job)
            await mark_job_complete(job["id"])
        except Exception as exc:
            await mark_job_failed(job["id"], str(exc))

    # Worker exits — supervisor will respawn if more jobs arrive
```

Key differences from today:
- Worker tries to claim another job immediately after finishing one (greedy — keep working if work exists)
- If no pending jobs, worker exits cleanly (supervisor decides whether to restart)
- Supervisor handles the scaling decisions, not the worker

### 6. Per-Worker Logging

```
worker/logs/
├── supervisor.log    # spawn/kill/health events
├── worker-1.log      # full pipeline output for worker 1
├── worker-2.log      # full pipeline output for worker 2
├── worker-3.log
├── worker-4.log
└── worker-5.log
```

Each worker logs to its own file. Supervisor logs spawn/kill/health events to `supervisor.log`.

### 7. Database Changes

Add `worker_id` column to `compute_jobs`:
```sql
ALTER TABLE compute_jobs ADD COLUMN worker_id TEXT;
CREATE INDEX idx_compute_jobs_worker ON compute_jobs(worker_id) WHERE status = 'processing';
```

### 8. Dev Mode (backwards compatible)

Running `python3.13 main.py` directly (no supervisor) still works as today — single worker, loads `.env`, polls for jobs. The supervisor is an opt-in upgrade:

```bash
# Dev (single worker, today's behavior)
python3.13 main.py

# Production (supervised pool, reactive scaling)
python3.13 supervisor.py
```

## Error Recovery Matrix

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Worker crashes mid-job | `process.is_alive()` returns False | Mark job `failed`, restart worker (up to 3x) |
| Worker hangs (stuck >30min) | Stale job scan on supervisor startup + periodic | Reset job to `pending`, kill worker, restart |
| NIM 429 rate limit | Worker's existing cascade (GLM5 → Kimi → OpenRouter) | Per-worker key = per-worker rate bucket |
| Neon connection failure | Worker exception handler | Worker exits, supervisor restarts |
| All workers crash | Supervisor health check finds 0 alive | Respawn all from config |
| Supervisor itself crashes | systemd/launchd service monitor | Auto-restart supervisor, which restarts workers |

## Timeline

| Date | Milestone |
|------|-----------|
| Mar 31 | Implement `claim_next_job()` with SKIP LOCKED |
| Apr 1 | Build `supervisor.py` with spawn/health/restart |
| Apr 2 | Per-worker env files, logging, config |
| Apr 3 | Campaign splitter integration (split triggers multi-spawn) |
| Apr 4 | End-to-end test: Vega (5 countries) → 5 workers → parallel |
| Apr 5 | Stress test, edge cases, monitoring dashboard |
| Apr 6 | Day 1 at Centific — ship it |

## File Changes

| File | Change |
|------|--------|
| `supervisor.py` | **NEW** — supervisor process |
| `worker_config.json` | **NEW** — pool configuration |
| `main.py` | Add `worker_main()` entry point, accept WORKER_ID |
| `neon_client.py` | Add `claim_next_job()` with FOR UPDATE SKIP LOCKED |
| `config.py` | Load from worker-specific env file |
| `.env.worker1` through `.env.worker5` | **NEW** — per-worker NIM keys |
| DB migration | Add `worker_id` column to `compute_jobs` |

## What This Enables

```
Before:
  Vega (5 countries) → serial → 45min × 5 = 3.75 hours

After:
  Vega (5 countries) → split → 5 parallel workers → 45 min total

  3 RFPs submitted at once → 3 parallel workers → all done in ~45 min

  Peak: 5 campaigns simultaneously → 5 workers → agency output in under an hour
```

One intake form → campaign splitter → parallel workers → 1,100+ assets per country → all countries done in 45 minutes. That's the Day 1 weapon.
