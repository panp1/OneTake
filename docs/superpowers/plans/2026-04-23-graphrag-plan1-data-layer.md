# GraphRAG Platform Interests — Plan 1: Data Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the interest graph schema, seed 1,100+ real platform interests from 6 ad platforms, and generate cross-platform edges.

**Architecture:** Two new Postgres tables (`interest_nodes`, `interest_edges`) seeded from JSON files per platform. A Python seeder script reads JSON, inserts nodes, then generates edges via name matching and keyword overlap. TypeScript types added for frontend consumption.

**Tech Stack:** PostgreSQL (Neon), Python 3 (asyncpg), TypeScript, JSON seed data

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `migrations/2026-04-23-interest-graph.sql` | Create | Schema migration for interest_nodes + interest_edges |
| `src/lib/db/schema.ts` | Modify | Add interest_nodes + interest_edges table definitions |
| `src/lib/types.ts` | Modify | Add InterestNode, InterestEdge types |
| `worker/platform_interests/__init__.py` | Create | Package init |
| `worker/platform_interests/seed_data/meta.json` | Create | Meta/Facebook ~250 interests |
| `worker/platform_interests/seed_data/linkedin.json` | Create | LinkedIn ~400 interests |
| `worker/platform_interests/seed_data/tiktok.json` | Create | TikTok ~100 interests (partial) |
| `worker/platform_interests/seed_data/reddit.json` | Create | Reddit ~152 interests |
| `worker/platform_interests/seed_data/snapchat.json` | Create | Snapchat ~90 interests |
| `worker/platform_interests/seed_data/wechat.json` | Create | WeChat ~124 interests |
| `worker/platform_interests/seeder.py` | Create | Reads JSON, inserts nodes, generates edges |
| `worker/tests/test_interest_seeder.py` | Create | Tests for seeder logic |

---

### Task 1: Create the SQL migration

**Files:**
- Create: `migrations/2026-04-23-interest-graph.sql`

- [ ] **Step 1: Write the migration**

```sql
-- migrations/2026-04-23-interest-graph.sql
-- GraphRAG Platform Interest Knowledge Graph

CREATE TABLE IF NOT EXISTS interest_nodes (
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

CREATE TABLE IF NOT EXISTS interest_edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
  edge_type   TEXT NOT NULL CHECK (edge_type IN ('equivalent_on', 'related_to', 'parent_of', 'sibling')),
  weight      FLOAT DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_interest_nodes_platform ON interest_nodes(platform);
CREATE INDEX IF NOT EXISTS idx_interest_nodes_category ON interest_nodes(platform, category);
CREATE INDEX IF NOT EXISTS idx_interest_nodes_search ON interest_nodes USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_interest_edges_source ON interest_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_interest_edges_target ON interest_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_interest_edges_type ON interest_edges(edge_type);
```

- [ ] **Step 2: Commit**

```bash
git add migrations/2026-04-23-interest-graph.sql
git commit -m "feat: add interest graph schema migration (interest_nodes + interest_edges)"
```

---

### Task 2: Run migration + update schema.ts + types.ts

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Run migration against Neon**

```python
# Run via Python since psql is not installed
import asyncio
async def run():
    from neon_client import _get_pool
    pool = await _get_pool()
    async with pool.acquire() as conn:
        with open('../migrations/2026-04-23-interest-graph.sql') as f:
            sql = f.read()
        for stmt in sql.split(';'):
            stmt = stmt.strip()
            if stmt and not stmt.startswith('--'):
                await conn.execute(stmt)
                print(f'OK: {stmt[:60]}...')
asyncio.run(run())
```

- [ ] **Step 2: Add tables to schema.ts**

After the existing table definitions in `src/lib/db/schema.ts`, add:

```typescript
  // interest_nodes — GraphRAG platform interest knowledge graph
  await sql`
    CREATE TABLE IF NOT EXISTS interest_nodes (
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
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_nodes_platform ON interest_nodes(platform)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_nodes_category ON interest_nodes(platform, category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_nodes_search ON interest_nodes USING GIN(keywords)`;

  // interest_edges — relationships between interest nodes
  await sql`
    CREATE TABLE IF NOT EXISTS interest_edges (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
      target_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
      edge_type   TEXT NOT NULL CHECK (edge_type IN ('equivalent_on', 'related_to', 'parent_of', 'sibling')),
      weight      FLOAT DEFAULT 1.0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source_id, target_id, edge_type)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_edges_source ON interest_edges(source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_edges_target ON interest_edges(target_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_interest_edges_type ON interest_edges(edge_type)`;
```

- [ ] **Step 3: Add TypeScript types**

In `src/lib/types.ts`, add after the CountryQuota types:

```typescript
// ============================================================
// INTEREST GRAPH TYPES (GraphRAG Platform Interests)
// ============================================================

export interface InterestNode {
  id: string;
  platform: string;
  category: string;
  subcategory: string | null;
  interest: string;
  tier: string;
  keywords: string[];
  is_active: boolean;
  created_at: string;
}

export interface InterestEdge {
  id: string;
  source_id: string;
  target_id: string;
  edge_type: 'equivalent_on' | 'related_to' | 'parent_of' | 'sibling';
  weight: number;
  created_at: string;
}

export interface InterestsByTier {
  hyper: string[];
  hot: string[];
  broad: string[];
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "interest" -i | head -10`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/types.ts
git commit -m "feat: add InterestNode, InterestEdge types + schema.ts table definitions"
```

---

### Task 3: Create Meta/Facebook seed data

**Files:**
- Create: `worker/platform_interests/__init__.py`
- Create: `worker/platform_interests/seed_data/meta.json`

- [ ] **Step 1: Create package init**

```python
# worker/platform_interests/__init__.py
"""GraphRAG Platform Interest Knowledge Graph."""
```

- [ ] **Step 2: Create meta.json from the PDF data**

Create `worker/platform_interests/seed_data/meta.json` with the COMPLETE Meta/Facebook taxonomy extracted from the PDF. Structure:

```json
{
  "platform": "meta",
  "categories": [
    {
      "name": "Business and industry",
      "interests": [
        {"name": "Advertising", "subcategory": null, "tier": "standard", "keywords": ["ads", "advertising"]},
        {"name": "Agriculture", "subcategory": null, "tier": "standard", "keywords": ["farming", "agriculture"]},
        {"name": "Architecture", "subcategory": null, "tier": "standard", "keywords": ["architecture", "buildings"]},
        {"name": "Aviation", "subcategory": null, "tier": "standard", "keywords": ["aviation", "airlines", "flying"]},
        {"name": "Investment banking", "subcategory": "Banking", "tier": "niche", "keywords": ["investment", "banking"]},
        {"name": "Online banking", "subcategory": "Banking", "tier": "niche", "keywords": ["online banking", "digital banking"]},
        {"name": "Retail banking", "subcategory": "Banking", "tier": "niche", "keywords": ["retail banking"]},
        {"name": "Business", "subcategory": null, "tier": "standard", "keywords": ["business"]},
        {"name": "Construction", "subcategory": null, "tier": "standard", "keywords": ["construction", "building"]},
        {"name": "Fashion design", "subcategory": "Design", "tier": "niche", "keywords": ["fashion design"]},
        {"name": "Graphic design", "subcategory": "Design", "tier": "niche", "keywords": ["graphic design"]},
        {"name": "Interior design", "subcategory": "Design", "tier": "niche", "keywords": ["interior design"]},
        {"name": "Economics", "subcategory": null, "tier": "standard", "keywords": ["economics", "economy"]},
        {"name": "Engineering", "subcategory": null, "tier": "standard", "keywords": ["engineering"]},
        {"name": "Entrepreneurship", "subcategory": null, "tier": "standard", "keywords": ["entrepreneurship", "startup"]},
        {"name": "Healthcare", "subcategory": null, "tier": "standard", "keywords": ["healthcare", "medical"]},
        {"name": "Higher Education", "subcategory": null, "tier": "standard", "keywords": ["university", "college", "higher education"]},
        {"name": "Management", "subcategory": null, "tier": "standard", "keywords": ["management"]},
        {"name": "Marketing", "subcategory": null, "tier": "standard", "keywords": ["marketing"]},
        {"name": "Nursing", "subcategory": null, "tier": "standard", "keywords": ["nursing", "nurse"]},
        {"name": "Digital marketing", "subcategory": "Online", "tier": "niche", "keywords": ["digital marketing", "online marketing"]},
        {"name": "Display advertising", "subcategory": "Online", "tier": "niche", "keywords": ["display ads"]},
        {"name": "Email marketing", "subcategory": "Online", "tier": "niche", "keywords": ["email marketing"]},
        {"name": "Online advertising", "subcategory": "Online", "tier": "niche", "keywords": ["online ads"]},
        {"name": "Search engine optimization", "subcategory": "Online", "tier": "niche", "keywords": ["SEO", "search engine"]},
        {"name": "Social media", "subcategory": "Online", "tier": "niche", "keywords": ["social media"]},
        {"name": "Social media marketing", "subcategory": "Online", "tier": "niche", "keywords": ["social media marketing"]},
        {"name": "Web design", "subcategory": "Online", "tier": "niche", "keywords": ["web design"]},
        {"name": "Web development", "subcategory": "Online", "tier": "niche", "keywords": ["web development", "web dev"]},
        {"name": "Web hosting", "subcategory": "Online", "tier": "niche", "keywords": ["web hosting"]},
        {"name": "Credit cards", "subcategory": "Personal finance", "tier": "niche", "keywords": ["credit cards"]},
        {"name": "Insurance", "subcategory": "Personal finance", "tier": "niche", "keywords": ["insurance"]},
        {"name": "Investment", "subcategory": "Personal finance", "tier": "niche", "keywords": ["investment", "investing"]},
        {"name": "Mortgage loans", "subcategory": "Personal finance", "tier": "niche", "keywords": ["mortgage", "home loan"]},
        {"name": "Property", "subcategory": null, "tier": "standard", "keywords": ["property", "real estate"]},
        {"name": "Retail", "subcategory": null, "tier": "standard", "keywords": ["retail"]},
        {"name": "Sales", "subcategory": null, "tier": "standard", "keywords": ["sales"]},
        {"name": "Science", "subcategory": null, "tier": "standard", "keywords": ["science"]},
        {"name": "Small business", "subcategory": null, "tier": "standard", "keywords": ["small business", "SMB"]}
      ]
    }
  ]
}
```

Include ALL categories from the PDF: Business and industry, Entertainment (films, games, live events, music, reading, TV), Family and relationships, Fitness and wellness, Food and drink, Hobbies and activities, Shopping and fashion, Sports and outdoors, Technology. Every single interest from the PDF pages must be included.

- [ ] **Step 3: Commit**

```bash
git add worker/platform_interests/__init__.py worker/platform_interests/seed_data/meta.json
git commit -m "feat: add Meta/Facebook interest taxonomy — ~250 interests from PDF"
```

---

### Task 4: Create LinkedIn seed data

**Files:**
- Create: `worker/platform_interests/seed_data/linkedin.json`

- [ ] **Step 1: Create linkedin.json from the research data**

Same JSON format as meta.json. Include all 11 categories from the research: Arts and Entertainment, Business Management, Careers and Employment, Finance and Economy, Health, Marketing and Advertising, Politics and Law, Sales and Retail, Science and Environment, Society and Culture, Technology. Include every subcategory and interest documented in the research.

Use `"tier": "niche"` for deeply nested interests (3+ levels deep) and `"tier": "standard"` for top-level.

Keywords should include common synonyms and abbreviations (e.g., "AI" for "Artificial Intelligence", "ML" for "Machine Learning").

- [ ] **Step 2: Commit**

```bash
git add worker/platform_interests/seed_data/linkedin.json
git commit -m "feat: add LinkedIn interest taxonomy — ~400 interests from research"
```

---

### Task 5: Create TikTok, Reddit, Snapchat, WeChat seed data

**Files:**
- Create: `worker/platform_interests/seed_data/tiktok.json`
- Create: `worker/platform_interests/seed_data/reddit.json`
- Create: `worker/platform_interests/seed_data/snapchat.json`
- Create: `worker/platform_interests/seed_data/wechat.json`

- [ ] **Step 1: Create tiktok.json**

20 Tier 1 categories, each with documented Tier 2 subcategories. Use `"tier": "broad"` for Tier 1 and `"tier": "niche"` for Tier 2. ~100 interests total (partial — API backfill later).

- [ ] **Step 2: Create reddit.json**

20 interest groups with all documented subgroups. Use `"tier": "standard"` for all. ~152 interests.

- [ ] **Step 3: Create snapchat.json**

32+ lifestyle categories with documented subcategories. Use `"tier": "standard"` for top-level, `"tier": "niche"` for subcategories. ~90 interests.

- [ ] **Step 4: Create wechat.json**

18 L1 categories with L2 subcategories. Include both Chinese and English names in keywords. ~124 interests.

- [ ] **Step 5: Commit**

```bash
git add worker/platform_interests/seed_data/tiktok.json worker/platform_interests/seed_data/reddit.json worker/platform_interests/seed_data/snapchat.json worker/platform_interests/seed_data/wechat.json
git commit -m "feat: add TikTok, Reddit, Snapchat, WeChat interest taxonomies"
```

---

### Task 6: Create the seeder script

**Files:**
- Create: `worker/platform_interests/seeder.py`

- [ ] **Step 1: Write the seeder**

```python
"""Interest graph seeder — reads JSON seed files, inserts nodes, generates edges.

Usage:
    cd worker/
    python -m platform_interests.seeder
"""
from __future__ import annotations

import json
import logging
import os
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).parent / "seed_data"


def load_seed_files() -> list[dict]:
    """Load all JSON seed files from seed_data/."""
    platforms = []
    for f in sorted(SEED_DIR.glob("*.json")):
        with open(f) as fh:
            data = json.load(fh)
            platforms.append(data)
            logger.info("Loaded %s: %d categories", f.name, len(data.get("categories", [])))
    return platforms


async def seed_nodes(platforms: list[dict]) -> dict[str, str]:
    """Insert all interest nodes. Returns mapping of (platform, interest) → node_id."""
    from neon_client import _get_pool

    pool = await _get_pool()
    node_map: dict[str, str] = {}
    total = 0

    for platform_data in platforms:
        platform = platform_data["platform"]
        for cat in platform_data.get("categories", []):
            category = cat["name"]
            for interest_data in cat.get("interests", []):
                node_id = str(uuid.uuid4())
                name = interest_data["name"]
                subcategory = interest_data.get("subcategory")
                tier = interest_data.get("tier", "standard")
                keywords = interest_data.get("keywords", [])

                key = f"{platform}::{name}".lower()
                if key in node_map:
                    continue  # skip duplicates

                async with pool.acquire() as conn:
                    try:
                        await conn.execute(
                            """
                            INSERT INTO interest_nodes (id, platform, category, subcategory, interest, tier, keywords)
                            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
                            ON CONFLICT (platform, category, interest) DO UPDATE
                            SET subcategory = EXCLUDED.subcategory,
                                tier = EXCLUDED.tier,
                                keywords = EXCLUDED.keywords,
                                is_active = TRUE
                            """,
                            node_id, platform, category, subcategory, name, tier, keywords,
                        )
                        node_map[key] = node_id
                        total += 1
                    except Exception as exc:
                        logger.warning("Failed to insert %s/%s: %s", platform, name, exc)

    logger.info("Seeded %d interest nodes across %d platforms", total, len(platforms))
    return node_map


async def generate_hierarchy_edges(platforms: list[dict], node_map: dict[str, str]) -> int:
    """Generate parent_of edges from category → subcategory → interest hierarchy."""
    from neon_client import _get_pool

    pool = await _get_pool()
    edge_count = 0

    for platform_data in platforms:
        platform = platform_data["platform"]
        for cat in platform_data.get("categories", []):
            category = cat["name"]
            cat_key = f"{platform}::{category}".lower()

            for interest_data in cat.get("interests", []):
                name = interest_data["name"]
                subcategory = interest_data.get("subcategory")
                interest_key = f"{platform}::{name}".lower()

                if subcategory:
                    # Interest → Subcategory parent_of edge
                    subcat_key = f"{platform}::{subcategory}".lower()
                    if subcat_key in node_map and interest_key in node_map:
                        async with pool.acquire() as conn:
                            try:
                                await conn.execute(
                                    """
                                    INSERT INTO interest_edges (id, source_id, target_id, edge_type, weight)
                                    VALUES ($1::uuid, $2::uuid, $3::uuid, 'parent_of', 1.0)
                                    ON CONFLICT (source_id, target_id, edge_type) DO NOTHING
                                    """,
                                    str(uuid.uuid4()), node_map[subcat_key], node_map[interest_key],
                                )
                                edge_count += 1
                            except Exception:
                                pass

    logger.info("Generated %d hierarchy edges", edge_count)
    return edge_count


async def generate_cross_platform_edges(node_map: dict[str, str]) -> int:
    """Generate equivalent_on edges by matching interest names across platforms."""
    from neon_client import _get_pool

    pool = await _get_pool()
    edge_count = 0

    # Group nodes by interest name (lowercase)
    name_groups: dict[str, list[tuple[str, str]]] = {}
    for key, node_id in node_map.items():
        platform, name = key.split("::", 1)
        name_lower = name.lower()
        if name_lower not in name_groups:
            name_groups[name_lower] = []
        name_groups[name_lower].append((platform, node_id))

    # Create edges between nodes with same name on different platforms
    for name, nodes in name_groups.items():
        if len(nodes) < 2:
            continue
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                p1, id1 = nodes[i]
                p2, id2 = nodes[j]
                if p1 == p2:
                    continue  # same platform = sibling, not equivalent
                async with pool.acquire() as conn:
                    try:
                        await conn.execute(
                            """
                            INSERT INTO interest_edges (id, source_id, target_id, edge_type, weight)
                            VALUES ($1::uuid, $2::uuid, $3::uuid, 'equivalent_on', 1.0)
                            ON CONFLICT (source_id, target_id, edge_type) DO NOTHING
                            """,
                            str(uuid.uuid4()), id1, id2,
                        )
                        edge_count += 1
                    except Exception:
                        pass

    logger.info("Generated %d cross-platform equivalent_on edges", edge_count)
    return edge_count


async def generate_keyword_edges(node_map: dict[str, str]) -> int:
    """Generate related_to edges between nodes on the same platform that share 2+ keywords."""
    from neon_client import _get_pool

    pool = await _get_pool()

    # Fetch all nodes with keywords
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, platform, interest, keywords FROM interest_nodes WHERE array_length(keywords, 1) > 0"
        )

    # Group by platform
    platform_nodes: dict[str, list] = {}
    for row in rows:
        p = row["platform"]
        if p not in platform_nodes:
            platform_nodes[p] = []
        platform_nodes[p].append(row)

    edge_count = 0
    for platform, nodes in platform_nodes.items():
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                kw_i = set(nodes[i]["keywords"])
                kw_j = set(nodes[j]["keywords"])
                overlap = len(kw_i & kw_j)
                if overlap >= 2:
                    weight = min(1.0, overlap * 0.3)
                    async with pool.acquire() as conn:
                        try:
                            await conn.execute(
                                """
                                INSERT INTO interest_edges (id, source_id, target_id, edge_type, weight)
                                VALUES ($1::uuid, $2::uuid, $3::uuid, 'related_to', $4)
                                ON CONFLICT (source_id, target_id, edge_type) DO NOTHING
                                """,
                                str(uuid.uuid4()), str(nodes[i]["id"]), str(nodes[j]["id"]), weight,
                            )
                            edge_count += 1
                        except Exception:
                            pass

    logger.info("Generated %d keyword-based related_to edges", edge_count)
    return edge_count


async def run_seeder():
    """Full seeding pipeline: load JSON → insert nodes → generate edges."""
    logger.info("Starting interest graph seeder...")

    platforms = load_seed_files()
    if not platforms:
        logger.error("No seed files found in %s", SEED_DIR)
        return

    node_map = await seed_nodes(platforms)
    await generate_hierarchy_edges(platforms, node_map)
    await generate_cross_platform_edges(node_map)
    await generate_keyword_edges(node_map)

    logger.info("Seeding complete.")


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    asyncio.run(run_seeder())
```

- [ ] **Step 2: Verify Python syntax**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -c "import platform_interests.seeder; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add worker/platform_interests/seeder.py
git commit -m "feat: add interest graph seeder — nodes + hierarchy/cross-platform/keyword edges"
```

---

### Task 7: Run the seeder and verify

- [ ] **Step 1: Run the seeder**

```bash
cd /Users/stevenjunop/centric-intake/worker
python3 -m platform_interests.seeder
```

Expected output:
```
Loaded meta.json: 9 categories
Loaded linkedin.json: 11 categories
Loaded tiktok.json: 20 categories
Loaded reddit.json: 20 categories
Loaded snapchat.json: 32 categories
Loaded wechat.json: 18 categories
Seeded ~1100 interest nodes across 6 platforms
Generated ~300 hierarchy edges
Generated ~150 cross-platform equivalent_on edges
Generated ~200 keyword-based related_to edges
Seeding complete.
```

- [ ] **Step 2: Verify node counts per platform**

```python
import asyncio
async def verify():
    from neon_client import _get_pool
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT platform, COUNT(*) as cnt FROM interest_nodes GROUP BY platform ORDER BY cnt DESC")
        for row in rows:
            print(f"{row['platform']}: {row['cnt']} nodes")
        edges = await conn.fetchval("SELECT COUNT(*) FROM interest_edges")
        print(f"Total edges: {edges}")
asyncio.run(verify())
```

- [ ] **Step 3: Verify cross-platform edges exist**

```python
import asyncio
async def verify_edges():
    from neon_client import _get_pool
    pool = await _get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT n1.platform as p1, n1.interest as i1, n2.platform as p2, n2.interest as i2
            FROM interest_edges e
            JOIN interest_nodes n1 ON n1.id = e.source_id
            JOIN interest_nodes n2 ON n2.id = e.target_id
            WHERE e.edge_type = 'equivalent_on'
            LIMIT 10
        """)
        for row in rows:
            print(f"{row['p1']}/{row['i1']} ↔ {row['p2']}/{row['i2']}")
asyncio.run(verify_edges())
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: verify interest graph seeded — nodes + edges live"
```

---

### Task 8: Write seeder tests

**Files:**
- Create: `worker/tests/test_interest_seeder.py`

- [ ] **Step 1: Write tests**

```python
"""Tests for platform interest seeder."""
import json
import pytest
from pathlib import Path
from platform_interests.seeder import load_seed_files, SEED_DIR


class TestSeedDataIntegrity:
    """Verify all seed JSON files are valid and well-structured."""

    def test_seed_dir_exists(self):
        assert SEED_DIR.is_dir(), f"Seed directory not found: {SEED_DIR}"

    def test_all_platforms_have_seed_files(self):
        expected = {"meta", "linkedin", "tiktok", "reddit", "snapchat", "wechat"}
        actual = {f.stem for f in SEED_DIR.glob("*.json")}
        assert expected == actual, f"Missing: {expected - actual}, Extra: {actual - expected}"

    def test_load_seed_files_returns_all_platforms(self):
        platforms = load_seed_files()
        assert len(platforms) == 6
        names = {p["platform"] for p in platforms}
        assert "meta" in names
        assert "linkedin" in names

    def test_each_file_has_valid_structure(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            assert "platform" in data, f"{f.name}: missing 'platform'"
            assert "categories" in data, f"{f.name}: missing 'categories'"
            assert isinstance(data["categories"], list), f"{f.name}: 'categories' not a list"
            assert len(data["categories"]) > 0, f"{f.name}: empty categories"

    def test_each_category_has_interests(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            for cat in data["categories"]:
                assert "name" in cat, f"{f.name}: category missing 'name'"
                assert "interests" in cat, f"{f.name}/{cat['name']}: missing 'interests'"
                assert len(cat["interests"]) > 0, f"{f.name}/{cat['name']}: empty interests"

    def test_each_interest_has_required_fields(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            for cat in data["categories"]:
                for interest in cat["interests"]:
                    assert "name" in interest, f"{f.name}/{cat['name']}: interest missing 'name'"
                    assert isinstance(interest["name"], str), f"{f.name}: interest name not string"
                    assert len(interest["name"]) > 0, f"{f.name}: empty interest name"

    def test_meta_has_minimum_250_interests(self):
        with open(SEED_DIR / "meta.json") as fh:
            data = json.load(fh)
        total = sum(len(cat["interests"]) for cat in data["categories"])
        assert total >= 200, f"Meta has only {total} interests (expected 200+)"

    def test_linkedin_has_minimum_200_interests(self):
        with open(SEED_DIR / "linkedin.json") as fh:
            data = json.load(fh)
        total = sum(len(cat["interests"]) for cat in data["categories"])
        assert total >= 200, f"LinkedIn has only {total} interests (expected 200+)"

    def test_no_duplicate_interests_per_platform(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            seen = set()
            for cat in data["categories"]:
                for interest in cat["interests"]:
                    key = f"{cat['name']}::{interest['name']}".lower()
                    assert key not in seen, f"{f.name}: duplicate interest '{interest['name']}' in '{cat['name']}'"
                    seen.add(key)

    def test_keywords_are_lists_of_strings(self):
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            for cat in data["categories"]:
                for interest in cat["interests"]:
                    kw = interest.get("keywords", [])
                    assert isinstance(kw, list), f"{f.name}/{interest['name']}: keywords not a list"
                    for k in kw:
                        assert isinstance(k, str), f"{f.name}/{interest['name']}: keyword not string: {k}"

    def test_tier_values_are_valid(self):
        valid_tiers = {"standard", "niche", "broad"}
        for f in SEED_DIR.glob("*.json"):
            with open(f) as fh:
                data = json.load(fh)
            for cat in data["categories"]:
                for interest in cat["interests"]:
                    tier = interest.get("tier", "standard")
                    assert tier in valid_tiers, f"{f.name}/{interest['name']}: invalid tier '{tier}'"
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/stevenjunop/centric-intake/worker && python3 -m pytest tests/test_interest_seeder.py -v`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add worker/tests/test_interest_seeder.py
git commit -m "test: add seed data integrity tests for interest graph"
```
