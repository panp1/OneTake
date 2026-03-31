# Campaign Strategies Migration — Implementation Complete

## Status: Code Complete, Awaiting Database Migration

The Campaign Strategy Engine database schema implementation is complete. All TypeScript and Python code is committed and ready for deployment.

## Completed Tasks

### 1. TypeScript Schema Update
**File:** `src/lib/db/schema.ts` (Committed)

Added table definition 15 for `campaign_strategies`:
- 13 columns: id, request_id, country, tier, monthly_budget, budget_mode, strategy_data, evaluation_score, evaluation_data, evaluation_passed, version, created_at
- Foreign key to intake_requests with CASCADE delete
- Index on request_id for query performance
- Budget modes: 'fixed' or 'ratio'

Updated user_roles table number from 15 to 16.

### 2. Neon Helper Functions
**File:** `worker/neon_client.py` (Committed)

Implemented two async functions:

#### `save_campaign_strategy(request_id: str, strategy: dict) -> str`
- Inserts a campaign strategy record
- Generates UUID and stores it
- Returns strategy ID for downstream reference
- Handles JSONB serialization for strategy_data and evaluation_data

#### `update_actor_targeting(actor_id: str, targeting_profile: dict) -> None`
- Updates targeting_profile JSONB on an actor_profiles row
- Used for enriching actor data with campaign-specific targeting info

### 3. Column Additions (Pending Database Execution)
Schema prepared but requires migration execution:
- `actor_profiles.targeting_profile JSONB` — Per-actor targeting metadata
- `creative_briefs.budget_data JSONB` — Budget breakdown per brief
- `generated_assets.ad_set_assignment JSONB` — Ad set associations

## Next Steps: Run Database Migration

### Option A: Manual Python Execution (Recommended for Testing)
```bash
cd /Users/stevenjunop/centric-intake/worker
python3 migrate_campaign_strategies.py
```

This script:
- Creates campaign_strategies table
- Creates idx_campaign_strategies_request index
- Adds 3 new JSONB columns to existing tables
- Uses CREATE TABLE IF NOT EXISTS for idempotency
- Uses ALTER TABLE ... ADD COLUMN IF NOT EXISTS for safety

### Option B: On Next Deploy
The TypeScript `createTables()` function in `src/lib/db/schema.ts` will automatically create the campaign_strategies table on next app startup (via `CREATE TABLE IF NOT EXISTS`).

However, the column additions require manual migration execution in Option A.

### Option C: Vercel Postgres Console
Log into Vercel, navigate to Storage → Postgres, and run the migration script in the SQL editor.

## Files Modified

**Committed (Code Ready):**
- `src/lib/db/schema.ts` — Table definition + index
- `worker/neon_client.py` — Helper functions

**Created (Migration Script):**
- `worker/migrate_campaign_strategies.py` — Standalone migration runner

**Verified:**
- All Python syntax valid
- Functions importable and documented
- TypeScript integrates with existing schema

## Integration Points

The new table integrates with existing pipeline:
- **Compute Jobs** → Creates campaign_strategies after media strategy evaluation
- **Actor Profiles** → Each actor gets targeting_profile with channel/demographic data
- **Creative Briefs** → budget_data holds per-brief budget allocation
- **Generated Assets** → ad_set_assignment tracks which ad set each asset belongs to

## Testing Verification

Python imports work correctly:
```
Successfully imported save_campaign_strategy and update_actor_targeting
```

Syntax validation passed for both files.

## Timeline

- Code commit: 2026-03-30 18:05 UTC
- Ready for migration: Immediate
- Expected deployment to prod: During next Vercel deploy cycle
