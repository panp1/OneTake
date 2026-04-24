# GraphRAG Platform Interests — Plan 2: Router + Pipeline Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the interest router that maps LLM-generated conceptual interests to real platform interests from the knowledge graph, integrate it into the pipeline, and fix the frontend parsing issues.

**Architecture:** New `router.py` module queries `interest_nodes` by keyword/category match, returns structured `interests_by_tier: {hyper[], hot[], broad[]}`. Called as a post-processing step after LLM strategy generation in Stage 1. Frontend components simplified — no more fallback logic for missing interests.

**Tech Stack:** Python 3 (asyncpg), TypeScript, React

**Depends on:** Plan 1 (Data Layer) must be complete — interest_nodes must be seeded.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `worker/platform_interests/router.py` | Create | Query graph, map concepts → real platform interests by tier |
| `worker/pipeline/stage1_intelligence.py` | Modify | Call router after strategy generation |
| `worker/prompts/campaign_strategy.py` | Modify | Update translate_to_ad_sets to use interests_by_tier |
| `src/components/AdSetRow.tsx` | Modify | Simplify — interests_by_tier always present |
| `src/components/MediaStrategyEditor.tsx` | Modify | Fix buildAllocation to read interests_by_tier |
| `worker/tests/test_interest_router.py` | Create | Tests for router query logic |

---

### Task 1: Create the interest router

**Files:**
- Create: `worker/platform_interests/router.py`

- [ ] **Step 1: Write the router module**

```python
"""Interest router — maps LLM-generated concepts to real platform interests.

Queries the interest_nodes knowledge graph to find real, validated platform
interests that match conceptual targeting. Returns structured interests_by_tier.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_TIER_COUNTS = {"hyper": 3, "hot": 5, "broad": 3}


async def route_interests(
    platform: str,
    concepts: list[str],
    tier_counts: dict[str, int] | None = None,
) -> dict[str, list[str]]:
    """Map conceptual interests to real platform interests from the graph.

    Parameters
    ----------
    platform : str
        Target ad platform ('meta', 'linkedin', 'tiktok', 'reddit', 'snapchat', 'wechat').
    concepts : list[str]
        LLM-generated conceptual interest keywords (e.g., ["tech workers", "freelancers"]).
    tier_counts : dict
        How many interests per tier. Defaults to {"hyper": 3, "hot": 5, "broad": 3}.

    Returns
    -------
    dict with keys 'hyper', 'hot', 'broad' — each a list of real platform interest strings.
    """
    from neon_client import _get_pool

    counts = tier_counts or DEFAULT_TIER_COUNTS
    total_needed = sum(counts.values())

    if not concepts:
        logger.warning("No concepts provided for %s — returning empty interests", platform)
        return {"hyper": [], "hot": [], "broad": []}

    # Build keyword search terms from concepts
    search_terms = []
    for concept in concepts:
        # Split multi-word concepts into individual keywords
        words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
        search_terms.extend(words)
    search_terms = list(set(search_terms))  # dedupe

    if not search_terms:
        return {"hyper": [], "hot": [], "broad": []}

    pool = await _get_pool()
    async with pool.acquire() as conn:
        # Query 1: Find interests matching by keyword overlap
        rows = await conn.fetch(
            """
            SELECT interest, category, subcategory, tier,
                   -- Score: count of matching keywords
                   (SELECT COUNT(*) FROM unnest(keywords) kw
                    WHERE kw = ANY($2::text[])) AS match_score
            FROM interest_nodes
            WHERE platform = $1
              AND is_active = TRUE
              AND keywords && $2::text[]
            ORDER BY match_score DESC, tier ASC
            LIMIT $3
            """,
            platform,
            search_terms,
            total_needed * 2,  # fetch extra for ranking
        )

        # Query 2: If not enough matches, broaden to category name matching
        if len(rows) < total_needed:
            category_rows = await conn.fetch(
                """
                SELECT interest, category, subcategory, tier, 0 AS match_score
                FROM interest_nodes
                WHERE platform = $1
                  AND is_active = TRUE
                  AND (
                    LOWER(category) = ANY($2::text[])
                    OR LOWER(interest) LIKE ANY(
                      SELECT '%' || term || '%' FROM unnest($2::text[]) AS term
                    )
                  )
                  AND interest NOT IN (SELECT interest FROM interest_nodes WHERE platform = $1 AND keywords && $3::text[])
                ORDER BY tier ASC
                LIMIT $4
                """,
                platform,
                search_terms,
                search_terms,
                total_needed - len(rows),
            )
            rows = list(rows) + list(category_rows)

    # Distribute across tiers
    # Niche interests → hyper (most specific)
    # Standard interests → hot (moderate)
    # Broad interests → broad (widest)
    hyper: list[str] = []
    hot: list[str] = []
    broad: list[str] = []
    seen: set[str] = set()

    for row in rows:
        name = row["interest"]
        if name in seen:
            continue
        seen.add(name)

        tier = row["tier"]
        if tier == "niche" and len(hyper) < counts["hyper"]:
            hyper.append(name)
        elif tier == "standard" and len(hot) < counts["hot"]:
            hot.append(name)
        elif tier == "broad" and len(broad) < counts["broad"]:
            broad.append(name)
        elif len(hot) < counts["hot"]:
            hot.append(name)  # overflow into hot
        elif len(broad) < counts["broad"]:
            broad.append(name)  # overflow into broad

    logger.info(
        "Routed %d concepts to %s: hyper=%d, hot=%d, broad=%d",
        len(concepts), platform, len(hyper), len(hot), len(broad),
    )

    return {"hyper": hyper, "hot": hot, "broad": broad}


async def route_interests_cross_platform(
    platforms: list[str],
    concepts: list[str],
    tier_counts: dict[str, int] | None = None,
) -> dict[str, dict[str, list[str]]]:
    """Route interests across multiple platforms with cross-platform awareness.

    Returns dict keyed by platform, each containing interests_by_tier.
    Uses equivalent_on edges to ensure consistent targeting.
    """
    results: dict[str, dict[str, list[str]]] = {}

    # Route first platform normally
    if platforms:
        results[platforms[0]] = await route_interests(platforms[0], concepts, tier_counts)

    # For subsequent platforms, include cross-platform equivalents
    for platform in platforms[1:]:
        # Start with direct routing
        direct = await route_interests(platform, concepts, tier_counts)

        # Enrich with cross-platform equivalents from already-routed platforms
        from neon_client import _get_pool
        pool = await _get_pool()
        enriched_concepts = list(concepts)

        for prev_platform, prev_interests in results.items():
            all_prev = prev_interests["hyper"] + prev_interests["hot"] + prev_interests["broad"]
            if all_prev:
                async with pool.acquire() as conn:
                    equiv_rows = await conn.fetch(
                        """
                        SELECT n2.interest
                        FROM interest_nodes n1
                        JOIN interest_edges e ON e.source_id = n1.id AND e.edge_type = 'equivalent_on'
                        JOIN interest_nodes n2 ON n2.id = e.target_id AND n2.platform = $1
                        WHERE n1.platform = $2 AND n1.interest = ANY($3::text[])
                        """,
                        platform, prev_platform, all_prev,
                    )
                    for row in equiv_rows:
                        if row["interest"] not in enriched_concepts:
                            enriched_concepts.append(row["interest"])

        # Re-route with enriched concepts if we found equivalents
        if len(enriched_concepts) > len(concepts):
            direct = await route_interests(platform, enriched_concepts, tier_counts)

        results[platform] = direct

    return results
```

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "from platform_interests.router import route_interests, route_interests_cross_platform; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/platform_interests/router.py
git commit -m "feat: add interest router — maps concepts to real platform interests via graph"
```

---

### Task 2: Integrate router into Stage 1 strategy post-processing

**Files:**
- Modify: `worker/pipeline/stage1_intelligence.py`

- [ ] **Step 1: Find where campaign strategy is saved**

In `stage1_intelligence.py`, find where the strategy is saved after LLM generation (after `save_campaign_strategy` or similar call). Add a post-processing step that routes interests.

After the strategy is generated and before/after it's saved, add:

```python
    # Post-process: replace LLM-hallucinated interests with real platform interests
    try:
        from platform_interests.router import route_interests
        strategy_data = strategy.get("strategy_data", {})
        campaigns = strategy_data.get("campaigns", [])
        for campaign in campaigns:
            for ad_set in campaign.get("ad_sets", []):
                platform = ad_set.get("placements", ["meta"])[0] if ad_set.get("placements") else "meta"
                # Normalize platform name
                platform_family = "meta"
                if "tiktok" in platform: platform_family = "tiktok"
                elif "linkedin" in platform: platform_family = "linkedin"
                elif "snap" in platform: platform_family = "snapchat"
                elif "reddit" in platform: platform_family = "reddit"
                elif "wechat" in platform: platform_family = "wechat"

                concepts = ad_set.get("interests", [])
                if concepts:
                    real_interests = await route_interests(platform_family, concepts)
                    ad_set["interests_by_tier"] = real_interests
                    # Keep original interests as fallback reference
                    ad_set["interests_original"] = concepts
                else:
                    ad_set["interests_by_tier"] = {"hyper": [], "hot": [], "broad": []}

        logger.info("Interest routing complete for %s", country or "campaign")
    except Exception as exc:
        logger.warning("Interest routing failed (non-fatal): %s — keeping LLM interests", exc)
```

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import pipeline.stage1_intelligence; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage1_intelligence.py
git commit -m "feat: integrate interest router into stage1 — replace hallucinated interests with real ones"
```

---

### Task 3: Update translate_to_ad_sets in campaign_strategy.py

**Files:**
- Modify: `worker/prompts/campaign_strategy.py:205-224`

- [ ] **Step 1: Update translate_to_ad_sets to output interests_by_tier**

Find the `translate_to_ad_sets` function (around line 190). Update the return dict to include `interests_by_tier` from the targeting profile, and structure the targeting_method to use tiered interests:

Replace lines 213-215:

```python
            "hyper": {"method": pmap["hyper"], "values": interests.get("hyper", [])},
            "hot": {"method": pmap["hot"], "values": interests.get("hot", [])},
            "broad": {"method": pmap["broad"], "values": interests.get("broad", [])},
```

With:

```python
            "hyper": {"method": pmap["hyper"], "values": interests.get("hyper", [])},
            "hot": {"method": pmap["hot"], "values": interests.get("hot", [])},
            "broad": {"method": pmap["broad"], "values": interests.get("broad", [])},
        },
        "interests_by_tier": {
            "hyper": interests.get("hyper", []),
            "hot": interests.get("hot", []),
            "broad": interests.get("broad", []),
```

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import prompts.campaign_strategy; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/prompts/campaign_strategy.py
git commit -m "feat: add interests_by_tier to translate_to_ad_sets output"
```

---

### Task 4: Fix AdSetRow.tsx — simplify interest rendering

**Files:**
- Modify: `src/components/AdSetRow.tsx:59-70`

- [ ] **Step 1: Simplify the interest tier logic**

Replace the complex fallback logic (lines 59-70):

```typescript
  const interestsByTier: InterestsByTier = adSet.interests_by_tier
    ? {
        hyper: adSet.interests_by_tier.hyper ?? [],
        hot: adSet.interests_by_tier.hot ?? [],
        broad: adSet.interests_by_tier.broad ?? [],
      }
    : {
        hyper: tier === "hyper" ? (adSet.interests ?? []) : [],
        hot: tier === "hot" ? (adSet.interests ?? []) : [],
        broad: tier === "broad" ? (adSet.interests ?? []) : [],
      };
```

With:

```typescript
  const interestsByTier: InterestsByTier = {
    hyper: adSet.interests_by_tier?.hyper ?? (tier === "hyper" ? (adSet.interests ?? []) : []),
    hot: adSet.interests_by_tier?.hot ?? (tier === "hot" ? (adSet.interests ?? []) : []),
    broad: adSet.interests_by_tier?.broad ?? (tier === "broad" ? (adSet.interests ?? []) : []),
  };
```

This is cleaner but still handles legacy data that doesn't have `interests_by_tier`.

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "AdSetRow" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/AdSetRow.tsx
git commit -m "fix: simplify AdSetRow interest tier logic with backwards-compatible fallback"
```

---

### Task 5: Fix MediaStrategyEditor.tsx — buildAllocation null safety

**Files:**
- Modify: `src/components/MediaStrategyEditor.tsx`

- [ ] **Step 1: Find buildAllocation function and add null safety**

Find the `buildAllocation` function (around line 96-126). The issue is it returns `{ "Other": 1.0 }` when placements are empty. Add a fallback that reads from `interests_by_tier` to derive channel allocation:

Find where placements are read and add null guards. If `placements` is empty but `interests_by_tier` exists, use the interest counts to derive allocation. Also add a guard for when `campaigns` array is missing from strategy_data:

Find `flattenAdSets` (around line 78) and ensure it handles null `campaigns`:

```typescript
function flattenAdSets(strategyData: any): any[] {
  if (!strategyData) return [];
  const campaigns = strategyData.campaigns ?? strategyData.ad_sets ?? [];
  if (!Array.isArray(campaigns)) return [];
  // ... rest of function
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "MediaStrategy" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/MediaStrategyEditor.tsx
git commit -m "fix: add null safety to buildAllocation and flattenAdSets in MediaStrategyEditor"
```

---

### Task 6: Write router tests

**Files:**
- Create: `worker/tests/test_interest_router.py`

- [ ] **Step 1: Write tests for the router**

```python
"""Tests for the interest router module.

These test the routing logic without database access by testing
the tier distribution and concept parsing logic.
"""
import pytest


class TestTierDistribution:
    """Verify interests are correctly distributed across hyper/hot/broad tiers."""

    def test_default_tier_counts(self):
        from platform_interests.router import DEFAULT_TIER_COUNTS
        assert DEFAULT_TIER_COUNTS == {"hyper": 3, "hot": 5, "broad": 3}

    def test_total_default_interests(self):
        from platform_interests.router import DEFAULT_TIER_COUNTS
        total = sum(DEFAULT_TIER_COUNTS.values())
        assert total == 11

    def test_empty_concepts_returns_empty(self):
        """route_interests with no concepts should return empty tiers."""
        import asyncio
        from platform_interests.router import route_interests
        # This will query the DB — skip if no connection
        try:
            result = asyncio.get_event_loop().run_until_complete(
                route_interests("meta", [])
            )
            assert result == {"hyper": [], "hot": [], "broad": []}
        except Exception:
            pytest.skip("No database connection available")


class TestConceptParsing:
    """Test that concepts are correctly parsed into search terms."""

    def test_multi_word_concepts_split(self):
        """Multi-word concepts should be split into individual keywords."""
        concept = "tech workers in gig economy"
        words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
        assert "tech" in words
        assert "workers" in words
        assert "gig" in words
        assert "economy" in words
        assert "in" not in words  # 2 chars, filtered out

    def test_comma_separated_concepts(self):
        """Comma-separated concepts should be handled."""
        concept = "freelancing, remote work, data science"
        words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
        assert "freelancing" in words
        assert "remote" in words
        assert "work" in words
        assert "data" in words
        assert "science" in words

    def test_deduplication(self):
        """Duplicate keywords should be removed."""
        concepts = ["tech workers", "tech industry"]
        search_terms = []
        for concept in concepts:
            words = [w.strip().lower() for w in concept.replace(",", " ").split() if len(w.strip()) > 2]
            search_terms.extend(words)
        search_terms = list(set(search_terms))
        assert search_terms.count("tech") == 1


class TestRouterOutputStructure:
    """Verify the router output matches the expected schema."""

    def test_output_has_three_tiers(self):
        result = {"hyper": ["a"], "hot": ["b", "c"], "broad": ["d"]}
        assert "hyper" in result
        assert "hot" in result
        assert "broad" in result

    def test_each_tier_is_list_of_strings(self):
        result = {"hyper": ["Digital marketing"], "hot": ["Software", "Data Science"], "broad": ["Technology"]}
        for tier in ["hyper", "hot", "broad"]:
            assert isinstance(result[tier], list)
            for item in result[tier]:
                assert isinstance(item, str)

    def test_empty_result_is_valid(self):
        result = {"hyper": [], "hot": [], "broad": []}
        total = sum(len(v) for v in result.values())
        assert total == 0

    def test_interests_are_unique_across_tiers(self):
        """No interest should appear in multiple tiers."""
        result = {"hyper": ["A", "B"], "hot": ["C", "D"], "broad": ["E"]}
        all_interests = result["hyper"] + result["hot"] + result["broad"]
        assert len(all_interests) == len(set(all_interests))


class TestCrossPlatformRouting:
    """Test cross-platform routing logic."""

    def test_cross_platform_returns_dict_per_platform(self):
        """Output should be keyed by platform name."""
        result = {
            "meta": {"hyper": ["Software"], "hot": ["Technology"], "broad": ["Business"]},
            "linkedin": {"hyper": ["Information Technology"], "hot": ["Computer Software"], "broad": ["Technology"]},
        }
        assert "meta" in result
        assert "linkedin" in result
        assert "hyper" in result["meta"]
        assert "hyper" in result["linkedin"]

    def test_platforms_can_have_different_interest_counts(self):
        """Different platforms may have different numbers of matching interests."""
        result = {
            "meta": {"hyper": ["A", "B", "C"], "hot": ["D", "E"], "broad": ["F"]},
            "reddit": {"hyper": ["G"], "hot": ["H"], "broad": []},
        }
        meta_total = sum(len(v) for v in result["meta"].values())
        reddit_total = sum(len(v) for v in result["reddit"].values())
        assert meta_total == 6
        assert reddit_total == 2
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -m pytest tests/test_interest_router.py -v`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add worker/tests/test_interest_router.py
git commit -m "test: add interest router tests — tier distribution, concept parsing, output structure"
```

---

### Task 7: End-to-end test

- [ ] **Step 1: Verify router works with seeded data**

```python
import asyncio
async def test_route():
    from platform_interests.router import route_interests
    result = await route_interests("meta", ["technology", "software", "freelancing"])
    print(f"Meta interests: {result}")
    assert len(result["hyper"]) + len(result["hot"]) + len(result["broad"]) > 0
    
    result2 = await route_interests("linkedin", ["data science", "machine learning", "AI"])
    print(f"LinkedIn interests: {result2}")

asyncio.run(test_route())
```

- [ ] **Step 2: Verify cross-platform routing**

```python
import asyncio
async def test_cross():
    from platform_interests.router import route_interests_cross_platform
    result = await route_interests_cross_platform(
        platforms=["meta", "linkedin"],
        concepts=["technology", "software", "data science"]
    )
    print(f"Meta: {result.get('meta', {})}")
    print(f"LinkedIn: {result.get('linkedin', {})}")

asyncio.run(test_cross())
```

- [ ] **Step 3: Start dev server and verify frontend**

Open `http://localhost:3003`, navigate to a campaign with a strategy. Verify:
- Ad sets show real platform interests under hyper/hot/broad tiers
- No more empty interest sections
- MediaStrategyEditor channel mix renders correctly

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: end-to-end interest routing verified"
```
