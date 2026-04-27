# Unified Campaign Workspace — Plan 1: Schema & Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `country` columns to all campaign-related tables, update TypeScript types, and run the migration so the database supports per-country data.

**Architecture:** Add nullable `country TEXT` columns to compute_jobs, actor_profiles, generated_assets, campaign_landing_pages, tracked_links, notifications, notification_deliveries. Update CHECK constraints. Add indexes for country-filtered queries. Update TypeScript interfaces to match.

**Tech Stack:** PostgreSQL (Neon), TypeScript, Next.js

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `migrations/2026-04-23-country-columns.sql` | Create | SQL migration adding country columns, indexes, constraint changes |
| `src/lib/types.ts` | Modify | Add `country` field to ActorProfile, GeneratedAsset, ComputeJob. Add `generate_country` to ComputeJobType. |
| `src/lib/db/schema.ts` | Modify | Add country columns to CREATE TABLE statements for schema sync |

---

### Task 1: Write the SQL migration

**Files:**
- Create: `migrations/2026-04-23-country-columns.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- migrations/2026-04-23-country-columns.sql
-- Unified Campaign Workspace: add country columns for per-country data

-- 1. Add country columns
ALTER TABLE compute_jobs ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE actor_profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE campaign_landing_pages ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE tracked_links ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE notification_deliveries ADD COLUMN IF NOT EXISTS country TEXT;

-- 2. Remove unique constraint on campaign_landing_pages.request_id
-- (now one row per country per campaign, not one per campaign)
ALTER TABLE campaign_landing_pages DROP CONSTRAINT IF EXISTS campaign_landing_pages_request_id_key;

-- 3. Update compute_jobs job_type check to include 'generate_country'
ALTER TABLE compute_jobs DROP CONSTRAINT IF EXISTS compute_jobs_job_type_check;
ALTER TABLE compute_jobs ADD CONSTRAINT compute_jobs_job_type_check
  CHECK (job_type IN ('generate', 'generate_country', 'regenerate', 'regenerate_stage', 'regenerate_asset', 'resume_from'));

-- 4. Indexes for country-filtered queries
CREATE INDEX IF NOT EXISTS idx_generated_assets_country ON generated_assets (request_id, country);
CREATE INDEX IF NOT EXISTS idx_actor_profiles_country ON actor_profiles (request_id, country);
CREATE INDEX IF NOT EXISTS idx_compute_jobs_country ON compute_jobs (request_id, country);
```

- [ ] **Step 2: Commit**

```bash
git add migrations/2026-04-23-country-columns.sql
git commit -m "feat: add country columns migration for unified campaign workspace"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/lib/types.ts:196-206` (ActorProfile)
- Modify: `src/lib/types.ts:214-231` (GeneratedAsset)
- Modify: `src/lib/types.ts:403` (ComputeJobType)
- Modify: `src/lib/types.ts:406-419` (ComputeJob)

- [ ] **Step 1: Add `country` to ActorProfile**

In `src/lib/types.ts`, add `country` field after `backdrops`:

```typescript
export interface ActorProfile {
  id: string;
  request_id: string;
  name: string;
  face_lock: Record<string, unknown>;
  prompt_seed: string;
  outfit_variations: Record<string, unknown> | null;
  signature_accessory: string | null;
  backdrops: string[];
  country: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Add `country` to GeneratedAsset**

```typescript
export interface GeneratedAsset {
  id: string;
  request_id: string;
  actor_id: string | null;
  asset_type: AssetType;
  platform: string;
  format: string;
  language: string;
  country: string | null;
  content: Record<string, unknown> | null;
  copy_data: Record<string, unknown> | null;
  blob_url: string | null;
  evaluation_score: number | null;
  evaluation_data: Record<string, unknown> | null;
  evaluation_passed: boolean;
  stage: number;
  version: number;
  created_at: string;
}
```

- [ ] **Step 3: Add `generate_country` to ComputeJobType and `country` to ComputeJob**

```typescript
export type ComputeJobType = 'generate' | 'generate_country' | 'regenerate' | 'regenerate_stage' | 'regenerate_asset';

export interface ComputeJob {
  id: string;
  request_id: string;
  job_type: ComputeJobType;
  status: ComputeJobStatus;
  country: string | null;
  stage_target: number | null;
  asset_id: string | null;
  feedback: string | null;
  feedback_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing code doesn't reference `country` yet, nullable fields are safe)

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add country field to ActorProfile, GeneratedAsset, ComputeJob types"
```

---

### Task 3: Update schema.ts table definitions

**Files:**
- Modify: `src/lib/db/schema.ts:155-168` (actor_profiles)
- Modify: `src/lib/db/schema.ts:170-190` (generated_assets)
- Modify: `src/lib/db/schema.ts:204-216` (campaign_landing_pages)
- Modify: `src/lib/db/schema.ts:222-248` (tracked_links)
- Modify: `src/lib/db/schema.ts:274-285` (notification_deliveries)
- Modify: `src/lib/db/schema.ts:287-300` (notifications)
- Modify: `src/lib/db/schema.ts:321-338` (compute_jobs)

- [ ] **Step 1: Add `country TEXT` to actor_profiles CREATE TABLE**

After `backdrops TEXT[] NOT NULL DEFAULT '{}'`, add:

```sql
      country TEXT,
```

- [ ] **Step 2: Add `country TEXT` to generated_assets CREATE TABLE**

After `language TEXT NOT NULL DEFAULT 'en'`, add:

```sql
      country TEXT,
```

- [ ] **Step 3: Update campaign_landing_pages — remove UNIQUE, add country**

Change `request_id UUID NOT NULL UNIQUE REFERENCES` to `request_id UUID NOT NULL REFERENCES` and add `country TEXT,` after `ada_form_url TEXT,`.

- [ ] **Step 4: Add `country TEXT` to tracked_links CREATE TABLE**

After `recruiter_clerk_id  TEXT NOT NULL,` add:

```sql
      country TEXT,
```

- [ ] **Step 5: Add `country TEXT` to notification_deliveries CREATE TABLE**

After `recipient TEXT NOT NULL,` add:

```sql
      country TEXT,
```

- [ ] **Step 6: Add `country TEXT` to notifications CREATE TABLE**

After `request_id  UUID REFERENCES intake_requests(id) ON DELETE CASCADE,` add:

```sql
      country TEXT,
```

- [ ] **Step 7: Update compute_jobs — add country and update CHECK**

After `request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,` add:

```sql
      country         TEXT,
```

Update the job_type CHECK constraint:

```sql
      job_type        TEXT NOT NULL CHECK (job_type IN ('generate', 'generate_country', 'regenerate', 'regenerate_stage', 'regenerate_asset', 'resume_from')),
```

- [ ] **Step 8: Add country indexes after table creation**

After the existing tracked_links indexes, add:

```typescript
  await sql`CREATE INDEX IF NOT EXISTS idx_generated_assets_country ON generated_assets(request_id, country)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_actor_profiles_country ON actor_profiles(request_id, country)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_compute_jobs_country ON compute_jobs(request_id, country)`;
```

- [ ] **Step 9: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 10: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat: add country columns to schema.ts table definitions"
```

---

### Task 4: Run the migration

- [ ] **Step 1: Run the migration against Neon**

Run: `psql $DATABASE_URL -f migrations/2026-04-23-country-columns.sql`
Expected: ALTER TABLE, CREATE INDEX statements succeed

- [ ] **Step 2: Verify columns exist**

Run: `psql $DATABASE_URL -c "\d compute_jobs" | grep country`
Expected: `country | text |`

Run: `psql $DATABASE_URL -c "\d generated_assets" | grep country`
Expected: `country | text |`

Run: `psql $DATABASE_URL -c "\d actor_profiles" | grep country`
Expected: `country | text |`

- [ ] **Step 3: Verify the claim_next_job query still works**

Run: `psql $DATABASE_URL -c "SELECT id, job_type, country, status FROM compute_jobs LIMIT 3"`
Expected: Existing rows show `country` as NULL (backwards compatible)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: verify migration — country columns live"
```

---

### Task 5: Update claim_next_job to return country field

**Files:**
- Modify: `worker/neon_client.py:77-96`

- [ ] **Step 1: Add country to the RETURNING clause**

In `claim_next_job()`, update the SQL RETURNING clause from:

```sql
RETURNING id, request_id, job_type, stage_target, feedback, created_at
```

To:

```sql
RETURNING id, request_id, job_type, country, stage_target, feedback, feedback_data, created_at
```

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import neon_client; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/neon_client.py
git commit -m "feat: return country and feedback_data from claim_next_job"
```
