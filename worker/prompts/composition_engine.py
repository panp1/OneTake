"""Photography composition engine for AI image generation.

Extracted from professional photography composition rules and adapted
for recruitment ad photography. Each composition technique is mapped to
specific content intents — the engine selects the right composition for
the shot context, NOT randomly.

The problem this solves: AI image generators default to the same
dead-center, eye-level headshot every time. Real UGC has diverse angles,
framings, and compositions that make images feel authentic and varied.
"""
from __future__ import annotations

import random
from typing import Any

# =========================================================================
# 11 COMPOSITION TECHNIQUES (from photography composition cheat sheet)
# =========================================================================

COMPOSITIONS: dict[str, dict[str, Any]] = {
    "rule_of_thirds": {
        "name": "Rule of Thirds",
        "prompt_instruction": (
            "Compose using rule of thirds — place the subject on the left "
            "or right third intersection point, NOT centered. 2/3 of the "
            "frame shows environment, 1/3 is the subject. Camera at eye level."
        ),
        "camera_angle": "eye level, slightly off-center",
        "best_for": ["working", "environmental", "storytelling"],
        "avoid_for": ["headshot", "stat_panel", "tight_portrait"],
        "aspect_ratios": ["landscape", "square"],
        "energy": "calm",
    },
    "balance": {
        "name": "Balance",
        "prompt_instruction": (
            "Compose with visual balance — subject on one side, their device "
            "or a secondary element (coffee cup, plant, window light) on the "
            "other side. Neither side feels heavier than the other."
        ),
        "camera_angle": "eye level, medium shot",
        "best_for": ["working", "two_actors", "device_visible"],
        "avoid_for": ["action", "celebration", "tight_crop"],
        "aspect_ratios": ["landscape", "square"],
        "energy": "balanced",
    },
    "framing": {
        "name": "Natural Framing",
        "prompt_instruction": (
            "Frame the subject using natural elements — a doorway, window "
            "frame, laptop screen edge, bookshelf opening, or archway. The "
            "subject is 'inside' the frame-within-a-frame. Creates depth "
            "and intimacy — like peering into their world."
        ),
        "camera_angle": "eye level or slightly below, shooting through frame element",
        "best_for": ["intimate", "home_setting", "working", "storytelling"],
        "avoid_for": ["outdoor", "group", "action"],
        "aspect_ratios": ["portrait", "square"],
        "energy": "intimate",
    },
    "low_angle": {
        "name": "Low Angle (Empowerment)",
        "prompt_instruction": (
            "Camera positioned below subject, looking UP at them slightly "
            "(15-30 degrees). Subject appears confident, empowered, larger "
            "than life. NOT extreme — subtle upward tilt. Shows ceiling or "
            "sky above them."
        ),
        "camera_angle": "low angle looking up (15-30 degrees)",
        "best_for": ["empowerment", "confidence", "celebrating", "aspirational"],
        "avoid_for": ["relaxed", "casual", "working_from_above"],
        "aspect_ratios": ["portrait", "square"],
        "energy": "powerful",
    },
    "overhead": {
        "name": "Overhead / Bird's Eye",
        "prompt_instruction": (
            "Camera directly above or at steep downward angle (60-90 degrees) "
            "looking down at subject's workspace. Shows: desk surface, laptop "
            "keyboard, hands, coffee cup, notebook, phone. Subject's face "
            "may be partially visible or looking down at work. Classic "
            "'flat lay' style for workspace shots."
        ),
        "camera_angle": "overhead, looking straight down or steep angle",
        "best_for": ["workspace", "hands_working", "device_focus", "flat_lay"],
        "avoid_for": ["face_focus", "portrait", "empowerment", "group"],
        "aspect_ratios": ["square", "landscape"],
        "energy": "focused",
    },
    "leading_lines": {
        "name": "Leading Lines",
        "prompt_instruction": (
            "Use natural lines in the environment to draw the eye toward "
            "the subject — table edge, hallway perspective, window sill, "
            "desk surface, cafe counter. The lines converge toward or "
            "frame the subject. Creates depth and draws attention."
        ),
        "camera_angle": "eye level or slightly above, perspective visible",
        "best_for": ["cafe", "corridor", "desk", "environmental"],
        "avoid_for": ["tight_portrait", "headshot", "flat_background"],
        "aspect_ratios": ["landscape"],
        "energy": "directed",
    },
    "environmental_wide": {
        "name": "Environmental / Background Focus",
        "prompt_instruction": (
            "Wide shot where the ENVIRONMENT is the star — the subject is "
            "smaller in the frame (30-40% of image). Shows the full setting: "
            "their home, cafe, city, culture. Subject is recognizable but "
            "context tells the story. Like a travel photo where a friend "
            "is part of the scene, not the only thing in it."
        ),
        "camera_angle": "eye level or slightly above, wide focal length",
        "best_for": ["cultural", "setting_showcase", "lifestyle", "story_context"],
        "avoid_for": ["face_focus", "headshot", "product_detail"],
        "aspect_ratios": ["landscape", "portrait"],
        "energy": "expansive",
    },
    "symmetry": {
        "name": "Symmetry / Pattern",
        "prompt_instruction": (
            "Center the subject in a symmetrical composition — works when "
            "the environment has symmetrical elements (tiled floor, bookshelf, "
            "window panes, archway). Subject dead center, environment mirrors "
            "on both sides. Powerful and intentional — NOT the AI default "
            "(which is centered but without symmetrical context)."
        ),
        "camera_angle": "straight on, eye level, centered",
        "best_for": ["twins", "community_group", "architectural_setting", "formal"],
        "avoid_for": ["casual", "candid", "action", "off_center"],
        "aspect_ratios": ["square", "portrait"],
        "energy": "structured",
    },
    "depth_bokeh": {
        "name": "Shallow Depth (Bokeh)",
        "prompt_instruction": (
            "Subject sharp in foreground, background heavily blurred (f/1.4 "
            "- f/2.8 equivalent). Subject occupies 50-60% of frame. "
            "Background shows soft color blobs of the environment — warm "
            "light orbs, blurred cafe shapes, out-of-focus plants. Classic "
            "iPhone portrait mode aesthetic."
        ),
        "camera_angle": "eye level, medium close-up",
        "best_for": ["portrait", "profile_photo", "focused", "any_setting"],
        "avoid_for": ["environmental", "workspace_detail", "group"],
        "aspect_ratios": ["portrait", "square"],
        "energy": "focused",
    },
    "tight_crop": {
        "name": "Tight Crop (Close-up)",
        "prompt_instruction": (
            "Cropped tight — shoulders and up. Face fills 60-70% of frame. "
            "One ear might be slightly out of frame. Headphones/earbuds "
            "clearly visible. Shows: skin texture, expression, eye contact "
            "or focused gaze at screen. Intimate, personal, high-impact. "
            "Like a selfie your friend took from arm's length."
        ),
        "camera_angle": "eye level or slightly above (selfie angle), close",
        "best_for": ["headshot", "story_format", "intimate", "reaction"],
        "avoid_for": ["environmental", "group", "workspace"],
        "aspect_ratios": ["portrait", "square"],
        "energy": "intimate",
    },
    "rule_of_space": {
        "name": "Rule of Space",
        "prompt_instruction": (
            "Subject placed on one side of frame, LOOKING or LEANING toward "
            "the open space on the other side. The empty space implies "
            "opportunity, possibility, the future. Subject at left third "
            "looking right (or vice versa). Perfect for 'new beginning' "
            "and 'opportunity' messaging in recruitment ads."
        ),
        "camera_angle": "eye level, medium shot, subject off-center",
        "best_for": ["opportunity", "aspirational", "looking_forward", "new_beginning"],
        "avoid_for": ["workspace_detail", "overhead", "tight_crop"],
        "aspect_ratios": ["landscape", "square"],
        "energy": "hopeful",
    },
}


# =========================================================================
# CONTENT INTENT → COMPOSITION MAPPING
# =========================================================================
# Each ad context/intent maps to a RANKED list of suitable compositions.
# The engine picks from the top 3, weighted by rank.

INTENT_COMPOSITIONS: dict[str, list[str]] = {
    # Actor working from home — annotating data on laptop
    "at_home_working": [
        "rule_of_thirds",       # Environmental, shows home + actor
        "overhead",             # Workspace flat lay, hands on keyboard
        "depth_bokeh",          # Focus on actor, home blurred behind
        "framing",              # Framed by doorway or window
        "balance",              # Actor and device balanced
    ],

    # Actor relaxed at home
    "at_home_relaxed": [
        "depth_bokeh",          # Soft, comfortable feel
        "rule_of_thirds",       # Couch/bed scene with environment
        "tight_crop",           # Relaxed selfie-style
        "framing",              # Through doorway or window
    ],

    # Actor at a cafe
    "cafe_working": [
        "leading_lines",        # Cafe counter or table leads to subject
        "environmental_wide",   # Cafe culture visible
        "rule_of_thirds",       # Actor at table, cafe around them
        "depth_bokeh",          # Cafe background beautifully blurred
        "balance",              # Actor + coffee + laptop balanced
    ],

    # Actor celebrating (got paid, completed task)
    "celebrating_earnings": [
        "low_angle",            # Empowerment! They're winning
        "tight_crop",           # Big smile, phone in hand
        "rule_of_space",        # Looking toward future/opportunity
        "depth_bokeh",          # Joyful face, soft background
    ],

    # Two actors collaborating
    "collaboration": [
        "balance",              # Two people balanced in frame
        "leading_lines",        # Table edge connects them
        "environmental_wide",   # Show the shared space
        "rule_of_thirds",       # One actor on each third
    ],

    # Twins / siblings
    "twins": [
        "symmetry",             # Twins = symmetry (intentional)
        "balance",              # One on each side
        "tight_crop",           # Two faces close together
    ],

    # Community / group shot
    "community": [
        "environmental_wide",   # Show the diversity + setting
        "symmetry",             # Centered group
        "leading_lines",        # Arranged along a table/bench
    ],

    # Video call scene
    "video_call": [
        "overhead",             # Looking down at laptop showing call
        "framing",              # Laptop screen frames the remote person
        "tight_crop",           # Over-shoulder into screen
    ],

    # Profile/headshot for carousel or avatar
    "profile": [
        "depth_bokeh",          # Classic portrait mode
        "tight_crop",           # Close and personal
        "rule_of_space",        # Looking toward opportunity
    ],

    # Aspirational / "what if" messaging
    "aspirational": [
        "low_angle",            # Empowerment
        "rule_of_space",        # Open space = possibility
        "environmental_wide",   # Their world, expanded
        "depth_bokeh",          # Dreamy, forward-looking
    ],

    # Workspace detail / hands working
    "workspace_detail": [
        "overhead",             # Flat lay of desk
        "tight_crop",           # Hands on keyboard close-up
        "leading_lines",        # Desk edge leads to hands
    ],

    # Story format (9:16 vertical)
    "story_vertical": [
        "tight_crop",           # Face fills vertical frame
        "low_angle",            # Dynamic vertical composition
        "depth_bokeh",          # Portrait mode natural fit
        "rule_of_space",        # Space above or below subject
    ],
}


# =========================================================================
# CAMERA ANGLE VARIATIONS (anti-sameness)
# =========================================================================
# Even within a composition, vary the exact angle slightly.

ANGLE_VARIATIONS: list[str] = [
    "straight on, eye level",
    "slightly from the left (10-15 degrees)",
    "slightly from the right (10-15 degrees)",
    "slightly above eye level (looking down 10 degrees)",
    "slightly below eye level (looking up 10 degrees)",
    "over-the-shoulder perspective",
    "three-quarter view (45 degrees from front)",
    "profile view (90 degrees, side of face)",
]


def select_composition(
    intent: str,
    actor_index: int = 0,
    total_images: int = 1,
    used_compositions: list[str] | None = None,
) -> dict[str, str]:
    """Select a composition technique for a specific image.

    Ensures variety across a set of images for the same actor/campaign.
    Never repeats the same composition within a set unless exhausted.

    Parameters
    ----------
    intent:
        The content intent (key from INTENT_COMPOSITIONS).
    actor_index:
        Which image number this is for the actor (0-based).
    total_images:
        Total images being generated for this actor.
    used_compositions:
        List of composition keys already used in this set.
        Pass this to avoid repetition across images.

    Returns
    -------
    dict with keys: composition_key, composition_name, prompt_instruction,
    camera_angle, angle_variation.
    """
    used = set(used_compositions or [])

    # Get ranked compositions for this intent
    ranked = INTENT_COMPOSITIONS.get(intent, INTENT_COMPOSITIONS["at_home_working"])

    # Filter out already-used compositions
    available = [c for c in ranked if c not in used]

    # If all exhausted, reset (shouldn't happen with 4 images per actor)
    if not available:
        available = ranked

    # Pick the top-ranked available composition
    # Add slight randomness: 70% chance of #1, 20% #2, 10% #3+
    if len(available) >= 3:
        weights = [0.7, 0.2] + [0.1 / (len(available) - 2)] * (len(available) - 2)
    elif len(available) == 2:
        weights = [0.7, 0.3]
    else:
        weights = [1.0]

    selected_key = random.choices(available, weights=weights, k=1)[0]
    comp = COMPOSITIONS[selected_key]

    # Select angle variation — different for each image in the set
    angle_idx = (actor_index + hash(selected_key)) % len(ANGLE_VARIATIONS)
    angle_variation = ANGLE_VARIATIONS[angle_idx]

    return {
        "composition_key": selected_key,
        "composition_name": comp["name"],
        "prompt_instruction": comp["prompt_instruction"],
        "camera_angle": comp["camera_angle"],
        "angle_variation": angle_variation,
        "energy": comp["energy"],
    }


def build_composition_block(intent: str, image_index: int = 0, used: list[str] | None = None) -> str:
    """Build the composition instruction block to append to any Seedream prompt.

    Returns a formatted string ready to be appended to the image prompt.
    """
    comp = select_composition(intent, actor_index=image_index, used_compositions=used)

    return f"""
COMPOSITION TECHNIQUE: {comp["composition_name"]}
{comp["prompt_instruction"]}

CAMERA ANGLE: {comp["camera_angle"]}
ANGLE VARIATION: {comp["angle_variation"]}

CRITICAL: Do NOT use the default AI head-on centered composition.
This image MUST use the {comp["composition_name"]} technique described above.
The camera position and subject placement must match the instructions.""", comp["composition_key"]
