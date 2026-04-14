-- ═══════════════════════════════════════════════════════════════════════
-- Migration: 2026-04-13 — ALL pending schema changes
-- ═══════════════════════════════════════════════════════════════════════
--
-- Run against Neon production database:
--   psql $DATABASE_URL -f migrations/2026-04-13-stage6-organic.sql
--
-- Safe to run multiple times (all operations are idempotent).
-- Covers: Stage 6 Landing Pages, Organic Carousels, WP Job Publish,
--         Figma Sync, and any missed column additions.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. intake_requests — figma_sync column + derived requirement columns
-- ═══════════════════════════════════════════════════════════════════════

-- Figma sync state (added for designer portal Figma integration)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_requests' AND column_name='figma_sync') THEN
    ALTER TABLE intake_requests ADD COLUMN figma_sync JSONB DEFAULT NULL;
  END IF;
END $$;

-- Campaign slug for LP URLs + recruiter link builder
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_requests' AND column_name='campaign_slug') THEN
    ALTER TABLE intake_requests ADD COLUMN campaign_slug TEXT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_intake_campaign_slug ON intake_requests(campaign_slug);

-- Derived requirement fields (Phase A+B persona refactor)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_requests' AND column_name='qualifications_required') THEN
    ALTER TABLE intake_requests ADD COLUMN qualifications_required TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_requests' AND column_name='qualifications_preferred') THEN
    ALTER TABLE intake_requests ADD COLUMN qualifications_preferred TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_requests' AND column_name='location_scope') THEN
    ALTER TABLE intake_requests ADD COLUMN location_scope TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_requests' AND column_name='language_requirements') THEN
    ALTER TABLE intake_requests ADD COLUMN language_requirements TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_requests' AND column_name='engagement_model') THEN
    ALTER TABLE intake_requests ADD COLUMN engagement_model TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_requests' AND column_name='technical_requirements') THEN
    ALTER TABLE intake_requests ADD COLUMN technical_requirements TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='intake_requests' AND column_name='context_notes') THEN
    ALTER TABLE intake_requests ADD COLUMN context_notes TEXT;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. creative_briefs — pillar weighting columns
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='creative_briefs' AND column_name='pillar_primary') THEN
    ALTER TABLE creative_briefs ADD COLUMN pillar_primary TEXT CHECK (pillar_primary IN ('earn', 'grow', 'shape'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='creative_briefs' AND column_name='pillar_secondary') THEN
    ALTER TABLE creative_briefs ADD COLUMN pillar_secondary TEXT CHECK (pillar_secondary IN ('earn', 'grow', 'shape'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='creative_briefs' AND column_name='derived_requirements') THEN
    ALTER TABLE creative_briefs ADD COLUMN derived_requirements JSONB;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_creative_briefs_pillar_primary ON creative_briefs(pillar_primary) WHERE pillar_primary IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. generated_assets — extend asset_type CHECK
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE generated_assets DROP CONSTRAINT IF EXISTS generated_assets_asset_type_check;
ALTER TABLE generated_assets ADD CONSTRAINT generated_assets_asset_type_check
  CHECK (asset_type IN ('base_image', 'composed_creative', 'carousel_panel', 'landing_page', 'organic_carousel'));

-- Partial indexes for fast organic + LP queries
CREATE INDEX IF NOT EXISTS idx_generated_assets_organic
  ON generated_assets(request_id, asset_type) WHERE asset_type = 'organic_carousel';
CREATE INDEX IF NOT EXISTS idx_generated_assets_landing_page
  ON generated_assets(request_id, asset_type) WHERE asset_type = 'landing_page';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. campaign_landing_pages — ensure table + generated_lp_urls column
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_landing_pages' AND column_name='generated_lp_urls') THEN
    ALTER TABLE campaign_landing_pages ADD COLUMN generated_lp_urls JSONB DEFAULT '{}';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_landing_pages_request ON campaign_landing_pages(request_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. tracked_links — ensure utm_campaign column exists
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tracked_links' AND column_name='utm_campaign') THEN
    ALTER TABLE tracked_links ADD COLUMN utm_campaign TEXT;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. campaign_strategies — ensure table exists
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaign_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  tier INT DEFAULT 1,
  monthly_budget NUMERIC,
  budget_mode TEXT DEFAULT 'ratio' CHECK (budget_mode IN ('fixed', 'ratio')),
  strategy_data JSONB NOT NULL,
  evaluation_score NUMERIC,
  evaluation_data JSONB,
  evaluation_passed BOOLEAN,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_strategies_request ON campaign_strategies(request_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 7. All remaining indexes from schema.ts
-- ═══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tracked_links_slug ON tracked_links(slug);
CREATE INDEX IF NOT EXISTS idx_tracked_links_request ON tracked_links(request_id);
CREATE INDEX IF NOT EXISTS idx_intake_status ON intake_requests(status);
CREATE INDEX IF NOT EXISTS idx_intake_task_type ON intake_requests(task_type);
CREATE INDEX IF NOT EXISTS idx_intake_created_at ON intake_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compute_jobs_pending ON compute_jobs(status, created_at) WHERE status = 'pending';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION (run after migration)
-- ═══════════════════════════════════════════════════════════════════════
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'generated_assets_asset_type_check';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'intake_requests' AND column_name IN ('figma_sync', 'campaign_slug', 'qualifications_required');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'campaign_landing_pages';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'creative_briefs' AND column_name IN ('pillar_primary', 'derived_requirements');
