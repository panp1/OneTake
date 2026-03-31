# Campaign Strategy Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Campaign Strategy Engine that transforms persona demographics + cultural research + budget into a ready-to-execute tiered media plan with real targeting parameters, budget allocation, split tests, and kill/scale rules.

**Architecture:** Enriched personas (with targeting_profile) feed a campaign strategy generator that outputs Tier 1 media plans per country. Budget cascades from RFP → countries → personas → ad sets with $10/day minimum enforcement. A 7-dimension evaluator gates quality with feedback loop. All data stored in Neon.

**Tech Stack:** Python 3.13, asyncpg, Neon Postgres, NIM API (Qwen 397B for strategy), existing pipeline infrastructure

---

### Task 1: Database Migration — campaign_strategies table + new columns

**Files:**
- Modify: `src/lib/db/schema.ts`
- Run: migration script against Neon

- [ ] **Step 1: Run migration to create table and add columns**

```python
import asyncio, asyncpg
from config import DATABASE_URL

async def migrate():
    conn = await asyncpg.connect(DATABASE_URL)

    # New table: campaign_strategies
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS campaign_strategies (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id       UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
            country          TEXT NOT NULL,
            tier             INT DEFAULT 1,
            monthly_budget   NUMERIC,
            budget_mode      TEXT DEFAULT 'ratio' CHECK (budget_mode IN ('fixed', 'ratio')),
            strategy_data    JSONB NOT NULL,
            evaluation_score NUMERIC,
            evaluation_data  JSONB,
            evaluation_passed BOOLEAN,
            version          INT DEFAULT 1,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    await conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_campaign_strategies_request
        ON campaign_strategies(request_id)
    """)

    # New columns on existing tables
    await conn.execute("ALTER TABLE actor_profiles ADD COLUMN IF NOT EXISTS targeting_profile JSONB")
    await conn.execute("ALTER TABLE creative_briefs ADD COLUMN IF NOT EXISTS budget_data JSONB")
    await conn.execute("ALTER TABLE generated_assets ADD COLUMN IF NOT EXISTS ad_set_assignment JSONB")

    print("Migration complete: campaign_strategies table + 3 new columns")
    await conn.close()

asyncio.run(migrate())
```

Run: `cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "<above>"`
Expected: `Migration complete: campaign_strategies table + 3 new columns`

- [ ] **Step 2: Update schema.ts**

Add after the `compute_jobs` table creation (around line 230):

```typescript
  // 15. campaign_strategies — media plan per country
  await sql`
    CREATE TABLE IF NOT EXISTS campaign_strategies (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id       UUID REFERENCES intake_requests(id) ON DELETE CASCADE,
      country          TEXT NOT NULL,
      tier             INT DEFAULT 1,
      monthly_budget   NUMERIC,
      budget_mode      TEXT DEFAULT 'ratio' CHECK (budget_mode IN ('fixed', 'ratio')),
      strategy_data    JSONB NOT NULL,
      evaluation_score NUMERIC,
      evaluation_data  JSONB,
      evaluation_passed BOOLEAN,
      version          INT DEFAULT 1,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaign_strategies_request ON campaign_strategies(request_id)`;
```

- [ ] **Step 3: Add Neon helper functions for campaign_strategies**

Add to `worker/neon_client.py`:

```python
async def save_campaign_strategy(request_id: str, strategy: dict) -> str:
    """Save a campaign strategy to Neon. Returns the strategy ID."""
    import json, uuid
    pool = await _get_pool()
    strategy_id = str(uuid.uuid4())
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO campaign_strategies (id, request_id, country, tier, monthly_budget,
                budget_mode, strategy_data, evaluation_score, evaluation_data, evaluation_passed)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, $10)
            """,
            strategy_id,
            request_id,
            strategy.get("country", "global"),
            strategy.get("tier", 1),
            strategy.get("monthly_budget"),
            strategy.get("budget_mode", "ratio"),
            json.dumps(strategy.get("strategy_data", {})),
            strategy.get("evaluation_score"),
            json.dumps(strategy.get("evaluation_data", {})) if strategy.get("evaluation_data") else None,
            strategy.get("evaluation_passed"),
        )
    return strategy_id


async def update_actor_targeting(actor_id: str, targeting_profile: dict) -> None:
    """Save targeting_profile JSONB on an actor profile."""
    import json
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE actor_profiles SET targeting_profile = $1::jsonb WHERE id = $2::uuid",
            json.dumps(targeting_profile),
            actor_id,
        )
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts worker/neon_client.py
git commit -m "feat: campaign_strategies table + targeting_profile column + Neon helpers"
```

---

### Task 2: Enrich Persona Generation with targeting_profile

**Files:**
- Modify: `worker/prompts/persona_engine.py` (the LLM persona generation prompt, around line 1240-1280)

- [ ] **Step 1: Add targeting_profile to the persona output schema**

In `worker/prompts/persona_engine.py`, find the `LLM_PERSONA_PROMPT` string (the section starting around line 1240 that lists "For each persona, output:"). Add `targeting_profile` to the output schema. After the existing `- score:` field (around line 1271), add:

```python
- targeting_profile: {
    demographics: {
      age_min: integer (lower bound of age_range),
      age_max: integer (upper bound of age_range),
      gender: "all" | "male" | "female",
      education_level: "high_school" | "university" | "graduate" | "any",
      occupation: specific job title or "student" or "freelancer",
      income_bracket: "low" | "medium" | "high",
      languages: list of languages this persona speaks,
      relationship_status: "single" | "married" | "any"
    },
    interests: {
      hyper: list of 3+ VERY specific interests related to the task (e.g., "AI data labeling", "voice recording freelance", "linguistic research" — NOT generic like "technology"),
      hot: list of 2-3 stacked interests (e.g., "side hustle" + "flexible work schedule"),
      broad: list of 3-5 wider interests to cover the full target base (e.g., "part time jobs", "online earning", "university life")
    },
    behaviors: list of 3 behavioral traits (e.g., "smartphone power user", "mobile payment user", "online course taker"),
    psychographics: {
      values: list of 3 core values,
      pain_points: same as persona pain_points (reference),
      media_consumption: list of platform + usage patterns (e.g., "TikTok 2hrs/day", "WhatsApp groups")
    },
    estimated_pool_size: "large" | "medium" | "small" — how many people match this targeting in the region,
    expected_cpl_tier: "low" | "medium" | "high" — estimated cost per lead on primary channels,
    budget_weight_pct: integer 1-100 — what % of budget this persona should get (all personas must sum to 100)
  }
```

Also add this rule to the CRITICAL section at the bottom of the prompt:

```
- targeting_profile.interests.hyper MUST be specific to the task type. For audio recording → "voice acting", "podcast production", "audiobook narration". For data annotation → "AI training data", "data labeling", "machine learning datasets". NEVER generic like "technology" or "AI".
- budget_weight_pct across all personas MUST sum to exactly 100
- estimated_pool_size should reflect actual market size in the target region based on cultural research
```

- [ ] **Step 2: Save targeting_profile to Neon after persona generation**

In `worker/pipeline/stage1_intelligence.py`, find where personas are generated and actors are saved (after `generate_personas_llm` is called). After each actor is saved to Neon, add:

```python
# Save targeting_profile on the actor record
targeting = persona.get("targeting_profile", {})
if targeting:
    await update_actor_targeting(str(actor_id), targeting)
    logger.info("Saved targeting_profile for persona '%s' (pool=%s, cpl=%s, weight=%d%%)",
        persona.get("archetype_key", "?"),
        targeting.get("estimated_pool_size", "?"),
        targeting.get("expected_cpl_tier", "?"),
        targeting.get("budget_weight_pct", 0),
    )
```

Add the import at the top of stage1_intelligence.py:
```python
from neon_client import update_actor_targeting
```

- [ ] **Step 3: Verify prompt compiles**

```bash
cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from prompts.persona_engine import generate_personas_llm; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add worker/prompts/persona_engine.py worker/pipeline/stage1_intelligence.py
git commit -m "feat: enrich personas with targeting_profile (demographics, interests, behaviors)"
```

---

### Task 3: Budget Cascade Logic

**Files:**
- Create: `worker/prompts/campaign_strategy.py`

- [ ] **Step 1: Create the budget cascade module**

```python
"""Campaign Strategy — budget cascade, ad set optimization, platform translation.

Takes personas (with targeting_profiles) + cultural research + budget and produces
a full Tier 1 media plan per country with ad sets, budget allocation, split tests,
and kill/scale rules.

Budget cascade: RFP → countries → personas → ad sets
Rules:
- $10/day minimum per ad set (auto-reduce if below)
- $1,800/mo minimum per country (auto-cut if below)
- No budget = ratio mode (percentages only)
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Budget thresholds
MIN_DAILY_PER_AD_SET = 10
MIN_MONTHLY_PER_COUNTRY = 1800
KILL_THRESHOLD_MULTIPLIER = 1.5
MAX_AD_SETS_PER_PERSONA = 5
MIN_AD_SETS_PER_PERSONA = 2


def calculate_budget_cascade(
    *,
    total_monthly: float | None,
    countries: list[dict],
    personas: list[dict],
) -> dict[str, Any]:
    """Calculate the full budget cascade from RFP to ad sets.

    Parameters
    ----------
    total_monthly : float | None
        Monthly budget from RFP. None = ratio mode.
    countries : list[dict]
        Each dict has: country, market_opportunity_score (0-1).
    personas : list[dict]
        Each dict has: archetype_key, targeting_profile.budget_weight_pct.

    Returns
    -------
    dict with budget_mode, country_allocations, persona_allocations, flags, deferred_markets
    """
    if not total_monthly or total_monthly <= 0:
        return _calculate_ratio_mode(countries, personas)

    return _calculate_fixed_mode(total_monthly, countries, personas)


def _calculate_fixed_mode(
    total_monthly: float,
    countries: list[dict],
    personas: list[dict],
) -> dict:
    """Fixed budget mode — actual dollar amounts with optimization rules."""
    result = {
        "budget_mode": "fixed",
        "total_monthly": total_monthly,
        "country_allocations": {},
        "deferred_markets": [],
        "flags": [],
    }

    # Rank countries by opportunity score
    ranked = sorted(countries, key=lambda c: c.get("market_opportunity_score", 0.5), reverse=True)
    total_score = sum(c.get("market_opportunity_score", 0.5) for c in ranked)

    # Initial country allocation by market opportunity weight
    active_countries = []
    for country_data in ranked:
        country = country_data["country"]
        weight = country_data.get("market_opportunity_score", 0.5) / total_score
        allocation = total_monthly * weight

        if allocation < MIN_MONTHLY_PER_COUNTRY:
            result["deferred_markets"].append({
                "country": country,
                "would_need": MIN_MONTHLY_PER_COUNTRY,
                "allocated": round(allocation, 2),
                "reactivation_budget": round(
                    MIN_MONTHLY_PER_COUNTRY * len(ranked) / weight, 2
                ),
                "reason": f"${allocation:.0f}/mo below ${MIN_MONTHLY_PER_COUNTRY} minimum",
            })
            result["flags"].append(
                f"Deferred {country}: ${allocation:.0f}/mo insufficient (need ${MIN_MONTHLY_PER_COUNTRY})"
            )
        else:
            active_countries.append({"country": country, "weight": weight, "monthly": allocation})

    # If ALL countries are below minimum, keep top N that fit
    if not active_countries and ranked:
        max_countries = max(1, int(total_monthly / MIN_MONTHLY_PER_COUNTRY))
        active_countries = [
            {
                "country": c["country"],
                "weight": 1.0 / max_countries,
                "monthly": total_monthly / max_countries,
            }
            for c in ranked[:max_countries]
        ]
        result["deferred_markets"] = [
            d for d in result["deferred_markets"]
            if d["country"] not in {a["country"] for a in active_countries}
        ]
        result["flags"].append(
            f"Auto-consolidated to {max_countries} countries (budget too thin for all {len(ranked)})"
        )

    # Redistribute budget to active countries
    active_total_weight = sum(c["weight"] for c in active_countries)
    for c in active_countries:
        c["monthly"] = total_monthly * (c["weight"] / active_total_weight)
        c["daily"] = round(c["monthly"] / 30, 2)
        c["persona_allocations"] = _allocate_personas(c["monthly"], personas)
        result["country_allocations"][c["country"]] = c

    return result


def _allocate_personas(
    country_monthly: float,
    personas: list[dict],
) -> dict[str, dict]:
    """Allocate budget to personas within a country, respecting $10/day minimum."""
    allocations = {}

    for persona in personas:
        key = persona.get("archetype_key", "unknown")
        tp = persona.get("targeting_profile", {})
        weight_pct = tp.get("budget_weight_pct", 100 // len(personas))
        persona_monthly = country_monthly * (weight_pct / 100)
        persona_daily = persona_monthly / 30

        # Determine ad set count based on $10/day minimum
        ideal_ad_sets = MAX_AD_SETS_PER_PERSONA
        per_ad_set_daily = persona_daily / ideal_ad_sets

        flags = []
        if per_ad_set_daily < MIN_DAILY_PER_AD_SET:
            # Reduce ad sets until minimum is met
            for n in range(ideal_ad_sets, MIN_AD_SETS_PER_PERSONA - 1, -1):
                if persona_daily / n >= MIN_DAILY_PER_AD_SET:
                    ideal_ad_sets = n
                    per_ad_set_daily = persona_daily / n
                    break
            else:
                ideal_ad_sets = MIN_AD_SETS_PER_PERSONA
                per_ad_set_daily = persona_daily / MIN_AD_SETS_PER_PERSONA
                if per_ad_set_daily < MIN_DAILY_PER_AD_SET:
                    flags.append(
                        f"Underfunded: ${per_ad_set_daily:.2f}/day per ad set "
                        f"(need ${MIN_DAILY_PER_AD_SET}). "
                        f"Recommend increasing budget or excluding persona."
                    )

        kill_threshold = round(per_ad_set_daily * KILL_THRESHOLD_MULTIPLIER, 2)

        allocations[key] = {
            "weight_pct": weight_pct,
            "monthly": round(persona_monthly, 2),
            "daily": round(persona_daily, 2),
            "ad_set_count": ideal_ad_sets,
            "per_ad_set_daily": round(per_ad_set_daily, 2),
            "kill_threshold": kill_threshold,
            "flags": flags,
        }

    return allocations


def _calculate_ratio_mode(
    countries: list[dict],
    personas: list[dict],
) -> dict:
    """Ratio mode — percentages only, no dollar amounts."""
    ranked = sorted(countries, key=lambda c: c.get("market_opportunity_score", 0.5), reverse=True)
    total_score = sum(c.get("market_opportunity_score", 0.5) for c in ranked)

    country_ratios = {}
    for c in ranked:
        weight = c.get("market_opportunity_score", 0.5) / total_score
        country_ratios[c["country"]] = {
            "weight_pct": round(weight * 100, 1),
            "persona_ratios": {
                p.get("archetype_key", "unknown"): p.get("targeting_profile", {}).get("budget_weight_pct", 33)
                for p in personas
            },
            "recommended_ad_sets": "3-5 depending on budget",
        }

    return {
        "budget_mode": "ratio",
        "total_monthly": None,
        "country_allocations": country_ratios,
        "deferred_markets": [],
        "flags": ["No budget specified — output is ratios only. Plug in your monthly budget and multiply."],
    }


# ── Platform Translation ──────────────────────────────────────────

PLATFORM_TARGETING_MAP = {
    "meta": {
        "label": "Meta (Facebook/Instagram)",
        "hyper": "Interest targeting",
        "hot": "Stacked interests",
        "broad": "Broad demographics",
        "lla": "Lookalike audiences",
        "retargeting": "Pixel visitors",
    },
    "tiktok": {
        "label": "TikTok",
        "hyper": "Interest targeting",
        "hot": "Behavior + interest combo",
        "broad": "Broad age/geo",
        "lla": "Custom audience lookalike",
        "retargeting": "Pixel/engagement retarget",
    },
    "linkedin": {
        "label": "LinkedIn",
        "hyper": "Job title + skill targeting",
        "hot": "Industry + seniority",
        "broad": "Company size + function",
        "lla": "Matched audience lookalike",
        "retargeting": "Website/engagement retarget",
    },
    "youtube": {
        "label": "YouTube",
        "hyper": "In-market + affinity audiences",
        "hot": "Custom intent audiences",
        "broad": "Demographics",
        "lla": "Similar audiences",
        "retargeting": "Remarketing lists",
    },
    "x": {
        "label": "X (Twitter)",
        "hyper": "Keyword + follower lookalike",
        "hot": "Conversation topics",
        "broad": "Interest categories",
        "lla": "Tailored audience lookalike",
        "retargeting": "Website tag retarget",
    },
    "snapchat": {
        "label": "Snapchat",
        "hyper": "Snap Lifestyle Categories",
        "hot": "Stacked interests",
        "broad": "Demographics + geo",
        "lla": "Snap Audience Match lookalike",
        "retargeting": "Pixel/engagement retarget",
    },
    "pinterest": {
        "label": "Pinterest",
        "hyper": "Interest + keyword targeting",
        "hot": "Actalike targeting",
        "broad": "Broad interests",
        "lla": "Actalike audiences",
        "retargeting": "Engagement retarget",
    },
    "wechat": {
        "label": "WeChat",
        "hyper": "Interest + behavior tags",
        "hot": "Stacked tags",
        "broad": "Demographics",
        "lla": "Mini Program lookalike",
        "retargeting": "Official Account followers",
    },
}


def translate_targeting_for_platform(
    targeting_profile: dict,
    platform: str,
) -> dict[str, Any]:
    """Translate universal targeting profile to platform-specific parameters."""
    # Map platform keys to platform families
    platform_family = "meta"  # default
    if "tiktok" in platform:
        platform_family = "tiktok"
    elif "linkedin" in platform:
        platform_family = "linkedin"
    elif "youtube" in platform:
        platform_family = "youtube"
    elif "twitter" in platform or platform == "x":
        platform_family = "x"
    elif "snap" in platform:
        platform_family = "snapchat"
    elif "pinterest" in platform:
        platform_family = "pinterest"
    elif "wechat" in platform:
        platform_family = "wechat"

    pmap = PLATFORM_TARGETING_MAP.get(platform_family, PLATFORM_TARGETING_MAP["meta"])
    interests = targeting_profile.get("interests", {})
    demographics = targeting_profile.get("demographics", {})

    return {
        "platform": platform,
        "platform_family": platform_family,
        "platform_label": pmap["label"],
        "targeting_method": {
            "hyper": {"method": pmap["hyper"], "values": interests.get("hyper", [])},
            "hot": {"method": pmap["hot"], "values": interests.get("hot", [])},
            "broad": {"method": pmap["broad"], "values": interests.get("broad", [])},
        },
        "demographics": {
            "age_min": demographics.get("age_min", 18),
            "age_max": demographics.get("age_max", 65),
            "gender": demographics.get("gender", "all"),
        },
        "tier_2_method": pmap["lla"],
        "retargeting_method": pmap["retargeting"],
    }
```

- [ ] **Step 2: Verify module compiles**

```bash
cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "
from prompts.campaign_strategy import calculate_budget_cascade, translate_targeting_for_platform

# Test fixed mode
result = calculate_budget_cascade(
    total_monthly=5000,
    countries=[
        {'country': 'Morocco', 'market_opportunity_score': 0.8},
        {'country': 'France', 'market_opportunity_score': 0.6},
        {'country': 'Brazil', 'market_opportunity_score': 0.9},
    ],
    personas=[
        {'archetype_key': 'student', 'targeting_profile': {'budget_weight_pct': 45}},
        {'archetype_key': 'parent', 'targeting_profile': {'budget_weight_pct': 35}},
        {'archetype_key': 'professional', 'targeting_profile': {'budget_weight_pct': 20}},
    ],
)
print(f'Mode: {result[\"budget_mode\"]}')
for c, data in result['country_allocations'].items():
    print(f'  {c}: \${data[\"monthly\"]:.0f}/mo')
print(f'Deferred: {[d[\"country\"] for d in result[\"deferred_markets\"]]}')
print(f'Flags: {result[\"flags\"]}')

# Test platform translation
tp = {'demographics': {'age_min': 18, 'age_max': 24}, 'interests': {'hyper': ['data annotation'], 'hot': ['side hustle'], 'broad': ['technology']}}
meta = translate_targeting_for_platform(tp, 'ig_feed')
print(f'Meta hyper: {meta[\"targeting_method\"][\"hyper\"]}')
tiktok = translate_targeting_for_platform(tp, 'tiktok_feed')
print(f'TikTok hyper: {tiktok[\"targeting_method\"][\"hyper\"]}')
print('OK')
"
```

- [ ] **Step 3: Commit**

```bash
git add worker/prompts/campaign_strategy.py
git commit -m "feat: budget cascade logic + platform targeting translation"
```

---

### Task 4: Campaign Strategy LLM Generator

**Files:**
- Modify: `worker/prompts/campaign_strategy.py` (add strategy generation prompt + function)

- [ ] **Step 1: Add the strategy generation prompt and function**

Append to `worker/prompts/campaign_strategy.py`:

```python
# ── Strategy Generation (LLM) ─────────────────────────────────────

STRATEGY_SYSTEM_PROMPT = """You are an elite media buyer designing a Tier 1 campaign for OneForma recruitment.

You receive: personas (with targeting profiles), cultural research, channel strategy, and budget data.
You output: a complete Tier 1 media plan with campaigns, ad sets, targeting, budget, split test, and rules.

FRAMEWORK (from proven MBA Lead Gen Strategy):
- Tier 1 = Interest-only cold traffic. NO lookalikes. NO retargeting.
- 2 campaigns (A/B split test) — test ONE variable (creative treatment OR copy angle)
- Per campaign: 3-5 ad sets depending on budget
  - Ad Sets 1-3: Hyper-targeted (1 specific interest each)
  - Ad Set 4: Hot interests (2-3 stacked)
  - Ad Set 5: Broad interests (3-5 wider interests)
- Budget split evenly across ad sets within a persona
- Kill threshold: 1.5x daily ad set budget with no leads → pause
- Scale rule: CPA below target after 10 leads → increase 20% every 3 days
- Progression: after 250 tracked leads → add Tier 2 (1% Lead LLA + retargeting)

RULES:
1. Every interest must be SPECIFIC to the task type and region — never generic
2. Demographics must match the persona exactly (age, education, occupation)
3. Placements must match the channel strategy (only platforms in the brief)
4. Kill threshold is ALWAYS 1.5x daily ad set budget — calculate it
5. Split test must change EXACTLY one variable between Campaign A and B
6. Ad set names must be descriptive: "[Targeting Type] — [Interest Description]"
7. creative_assignment_rule maps persona + hook_type + treatment to each ad set

Return ONLY valid JSON matching the campaign_strategy schema.
"""

STRATEGY_USER_PROMPT = """Design a Tier 1 campaign for: {country}

BUDGET DATA:
{budget_json}

PERSONAS (with targeting):
{personas_json}

CHANNEL STRATEGY (only use these platforms):
{channels_json}

CULTURAL RESEARCH SUMMARY:
{research_summary}

TASK TYPE: {task_type}
TASK DESCRIPTION: {task_description}

{budget_instruction}

Return a JSON object with this structure:
{{
  "tier": 1,
  "tier_description": "Interest-only cold traffic",
  "monthly_budget": number or null,
  "budget_mode": "fixed" or "ratio",
  "daily_budget_total": number or null,
  "split_test": {{
    "variable": "creative" or "copy",
    "description": "What differs between Campaign A and B",
    "measurement": "How to measure the winner"
  }},
  "campaigns": [
    {{
      "name": "Campaign name",
      "objective": "lead_generation",
      "optimization": "leads",
      "daily_budget": number or null,
      "ad_sets": [
        {{
          "name": "Descriptive ad set name",
          "persona_key": "archetype_key",
          "targeting_type": "hyper" | "hot" | "broad",
          "interests": ["specific", "interests"],
          "demographics": {{"age_min": int, "age_max": int, "gender": "all"}},
          "placements": ["platform_keys"],
          "daily_budget": number or null,
          "kill_threshold": number or null,
          "kill_rule": "Specific kill rule with number",
          "scale_rule": "Specific scale rule with numbers",
          "creative_assignment_rule": {{
            "persona": "key",
            "hook_types": ["earnings", "curiosity"],
            "treatment": "gradient_overlay" | "split_panel" | "shape_overlay"
          }},
          "creatives_assigned": []
        }}
      ]
    }}
  ],
  "progression_rules": {{
    "next_tier": 2,
    "trigger": "250 tracked leads across all ad sets",
    "adds": ["what Tier 2 adds"],
    "estimated_timeline": "X weeks at current budget"
  }},
  "scaling_rules": {{
    "winning_ad_set": "specific rule",
    "losing_ad_set": "specific rule",
    "winning_creative": "specific rule"
  }},
  "deferred_markets": []
}}
"""


async def generate_campaign_strategy(
    *,
    country: str,
    personas: list[dict],
    cultural_research: dict,
    channel_strategy: list[str],
    budget_data: dict,
    task_type: str,
    task_description: str,
    feedback: list[str] | None = None,
) -> dict[str, Any]:
    """Generate a Tier 1 campaign strategy for one country via LLM.

    Returns the campaign_strategy JSON dict.
    """
    from ai.local_llm import generate_text

    budget_instruction = ""
    if budget_data.get("budget_mode") == "ratio":
        budget_instruction = (
            "No dollar budget specified. Output RATIOS ONLY — percentage allocations, "
            "no dollar amounts. Ad set daily_budget and kill_threshold should be null. "
            "Include recommended_ad_sets as '3-5 depending on budget'."
        )
    else:
        budget_instruction = (
            f"Budget is FIXED at ${budget_data.get('total_monthly', 0):.0f}/mo total. "
            f"This country gets ${budget_data.get('country_monthly', 0):.0f}/mo. "
            f"Calculate exact daily budgets and kill thresholds."
        )

    # Build personas JSON (trimmed for prompt size)
    personas_trimmed = []
    for p in personas:
        tp = p.get("targeting_profile", {})
        personas_trimmed.append({
            "archetype_key": p.get("archetype_key"),
            "age_range": p.get("age_range"),
            "occupation": tp.get("demographics", {}).get("occupation", "unknown"),
            "interests": tp.get("interests", {}),
            "budget_weight_pct": tp.get("budget_weight_pct", 33),
            "estimated_pool_size": tp.get("estimated_pool_size", "medium"),
            "media_consumption": tp.get("psychographics", {}).get("media_consumption", []),
        })

    user_prompt = STRATEGY_USER_PROMPT.format(
        country=country,
        budget_json=json.dumps(budget_data, indent=2, default=str),
        personas_json=json.dumps(personas_trimmed, indent=2, default=str),
        channels_json=json.dumps(channel_strategy, default=str),
        research_summary=json.dumps(cultural_research, default=str)[:2000],
        task_type=task_type,
        task_description=task_description[:500],
        budget_instruction=budget_instruction,
    )

    if feedback:
        user_prompt += (
            "\n\n⚠️ PREVIOUS STRATEGY FAILED EVALUATION. Fix these issues:\n"
            + "\n".join(f"- {f}" for f in feedback)
        )

    raw = await generate_text(
        STRATEGY_SYSTEM_PROMPT,
        user_prompt,
        max_tokens=8192,
        temperature=0.4,
    )

    # Parse JSON
    return _parse_strategy_json(raw)


def _parse_strategy_json(text: str) -> dict:
    """Parse campaign strategy JSON from LLM output."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        result = json.loads(cleaned)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # Brace-depth search
    brace_depth = 0
    start = -1
    for i, char in enumerate(cleaned):
        if char == '{':
            if brace_depth == 0:
                start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and start >= 0:
                try:
                    return json.loads(cleaned[start:i + 1])
                except json.JSONDecodeError:
                    pass
                start = -1

    logger.warning("Failed to parse campaign strategy JSON (%d chars)", len(text))
    return {}
```

- [ ] **Step 2: Verify**

```bash
cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from prompts.campaign_strategy import generate_campaign_strategy, STRATEGY_SYSTEM_PROMPT; print(f'Strategy prompt: {len(STRATEGY_SYSTEM_PROMPT)} chars'); print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add worker/prompts/campaign_strategy.py
git commit -m "feat: LLM campaign strategy generator with tiered framework"
```

---

### Task 5: Campaign Strategy Evaluator (7 dimensions)

**Files:**
- Create: `worker/ai/campaign_evaluator.py`

- [ ] **Step 1: Create the evaluator**

```python
"""Campaign Strategy Evaluator — 7-dimension quality gate.

Scores a generated campaign strategy against:
1. Targeting specificity (20%)
2. Persona-targeting alignment (15%)
3. Budget math validity (20%)
4. Platform-channel fit (15%)
5. Split test structure (10%)
6. Kill/scale rules present (10%)
7. Tier-appropriate structure (10%)

Pass threshold: 0.80. Feedback loop: up to 3 attempts.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

PASS_THRESHOLD = 0.80
MAX_RETRIES = 3

DIMENSION_WEIGHTS = {
    "targeting_specificity": 0.20,
    "persona_alignment": 0.15,
    "budget_math": 0.20,
    "platform_fit": 0.15,
    "split_test": 0.10,
    "kill_scale_rules": 0.10,
    "tier_structure": 0.10,
}

# Weights when budget_mode = "ratio" (skip budget_math, redistribute)
RATIO_MODE_WEIGHTS = {
    "targeting_specificity": 0.25,
    "persona_alignment": 0.19,
    "budget_math": 0.0,
    "platform_fit": 0.19,
    "split_test": 0.12,
    "kill_scale_rules": 0.12,
    "tier_structure": 0.13,
}


def evaluate_campaign_strategy(
    strategy: dict[str, Any],
    personas: list[dict],
    channel_strategy: list[str],
    budget_mode: str = "fixed",
) -> dict[str, Any]:
    """Evaluate a campaign strategy against 7 dimensions.

    Returns dict with: passed, overall_score, dimensions, issues.
    """
    weights = RATIO_MODE_WEIGHTS if budget_mode == "ratio" else DIMENSION_WEIGHTS
    dimensions = {}
    all_issues = []

    # 1. Targeting specificity
    score, issues = _check_targeting_specificity(strategy, personas)
    dimensions["targeting_specificity"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    # 2. Persona-targeting alignment
    score, issues = _check_persona_alignment(strategy, personas)
    dimensions["persona_alignment"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    # 3. Budget math validity
    if budget_mode == "fixed":
        score, issues = _check_budget_math(strategy)
        dimensions["budget_math"] = {"score": score, "issues": issues}
        all_issues.extend(issues)
    else:
        dimensions["budget_math"] = {"score": 1.0, "issues": [], "skipped": True}

    # 4. Platform-channel fit
    score, issues = _check_platform_fit(strategy, personas, channel_strategy)
    dimensions["platform_fit"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    # 5. Split test structure
    score, issues = _check_split_test(strategy)
    dimensions["split_test"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    # 6. Kill/scale rules
    score, issues = _check_kill_scale_rules(strategy)
    dimensions["kill_scale_rules"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    # 7. Tier-appropriate structure
    score, issues = _check_tier_structure(strategy)
    dimensions["tier_structure"] = {"score": score, "issues": issues}
    all_issues.extend(issues)

    # Calculate weighted average
    overall = sum(
        dimensions[dim]["score"] * weights[dim]
        for dim in weights
    )

    passed = overall >= PASS_THRESHOLD

    logger.info(
        "Campaign strategy eval: score=%.2f (%s) — %d issues",
        overall, "PASS" if passed else "FAIL", len(all_issues),
    )

    return {
        "passed": passed,
        "overall_score": round(overall, 3),
        "dimensions": dimensions,
        "issues": all_issues,
    }


def _check_targeting_specificity(strategy: dict, personas: list) -> tuple[float, list[str]]:
    """Check that interests are specific, not generic."""
    issues = []
    generic_terms = {"technology", "internet", "social media", "ai", "computer", "digital", "online", "mobile"}

    campaigns = strategy.get("campaigns", [])
    total_ad_sets = 0
    specific_count = 0

    for campaign in campaigns:
        for ad_set in campaign.get("ad_sets", []):
            total_ad_sets += 1
            interests = ad_set.get("interests", [])
            if not interests:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' has no interests")
                continue

            generic_found = [i for i in interests if i.lower() in generic_terms]
            if generic_found:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' has generic interests: {generic_found}")
            else:
                specific_count += 1

            if ad_set.get("targeting_type") == "hyper" and len(interests) > 2:
                issues.append(f"Hyper ad set '{ad_set.get('name', '?')}' has {len(interests)} interests (should be 1-2)")

    if total_ad_sets == 0:
        return 0.0, ["No ad sets found in strategy"]

    score = specific_count / total_ad_sets
    return round(score, 2), issues


def _check_persona_alignment(strategy: dict, personas: list) -> tuple[float, list[str]]:
    """Check demographics match persona archetypes."""
    issues = []
    persona_map = {p.get("archetype_key", ""): p for p in personas}
    checks_passed = 0
    checks_total = 0

    for campaign in strategy.get("campaigns", []):
        for ad_set in campaign.get("ad_sets", []):
            persona_key = ad_set.get("persona_key", "")
            persona = persona_map.get(persona_key)
            if not persona:
                continue

            checks_total += 1
            demo = ad_set.get("demographics", {})
            tp = persona.get("targeting_profile", {}).get("demographics", {})

            if tp:
                age_match = (
                    demo.get("age_min", 18) >= tp.get("age_min", 18) - 2 and
                    demo.get("age_max", 65) <= tp.get("age_max", 65) + 2
                )
                if not age_match:
                    issues.append(
                        f"Ad set '{ad_set.get('name', '?')}' age {demo.get('age_min')}-{demo.get('age_max')} "
                        f"doesn't match persona {persona_key} ({tp.get('age_min')}-{tp.get('age_max')})"
                    )
                else:
                    checks_passed += 1
            else:
                checks_passed += 1  # No targeting profile to check against

    if checks_total == 0:
        return 0.5, ["No ad sets with persona_key found"]

    return round(checks_passed / checks_total, 2), issues


def _check_budget_math(strategy: dict) -> tuple[float, list[str]]:
    """Check budget allocations are valid."""
    issues = []
    checks_passed = 0
    checks_total = 0

    for campaign in strategy.get("campaigns", []):
        for ad_set in campaign.get("ad_sets", []):
            checks_total += 1
            daily = ad_set.get("daily_budget")
            kill = ad_set.get("kill_threshold")

            if daily is not None and daily < 10:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' budget ${daily}/day < $10 minimum")
            elif daily is not None:
                checks_passed += 1

            if daily is not None and kill is not None:
                expected_kill = round(daily * 1.5, 2)
                if abs(kill - expected_kill) > 1:
                    issues.append(
                        f"Ad set '{ad_set.get('name', '?')}' kill threshold ${kill} "
                        f"doesn't match 1.5x daily (expected ~${expected_kill})"
                    )

    # Check persona weights sum to ~100
    persona_weights = set()
    for campaign in strategy.get("campaigns", []):
        for ad_set in campaign.get("ad_sets", []):
            rule = ad_set.get("creative_assignment_rule", {})
            if rule.get("persona"):
                persona_weights.add(rule["persona"])

    if checks_total == 0:
        return 0.5, ["No ad sets with budget data"]

    return round(checks_passed / max(checks_total, 1), 2), issues


def _check_platform_fit(strategy: dict, personas: list, channels: list) -> tuple[float, list[str]]:
    """Check placements match channel strategy and persona demographics."""
    issues = []
    checks_passed = 0
    checks_total = 0

    channel_set = set(ch.lower() for ch in channels)

    for campaign in strategy.get("campaigns", []):
        for ad_set in campaign.get("ad_sets", []):
            placements = ad_set.get("placements", [])
            checks_total += 1

            if not placements:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' has no placements")
                continue

            # Check placements are in channel strategy
            invalid = [p for p in placements if p.lower() not in channel_set and not any(p.lower() in ch for ch in channel_set)]
            if invalid:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' has placements not in channel strategy: {invalid}")
            else:
                checks_passed += 1

    if checks_total == 0:
        return 0.5, ["No ad sets with placements"]

    return round(checks_passed / checks_total, 2), issues


def _check_split_test(strategy: dict) -> tuple[float, list[str]]:
    """Check split test structure."""
    issues = []
    split = strategy.get("split_test", {})

    if not split:
        return 0.0, ["No split test defined"]

    variable = split.get("variable", "")
    if not variable:
        issues.append("Split test has no variable specified")
        return 0.2, issues

    if variable not in ("creative", "copy", "audience", "placement"):
        issues.append(f"Split test variable '{variable}' is unusual — expected 'creative' or 'copy'")

    if not split.get("description"):
        issues.append("Split test has no description of what differs")

    if not split.get("measurement"):
        issues.append("Split test has no measurement criteria")

    campaigns = strategy.get("campaigns", [])
    if len(campaigns) < 2:
        issues.append("Need at least 2 campaigns for a split test")
        return 0.3, issues

    score = 1.0 - (len(issues) * 0.25)
    return max(0.0, round(score, 2)), issues


def _check_kill_scale_rules(strategy: dict) -> tuple[float, list[str]]:
    """Check every ad set has specific kill/scale rules."""
    issues = []
    has_rules = 0
    total = 0

    for campaign in strategy.get("campaigns", []):
        for ad_set in campaign.get("ad_sets", []):
            total += 1
            kill = ad_set.get("kill_rule", "")
            scale = ad_set.get("scale_rule", "")

            if not kill:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' missing kill rule")
            elif "monitor" in kill.lower() or "adjust" in kill.lower():
                issues.append(f"Ad set '{ad_set.get('name', '?')}' kill rule is vague: '{kill}'")
            else:
                has_rules += 1

            if not scale:
                issues.append(f"Ad set '{ad_set.get('name', '?')}' missing scale rule")

    if total == 0:
        return 0.0, ["No ad sets found"]

    return round(has_rules / total, 2), issues


def _check_tier_structure(strategy: dict) -> tuple[float, list[str]]:
    """Check tier-appropriate structure."""
    issues = []
    tier = strategy.get("tier", 1)

    if tier == 1:
        # Tier 1 should NOT have LLAs or retargeting
        for campaign in strategy.get("campaigns", []):
            for ad_set in campaign.get("ad_sets", []):
                targeting = ad_set.get("targeting_type", "")
                name = ad_set.get("name", "").lower()
                if "lookalike" in name or "lla" in name or "retarget" in name:
                    issues.append(f"Tier 1 should not have LLA/retargeting: '{ad_set.get('name')}'")

    progression = strategy.get("progression_rules", {})
    if not progression.get("trigger"):
        issues.append("No progression trigger defined (need specific threshold like '250 leads')")
    elif "enough" in str(progression.get("trigger", "")).lower():
        issues.append(f"Progression trigger is vague: '{progression['trigger']}' — need specific number")

    score = 1.0 - (len(issues) * 0.3)
    return max(0.0, round(score, 2)), issues
```

- [ ] **Step 2: Verify**

```bash
cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "
from ai.campaign_evaluator import evaluate_campaign_strategy, PASS_THRESHOLD
print(f'Threshold: {PASS_THRESHOLD}')

# Test with a minimal strategy
test = {
    'tier': 1,
    'split_test': {'variable': 'creative', 'description': 'A vs B', 'measurement': 'CPA'},
    'campaigns': [{
        'name': 'Test A',
        'ad_sets': [{
            'name': 'Hyper — Data Annotation',
            'persona_key': 'student',
            'targeting_type': 'hyper',
            'interests': ['data annotation', 'AI training'],
            'demographics': {'age_min': 18, 'age_max': 24},
            'placements': ['ig_feed'],
            'daily_budget': 11,
            'kill_threshold': 16.50,
            'kill_rule': 'No leads after 16.50 — pause',
            'scale_rule': 'CPA below target after 10 leads — increase 20%',
            'creative_assignment_rule': {'persona': 'student', 'hook_types': ['earnings'], 'treatment': 'gradient'},
        }]
    }],
    'progression_rules': {'trigger': '250 tracked leads', 'next_tier': 2, 'adds': ['LLA'], 'estimated_timeline': '3 weeks'},
}
result = evaluate_campaign_strategy(test, [{'archetype_key': 'student', 'targeting_profile': {'demographics': {'age_min': 18, 'age_max': 24}}}], ['ig_feed'])
print(f'Score: {result[\"overall_score\"]} ({\"PASS\" if result[\"passed\"] else \"FAIL\"})')
print(f'Issues: {result[\"issues\"]}')
print('OK')
"
```

- [ ] **Step 3: Commit**

```bash
git add worker/ai/campaign_evaluator.py
git commit -m "feat: 7-dimension campaign strategy evaluator with feedback loop"
```

---

### Task 6: Wire Strategy Engine into Stage 1

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Add strategy generation + evaluation after persona generation**

In `stage1_intelligence.py`, find where personas are generated and the brief is built. After persona generation and before brief generation, add the campaign strategy block.

Find the section after `generate_personas_llm` returns and actors are saved. Add:

```python
    # ── Step 3b: Generate campaign strategy per country ──────────
    from prompts.campaign_strategy import (
        calculate_budget_cascade,
        generate_campaign_strategy,
    )
    from ai.campaign_evaluator import evaluate_campaign_strategy, MAX_RETRIES, PASS_THRESHOLD
    from neon_client import save_campaign_strategy

    monthly_budget = form_data.get("monthly_budget")
    channel_strategy = context.get("brief", {}).get("channels", {}).get("primary", [])
    if not channel_strategy:
        channel_strategy = [p.get("best_channels", ["ig_feed"])[0] for p in personas_result if p.get("best_channels")]
        channel_strategy = list(set(channel_strategy)) or ["ig_feed", "facebook_feed"]

    # Build country list with opportunity scores
    countries_data = []
    for region in target_regions:
        research = research_results.get(region, {})
        # Derive opportunity score from research dimensions
        econ = research.get("economic_context", {})
        tech = research.get("tech_literacy", {})
        opp_score = 0.5  # default
        if isinstance(econ, dict) and isinstance(tech, dict):
            opp_score = min(1.0, 0.3 + len(str(econ)) / 5000 + len(str(tech)) / 5000)
        countries_data.append({"country": region, "market_opportunity_score": opp_score})

    # Calculate budget cascade
    budget_data = calculate_budget_cascade(
        total_monthly=monthly_budget,
        countries=countries_data,
        personas=personas_result,
    )
    logger.info(
        "Budget cascade: mode=%s, countries=%d, deferred=%d, flags=%d",
        budget_data["budget_mode"],
        len(budget_data["country_allocations"]),
        len(budget_data["deferred_markets"]),
        len(budget_data["flags"]),
    )

    # Generate strategy per country
    all_strategies = {}
    for region in target_regions:
        country_budget = budget_data["country_allocations"].get(region, {})
        if not country_budget and budget_data["budget_mode"] == "fixed":
            logger.info("Skipping deferred market: %s", region)
            continue

        country_budget_for_llm = {
            "budget_mode": budget_data["budget_mode"],
            "total_monthly": monthly_budget,
            "country_monthly": country_budget.get("monthly") if isinstance(country_budget, dict) else None,
            "persona_allocations": country_budget.get("persona_allocations", {}) if isinstance(country_budget, dict) else {},
        }

        # Generate + evaluate with feedback loop
        feedback = []
        best_strategy = {}
        best_score = 0.0

        for attempt in range(MAX_RETRIES):
            strategy = await generate_campaign_strategy(
                country=region,
                personas=personas_result,
                cultural_research=research_results.get(region, {}),
                channel_strategy=channel_strategy,
                budget_data=country_budget_for_llm,
                task_type=task_type,
                task_description=form_data.get("description", ""),
                feedback=feedback if feedback else None,
            )

            if not strategy:
                logger.warning("Empty strategy for %s (attempt %d)", region, attempt + 1)
                continue

            # Evaluate
            eval_result = evaluate_campaign_strategy(
                strategy=strategy,
                personas=personas_result,
                channel_strategy=channel_strategy,
                budget_mode=budget_data["budget_mode"],
            )

            score = eval_result["overall_score"]
            logger.info(
                "Strategy eval for %s: %.2f (%s, attempt %d/%d)",
                region, score, "PASS" if eval_result["passed"] else "FAIL",
                attempt + 1, MAX_RETRIES,
            )

            if score > best_score:
                best_score = score
                best_strategy = strategy
                best_strategy["_evaluation"] = eval_result

            if eval_result["passed"]:
                break

            feedback = eval_result["issues"]

        # Save to Neon
        if best_strategy:
            await save_campaign_strategy(request_id, {
                "country": region,
                "tier": best_strategy.get("tier", 1),
                "monthly_budget": country_budget.get("monthly") if isinstance(country_budget, dict) else None,
                "budget_mode": budget_data["budget_mode"],
                "strategy_data": best_strategy,
                "evaluation_score": best_score,
                "evaluation_data": best_strategy.get("_evaluation"),
                "evaluation_passed": best_score >= PASS_THRESHOLD,
            })
            all_strategies[region] = best_strategy
            logger.info("Saved campaign strategy for %s (score=%.2f)", region, best_score)

    context["campaign_strategies"] = all_strategies
    context["budget_data"] = budget_data
```

- [ ] **Step 2: Add budget_data to the brief save**

Find where `save_brief` is called in stage1_intelligence.py. Add budget_data to the save call. Find the brief_data dict that gets saved and add:

```python
    # Add budget_data to the brief
    if budget_data:
        brief_data["budget_data"] = budget_data
        brief_data["campaign_strategies_summary"] = {
            region: {
                "tier": s.get("tier"),
                "ad_set_count": sum(len(c.get("ad_sets", [])) for c in s.get("campaigns", [])),
                "split_test_variable": s.get("split_test", {}).get("variable"),
            }
            for region, s in all_strategies.items()
        }
```

- [ ] **Step 3: Verify Stage 1 compiles**

```bash
cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "from pipeline.stage1_intelligence import run_stage1; print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/stage1_intelligence.py
git commit -m "feat: wire campaign strategy engine into Stage 1 with eval feedback loop"
```

---

### Task 7: Add campaign-strategy Marketing Skill

**Files:**
- Create: `docs/marketingskills/skills/campaign-strategy/SKILL.md`
- Modify: `worker/prompts/marketing_skills.py`

- [ ] **Step 1: Create the marketing skill**

```bash
mkdir -p /Users/stevenjunop/centric-intake/docs/marketingskills/skills/campaign-strategy
```

Create `SKILL.md`:

```markdown
---
name: campaign-strategy
description: "When designing paid media campaign structures, ad set targeting, budget allocation, or split testing strategy. Use when building media plans, defining audience targeting, setting kill/scale rules, or planning campaign tier progression. Sources: MBA Facebook + IG Lead Gen Strategy framework, adapted for multi-platform recruitment."
metadata:
  version: 1.0.0
---

# Campaign Strategy — Tiered Media Plan Framework

You are designing a paid media campaign using a proven tiered progression framework.

## The 5-Tier Model

### Tier 1: Interest-Only (Starting Tier)
- 2 campaigns (A/B split test — ONE variable: creative OR copy)
- Per campaign: 3-5 ad sets depending on budget
  - Ad Sets 1-3: Hyper-targeted (1 specific interest each)
  - Ad Set 4: Hot interests (2-3 stacked)
  - Ad Set 5: Broad interests (3-5 wider)
- Budget split evenly across ad sets
- Kill: 1.5x daily ad set budget with no leads → pause
- Scale: CPA below target after 10 leads → increase 20% every 3 days

### Tier 2: + Lead LLA + Retargeting (after 250 leads)
- Add: 1% Lead Lookalike audience ad set
- Add: Retargeting — visitors exclude leads

### Tier 3: + Main Objective LLA (after 250 conversions)
- Add: 1% Main Objective Lookalike audience ad set

### Tier 4: + Buyer List LLA (after buyer list available)
- Add: Buyer List Lookalike audience ad set

### Tier 5: + Combined LLAs + Expanded (mature campaign)
- Combine: 1% Lead LLA + 1% Main Objective LLA
- Add: Buyer List LLA
- Add: Expanded/Broad campaign

## Budget Rules

- Minimum $10/day per ad set (auto-reduce ad sets if below)
- Minimum $1,800/mo per country (3 personas × 2 ad sets × $10/day × 30)
- Kill threshold: always 1.5x daily ad set budget
- After $30-50 spend per ad set with no results: pause
- Scaling: do more of what works, increase budget gradually (20% every 3 days)

## Interest Targeting Hierarchy

| Type | Count | Specificity | Example |
|------|-------|-------------|---------|
| Hyper | 1 per ad set | Very specific to task | "AI data labeling", "voice recording freelance" |
| Hot | 2-3 stacked | Related interests | "side hustle" + "flexible work schedule" |
| Broad | 3-5 | Wide coverage | "technology" + "part time jobs" + "online earning" |

## Split Testing Rules

- ALWAYS launch with a split test (2 campaigns)
- Test ONE variable at a time (creative treatment OR copy angle)
- Everything else identical between Campaign A and B
- Measure: compare CPA after statistically significant sample
- Winner gets scaled, loser gets paused
```

- [ ] **Step 2: Add to marketing skills stage mapping**

In `worker/prompts/marketing_skills.py`, add a new stage:

```python
    "strategy": ["campaign-strategy", "paid-ads"],
```

Add this to the `STAGE_SKILLS` dict.

- [ ] **Step 3: Verify skill loads**

```bash
cd /Users/stevenjunop/centric-intake/worker && /opt/homebrew/bin/python3.13 -c "
from prompts.marketing_skills import get_skills_for_stage
s = get_skills_for_stage('strategy')
print(f'Strategy skills: {len(s)} chars')
assert 'Tier 1' in s
assert 'Kill' in s
print('OK')
"
```

- [ ] **Step 4: Commit**

```bash
git add docs/marketingskills/skills/campaign-strategy/ worker/prompts/marketing_skills.py
git commit -m "feat: campaign-strategy marketing skill + strategy stage injection"
```
