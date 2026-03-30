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
    result = {
        "budget_mode": "fixed",
        "total_monthly": total_monthly,
        "country_allocations": {},
        "deferred_markets": [],
        "flags": [],
    }

    ranked = sorted(countries, key=lambda c: c.get("market_opportunity_score", 0.5), reverse=True)
    total_score = sum(c.get("market_opportunity_score", 0.5) for c in ranked)
    if total_score == 0:
        total_score = 1

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
                "reactivation_budget": round(MIN_MONTHLY_PER_COUNTRY * len(ranked) / max(weight, 0.01), 2),
                "reason": f"${allocation:.0f}/mo below ${MIN_MONTHLY_PER_COUNTRY} minimum",
            })
            result["flags"].append(f"Deferred {country}: ${allocation:.0f}/mo insufficient (need ${MIN_MONTHLY_PER_COUNTRY})")
        else:
            active_countries.append({"country": country, "weight": weight, "monthly": allocation})

    if not active_countries and ranked:
        max_countries = max(1, int(total_monthly / MIN_MONTHLY_PER_COUNTRY))
        active_countries = [
            {"country": c["country"], "weight": 1.0 / max_countries, "monthly": total_monthly / max_countries}
            for c in ranked[:max_countries]
        ]
        result["deferred_markets"] = [d for d in result["deferred_markets"] if d["country"] not in {a["country"] for a in active_countries}]
        result["flags"].append(f"Auto-consolidated to {max_countries} countries (budget too thin for all {len(ranked)})")

    active_total_weight = sum(c["weight"] for c in active_countries)
    if active_total_weight == 0:
        active_total_weight = 1
    for c in active_countries:
        c["monthly"] = total_monthly * (c["weight"] / active_total_weight)
        c["daily"] = round(c["monthly"] / 30, 2)
        c["persona_allocations"] = _allocate_personas(c["monthly"], personas)
        result["country_allocations"][c["country"]] = c

    return result


def _allocate_personas(country_monthly: float, personas: list[dict]) -> dict[str, dict]:
    allocations = {}
    for persona in personas:
        key = persona.get("archetype_key", "unknown")
        tp = persona.get("targeting_profile", {})
        weight_pct = tp.get("budget_weight_pct", 100 // max(len(personas), 1))
        persona_monthly = country_monthly * (weight_pct / 100)
        persona_daily = persona_monthly / 30

        ideal_ad_sets = MAX_AD_SETS_PER_PERSONA
        per_ad_set_daily = persona_daily / ideal_ad_sets
        flags = []

        if per_ad_set_daily < MIN_DAILY_PER_AD_SET:
            for n in range(ideal_ad_sets, MIN_AD_SETS_PER_PERSONA - 1, -1):
                if persona_daily / n >= MIN_DAILY_PER_AD_SET:
                    ideal_ad_sets = n
                    per_ad_set_daily = persona_daily / n
                    break
            else:
                ideal_ad_sets = MIN_AD_SETS_PER_PERSONA
                per_ad_set_daily = persona_daily / MIN_AD_SETS_PER_PERSONA
                if per_ad_set_daily < MIN_DAILY_PER_AD_SET:
                    flags.append(f"Underfunded: ${per_ad_set_daily:.2f}/day per ad set (need ${MIN_DAILY_PER_AD_SET}). Recommend increasing budget or excluding persona.")

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


def _calculate_ratio_mode(countries: list[dict], personas: list[dict]) -> dict:
    ranked = sorted(countries, key=lambda c: c.get("market_opportunity_score", 0.5), reverse=True)
    total_score = sum(c.get("market_opportunity_score", 0.5) for c in ranked)
    if total_score == 0:
        total_score = 1

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


PLATFORM_TARGETING_MAP = {
    "meta": {"label": "Meta (Facebook/Instagram)", "hyper": "Interest targeting", "hot": "Stacked interests", "broad": "Broad demographics", "lla": "Lookalike audiences", "retargeting": "Pixel visitors"},
    "tiktok": {"label": "TikTok", "hyper": "Interest targeting", "hot": "Behavior + interest combo", "broad": "Broad age/geo", "lla": "Custom audience lookalike", "retargeting": "Pixel/engagement retarget"},
    "linkedin": {"label": "LinkedIn", "hyper": "Job title + skill targeting", "hot": "Industry + seniority", "broad": "Company size + function", "lla": "Matched audience lookalike", "retargeting": "Website/engagement retarget"},
    "youtube": {"label": "YouTube", "hyper": "In-market + affinity audiences", "hot": "Custom intent audiences", "broad": "Demographics", "lla": "Similar audiences", "retargeting": "Remarketing lists"},
    "x": {"label": "X (Twitter)", "hyper": "Keyword + follower lookalike", "hot": "Conversation topics", "broad": "Interest categories", "lla": "Tailored audience lookalike", "retargeting": "Website tag retarget"},
    "snapchat": {"label": "Snapchat", "hyper": "Snap Lifestyle Categories", "hot": "Stacked interests", "broad": "Demographics + geo", "lla": "Snap Audience Match lookalike", "retargeting": "Pixel/engagement retarget"},
    "pinterest": {"label": "Pinterest", "hyper": "Interest + keyword targeting", "hot": "Actalike targeting", "broad": "Broad interests", "lla": "Actalike audiences", "retargeting": "Engagement retarget"},
    "wechat": {"label": "WeChat", "hyper": "Interest + behavior tags", "hot": "Stacked tags", "broad": "Demographics", "lla": "Mini Program lookalike", "retargeting": "Official Account followers"},
}


def translate_targeting_for_platform(targeting_profile: dict, platform: str) -> dict[str, Any]:
    """Translate universal targeting profile to platform-specific parameters."""
    platform_family = "meta"
    if "tiktok" in platform: platform_family = "tiktok"
    elif "linkedin" in platform: platform_family = "linkedin"
    elif "youtube" in platform: platform_family = "youtube"
    elif "twitter" in platform or platform == "x": platform_family = "x"
    elif "snap" in platform: platform_family = "snapchat"
    elif "pinterest" in platform: platform_family = "pinterest"
    elif "wechat" in platform: platform_family = "wechat"

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
