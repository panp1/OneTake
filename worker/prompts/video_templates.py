# worker/prompts/video_templates.py
"""UGC genre templates + location system for Stage 5 video pipeline.

8 templates define the structural skeleton for each video genre.
10 locations provide environmental variety. The LLM fills in
persona-specific content within the template's beat structure.

Architecture ported from Neurogen's prompt_templates.py.
"""
from __future__ import annotations

import random
from typing import Any

# ── 10 Locations ─────────────────────────────────────────────────────

LOCATIONS: dict[str, dict[str, Any]] = {
    "bedroom_vanity": {
        "environmental_pressure": ["beauty routine", "self-care", "confidence building"],
        "mood_bias": ["ring light or warm lamp", "close-up face", "mirror POV"],
        "seedream_hints": (
            "Young woman at vanity table, ring light reflection in eyes, "
            "makeup products visible, warm bedroom background, "
            "front-facing camera angle as if camera IS the mirror"
        ),
    },
    "bathroom_mirror": {
        "environmental_pressure": ["routine", "authenticity", "vulnerability"],
        "mood_bias": ["warm soft lighting", "intimate", "morning glow"],
        "seedream_hints": (
            "Person in bathroom, mirror selfie angle, warm overhead light, "
            "toothbrush/skincare visible, natural morning appearance"
        ),
    },
    "kitchen_counter": {
        "environmental_pressure": ["home comfort", "casual", "daily life"],
        "mood_bias": ["bright natural window light", "domestic", "approachable"],
        "seedream_hints": (
            "Person leaning on kitchen counter, bright window behind, "
            "coffee mug visible, casual clothes, relaxed posture"
        ),
    },
    "car_selfie": {
        "environmental_pressure": ["urgency", "mobility", "spontaneity"],
        "mood_bias": ["variable natural light", "handheld shake", "raw energy"],
        "seedream_hints": (
            "Person in car driver/passenger seat, seatbelt visible, "
            "dashboard blurred behind, selfie angle from phone on dash, "
            "excited expression"
        ),
    },
    "couch_home": {
        "environmental_pressure": ["relaxation", "trust", "personal space"],
        "mood_bias": ["warm lamp glow", "cozy", "confessional"],
        "seedream_hints": (
            "Person on couch with throw blanket, warm lamp light, "
            "living room background, legs tucked up, casual intimate pose"
        ),
    },
    "desk_workspace": {
        "environmental_pressure": ["productivity", "earning", "professional"],
        "mood_bias": ["focused task lighting", "clean background", "competent"],
        "seedream_hints": (
            "Person at desk, laptop closed/angled away, desk lamp, "
            "organized space, smart-casual clothes, slightly leaning forward"
        ),
    },
    "cafe_window": {
        "environmental_pressure": ["social", "aspirational", "freedom"],
        "mood_bias": ["golden natural light", "bokeh background", "lifestyle"],
        "seedream_hints": (
            "Person at cafe window seat, golden light streaming in, "
            "coffee cup, busy street bokeh behind, relaxed confident smile"
        ),
    },
    "walking_street": {
        "environmental_pressure": ["movement", "energy", "real world"],
        "mood_bias": ["overcast or golden", "handheld shake", "dynamic"],
        "seedream_hints": (
            "Person walking on urban street, camera tracking at eye level, "
            "slight motion blur, buildings behind, mid-stride energy"
        ),
    },
    "bedroom_morning": {
        "environmental_pressure": ["fresh start", "genuine", "unfiltered"],
        "mood_bias": ["soft morning window light", "messy-real", "intimate"],
        "seedream_hints": (
            "Person sitting on bed edge, morning light through curtains, "
            "rumpled sheets, natural hair, just-woke-up authentic"
        ),
    },
    "park_bench": {
        "environmental_pressure": ["freedom", "flexibility", "outdoors"],
        "mood_bias": ["bright daylight", "green background", "relaxed"],
        "seedream_hints": (
            "Person on park bench, trees and grass behind, dappled sunlight, "
            "casual outdoor clothes, open relaxed posture"
        ),
    },
}


# ── 8 UGC Genre Templates ───────────────────────────────────────────

UGC_TEMPLATES: dict[str, dict[str, Any]] = {
    "grwm": {
        "name": "Get Ready With Me",
        "description": "Creator sharing a tip during their morning routine",
        "duration_range": (14, 15),
        "beats": [
            {
                "label": "routine",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up mirror angle, doing morning routine, natural and relaxed",
                "energy": 3,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
            {
                "label": "getting_ready",
                "duration_s": 3,
                "camera": "medium",
                "direction": "Medium shot getting dressed/doing makeup, casual body language",
                "energy": 4,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "casual_mention",
                "duration_s": 4,
                "camera": "close_up",
                "direction": "Close-up, 'oh btw' casual tone, genuine excitement creeping in",
                "energy": 6,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "reaction",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Eyes light up genuinely, nodding, convincing smile",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "wide_establishing",
                "direction": "Wide shot grabbing bag, heading out the door, confident energy",
                "energy": 8,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["bedroom_vanity", "bathroom_mirror", "bedroom_morning", "kitchen_counter"],
    },
    "storytime": {
        "name": "Storytime",
        "description": "Creator telling friends about an amazing find",
        "duration_range": (13, 15),
        "beats": [
            {
                "label": "hook",
                "duration_s": 3,
                "camera": "extreme_close_up",
                "direction": "Extreme close-up, 'so this happened' energy, lean into camera",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "problem",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, animated hand gestures, building the frustration",
                "energy": 5,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "discovery",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up, expression shifts from frustrated to surprised to excited",
                "energy": 8,
                "has_dialogue": True,
                "transition": "smash_cut",
            },
            {
                "label": "cta",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Direct to camera, excited energy, beckoning gesture, genuine urgency",
                "energy": 9,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["couch_home", "car_selfie", "bedroom_morning", "cafe_window"],
    },
    "just_found_out": {
        "name": "Just Found Out",
        "description": "Excited friend who can't contain the news",
        "duration_range": (12, 14),
        "beats": [
            {
                "label": "urgent_hook",
                "duration_s": 3,
                "camera": "handheld",
                "direction": "Handheld selfie, slightly shaky, 'you guys...' urgent energy",
                "energy": 8,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "explain",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, speaking rapidly, animated gestures, can't slow down",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "proof",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up, eyes wide, genuine disbelief at the opportunity",
                "energy": 9,
                "has_dialogue": True,
                "transition": "smash_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "close_up",
                "direction": "Direct to camera, 'you NEED to try this', pointing at viewer",
                "energy": 10,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["car_selfie", "walking_street", "couch_home", "kitchen_counter"],
    },
    "day_in_my_life": {
        "name": "Day In My Life",
        "description": "Lifestyle vlog with naturally embedded pitch",
        "duration_range": (14, 15),
        "beats": [
            {
                "label": "morning",
                "duration_s": 2,
                "camera": "wide_establishing",
                "direction": "Wide shot morning routine, stretching/coffee, soft morning light",
                "energy": 3,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
            {
                "label": "commute",
                "duration_s": 2,
                "camera": "tracking",
                "direction": "Tracking shot walking/commuting, handheld energy, city sounds",
                "energy": 4,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
            {
                "label": "work",
                "duration_s": 3,
                "camera": "medium",
                "direction": "Medium at desk/workspace, focused then looks up to camera",
                "energy": 5,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "earnings",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up reaction to earnings, genuine happy surprise, celebratory",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "flex",
                "duration_s": 3,
                "camera": "medium",
                "direction": "Medium shot enjoying evening, relaxed, satisfied energy",
                "energy": 8,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "close_up",
                "direction": "Direct to camera, recommend with warm confidence",
                "energy": 9,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["bedroom_morning", "walking_street", "desk_workspace", "cafe_window", "couch_home", "park_bench"],
    },
    "pov_discover": {
        "name": "POV: You Discover",
        "description": "Second-person immersion, viewer IS the character",
        "duration_range": (12, 13),
        "beats": [
            {
                "label": "pov_scroll",
                "duration_s": 4,
                "camera": "over_shoulder",
                "direction": "Over-shoulder/POV angle, person scrolling or reading, contemplative",
                "energy": 4,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
            {
                "label": "reaction",
                "duration_s": 4,
                "camera": "close_up",
                "direction": "Close-up face, expression shifts from curious to excited, genuine",
                "energy": 8,
                "has_dialogue": True,
                "transition": "smash_cut",
            },
            {
                "label": "cta",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot celebration, fist pump or happy dance, then direct to camera CTA",
                "energy": 10,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["couch_home", "desk_workspace", "bedroom_morning", "car_selfie"],
    },
    "reply_to_comment": {
        "name": "Reply To Comment",
        "description": "Organic engagement response, creator defending their choice",
        "duration_range": (12, 14),
        "beats": [
            {
                "label": "read_comment",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up reading 'comment' with slight skepticism/amusement",
                "energy": 5,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "address",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, explaining directly, confident body language",
                "energy": 7,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "proof",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up, sharing personal experience, authentic storytelling",
                "energy": 8,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "close_up",
                "direction": "Direct to camera, 'try it yourself', warm challenge energy",
                "energy": 9,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["couch_home", "desk_workspace", "kitchen_counter", "car_selfie"],
    },
    "before_after": {
        "name": "Before/After",
        "description": "Transformation story, relatable struggle to success",
        "duration_range": (13, 15),
        "beats": [
            {
                "label": "before",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, slumped posture, frustrated, dim/flat lighting feel",
                "energy": 3,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "discovery",
                "duration_s": 3,
                "camera": "close_up",
                "direction": "Close-up, expression shifts, curiosity then hope",
                "energy": 5,
                "has_dialogue": True,
                "transition": "whip_transition",
            },
            {
                "label": "after",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, upright posture, bright energy, warm lighting",
                "energy": 9,
                "has_dialogue": True,
                "transition": "smash_cut",
            },
            {
                "label": "cta",
                "duration_s": 2,
                "camera": "close_up",
                "direction": "Direct to camera, recommending with earned credibility",
                "energy": 8,
                "has_dialogue": False,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["desk_workspace", "bedroom_morning", "cafe_window", "park_bench", "couch_home"],
    },
    "whisper_confession": {
        "name": "Whisper/Confession",
        "description": "Intimate secret sharing, insider knowledge",
        "duration_range": (12, 13),
        "beats": [
            {
                "label": "lean_in",
                "duration_s": 4,
                "camera": "extreme_close_up",
                "direction": "Extreme close-up, whispering, conspiratorial, 'don't tell anyone'",
                "energy": 6,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "reveal",
                "duration_s": 4,
                "camera": "medium",
                "direction": "Medium shot, hushed excitement building, gestures getting bigger",
                "energy": 8,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
            {
                "label": "cta",
                "duration_s": 4,
                "camera": "close_up",
                "direction": "Close-up, drops the whisper, direct intense eye contact, 'seriously go do this'",
                "energy": 9,
                "has_dialogue": True,
                "transition": "hard_cut",
            },
        ],
        "location_pool": ["bedroom_vanity", "bedroom_morning", "couch_home", "car_selfie"],
    },
}


# ── Template Selector ────────────────────────────────────────────────

def select_template(
    persona: dict[str, Any],
    platform: str = "tiktok",
) -> tuple[str, dict[str, Any], list[dict[str, Any]]]:
    """Select a genre template and random locations for a persona.

    Returns (template_key, template_dict, selected_locations).
    Each location is a dict from LOCATIONS with its key added as "key".
    """
    # Score templates by persona fit
    psychology = persona.get("psychology_profile", {})
    primary_bias = psychology.get("primary_bias", "")

    # Bias → template affinity mapping
    bias_affinity: dict[str, list[str]] = {
        "effort_minimization": ["grwm", "day_in_my_life", "pov_discover"],
        "social_proof": ["storytime", "reply_to_comment", "before_after"],
        "loss_aversion": ["just_found_out", "whisper_confession"],
        "curiosity_gap": ["pov_discover", "whisper_confession", "storytime"],
        "identity_appeal": ["before_after", "day_in_my_life", "grwm"],
        "concrete_specificity": ["just_found_out", "reply_to_comment"],
    }

    preferred = bias_affinity.get(primary_bias, list(UGC_TEMPLATES.keys()))
    # Pick from preferred, fallback to random
    candidates = [k for k in preferred if k in UGC_TEMPLATES]
    if not candidates:
        candidates = list(UGC_TEMPLATES.keys())

    template_key = random.choice(candidates)
    template = UGC_TEMPLATES[template_key]

    # Pick 2-3 random locations from the template's pool
    pool = template.get("location_pool", list(LOCATIONS.keys()))
    num_locations = min(len(template["beats"]), len(pool), 3)
    selected_keys = random.sample(pool, num_locations)
    selected_locations = [
        {**LOCATIONS[k], "key": k} for k in selected_keys
    ]

    return template_key, template, selected_locations
