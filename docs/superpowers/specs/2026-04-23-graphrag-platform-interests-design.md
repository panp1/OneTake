# GraphRAG Platform Interest Routing — Design Spec

> Feature: Knowledge graph of real platform advertising interests with cross-platform intelligence. Replaces LLM-hallucinated interests with validated platform-specific targeting.
> Date: 2026-04-23
> Status: Approved
> Fixes: Media Strategy Parsing Issues #1 (interests structure mismatch), #2 (missing channel mix), #3 (missing campaigns array)

---

## Problem

The LLM generates freetext interests like "tech-savvy professionals interested in AI" for ad set targeting. These are:
- Not real platform interests (hallucinated)
- Not structured correctly (`interests[]` flat array vs `interests_by_tier: {hyper, hot, broad}`)
- Not actionable by ad agencies (can't paste into Meta Ads Manager)
- Not cross-platform aware (same concept has different names on each platform)

## Solution

A **Postgres-native knowledge graph** of 1,100+ real platform interests across 6 ad platforms. The graph captures hierarchies (category → subcategory → interest), cross-platform equivalences (Meta's "Software" = LinkedIn's "Information Technology"), and semantic relationships. At strategy generation time, the pipeline queries the graph to map campaign context to real, validated platform interests — structured as `interests_by_tier: {hyper[], hot[], broad[]}`.

---

## Graph Schema

### Tables

```sql
-- Every real platform interest is a node
CREATE TABLE interest_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    TEXT NOT NULL,
  category    TEXT NOT NULL,
  subcategory TEXT,
  interest    TEXT NOT NULL,
  tier        TEXT DEFAULT 'standard',
  keywords    TEXT[] DEFAULT '{}',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, category, interest)
);

-- Relationships between nodes
CREATE TABLE interest_edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
  edge_type   TEXT NOT NULL CHECK (edge_type IN ('equivalent_on', 'related_to', 'parent_of', 'sibling')),
  weight      FLOAT DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, edge_type)
);

-- Indexes
CREATE INDEX idx_interest_nodes_platform ON interest_nodes(platform);
CREATE INDEX idx_interest_nodes_category ON interest_nodes(platform, category);
CREATE INDEX idx_interest_nodes_search ON interest_nodes USING GIN(keywords);
CREATE INDEX idx_interest_edges_source ON interest_edges(source_id);
CREATE INDEX idx_interest_edges_target ON interest_edges(target_id);
CREATE INDEX idx_interest_edges_type ON interest_edges(edge_type);
```

### Edge Types

| Type | Meaning | Example |
|---|---|---|
| `equivalent_on` | Same concept, different platform | Meta "Software" ↔ LinkedIn "Information Technology" |
| `related_to` | Semantically related on same platform | "Digital marketing" → "Social media" |
| `parent_of` | Hierarchy within a platform | "Business and industry" → "Online" → "Digital marketing" |
| `sibling` | Same level within a category | "Investment banking" ↔ "Retail banking" (both under "Banking") |

### Node Count Estimates

| Platform | Nodes | Completeness | Gap-Fill Strategy |
|---|---|---|---|
| Meta/Facebook | ~250 | 100% | Complete from PDF |
| LinkedIn | ~400 | 95% | API endpoint for remainder |
| TikTok | ~100 | 14% | API backfill when account available (TODO) |
| Reddit | ~152 | 100% via API | `GET /api/v3/targeting/interests` — no approval needed |
| Snapchat | ~90 | 80% | API endpoint with ad account auth |
| WeChat | ~124 | 70% | Michael's team for Tencent Ads access |
| **Total** | **~1,116** | | |

### Cross-Platform Edges (Seeded)

The seeding script generates cross-platform `equivalent_on` edges by matching:
1. Exact name matches across platforms (case-insensitive)
2. Keyword overlap (e.g., Meta node with `keywords: ["software", "tech"]` matches LinkedIn "Computer Software")
3. Manual curated mappings for critical recruitment-relevant interests

Estimated initial edges: ~500 `equivalent_on` + ~300 `parent_of` + ~200 `related_to` + ~100 `sibling` = ~1,100 edges.

---

## Query Patterns

### 1. Get all interests for a platform

```sql
SELECT category, subcategory, interest, tier
FROM interest_nodes
WHERE platform = 'meta' AND is_active = TRUE
ORDER BY category, subcategory, interest;
```

### 2. Find cross-platform equivalents

```sql
-- Given Meta's "Software" interest, find equivalents on LinkedIn
SELECT n2.platform, n2.category, n2.interest
FROM interest_nodes n1
JOIN interest_edges e ON e.source_id = n1.id AND e.edge_type = 'equivalent_on'
JOIN interest_nodes n2 ON n2.id = e.target_id
WHERE n1.platform = 'meta' AND n1.interest = 'Software'
  AND n2.platform = 'linkedin';
```

### 3. Traverse hierarchy (recursive CTE)

```sql
-- Get all interests under "Business and industry" on Meta (including nested)
WITH RECURSIVE tree AS (
  SELECT id, interest, 0 AS depth
  FROM interest_nodes
  WHERE platform = 'meta' AND interest = 'Business and industry'

  UNION ALL

  SELECT n.id, n.interest, t.depth + 1
  FROM tree t
  JOIN interest_edges e ON e.source_id = t.id AND e.edge_type = 'parent_of'
  JOIN interest_nodes n ON n.id = e.target_id
)
SELECT * FROM tree WHERE depth > 0 ORDER BY depth, interest;
```

### 4. Semantic search by keywords

```sql
-- Find interests related to "gig economy" across all platforms
SELECT platform, category, interest, tier
FROM interest_nodes
WHERE keywords @> ARRAY['gig economy']
   OR keywords @> ARRAY['freelance']
   OR keywords @> ARRAY['contract work']
ORDER BY platform, category;
```

### 5. Smart interest routing (the main query)

```sql
-- Given a campaign concept + platform, find the best real interests
-- This is the query the pipeline calls at strategy time
SELECT n.interest, n.category, n.tier,
       COALESCE(e.weight, 0.5) AS relevance
FROM interest_nodes n
LEFT JOIN interest_edges e ON (
  e.target_id = n.id AND e.edge_type = 'related_to'
)
WHERE n.platform = $1  -- 'meta'
  AND n.is_active = TRUE
  AND (
    n.keywords && $2::text[]  -- keyword overlap with campaign concepts
    OR n.category = ANY($3::text[])  -- category match
  )
ORDER BY relevance DESC
LIMIT $4;  -- top N interests per tier
```

---

## Pipeline Integration

### Where it plugs in

```
Stage 1: Strategy Generation
  |
  ├── LLM generates campaign strategy (current behavior)
  │   └── Outputs conceptual interests: ["tech workers", "freelancers", "data science"]
  │
  ├── NEW: Interest Router (post-processing)
  │   ├── For each platform in the channel strategy:
  │   │   ├── Query interest_nodes with concept keywords
  │   │   ├── Get top-K real interests per tier (hyper/hot/broad)
  │   │   ├── Traverse cross-platform edges for consistency
  │   │   └── Return structured interests_by_tier
  │   │
  │   └── Output per ad_set:
  │       {
  │         "interests_by_tier": {
  │           "hyper": ["Digital marketing", "Data Science"],
  │           "hot": ["Software", "Freelancing", "Remote Work"],
  │           "broad": ["Technology", "Business"]
  │         }
  │       }
  │
  └── Save to campaign_strategies.strategy_data
```

### Interest Router Module

New file: `worker/platform_interests/router.py`

```python
async def route_interests(
    platform: str,
    concepts: list[str],
    tier_counts: dict = {"hyper": 3, "hot": 5, "broad": 3},
) -> dict[str, list[str]]:
    """Map conceptual interests to real platform interests.

    Parameters
    ----------
    platform : str
        Target platform ('meta', 'linkedin', 'tiktok', etc.)
    concepts : list[str]
        LLM-generated conceptual interests/keywords
    tier_counts : dict
        How many interests to return per tier

    Returns
    -------
    dict with keys 'hyper', 'hot', 'broad' — each a list of real platform interest strings
    """
```

### Integration into campaign_strategy.py

After the LLM generates the strategy, add a post-processing step:

```python
# Current: LLM generates ad_sets with hallucinated interests
# New: replace interests with real platform interests from the graph

from platform_interests.router import route_interests

for ad_set in strategy["ad_sets"]:
    platform = ad_set["platform"]
    concepts = ad_set.get("interests", [])
    targeting_type = ad_set.get("targeting_type", "hot")

    real_interests = await route_interests(
        platform=platform,
        concepts=concepts,
    )

    # Replace flat interests with structured interests_by_tier
    ad_set["interests_by_tier"] = real_interests
    # Remove old flat interests field
    ad_set.pop("interests", None)
    ad_set.pop("targeting_type", None)
```

### Cross-Platform Consistency

When generating ad sets for the same persona across multiple platforms, the router ensures consistency:

```python
async def route_interests_cross_platform(
    platforms: list[str],
    concepts: list[str],
    tier_counts: dict = {"hyper": 3, "hot": 5, "broad": 3},
) -> dict[str, dict[str, list[str]]]:
    """Route interests across multiple platforms with cross-platform awareness.

    Returns dict keyed by platform, each containing interests_by_tier.
    Uses equivalent_on edges to ensure consistent targeting across platforms.
    """
```

---

## Seeding Strategy

### Phase 1: Seed from research data (immediate)

Create `worker/platform_interests/seed_data/` with JSON files per platform:

| File | Content | Source |
|---|---|---|
| `meta.json` | ~250 interests, 9 categories | Facebook Interests PDF |
| `linkedin.json` | ~400 interests, 11 categories | Deep research compilation |
| `tiktok.json` | ~100 interests, 20 Tier 1 categories | Deep research (partial) |
| `reddit.json` | ~152 interests, 20 groups | Deep research + API backfill |
| `snapchat.json` | ~90 interests, 32 lifestyle categories | Deep research |
| `wechat.json` | ~124 interests, 18 L1 categories | Deep research |

JSON format per file:

```json
{
  "platform": "meta",
  "categories": [
    {
      "name": "Business and industry",
      "interests": [
        {
          "name": "Advertising",
          "subcategory": null,
          "tier": "standard",
          "keywords": ["ads", "advertising", "ad industry"]
        },
        {
          "name": "Investment banking",
          "subcategory": "Banking",
          "tier": "niche",
          "keywords": ["investment", "banking", "finance"]
        }
      ]
    }
  ]
}
```

### Phase 2: API backfill (when accounts available)

| Platform | Endpoint | Approval | Priority |
|---|---|---|---|
| Reddit | `GET /api/v3/targeting/interests` | None needed | Pull immediately |
| LinkedIn | `GET /rest/adTargetingEntities?facet=interests` | Light review (1-2 days) | High |
| Snapchat | `GET /v1/targeting/v1/interests/scls` | Ad account auth | Medium |
| TikTok | `GET /tool/interest_category/` | Advertiser account needed | TODO — no account yet |
| WeChat | Tencent Ads platform | Michael's team | Low — China-specific |

### Phase 3: Cross-platform edge generation

After nodes are seeded, generate edges:
1. **Automated**: Match interests with identical names across platforms → `equivalent_on` edge
2. **Keyword overlap**: Interests sharing 2+ keywords → `related_to` edge with weight based on overlap count
3. **Hierarchy**: Category → subcategory → interest chains → `parent_of` edges
4. **LLM-assisted**: For remaining unmapped interests, use a small LLM call to identify cross-platform equivalents in batches of 50

---

## Frontend: Interest Viewer in CampaignWorkspace

### How interests display in the Media Strategy tab

When viewing a country's media strategy, ad sets show REAL platform interests:

```
Ad Set 1: Hyper — Meta (Facebook)
  Targeting: Digital marketing, Data Science, Freelancing
  [View cross-platform equivalents →]

Ad Set 2: Hot — LinkedIn
  Targeting: Information Technology, Data Management, Remote Working
  [Mapped from Meta: Digital marketing → Data Management]

Ad Set 3: Broad — Meta (Instagram)
  Targeting: Technology, Business, Online
```

The "View cross-platform equivalents" link traverses the graph and shows how the same concepts are targeted differently on each platform.

### Agency View Enhancement

AgencyChannelsTab shows `interests_by_tier` per ad set — no more empty interest sections. The agency can copy these directly into their ad platform targeting fields because they're REAL interest names.

---

## Files to Create / Modify

### New Files

| File | Purpose |
|---|---|
| `worker/platform_interests/__init__.py` | Package init |
| `worker/platform_interests/router.py` | Interest routing engine (query graph, return structured interests) |
| `worker/platform_interests/seeder.py` | Seed script — reads JSON files, inserts nodes + generates edges |
| `worker/platform_interests/seed_data/meta.json` | Meta/Facebook interest taxonomy |
| `worker/platform_interests/seed_data/linkedin.json` | LinkedIn interest taxonomy |
| `worker/platform_interests/seed_data/tiktok.json` | TikTok interest taxonomy (partial) |
| `worker/platform_interests/seed_data/reddit.json` | Reddit interest taxonomy |
| `worker/platform_interests/seed_data/snapchat.json` | Snapchat lifestyle categories |
| `worker/platform_interests/seed_data/wechat.json` | WeChat interest taxonomy |
| `migrations/2026-04-23-interest-graph.sql` | CREATE TABLE for interest_nodes + interest_edges |

### Modified Files

| File | Change |
|---|---|
| `worker/pipeline/stage1_intelligence.py` | Call `route_interests()` after strategy generation to replace hallucinated interests |
| `worker/prompts/campaign_strategy.py` | Update `translate_to_ad_sets()` to use `interests_by_tier` from graph instead of flat `interests` |
| `src/components/AdSetRow.tsx` | Remove fallback logic — `interests_by_tier` is now always present and structured |
| `src/components/MediaStrategyEditor.tsx` | Update `buildAllocation()` to read from `interests_by_tier` |
| `src/components/agency/AgencyChannelsTab.tsx` | Read `interests_by_tier` directly (already expects this structure) |
| `src/lib/db/schema.ts` | Add interest_nodes + interest_edges table definitions |
| `src/lib/types.ts` | Add InterestNode, InterestEdge types |

---

## Parsing Issue Fixes (from the 6 identified issues)

This spec directly fixes 3 of the 6 media strategy parsing issues:

| Issue | Fix |
|---|---|
| #1: Interests structure mismatch | Router outputs `interests_by_tier: {hyper[], hot[], broad[]}` — matches frontend expectation exactly |
| #2: Missing channel mix | `buildAllocation()` reads from `interests_by_tier` which is always populated by the router |
| #3: Missing campaigns array | Strategy post-processing ensures every ad_set has structured interests, which means the campaigns array is always populated |

Issues #4-6 (country mismatch, budget strings, double-encoded JSON) are separate fixes not covered by this spec.

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Platform has no nodes seeded | Fall back to LLM-generated interests (current behavior). Log a warning. |
| No keyword matches found | Broaden search to category-level matches. If still empty, fall back to top interests in the category. |
| Cross-platform edge doesn't exist | Return platform-specific interests only. No forced consistency. |
| New platform added | Create JSON seed file, run seeder, edges auto-generate from keyword overlap. |
| Interest deprecated by platform | Set `is_active = FALSE`. Router excludes inactive nodes. |
| API backfill changes existing data | Seeder uses UPSERT (ON CONFLICT DO UPDATE) — existing nodes get updated, new ones get added. |

---

## Out of Scope

- Admin UI for managing the interest graph (future)
- Real-time API sync with platform taxonomies (future — manual refresh for now)
- CLaRa integration for compressed latent reasoning (Phase 2 roadmap)
- Audience size estimation per interest (requires platform API access)
- Interest performance tracking (which interests drove conversions — requires Command Center)
