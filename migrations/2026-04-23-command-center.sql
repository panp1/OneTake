-- migrations/2026-04-23-command-center.sql
-- Command Center (SRC Port) — campaign analytics, ROAS, RevBrain

-- 1. normalized_daily_metrics — aggregated daily metrics by platform/channel
CREATE TABLE IF NOT EXISTS normalized_daily_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  country         TEXT,
  date            DATE NOT NULL,
  platform        TEXT NOT NULL,
  channel         TEXT,
  impressions     INT DEFAULT 0,
  clicks          INT DEFAULT 0,
  spend           NUMERIC(12,2) DEFAULT 0,
  conversions     INT DEFAULT 0,
  conversion_value NUMERIC(12,2) DEFAULT 0,
  signups         INT DEFAULT 0,
  profile_completes INT DEFAULT 0,
  quality_score   FLOAT,
  cpa             NUMERIC(12,2),
  ctr             FLOAT,
  roas            FLOAT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, country, date, platform, channel)
);

-- 2. attribution_journeys — user conversion journeys
CREATE TABLE IF NOT EXISTS attribution_journeys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  visitor_id      TEXT NOT NULL,
  country         TEXT,
  converted       BOOLEAN DEFAULT FALSE,
  revenue         NUMERIC(12,2) DEFAULT 0,
  first_touch_at  TIMESTAMPTZ,
  last_touch_at   TIMESTAMPTZ,
  conversion_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. attribution_touchpoints — individual touchpoints in journeys
CREATE TABLE IF NOT EXISTS attribution_touchpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id      UUID NOT NULL REFERENCES attribution_journeys(id) ON DELETE CASCADE,
  touchpoint_order INT NOT NULL,
  channel         TEXT NOT NULL,
  platform        TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  utm_content     TEXT,
  utm_term        TEXT,
  page_url        TEXT,
  timestamp       TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. revbrain_snapshots — materialized truth layer for budget recommendations
CREATE TABLE IF NOT EXISTS revbrain_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  country         TEXT,
  snapshot_date   DATE NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  metrics_data    JSONB NOT NULL DEFAULT '{}',
  recommendations JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. campaign_dashboards — user-created reporting surfaces
CREATE TABLE IF NOT EXISTS campaign_dashboards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  layout          JSONB NOT NULL DEFAULT '{}',
  filters         JSONB DEFAULT '{}',
  created_by      TEXT NOT NULL,
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. campaign_exports — async-generated report artifacts
CREATE TABLE IF NOT EXISTS campaign_exports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  export_type     TEXT NOT NULL CHECK (export_type IN ('pdf', 'xlsx', 'csv', 'pptx')),
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'complete', 'failed')),
  blob_url        TEXT,
  filters         JSONB DEFAULT '{}',
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- 7. campaign_share_links — public sharing with optional password
CREATE TABLE IF NOT EXISTS campaign_share_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('dashboard', 'export')),
  resource_id     UUID NOT NULL,
  password_hash   TEXT,
  expires_at      TIMESTAMPTZ,
  view_count      INT DEFAULT 0,
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 8. roas_config — per-campaign ROAS calculation parameters
CREATE TABLE IF NOT EXISTS roas_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
  country         TEXT,
  contract_value  NUMERIC(14,2),
  required_participants INT,
  variable_cost_per_participant NUMERIC(10,2) DEFAULT 0,
  fulfillment_rate FLOAT DEFAULT 0.65,
  rpp             NUMERIC(10,2),
  net_rpp         NUMERIC(10,2),
  breakeven_cpa   NUMERIC(10,2),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, country)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_metrics_request ON normalized_daily_metrics(request_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_country ON normalized_daily_metrics(request_id, country);
CREATE INDEX IF NOT EXISTS idx_attribution_journeys_request ON attribution_journeys(request_id);
CREATE INDEX IF NOT EXISTS idx_attribution_touchpoints_journey ON attribution_touchpoints(journey_id);
CREATE INDEX IF NOT EXISTS idx_revbrain_request ON revbrain_snapshots(request_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_dashboards_request ON campaign_dashboards(request_id);
CREATE INDEX IF NOT EXISTS idx_exports_request ON campaign_exports(request_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON campaign_share_links(token);
CREATE INDEX IF NOT EXISTS idx_roas_config_request ON roas_config(request_id, country);
