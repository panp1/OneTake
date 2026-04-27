"""Interest graph seeder — reads JSON seed files, inserts nodes, generates edges.

Usage:
    cd worker/
    python -m platform_interests.seeder
"""
from __future__ import annotations

import json
import logging
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
    """Insert all interest nodes. Returns mapping of (platform::interest) → node_id."""
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
                    continue

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

            for interest_data in cat.get("interests", []):
                name = interest_data["name"]
                subcategory = interest_data.get("subcategory")
                interest_key = f"{platform}::{name}".lower()

                if subcategory:
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

    name_groups: dict[str, list[tuple[str, str]]] = {}
    for key, node_id in node_map.items():
        platform, name = key.split("::", 1)
        name_lower = name.lower()
        if name_lower not in name_groups:
            name_groups[name_lower] = []
        name_groups[name_lower].append((platform, node_id))

    for name, nodes in name_groups.items():
        if len(nodes) < 2:
            continue
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                p1, id1 = nodes[i]
                p2, id2 = nodes[j]
                if p1 == p2:
                    continue
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

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, platform, interest, keywords FROM interest_nodes WHERE array_length(keywords, 1) > 0"
        )

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
