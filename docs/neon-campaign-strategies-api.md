# Neon Campaign Strategies API

Two new async helper functions added to `worker/neon_client.py` for managing campaign strategies.

## `save_campaign_strategy(request_id: str, strategy: dict) -> str`

Insert a campaign strategy record into Neon.

### Signature
```python
async def save_campaign_strategy(request_id: str, strategy: dict) -> str:
    """Save a campaign strategy to Neon. Returns the strategy ID."""
```

### Parameters
- **request_id** (str) — UUID of the intake request
- **strategy** (dict) — Strategy data with keys:
  - `country` (str, default: "global") — Target country
  - `tier` (int, default: 1) — Budget tier (1-3)
  - `monthly_budget` (Decimal, optional) — Monthly spend in USD
  - `budget_mode` (str, default: "ratio") — "fixed" or "ratio"
  - `strategy_data` (dict, required) — Media strategy JSON
  - `evaluation_score` (float, optional) — Quality score 0-1
  - `evaluation_data` (dict, optional) — Evaluation metadata
  - `evaluation_passed` (bool, optional) — Whether passed threshold

### Returns
- **strategy_id** (str) — UUID of created campaign_strategies record

### Example Usage
```python
from neon_client import save_campaign_strategy

strategy = {
    "country": "US",
    "tier": 2,
    "monthly_budget": 5000.00,
    "budget_mode": "fixed",
    "strategy_data": {
        "platforms": ["instagram", "tiktok"],
        "demographics": {"age_range": "18-34", "interests": ["tech"]},
        "placements": ["feed", "reels", "stories"]
    },
    "evaluation_score": 0.87,
    "evaluation_passed": True
}

strategy_id = await save_campaign_strategy("550e8400-e29b-41d4-a716-446655440000", strategy)
print(f"Created strategy: {strategy_id}")
```

### Database Behavior
- Generates a new UUID if not provided
- Serializes `strategy_data` and `evaluation_data` to JSONB
- Stores all fields with defaults where applicable
- Returns the UUID for downstream reference

---

## `update_actor_targeting(actor_id: str, targeting_profile: dict) -> None`

Update targeting profile JSONB on an actor record.

### Signature
```python
async def update_actor_targeting(actor_id: str, targeting_profile: dict) -> None:
    """Save targeting_profile JSONB on an actor profile."""
```

### Parameters
- **actor_id** (str) — UUID of the actor_profiles record
- **targeting_profile** (dict) — Targeting metadata with keys:
  - `channels` (list[str]) — Platforms actor appears on
  - `demographics` (dict) — Age range, interests, location, etc.
  - `messaging` (dict) — Tone, pain points, value propositions
  - `seasonality` (dict) — Peak months, best times to run
  - `competitive_set` (list[str]) — Similar campaigns/actors to test against

### Returns
- None (updates in-place)

### Example Usage
```python
from neon_client import update_actor_targeting

targeting = {
    "channels": ["instagram", "tiktok", "youtube_shorts"],
    "demographics": {
        "age_range": "18-30",
        "job_titles": ["content_creator", "student", "freelancer"],
        "interests": ["social_media", "personal_branding", "digital_marketing"]
    },
    "messaging": {
        "pain_points": ["low_engagement", "algorithm_changes"],
        "value_props": ["authentic_voice", "community_growth"]
    },
    "seasonality": {
        "peak_months": ["january", "september"],
        "best_times": ["evenings", "weekends"]
    }
}

actor_id = "660e8400-e29b-41d4-a716-446655440111"
await update_actor_targeting(actor_id, targeting)
```

### Database Behavior
- Serializes targeting_profile to JSONB
- Updates only the targeting_profile column
- No return value (void function)
- Idempotent (safe to call multiple times)

---

## Integration with Pipeline

### Stage 3: Media Strategy Intelligence
After LLM generates campaign strategy, save it:
```python
strategy_id = await save_campaign_strategy(
    request_id=request_id,
    strategy={
        "country": form_data["target_country"],
        "tier": form_data["budget_tier"],
        "monthly_budget": form_data.get("monthly_budget"),
        "budget_mode": form_data.get("budget_mode", "ratio"),
        "strategy_data": llm_output["media_strategy"],
        "evaluation_score": vqa_score,
        "evaluation_passed": vqa_score >= 0.75
    }
)
```

### Stage 2: Actor Generation
After actor persona is created, enrich with targeting:
```python
actors = await get_actors(request_id)
for actor in actors:
    targeting_profile = {
        "channels": strategy_data["platforms"],
        "demographics": actor["demographic_profile"],
        "messaging": strategy_data["messaging_angles"]
    }
    await update_actor_targeting(actor["id"], targeting_profile)
```

---

## Schema Reference

### campaign_strategies Table
```sql
CREATE TABLE campaign_strategies (
    id               UUID PRIMARY KEY,
    request_id       UUID REFERENCES intake_requests(id),
    country          TEXT NOT NULL,
    tier             INT DEFAULT 1,
    monthly_budget   NUMERIC,
    budget_mode      TEXT CHECK (budget_mode IN ('fixed', 'ratio')),
    strategy_data    JSONB NOT NULL,
    evaluation_score NUMERIC,
    evaluation_data  JSONB,
    evaluation_passed BOOLEAN,
    version          INT DEFAULT 1,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_strategies_request ON campaign_strategies(request_id);
```

### Updated Columns
- `actor_profiles.targeting_profile JSONB`
- `creative_briefs.budget_data JSONB`
- `generated_assets.ad_set_assignment JSONB`
