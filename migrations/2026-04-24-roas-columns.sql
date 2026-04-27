-- migrations/2026-04-24-roas-columns.sql
-- Add ROAS formula parameters to roas_config

ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS recognition_rate FLOAT DEFAULT 0.85;
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS cpa_target_pct FLOAT DEFAULT 0.20;
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS budget_multiplier FLOAT DEFAULT 6.0;
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS recommended_budget NUMERIC(14,2);
ALTER TABLE roas_config ADD COLUMN IF NOT EXISTS target_cpa NUMERIC(10,2);
