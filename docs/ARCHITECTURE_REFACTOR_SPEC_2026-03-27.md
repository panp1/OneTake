# Centric Intake App — Architecture Refactor Spec

**Date:** 2026-03-27
**Status:** Approved
**Reason:** Current implementation calls VYRA via HTTP (localhost:8000). Correct architecture uses Neon as message bus between Vercel frontend and local Mac compute worker.

---

## 1. Current State (Wrong)

```
Vercel App ──HTTP──> VYRA at localhost:8000
  ├── Tight coupling (Vercel needs VYRA running)
  ├── Mock fallbacks when VYRA unavailable (89 mock references)
  ├── Can't deploy Vercel independently
  └── Not the agreed architecture
```

## 2. Target State (Correct)

```
┌──────────────────────────────────────┐     ┌───────────────────────────────┐
│  VERCEL (Cloud)                       │     │  STEVEN'S MAC (Local)         │
│                                       │     │                               │
│  Recruiter Portal                     │     │  Local Worker (Python)        │
│  ├── Upload RFP                       │     │  ├── Polls Neon for jobs      │
│  ├── K2.5 summarizes (OpenRouter)     │     │  ├── Runs Creative OS:        │
│  ├── Recruiter reviews + approves     │     │  │   ├── Qwen3.5-9B           │
│  └── Writes to Neon ──────────────────┼──>──┤   ├── Gemma 3 12B            │
│                                       │     │  │   ├── Seedream 4.5          │
│  Marketing Portal (Steven)            │     │  │   ├── Qwen3-VL-8B          │
│  ├── Reviews generated package  <─────┼──<──┤   ├── Compositor              │
│  ├── Gives feedback → Neon ───────────┼──>──┤   └── Evaluator               │
│  ├── Approves → notifies designer     │     │  ├── Posts results to Neon     │
│  └── Final approve → ZIP to agency    │     │  └── All compute = zero cost   │
│                                       │     │                               │
│  Designer Portal (Magic Link)         │     └───────────────────────────────┘
│  ├── Downloads assets                 │
│  ├── Uploads refined creatives        │              ▲
│  └── Submits → notifies Steven        │              │
│                                       │         Neon is the
│  Neon Postgres (Message Bus)          │         MESSAGE BUS
│  ├── intake_requests                  │         between cloud
│  ├── generated_assets                 │         and local
│  ├── compute_jobs  ← NEW             │
│  ├── All other tables                 │
│  └── Triggers notifications           │
│                                       │
│  Teams Webhooks (Notifications)       │
│  OpenRouter (K2.5 RFP extraction)     │
└──────────────────────────────────────┘
```

## 3. The Full Workflow (Corrected)

### Step 1: Recruiter Uploads RFP
- Recruiter opens Vercel app
- Uploads RFP document (PDF/DOCX/text paste)
- **Vercel API route** calls **OpenRouter K2.5** directly (cloud-to-cloud, fast)
- K2.5 extracts: role, languages, regions, skills, commitment, compensation
- Structured data displayed in dynamic form fields
- Recruiter reviews, adjusts any fields, clicks **APPROVE**
- Data written to Neon `intake_requests` table with `status='approved'`
- New row written to `compute_jobs` table with `job_type='generate'`, `status='pending'`

### Step 2: Local Worker Picks Up Job
- Python worker on Steven's Mac polls `compute_jobs` every 30 seconds
- Finds `status='pending'` job → marks as `status='processing'`
- Loads intake request data from Neon
- Runs full Creative OS pipeline LOCALLY:
  - Stage 1: Brief + channel research (Qwen3.5-9B)
  - Stage 2: Actor cards + Seedream images + VL-8B QA
  - Stage 3: Copy generation (Gemma 3 12B, multilingual)
  - Stage 4: Composition + 7-dimension evaluation
- Uploads generated images to Vercel Blob (via presigned URL or direct API)
- Inserts results into Neon: `generated_assets`, `creative_briefs`, `actor_profiles`
- Updates `intake_requests.status` = `'review'`
- Updates `compute_jobs.status` = `'complete'`
- Posts Teams notification to Steven

### Step 3: Steven Reviews in Marketing Portal
- Gets Teams notification → opens Vercel app
- Sees full generated package: brief, messaging, characters, ad mockups, scores
- Options:
  - **Approve** → status = 'approved', designer notified
  - **Feedback** → writes notes, new `compute_jobs` row with `job_type='regenerate'` + feedback context
  - **Regenerate specific** → targets specific creatives for redo
- If feedback → local worker picks up regeneration job, runs with feedback context, posts updated results

### Step 4: Designer Gets Notified
- Steven approves → Neon gets approval row
- Teams webhook fires to designer
- Designer opens magic link (no account, 7-day expiry token)
- Sees: brief, messaging, character photos, ad mockups per platform
- Can download individual assets or full ZIP
- Can upload refined creatives
- Clicks Submit → new rows in `designer_uploads`, notification to Steven

### Step 5: Steven Final Review
- Gets Teams notification
- Reviews designer's finals in Vercel frontend
- If tweaks needed → notification back to designer (loop step 4-5)
- If approved → clicks "Send to Agency"
- ZIP generated: finals + brief + positioning + targeting + character refs
- Delivered to agency (download link or email)

---

## 4. New Database Table: `compute_jobs`

```sql
CREATE TABLE compute_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  job_type        TEXT NOT NULL CHECK (job_type IN (
    'generate',           -- Full pipeline (stages 1-4)
    'regenerate',         -- Regenerate with feedback
    'regenerate_stage',   -- Regenerate specific stage only
    'regenerate_asset'    -- Regenerate specific creative
  )),
  status          TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',            -- Waiting for local worker
    'processing',         -- Worker picked it up
    'complete',           -- Results posted to Neon
    'failed'              -- Worker encountered error
  )),
  stage_target    INT,                    -- NULL = all stages, or specific stage number
  asset_id        UUID,                   -- NULL = all assets, or specific asset to regenerate
  feedback        TEXT,                   -- Steven's feedback for regeneration
  feedback_data   JSONB,                  -- Structured feedback (which dimensions to improve, etc.)
  error_message   TEXT,                   -- Error details if failed
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_compute_jobs_pending ON compute_jobs (status) WHERE status = 'pending';
```

---

## 5. Local Worker Architecture

### File: `/Users/stevenjunop/centric-intake/worker/`

```
worker/
├── main.py                  ← Entry point: polls Neon, dispatches jobs
├── config.py                ← Neon connection, Vercel Blob token, intervals
├── neon_client.py           ← Read/write compute_jobs + results to Neon
├── blob_uploader.py         ← Upload generated images to Vercel Blob
├── teams_notify.py          ← Send Teams webhook notifications
├── pipeline/
│   ├── __init__.py
│   ├── orchestrator.py      ← Runs stages sequentially, handles retries
│   ├── stage1_intelligence.py  ← Brief + channel research (Qwen3.5-9B)
│   ├── stage2_images.py     ← Actor cards + Seedream + VL QA
│   ├── stage3_copy.py       ← Gemma 3 12B multilingual copy
│   └── stage4_compose.py    ← Compositor + evaluator
├── ai/
│   ├── __init__.py
│   ├── local_llm.py         ← COPIED from VYRA (Qwen3.5-9B + Gemma 3 12B)
│   ├── local_vlm.py         ← COPIED from VYRA (Qwen3-VL-8B)
│   ├── seedream.py          ← COPIED from VYRA (Seedream 4.5 API)
│   ├── compositor.py        ← COPIED from VYRA (HTML/CSS → PNG)
│   ├── evaluator.py         ← COPIED from VYRA (7-dimension, recruitment-adapted)
│   └── font_cache.py        ← COPIED from VYRA (OneForma fonts)
├── prompts/
│   ├── recruitment_brief.py    ← Recruitment-specific brief prompts
│   ├── recruitment_copy.py     ← Candidate messaging prompts
│   ├── recruitment_actors.py   ← Culturally-aware actor generation
│   └── recruitment_evaluation.py ← Recruitment evaluation dimensions
├── requirements.txt
└── README.md
```

### `main.py` — The Polling Loop

```python
"""Local compute worker for Centric Intake App.

Polls Neon for pending compute jobs, runs Creative OS pipeline locally,
posts results back to Neon. All AI inference runs on Apple Silicon via MLX.

Usage:
  cd worker/
  pip install -r requirements.txt
  python main.py
"""

import asyncio
import logging
from config import POLL_INTERVAL_SECONDS
from neon_client import fetch_pending_jobs, mark_job_processing, mark_job_complete, mark_job_failed
from pipeline.orchestrator import run_pipeline

logger = logging.getLogger(__name__)

async def main():
    logger.info("Centric local worker started. Polling every %ds.", POLL_INTERVAL_SECONDS)

    while True:
        try:
            jobs = await fetch_pending_jobs()

            for job in jobs:
                logger.info("Processing job %s (type=%s, request=%s)", job.id, job.job_type, job.request_id)
                await mark_job_processing(job.id)

                try:
                    results = await run_pipeline(job)
                    await mark_job_complete(job.id, results)
                    logger.info("Job %s complete.", job.id)
                except Exception as e:
                    logger.error("Job %s failed: %s", job.id, e)
                    await mark_job_failed(job.id, str(e))

        except Exception as e:
            logger.error("Poll cycle error: %s", e)

        await asyncio.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
```

---

## 6. Surgical Refactor Steps (Don't Start From Scratch)

### What STAYS (Don't Touch)

```
✅ src/app/globals.css                    — OneForma design system (keep ALL)
✅ src/app/layout.tsx                     — Clerk + Sonner (keep)
✅ src/app/sign-in/, sign-up/             — Auth pages (keep)
✅ src/middleware.ts                       — Clerk auth (keep)
✅ src/components/*.tsx (all 16)           — ALL components stay
✅ src/app/page.tsx                        — Dashboard (keep)
✅ src/app/designer/[id]/page.tsx          — Designer portal (keep)
✅ src/lib/db.ts                           — Neon client (keep)
✅ src/lib/db/*.ts (all 11 modules)        — DB operations (keep)
✅ src/lib/types.ts                        — TypeScript types (keep)
✅ src/lib/validation.ts                   — Validation engine (keep)
✅ src/lib/seed-schemas.ts                 — 7 task type schemas (keep)
✅ src/lib/export.ts                       — ZIP export (keep)
✅ src/lib/extraction-prompt.ts            — K2.5 RFP extraction (keep)
✅ src/lib/openrouter.ts                   — OpenRouter client (keep)
✅ src/lib/blob.ts                         — Vercel Blob (keep)
✅ src/lib/notifications/slack.ts          — Slack webhook (keep)
✅ src/lib/notifications/outlook.ts        — Outlook (keep, adapt for Teams)
✅ src/app/api/intake/*                    — CRUD routes (keep)
✅ src/app/api/approve/*                   — Approval routes (keep)
✅ src/app/api/designer/*                  — Designer routes (keep)
✅ src/app/api/export/*                    — Export route (keep)
✅ src/app/api/extract/*                   — RFP extraction (keep)
✅ src/app/api/notify/*                    — Notification routes (keep)
✅ src/app/api/schemas/*                   — Schema routes (keep)
✅ src/app/api/registries/*                — Registry routes (keep)
✅ src/app/api/setup/*                     — DB setup route (keep)
✅ docs/*                                  — Specs and plans (keep)
```

### What GETS DELETED

```
❌ src/lib/vyra-client.ts                 — DELETE (no HTTP to VYRA)
❌ src/lib/pipeline/orchestrator.ts        — DELETE (orchestration moves to local worker)
❌ src/lib/pipeline/stage1-intelligence.ts — DELETE (moves to worker/pipeline/)
❌ src/lib/pipeline/stage2-images.ts       — DELETE (moves to worker/pipeline/)
❌ src/lib/pipeline/stage3-copy.ts         — DELETE (moves to worker/pipeline/)
❌ src/lib/pipeline/stage4-compose.ts      — DELETE (moves to worker/pipeline/)
❌ src/lib/pipeline/stage5-surface.ts      — DELETE (this becomes DB + notification logic)
```

### What GETS MODIFIED

```
🔧 src/lib/db/schema.ts
   ADD: compute_jobs table DDL

🔧 src/app/api/generate/[id]/route.ts
   OLD: calls vyra-client → stage orchestration → returns result
   NEW: writes compute_jobs row (status='pending') → returns 202 Accepted

🔧 src/app/api/generate/[id]/brief/route.ts (and all stage routes)
   OLD: calls vyra-client for specific stage
   NEW: writes compute_jobs row with stage_target → returns 202 Accepted

🔧 src/app/intake/[id]/page.tsx
   ADD: polling for compute_jobs status (show "Generating..." with progress)
   ADD: when status='complete', refresh and show generated assets

🔧 src/app/api/setup/route.ts
   ADD: create compute_jobs table in setup
```

### What GETS CREATED

```
🆕 src/lib/db/compute-jobs.ts
   — CRUD for compute_jobs table
   — fetchPendingJobs(), markProcessing(), markComplete(), markFailed()

🆕 src/app/api/compute/status/[id]/route.ts
   — GET: returns current compute_jobs status for a request (for frontend polling)

🆕 src/lib/notifications/teams.ts
   — Teams webhook client (Microsoft Teams, not Slack — Centific uses MS)

🆕 worker/                              — The entire local worker directory
   — (Python, runs on Steven's Mac, polls Neon, runs Creative OS)
```

---

## 7. Step-by-Step Implementation Order

### Step 1: Add compute_jobs table (15 min)
```
1. Add DDL to src/lib/db/schema.ts
2. Create src/lib/db/compute-jobs.ts with CRUD operations
3. Add to src/app/api/setup/route.ts
4. Test: hit /api/setup, verify table created in Neon
```

### Step 2: Rewire generate routes to write jobs (30 min)
```
1. Modify src/app/api/generate/[id]/route.ts:
   - Remove vyra-client import
   - Instead: insert compute_jobs row with job_type='generate', status='pending'
   - Return 202 Accepted with { jobId, status: 'pending' }

2. Modify all stage-specific routes (brief, images, copy, compose):
   - Same pattern: write compute_jobs row with stage_target
   - Return 202 Accepted

3. Create src/app/api/compute/status/[id]/route.ts:
   - Query compute_jobs for request_id
   - Return current status + timestamps
```

### Step 3: Add frontend polling (30 min)
```
1. Modify src/app/intake/[id]/page.tsx:
   - When status is 'generating', poll /api/compute/status/[id] every 5 seconds
   - Show PipelineProgress with stage-by-stage status
   - When complete, fetch generated assets and display

2. Modify src/app/page.tsx (dashboard):
   - Show real-time status on IntakeCards (pulsing badge for 'generating')
```

### Step 4: Delete old pipeline + vyra-client (10 min)
```
1. Delete src/lib/vyra-client.ts
2. Delete src/lib/pipeline/ (entire directory)
3. Verify: npx tsc --noEmit (fix any broken imports)
```

### Step 5: Add Teams notification (20 min)
```
1. Create src/lib/notifications/teams.ts
   - Microsoft Teams incoming webhook
   - Adaptive card format for rich notifications
2. Wire into approval and designer workflows
```

### Step 6: Create local worker skeleton (1 hour)
```
1. Create worker/ directory structure
2. Copy VYRA AI files:
   - vyra/apps/api/app/providers/local_llm.py → worker/ai/local_llm.py
   - vyra/apps/api/app/providers/local_vlm.py → worker/ai/local_vlm.py
   - vyra/packages/llm-engine/vyra_llm/providers/seedream.py → worker/ai/seedream.py
   - vyra/apps/api/app/services/optimize/creative_compositor.py → worker/ai/compositor.py
   - vyra/apps/api/app/services/optimize/creative_evaluator.py → worker/ai/evaluator.py
   - vyra/apps/api/app/services/optimize/font_cache.py → worker/ai/font_cache.py
3. Create worker/neon_client.py (read/write to Neon)
4. Create worker/blob_uploader.py (upload images to Vercel Blob)
5. Create worker/teams_notify.py (send Teams webhooks)
6. Create worker/config.py (env vars)
7. Create worker/requirements.txt
```

### Step 7: Build pipeline stages in worker (2-3 hours)
```
1. worker/pipeline/stage1_intelligence.py
   - Adapt VYRA brief generation prompts for recruitment
   - Channel research stays on Vercel (OpenRouter K2.5 — cloud to cloud)
   - Brief + evaluation + design direction all local

2. worker/pipeline/stage2_images.py
   - Actor card generation (Qwen3.5-9B)
   - Seedream image generation
   - VL-8B visual QA (cultural authenticity + realism)
   - Upload images to Vercel Blob

3. worker/pipeline/stage3_copy.py
   - Gemma 3 12B writes multilingual ad copy
   - Recruitment-specific prompts
   - Copy evaluation gate

4. worker/pipeline/stage4_compose.py
   - Template selection (Qwen3.5-9B)
   - Compositor (HTML/CSS → Playwright → PNG)
   - 7-dimension evaluation gate
   - Upload composed creatives to Vercel Blob

5. worker/pipeline/orchestrator.py
   - Runs stages 1-4 sequentially
   - Handles retries per stage
   - Posts all results to Neon
   - Sends Teams notification on complete/fail
```

### Step 8: Create recruitment-specific prompts (1 hour)
```
1. worker/prompts/recruitment_brief.py
   - "Generate recruitment marketing brief for [task_type] at OneForma..."
   - Contributor messaging, not corporate job posting

2. worker/prompts/recruitment_copy.py
   - "Earn from home" / "Use your language skills" / "Flexible hours"
   - Multilingual, accessible tone

3. worker/prompts/recruitment_actors.py
   - Culturally authentic for target region
   - Relatable contributors, not corporate stock

4. worker/prompts/recruitment_evaluation.py
   - employer_brand_fit, candidate_hook, readability,
     cta_clarity, platform_compliance, culture_proof, language_quality
```

### Step 9: Test end-to-end (1 hour)
```
1. Deploy Vercel frontend (or run locally)
2. Start local worker: cd worker && python main.py
3. Create intake request via frontend
4. Approve → verify compute_jobs row created
5. Verify worker picks up job, processes, posts results
6. Verify frontend shows generated package
7. Test approval → designer notification → designer upload → final export
```

### Step 10: Polish and deploy (30 min)
```
1. Vercel environment variables (DATABASE_URL, OPENROUTER_API_KEY, CLERK keys, BLOB token)
2. Local worker .env (DATABASE_URL, SEEDREAM_API_KEY, VERCEL_BLOB_TOKEN, TEAMS_WEBHOOK_URL)
3. Verify Clerk Microsoft SSO
4. Run full workflow with real data
```

---

## 8. Total Effort Estimate

```
Step 1:  Add compute_jobs table           15 min
Step 2:  Rewire generate routes           30 min
Step 3:  Frontend polling                 30 min
Step 4:  Delete old pipeline              10 min
Step 5:  Teams notification               20 min
Step 6:  Local worker skeleton            1 hour
Step 7:  Pipeline stages in worker        2-3 hours
Step 8:  Recruitment prompts              1 hour
Step 9:  End-to-end test                  1 hour
Step 10: Polish and deploy               30 min
─────────────────────────────────────────────────
TOTAL:                                   7-8 hours

At Steven's velocity:                    ~half a day
```

---

## 9. What Changes for the VP Demo (April 6)

```
BEFORE (mock mode):
  "Here's what the app will do..." (fake data)

AFTER (real mode):
  Recruiter uploads RFP → K2.5 extracts fields live on screen
  → Recruiter approves → loading spinner (30s)
  → Local Mac generates real brief, real images, real copy
  → VP sees ACTUAL AI-generated recruitment creatives
  → With evaluation scores and channel recommendations
  → Approve → designer gets Teams notification → ZIP for agency

  All real. All live. All running on Steven's laptop.
```

---

## 10. Admin Portal + Role-Based Permissions

### Roles

| Role | Who | Can Do |
|---|---|---|
| **Admin** (Steven) | Marketing Manager | Everything: configure system, manage users, approve/reject, view all requests, export, manage schemas, assign roles |
| **Recruiter** | Recruiting team members | Create intake requests, upload RFPs, review AI-extracted fields, approve form data, view own requests only |
| **Designer** | Design team | View approved packages (magic link OR logged in), download assets, upload refined creatives, submit finals |
| **Viewer** | VP/stakeholders | Read-only access to all requests, view metrics/dashboards, no edit permissions |

### Permission Matrix

| Action | Admin | Recruiter | Designer | Viewer |
|---|---|---|---|---|
| Create intake request | ✅ | ✅ | ❌ | ❌ |
| Upload RFP | ✅ | ✅ | ❌ | ❌ |
| Approve RFP extraction | ✅ | ✅ (own) | ❌ | ❌ |
| View all requests | ✅ | ❌ (own only) | ❌ (assigned only) | ✅ (read-only) |
| Trigger generation | ✅ | ❌ | ❌ | ❌ |
| Review generated package | ✅ | ❌ | ❌ | ✅ (read-only) |
| Give feedback / request regen | ✅ | ❌ | ❌ | ❌ |
| Approve for designer | ✅ | ❌ | ❌ | ❌ |
| Download assets | ✅ | ❌ | ✅ | ❌ |
| Upload refined creatives | ❌ | ❌ | ✅ | ❌ |
| Final approve + send to agency | ✅ | ❌ | ❌ | ❌ |
| Manage users + roles | ✅ | ❌ | ❌ | ❌ |
| Edit task type schemas | ✅ | ❌ | ❌ | ❌ |
| View pipeline status | ✅ | ✅ (own) | ❌ | ✅ |
| Configure Teams webhooks | ✅ | ❌ | ❌ | ❌ |

### Admin Portal Pages

```
/admin                         ← Admin dashboard (stats, active jobs, recent activity)
/admin/users                   ← Manage team: invite users, assign roles, deactivate
/admin/schemas                 ← Edit task type form schemas (7 annotation types)
/admin/settings                ← Teams webhook URLs, Neon connection, Vercel Blob config
/admin/pipeline                ← Monitor local worker: job queue, processing status, errors
/admin/templates               ← Manage creative templates, brand assets, OneForma fonts
```

### Implementation via Clerk

Clerk handles SSO + role assignment. Roles stored in Clerk metadata:

```typescript
// Clerk user metadata
{
  publicMetadata: {
    role: "admin" | "recruiter" | "designer" | "viewer"
  }
}

// Middleware checks
function requireRole(role: string | string[]) {
  // Check auth().sessionClaims.metadata.role
}
```

### Database Table: `user_roles` (backup/audit)

```sql
CREATE TABLE user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id    TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'recruiter', 'designer', 'viewer')),
  is_active   BOOLEAN DEFAULT TRUE,
  invited_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Refactor Step Addition

```
Step 5b: Add admin portal + permissions (1-1.5 hours)
  1. Create src/app/admin/page.tsx (admin dashboard)
  2. Create src/app/admin/users/page.tsx (user management)
  3. Create src/app/admin/settings/page.tsx (system config)
  4. Create src/app/admin/pipeline/page.tsx (worker monitor)
  5. Create src/lib/db/user-roles.ts (CRUD)
  6. Add role check middleware: src/lib/auth.ts
  7. Wrap all routes with role checks
  8. Add user_roles table to schema.ts
```

Updated total effort: **8-9.5 hours** (was 7-8 + admin portal)

---

## 11. Key Principle: Neon Is The Message Bus

```
Cloud (Vercel) never calls local machine directly.
Local machine never exposes a port to the internet.

All communication goes through Neon Postgres:

  Vercel → writes job row → Neon
  Local  → polls for pending jobs → Neon
  Local  → writes results → Neon
  Vercel → reads results → Neon

  Neon → triggers notification webhooks (Teams/Slack)

This means:
  ✅ Vercel deploys independently (no localhost dependency)
  ✅ Local worker runs independently (no Vercel dependency)
  ✅ If Mac is off → jobs queue, process when Mac comes online
  ✅ If Vercel is down → local worker still processes queued jobs
  ✅ No ngrok, no port forwarding, no tunnels
  ✅ Secure: local machine only makes outbound connections
  ✅ Scalable: add second worker, or move to cloud GPU later
```
