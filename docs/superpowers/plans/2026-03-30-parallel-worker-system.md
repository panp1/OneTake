# Parallel Worker System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a supervisor process that reactively spawns parallel worker subprocesses, each with its own NIM API key, to process multiple campaigns simultaneously.

**Architecture:** Supervisor reads `worker_config.json`, polls Neon for pending job count, spawns/kills workers based on demand. Workers claim jobs atomically via `FOR UPDATE SKIP LOCKED`. Each worker loads a different `.env.workerN` file with a unique NIM key.

**Tech Stack:** Python 3.13, asyncio, multiprocessing, asyncpg, Neon Postgres

---

### Task 1: Database — Add worker_id column

**Files:**
- Modify: `worker/neon_client.py`
- Modify: `src/lib/db/schema.ts:219`

- [ ] **Step 1: Add worker_id column to compute_jobs via migration**

```python
# Run this one-time migration
import asyncio, asyncpg
from config import DATABASE_URL

async def migrate():
    conn = await asyncpg.connect(DATABASE_URL)
    await conn.execute("ALTER TABLE compute_jobs ADD COLUMN IF NOT EXISTS worker_id TEXT")
    await conn.execute("CREATE INDEX IF NOT EXISTS idx_compute_jobs_worker ON compute_jobs(worker_id) WHERE status = 'processing'")
    print("Migration complete: worker_id column + index added")
    await conn.close()

asyncio.run(migrate())
```

Run: `cd worker && python3.13 -c "<above code>"`
Expected: `Migration complete: worker_id column + index added`

- [ ] **Step 2: Update schema.ts to reflect the new column**

In `src/lib/db/schema.ts`, after line 219 (`job_type` line), add:

```typescript
      worker_id       TEXT,
```

- [ ] **Step 3: Commit**

```bash
git add worker/neon_client.py src/lib/db/schema.ts
git commit -m "feat: add worker_id column to compute_jobs for parallel workers"
```

---

### Task 2: Atomic Job Claiming — claim_next_job()

**Files:**
- Modify: `worker/neon_client.py:51-65`

- [ ] **Step 1: Add claim_next_job() function to neon_client.py**

Add after the `fetch_pending_jobs` function (keep `fetch_pending_jobs` for backward compat):

```python
async def claim_next_job(worker_id: str) -> dict[str, Any] | None:
    """Atomically claim the next pending job for this worker.

    Uses FOR UPDATE SKIP LOCKED to guarantee no two workers
    ever claim the same job, even when polling simultaneously.

    Returns the claimed job dict, or None if no pending jobs exist.
    """
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
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
            """,
            worker_id,
        )
    if row is None:
        return None
    return _row_to_dict(row)


async def count_pending_jobs() -> int:
    """Count pending jobs in the queue. Used by supervisor for scaling decisions."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT COUNT(*) as cnt FROM compute_jobs WHERE status = 'pending'"
        )
    return int(row["cnt"]) if row else 0


async def reset_stale_jobs(threshold_minutes: int = 30) -> int:
    """Reset jobs stuck in 'processing' for longer than threshold back to 'pending'.

    Returns number of jobs reset. Called by supervisor on startup.
    """
    pool = await _get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE compute_jobs
            SET status = 'pending', started_at = NULL, worker_id = NULL
            WHERE status = 'processing'
            AND started_at < NOW() - INTERVAL '1 minute' * $1
            """,
            threshold_minutes,
        )
    # result is like "UPDATE 3"
    count = int(result.split()[-1]) if result else 0
    return count
```

- [ ] **Step 2: Verify claim_next_job compiles**

Run: `cd worker && python3.13 -c "from neon_client import claim_next_job, count_pending_jobs, reset_stale_jobs; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/neon_client.py
git commit -m "feat: atomic job claiming with FOR UPDATE SKIP LOCKED"
```

---

### Task 3: Worker Config File

**Files:**
- Create: `worker/worker_config.json`

- [ ] **Step 1: Create worker_config.json**

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

- [ ] **Step 2: Create template env files**

Create `worker/.env.worker1.template`:
```
# Worker 1 — copy to .env.worker1 and fill in your NIM key
NVIDIA_NIM_API_KEY=nvapi-YOUR-KEY-HERE
WORKER_ID=worker-1

# Shared keys (same across all workers)
DATABASE_URL=
BLOB_READ_WRITE_TOKEN=
OPENROUTER_API_KEY=
KLING_ACCESS_KEY=
KLING_SECRET_KEY=
TEAMS_WEBHOOK_URL=
APP_URL=http://localhost:3000
```

- [ ] **Step 3: Add env files to .gitignore**

Append to `worker/.gitignore`:
```
.env.worker*
!.env.worker*.template
logs/
```

- [ ] **Step 4: Commit**

```bash
git add worker/worker_config.json worker/.env.worker1.template worker/.gitignore
git commit -m "feat: worker pool configuration and env templates"
```

---

### Task 4: Config.py — Worker-Aware Env Loading

**Files:**
- Modify: `worker/config.py:1-12`

- [ ] **Step 1: Update config.py to load worker-specific env files**

Replace the top of `config.py`:

```python
"""Configuration for the Centric Intake local worker.

All settings come from environment variables with sensible defaults.
In multi-worker mode, each worker loads its own .env.workerN file
with a unique NIM API key (rate limits are per-key).
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

# Worker identity — set by supervisor or defaults to "worker-0" (dev mode)
WORKER_ID = os.environ.get("WORKER_ID", "worker-0")

# Load worker-specific env file if specified, otherwise default .env
_env_file = os.environ.get("ENV_FILE", ".env")
if os.path.exists(_env_file):
    load_dotenv(_env_file, override=True)
else:
    load_dotenv()  # fall back to default .env
```

- [ ] **Step 2: Verify config still loads in dev mode**

Run: `cd worker && python3.13 -c "from config import WORKER_ID, DATABASE_URL; print(f'Worker: {WORKER_ID}, DB: {DATABASE_URL[:30]}...')"`
Expected: `Worker: worker-0, DB: postgres://...`

- [ ] **Step 3: Commit**

```bash
git add worker/config.py
git commit -m "feat: worker-aware config loading from per-worker env files"
```

---

### Task 5: Worker Entry Point — worker_main()

**Files:**
- Modify: `worker/main.py`

- [ ] **Step 1: Add worker_main() function for supervised mode**

Add this function ABOVE the existing `main()` function in `main.py`:

```python
async def worker_main(worker_id: str, env_file: str):
    """Entry point for a supervised worker subprocess.

    Called by supervisor.py via multiprocessing. Each worker:
    1. Loads its own env file (unique NIM API key)
    2. Claims jobs atomically (FOR UPDATE SKIP LOCKED)
    3. Runs pipeline, then tries to claim another job
    4. Exits cleanly when no more pending jobs (supervisor decides respawn)
    """
    import importlib

    os.environ["WORKER_ID"] = worker_id
    os.environ["ENV_FILE"] = env_file

    # Reload config module with worker-specific env
    import config as _config
    importlib.reload(_config)

    # Setup per-worker logging
    os.makedirs("logs", exist_ok=True)
    log_file = f"logs/{worker_id}.log"
    logging.basicConfig(
        level=logging.INFO,
        format=f"%(asctime)s [{worker_id}] [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_file, mode="a"),
            logging.StreamHandler(sys.stdout),
        ],
        force=True,
    )

    logger.info("Worker %s started (PID=%d, env=%s)", worker_id, os.getpid(), env_file)

    from neon_client import claim_next_job, mark_job_complete, mark_job_failed

    jobs_processed = 0

    try:
        while True:
            job = await claim_next_job(worker_id)

            if job is None:
                logger.info("No pending jobs — worker %s exiting cleanly (%d jobs processed)", worker_id, jobs_processed)
                break

            logger.info(
                "Claimed job %s (type=%s, request=%s)",
                job["id"], job["job_type"], job["request_id"],
            )

            try:
                await run_pipeline(job)
                await mark_job_complete(job["id"])
                jobs_processed += 1
                logger.info("Job %s complete. Total processed: %d", job["id"], jobs_processed)
            except Exception as exc:
                logger.error("Job %s failed: %s", job["id"], exc, exc_info=True)
                await mark_job_failed(job["id"], str(exc))

    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Worker %s received shutdown signal", worker_id)
    except Exception as exc:
        logger.error("Worker %s crashed: %s", worker_id, exc, exc_info=True)
        raise


def run_worker_subprocess(worker_id: str, env_file: str):
    """Multiprocessing target — runs the async worker_main in a new event loop.

    This is what supervisor.py calls via multiprocessing.Process(target=...).
    """
    asyncio.run(worker_main(worker_id, env_file))
```

- [ ] **Step 2: Verify dev mode still works (existing main() unchanged)**

Run: `cd worker && python3.13 -c "from main import run_worker_subprocess; print('Import OK')"`
Expected: `Import OK`

- [ ] **Step 3: Commit**

```bash
git add worker/main.py
git commit -m "feat: add worker_main() entry point for supervised workers"
```

---

### Task 6: Supervisor — Core Process

**Files:**
- Create: `worker/supervisor.py`

- [ ] **Step 1: Create supervisor.py**

```python
"""Supervisor — spawns and manages parallel worker subprocesses.

Reactive scaling: spawns workers based on pending job count.
- 0-1 pending jobs: 1 worker
- 2+ pending jobs: min(pending, max_workers) workers

Each worker gets its own NIM API key via .env.workerN file.
Workers claim jobs atomically (FOR UPDATE SKIP LOCKED).
Supervisor monitors health, restarts crashes, handles shutdown.

Usage:
    cd worker/
    python3.13 supervisor.py
"""
from __future__ import annotations

import asyncio
import json
import logging
import multiprocessing
import os
import signal
import sys
import time
from datetime import datetime
from typing import Any

# Setup supervisor logging BEFORE importing worker modules
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [supervisor] [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("logs/supervisor.log", mode="a"),
        logging.StreamHandler(sys.stdout),
    ],
    force=True,
)
logger = logging.getLogger("supervisor")

# Load base config for DB access
from dotenv import load_dotenv
load_dotenv()


class WorkerState:
    """Tracks the state of a single worker subprocess."""

    def __init__(self, worker_id: str, env_file: str):
        self.worker_id = worker_id
        self.env_file = env_file
        self.process: multiprocessing.Process | None = None
        self.started_at: datetime | None = None
        self.restart_count: int = 0

    @property
    def is_alive(self) -> bool:
        return self.process is not None and self.process.is_alive()

    def spawn(self):
        """Spawn (or respawn) this worker as a subprocess."""
        from main import run_worker_subprocess

        self.process = multiprocessing.Process(
            target=run_worker_subprocess,
            args=(self.worker_id, self.env_file),
            name=self.worker_id,
            daemon=False,
        )
        self.process.start()
        self.started_at = datetime.now()
        logger.info(
            "Spawned %s (PID=%d, env=%s, restarts=%d)",
            self.worker_id, self.process.pid, self.env_file, self.restart_count,
        )

    def terminate(self, timeout: float = 10.0):
        """Gracefully terminate this worker."""
        if self.process and self.process.is_alive():
            logger.info("Terminating %s (PID=%d)", self.worker_id, self.process.pid)
            self.process.terminate()
            self.process.join(timeout=timeout)
            if self.process.is_alive():
                logger.warning("Force-killing %s (PID=%d)", self.worker_id, self.process.pid)
                self.process.kill()
                self.process.join(timeout=5)
        self.process = None
        self.started_at = None


class Supervisor:
    """Manages a pool of worker subprocesses with reactive scaling."""

    def __init__(self, config_path: str = "worker_config.json"):
        with open(config_path) as f:
            self.config = json.load(f)

        self.max_workers: int = self.config["max_workers"]
        self.poll_interval: float = self.config["poll_interval_s"]
        self.health_interval: float = self.config["health_check_interval_s"]
        self.max_restarts: int = self.config["max_restarts_per_worker"]
        self.drain_timeout: float = self.config["drain_timeout_s"]
        self.stale_threshold: int = self.config["stale_job_threshold_minutes"]

        # Build worker pool from config
        self.workers: dict[str, WorkerState] = {}
        for w in self.config["workers"]:
            self.workers[w["id"]] = WorkerState(w["id"], w["env_file"])

        self._shutdown_event = asyncio.Event()
        self._last_health_check = 0.0

    async def start(self):
        """Main supervisor loop."""
        logger.info(
            "Supervisor starting: max_workers=%d, poll=%ds, health=%ds",
            self.max_workers, self.poll_interval, self.health_interval,
        )

        # Setup signal handlers
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda s=sig: asyncio.create_task(self._shutdown(s)))

        # Startup: clean stale jobs
        await self._cleanup_stale_jobs()

        # Main loop
        while not self._shutdown_event.is_set():
            try:
                await self._scaling_cycle()
                await self._health_check_cycle()
            except Exception as e:
                logger.error("Supervisor cycle error: %s", e, exc_info=True)

            try:
                await asyncio.wait_for(
                    self._shutdown_event.wait(),
                    timeout=self.poll_interval,
                )
                break  # Shutdown signal received
            except asyncio.TimeoutError:
                pass  # Normal — just loop again

        await self._drain_all()
        logger.info("Supervisor stopped.")

    async def _scaling_cycle(self):
        """Count pending jobs and adjust worker count."""
        from neon_client import count_pending_jobs

        pending = await count_pending_jobs()
        alive_count = sum(1 for w in self.workers.values() if w.is_alive)

        if pending == 0:
            # Keep 1 warm worker for quick response
            target = 1
        elif pending == 1:
            target = 1
        else:
            target = min(pending, self.max_workers)

        if target > alive_count:
            # Scale up — spawn workers from the pool
            to_spawn = target - alive_count
            available = [
                w for w in self.workers.values()
                if not w.is_alive and w.restart_count < self.max_restarts
            ]
            for w in available[:to_spawn]:
                w.spawn()
                logger.info(
                    "Scaled up: pending=%d, alive=%d→%d",
                    pending, alive_count, alive_count + 1,
                )
                alive_count += 1

        if alive_count > 0 or pending > 0:
            logger.info(
                "Status: pending=%d, alive=%d/%d, target=%d",
                pending, alive_count, self.max_workers, target,
            )

    async def _health_check_cycle(self):
        """Check worker health, restart crashed workers."""
        now = time.time()
        if now - self._last_health_check < self.health_interval:
            return
        self._last_health_check = now

        from neon_client import mark_job_failed

        for wid, state in self.workers.items():
            if state.process is not None and not state.is_alive:
                exit_code = state.process.exitcode
                logger.warning(
                    "Worker %s died (exit_code=%s, restarts=%d/%d)",
                    wid, exit_code, state.restart_count, self.max_restarts,
                )

                # Mark any in-flight job as failed
                try:
                    from neon_client import _get_pool
                    pool = await _get_pool()
                    async with pool.acquire() as conn:
                        row = await conn.fetchrow(
                            """
                            SELECT id::text FROM compute_jobs
                            WHERE worker_id = $1 AND status = 'processing'
                            """,
                            wid,
                        )
                        if row:
                            await mark_job_failed(
                                str(row["id"]),
                                f"Worker {wid} crashed (exit_code={exit_code})",
                            )
                            logger.info("Marked orphaned job %s as failed", row["id"])
                except Exception as e:
                    logger.error("Failed to mark orphaned job: %s", e)

                # Restart if under limit
                state.process = None
                if state.restart_count < self.max_restarts:
                    state.restart_count += 1
                    # Don't restart immediately — let the scaling cycle decide
                    logger.info("Worker %s eligible for restart (count=%d)", wid, state.restart_count)
                else:
                    logger.error("Worker %s exceeded max restarts (%d) — not restarting", wid, self.max_restarts)

    async def _cleanup_stale_jobs(self):
        """Reset jobs stuck in processing (from previous crashed runs)."""
        from neon_client import reset_stale_jobs

        count = await reset_stale_jobs(self.stale_threshold)
        if count > 0:
            logger.info("Reset %d stale jobs back to pending", count)

    async def _shutdown(self, sig):
        """Handle shutdown signal — drain workers gracefully."""
        logger.info("Received signal %s — initiating graceful shutdown", sig)
        self._shutdown_event.set()

    async def _drain_all(self):
        """Terminate all workers with grace period."""
        alive = [w for w in self.workers.values() if w.is_alive]
        if not alive:
            return

        logger.info("Draining %d workers (timeout=%ds)...", len(alive), self.drain_timeout)

        # Send SIGTERM to all
        for w in alive:
            if w.process and w.process.is_alive():
                w.process.terminate()

        # Wait for drain
        deadline = time.time() + self.drain_timeout
        while time.time() < deadline:
            still_alive = [w for w in alive if w.is_alive]
            if not still_alive:
                logger.info("All workers drained cleanly.")
                return
            await asyncio.sleep(1)

        # Force kill stragglers
        for w in alive:
            if w.is_alive:
                logger.warning("Force-killing %s", w.worker_id)
                w.terminate(timeout=5)


async def run_supervisor():
    supervisor = Supervisor()
    await supervisor.start()


if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)
    asyncio.run(run_supervisor())
```

- [ ] **Step 2: Verify supervisor imports and loads config**

Run: `cd worker && python3.13 -c "from supervisor import Supervisor; s = Supervisor(); print(f'Max workers: {s.max_workers}, Workers: {list(s.workers.keys())}')"`
Expected: `Max workers: 5, Workers: ['worker-1', 'worker-2', 'worker-3', 'worker-4', 'worker-5']`

- [ ] **Step 3: Commit**

```bash
git add worker/supervisor.py
git commit -m "feat: supervisor process with reactive scaling, health monitoring, crash recovery"
```

---

### Task 7: Wire Up — Dev Mode Backward Compatibility

**Files:**
- Modify: `worker/main.py`

- [ ] **Step 1: Update main() to use claim_next_job in dev mode too**

Replace the existing `main()` function's inner loop (lines 63-88) with:

```python
    try:
        while True:
            try:
                from neon_client import claim_next_job
                job = await claim_next_job(WORKER_ID)

                if job:
                    logger.info(
                        "Processing job %s (type=%s, request=%s)",
                        job["id"],
                        job["job_type"],
                        job["request_id"],
                    )

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
```

Also add `WORKER_ID` import at top:
```python
from config import POLL_INTERVAL_SECONDS, WORKER_ID
```

And remove `fetch_pending_jobs` and `mark_job_processing` from the imports since they're no longer used in the main loop.

- [ ] **Step 2: Verify dev mode still works**

Run: `cd worker && python3.13 -c "from main import main; print('Dev mode imports OK')"`
Expected: `Dev mode imports OK`

- [ ] **Step 3: Commit**

```bash
git add worker/main.py
git commit -m "feat: dev mode uses atomic claim_next_job, backward compatible"
```

---

### Task 8: Create Worker Env Files

**Files:**
- Create: `worker/.env.worker1` through `worker/.env.worker5`

- [ ] **Step 1: Create env files from the existing .env**

Script to generate worker env files:

```python
"""Generate per-worker env files from the base .env.

Copies all shared keys, sets unique WORKER_ID.
NIM API keys need to be filled in manually with unique keys.
"""
import shutil

for i in range(1, 6):
    src = ".env"
    dst = f".env.worker{i}"
    shutil.copy2(src, dst)

    with open(dst, "a") as f:
        f.write(f"\n# Worker identity\nWORKER_ID=worker-{i}\n")

    print(f"Created {dst}")

print("\nIMPORTANT: Replace NVIDIA_NIM_API_KEY in each file with a unique key!")
```

Run: `cd worker && python3.13 -c "<above script>"`

- [ ] **Step 2: Verify env files exist**

Run: `ls -la worker/.env.worker*`
Expected: 5 files listed

- [ ] **Step 3: Commit (templates only, not actual env files)**

The `.gitignore` from Task 3 already excludes `.env.worker*` files.

---

### Task 9: End-to-End Test — Single Worker via Supervisor

**Files:** No new files — integration test

- [ ] **Step 1: Start supervisor with 1 pending job**

Ensure there's exactly 1 pending job in Neon (the Vega campaign).
Run: `cd worker && python3.13 supervisor.py`

Expected log output:
```
[supervisor] Supervisor starting: max_workers=5, poll=10s, health=30s
[supervisor] Status: pending=1, alive=0/5, target=1
[supervisor] Spawned worker-1 (PID=XXXXX, env=.env.worker1, restarts=0)
[worker-1] Worker worker-1 started (PID=XXXXX, env=.env.worker1)
[worker-1] Claimed job XXXXX (type=generate, request=XXXXX)
```

- [ ] **Step 2: Verify worker exits when no more jobs**

After the job completes:
```
[worker-1] No pending jobs — worker worker-1 exiting cleanly (1 jobs processed)
[supervisor] Status: pending=0, alive=0/5, target=1
```

- [ ] **Step 3: Test campaign splitter → multi-worker spawn**

Submit a multinational RFP (5 countries) → splitter creates 5 child jobs → supervisor should spawn up to 5 workers:

Expected:
```
[supervisor] Status: pending=5, alive=0/5, target=5
[supervisor] Spawned worker-1 ...
[supervisor] Spawned worker-2 ...
[supervisor] Spawned worker-3 ...
[supervisor] Spawned worker-4 ...
[supervisor] Spawned worker-5 ...
```

- [ ] **Step 4: Test graceful shutdown**

Send SIGTERM: `kill -TERM <supervisor_pid>`

Expected:
```
[supervisor] Received signal SIGTERM — initiating graceful shutdown
[supervisor] Draining 5 workers (timeout=300s)...
[supervisor] All workers drained cleanly.
[supervisor] Supervisor stopped.
```

---

### Task 10: Hardening — Stale Jobs, Crash Recovery, Split Idempotency

**Files:**
- Modify: `worker/neon_client.py`
- Modify: `worker/supervisor.py`
- Modify: `worker/pipeline/campaign_splitter.py`

- [ ] **Step 1: Add periodic stale job scan to supervisor health check**

In `supervisor.py`, add to `_health_check_cycle()` after the worker death detection block:

```python
        # Periodic stale job cleanup (not just on startup)
        stale_count = await reset_stale_jobs(self.stale_threshold)
        if stale_count > 0:
            logger.warning("Reset %d stale jobs back to pending (stuck >%dm)", stale_count, self.stale_threshold)
```

- [ ] **Step 2: Crash recovery resets jobs to pending (not failed) with retry protection**

In `supervisor.py` `_health_check_cycle()`, replace the orphaned job handling:

```python
                # Reset orphaned job to pending for retry (not failed)
                # Add retry_count to prevent infinite crash loops on poison jobs
                try:
                    from neon_client import _get_pool
                    pool = await _get_pool()
                    async with pool.acquire() as conn:
                        row = await conn.fetchrow(
                            """
                            UPDATE compute_jobs
                            SET status = CASE
                                WHEN COALESCE((feedback_data->>'crash_retry_count')::int, 0) >= 2
                                THEN 'failed'
                                ELSE 'pending'
                            END,
                            started_at = NULL,
                            worker_id = NULL,
                            error_message = CASE
                                WHEN COALESCE((feedback_data->>'crash_retry_count')::int, 0) >= 2
                                THEN $2
                                ELSE NULL
                            END,
                            feedback_data = jsonb_set(
                                COALESCE(feedback_data, '{}'::jsonb),
                                '{crash_retry_count}',
                                (COALESCE((feedback_data->>'crash_retry_count')::int, 0) + 1)::text::jsonb
                            )
                            WHERE worker_id = $1 AND status = 'processing'
                            RETURNING id::text, status
                            """,
                            wid,
                            f"Worker {wid} crashed {3} times — poison job",
                        )
                        if row:
                            new_status = row["status"]
                            if new_status == "pending":
                                logger.info("Reset orphaned job %s to pending (will be retried)", row["id"])
                            else:
                                logger.error("Marked orphaned job %s as failed (exceeded crash retries)", row["id"])
                except Exception as e:
                    logger.error("Failed to handle orphaned job: %s", e)
```

- [ ] **Step 3: Campaign splitter — wrap in transaction + idempotency check**

In `campaign_splitter.py`, update `split_campaign()`:

```python
    # Idempotency: check if already split
    pool = await _get_pool()
    async with pool.acquire() as conn:
        current_status = await conn.fetchval(
            "SELECT status FROM intake_requests WHERE id = $1::uuid", request_id
        )
        if current_status == "split":
            logger.info("Campaign %s already split — skipping", request_id)
            # Return existing children
            existing = await conn.fetch(
                "SELECT id::text, title FROM intake_requests WHERE form_data->>'parent_request_id' = $1",
                request_id,
            )
            return [{"child_request_id": r["id"], "title": r["title"], "country": ""} for r in existing]
```

And wrap all child inserts in a transaction:

```python
    async with pool.acquire() as conn:
        async with conn.transaction():
            for country, country_region_list in country_regions.items():
                # ... all child insert logic inside the transaction ...
                pass

            # Mark parent as split (inside same transaction)
            await conn.execute(
                "UPDATE intake_requests SET status = 'split' WHERE id = $1::uuid",
                request_id,
            )
    # If any insert fails, the entire transaction rolls back — no orphans
```

- [ ] **Step 4: Add job_id tracking to supervisor worker state**

In `supervisor.py`, add to `_scaling_cycle` after spawn:

```python
# Track which job each worker is processing (for log correlation)
for wid, state in self.workers.items():
    if state.is_alive and not hasattr(state, 'current_job_id'):
        state.current_job_id = None
```

And update `get_status()` to include `current_job_id`.

- [ ] **Step 5: Commit**

```bash
git add worker/neon_client.py worker/supervisor.py worker/pipeline/campaign_splitter.py
git commit -m "feat: hardened stale-job recovery, crash retry with poison protection, split idempotency"
```

---

### Task 11: Failure Scenario Tests

**Files:** No new files — manual test checklist

- [ ] **Step 1: Kill worker mid-pipeline**

While a worker is processing Stage 2 (image generation):
```bash
kill -9 <worker_pid>
```

Expected:
- Supervisor detects dead worker within 30s
- Orphaned job reset to `pending`
- New worker spawns and re-claims the job
- Job completes on second attempt

- [ ] **Step 2: Poison job test**

Insert a job with an invalid request_id that will always crash:
```sql
INSERT INTO compute_jobs (id, request_id, job_type, status)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'generate', 'pending');
```

Expected:
- Worker 1 claims it, crashes
- Supervisor resets to pending, increments crash_retry_count to 1
- Worker 2 claims it, crashes again
- After 3 crashes: job marked as `failed` with "poison job" message
- Workers stop retrying it

- [ ] **Step 3: Duplicate supervisor protection**

Start two supervisors simultaneously:
```bash
python3.13 supervisor.py &
python3.13 supervisor.py &
```

Expected: Both supervisors use `SKIP LOCKED` for job claiming, so workers from different supervisors won't conflict. But scaling logic might over-spawn. Verify no duplicate processing.

- [ ] **Step 4: Campaign splitter re-run idempotency**

Trigger the same multinational RFP twice:
Expected: Second run detects `status = 'split'` and returns existing children without creating duplicates.

- [ ] **Step 5: 5-country parallel run (the real test)**

Submit Vega (5 countries) with all 5 NIM keys configured:
1. Verify splitter creates 5 child jobs
2. Verify supervisor spawns 5 workers
3. Verify all 5 run simultaneously (check timestamps in logs)
4. Verify all 5 complete independently
5. Verify total wall-clock time is ~45min (not 5×45min)
6. Count total assets across all 5 countries

---

### Task 12: Operational Scripts

**Files:**
- Create: `worker/scripts/tail-all.sh`
- Create: `worker/scripts/status.sh`

- [ ] **Step 1: Create combined log tail script**

`worker/scripts/tail-all.sh`:
```bash
#!/bin/bash
# Tail all worker logs + supervisor log simultaneously
# Each line prefixed with the source file for easy filtering
tail -f logs/supervisor.log logs/worker-*.log 2>/dev/null | \
  sed -u 's|==> logs/\(.*\)\.log <==|\n--- \1 ---|'
```

- [ ] **Step 2: Create status check script**

`worker/scripts/status.sh`:
```bash
#!/bin/bash
# Quick status check: pending jobs, active workers, recent errors
echo "=== Pending Jobs ==="
cd "$(dirname "$0")/.."
python3.13 -c "
import asyncio, asyncpg
from config import DATABASE_URL
async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    pending = await conn.fetchval(\"SELECT COUNT(*) FROM compute_jobs WHERE status = 'pending'\")
    processing = await conn.fetchval(\"SELECT COUNT(*) FROM compute_jobs WHERE status = 'processing'\")
    rows = await conn.fetch(\"SELECT worker_id, id::text, request_id::text FROM compute_jobs WHERE status = 'processing' ORDER BY started_at\")
    print(f'Pending: {pending}  Processing: {processing}')
    for r in rows:
        print(f'  {r[\"worker_id\"] or \"?\"}: job={r[\"id\"][:8]}... request={r[\"request_id\"][:8]}...')
    await conn.close()
asyncio.run(main())
"

echo ""
echo "=== Worker Processes ==="
ps aux | grep "main.py\|supervisor.py" | grep -v grep

echo ""
echo "=== Recent Errors (last 5) ==="
grep -h "ERROR\|FAILED\|crashed" logs/*.log 2>/dev/null | tail -5
```

- [ ] **Step 3: Make scripts executable and commit**

```bash
chmod +x worker/scripts/tail-all.sh worker/scripts/status.sh
git add worker/scripts/
git commit -m "feat: operational scripts for log tailing and status checking"
```

---

### Task 13: Monitoring — Supervisor Status Method

**Files:**
- Modify: `worker/supervisor.py` (add status method)

- [ ] **Step 1: Add get_status() to Supervisor class**

```python
def get_status(self) -> dict[str, Any]:
    """Return current supervisor state for monitoring."""
    return {
        "max_workers": self.max_workers,
        "workers": {
            wid: {
                "alive": state.is_alive,
                "pid": state.process.pid if state.process else None,
                "started_at": state.started_at.isoformat() if state.started_at else None,
                "restart_count": state.restart_count,
            }
            for wid, state in self.workers.items()
        },
        "alive_count": sum(1 for w in self.workers.values() if w.is_alive),
    }
```

- [ ] **Step 2: Log status summary periodically**

In `_scaling_cycle`, the existing `logger.info("Status: ...")` line already covers this.

- [ ] **Step 3: Commit**

```bash
git add worker/supervisor.py
git commit -m "feat: supervisor monitoring status endpoint"
```
