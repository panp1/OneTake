-- Migration: 2026-04-13 — Stage 6 Landing Pages + Organic Carousels + WP Job Publish
--
-- Run against Neon production database:
--   psql $DATABASE_URL -f migrations/2026-04-13-stage6-organic.sql
--
-- Safe to run multiple times (all operations are idempotent).

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Extend asset_type CHECK to include landing_page + organic_carousel
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE generated_assets
  DROP CONSTRAINT IF EXISTS generated_assets_asset_type_check;

ALTER TABLE generated_assets
  ADD CONSTRAINT generated_assets_asset_type_check
  CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel', 'landing_page', 'organic_carousel'));

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Ensure campaign_landing_pages table exists (may already exist)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaign_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES intake_requests(id) ON DELETE CASCADE,
  job_posting_url TEXT,
  landing_page_url TEXT,
  ada_form_url TEXT,
  generated_lp_urls JSONB DEFAULT '{}',
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add generated_lp_urls column if it doesn't exist (for Stage 6 per-persona LP URLs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_landing_pages' AND column_name = 'generated_lp_urls'
  ) THEN
    ALTER TABLE campaign_landing_pages ADD COLUMN generated_lp_urls JSONB DEFAULT '{}';
  END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Ensure tracked_links table has the required columns for UTM auto-creation
-- ═══════════════════════════════════════════════════════════════════════

-- tracked_links should already exist — just verify it has the columns we need
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tracked_links' AND column_name = 'utm_campaign'
  ) THEN
    ALTER TABLE tracked_links ADD COLUMN utm_campaign TEXT;
  END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Index for fast organic carousel queries
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_generated_assets_organic
  ON generated_assets (request_id, asset_type)
  WHERE asset_type = 'organic_carousel';

CREATE INDEX IF NOT EXISTS idx_generated_assets_landing_page
  ON generated_assets (request_id, asset_type)
  WHERE asset_type = 'landing_page';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Verification queries (run after migration to confirm)
-- ═══════════════════════════════════════════════════════════════════════

-- Should return the full list including landing_page and organic_carousel:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conname = 'generated_assets_asset_type_check';

-- Should show generated_lp_urls column:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'campaign_landing_pages' ORDER BY ordinal_position;
