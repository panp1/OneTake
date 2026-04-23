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
