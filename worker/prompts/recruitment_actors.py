"""Recruitment-specific prompts for actor/character generation (Stage 2).

Actors are fictional but culturally authentic contributors used in
recruitment ads. They should look like real people you would see on a
bus or in a coffee shop — NOT corporate stock photos.

Every image prompt includes the 10 REALISM ANCHORS to ensure Seedream
generates UGC-style photography, not polished studio shots.
"""
from __future__ import annotations

ACTOR_SYSTEM_PROMPT = (
    "You are a casting director for OneForma recruitment ads. You create "
    "fictional but culturally authentic contributor personas for specific "
    "regions. Each actor should feel like a REAL person — someone you would "
    "meet at a coffee shop, library, or co-working space. They are NOT "
    "corporate employees, models, or stock photo subjects."
)

# ---------------------------------------------------------------------------
# The 10 Realism Anchors
# ---------------------------------------------------------------------------
# These are appended to every Seedream image prompt to ensure the generated
# images look like authentic UGC (user-generated content) rather than
# polished studio photography.

REALISM_ANCHORS = [
    "Shot on iPhone 15 Pro, natural lighting, no studio setup",
    "Slight asymmetry in facial features — real face, not AI-perfected",
    "Visible skin texture: pores, minor blemishes, natural skin tone variation",
    "Hair with natural flyaways, not salon-styled — real everyday hair",
    "Clothing with natural wrinkles and wear — not freshly pressed",
    "Environment with lived-in details: coffee cup, notebooks, phone charger",
    "Natural body posture — slightly leaning, relaxed, not model-posed",
    "Ambient background blur (shallow depth of field, f/1.8 equivalent)",
    "Warm indoor lighting with slight color cast from window or lamp",
    "Candid expression — mid-conversation smile or focused concentration, not posed grin",
]

REALISM_ANCHORS_TEXT = "\n".join(f"  {i+1}. {a}" for i, a in enumerate(REALISM_ANCHORS))

# Region-specific setting suggestions for authentic backgrounds.
REGION_SETTINGS: dict[str, list[str]] = {
    "Latin America": [
        "bright kitchen with tiled walls",
        "small home office with plant on desk",
        "outdoor balcony with city view",
        "local coffee shop with wooden tables",
    ],
    "Southeast Asia": [
        "small apartment desk near window with fan",
        "co-working space with tropical plants",
        "balcony overlooking green neighbourhood",
        "university library corner",
    ],
    "Eastern Europe": [
        "compact apartment with bookshelves",
        "kitchen table with tea and laptop",
        "co-working space in renovated building",
        "park bench with autumn leaves",
    ],
    "South Asia": [
        "home desk with chai cup and phone",
        "rooftop workspace at golden hour",
        "small room with colourful textiles visible",
        "university campus common area",
    ],
    "Africa": [
        "bright room with patterned curtains",
        "shared workspace with concrete walls",
        "outdoor seating under shade tree",
        "small business centre table",
    ],
    "Middle East": [
        "modern apartment study corner",
        "coffee shop with Arabic calligraphy decor",
        "home office with warm wood tones",
        "university common room",
    ],
    "CIS": [
        "apartment kitchen with tiled backsplash",
        "home desk near radiator and window",
        "co-working space with exposed brick",
        "cafe table with winter light through glass",
    ],
    "East Asia": [
        "compact desk in tidy apartment",
        "convenience store cafe corner",
        "library carrel with stacked books",
        "rooftop garden workspace",
    ],
    "Global": [
        "home desk with laptop and coffee",
        "co-working space with natural light",
        "coffee shop corner table",
        "outdoor park bench with laptop",
    ],
}


def build_actor_prompt(brief: dict, region: str, language: str) -> str:
    """Build the prompt for generating an actor identity card."""
    audience = brief.get("target_audience", {})
    persona = audience.get("persona", "A multilingual freelancer looking for flexible remote work")
    profile_types = audience.get("profile_types", ["students", "freelancers"])

    return f"""Create a fictional but culturally authentic contributor persona for a OneForma recruitment ad.

TARGET REGION: {region}
TARGET LANGUAGE: {language}
CAMPAIGN PERSONA: {persona}
PROFILE TYPES: {", ".join(profile_types)}

This person will appear in a recruitment ad photograph. They must feel REAL and RELATABLE
to people in {region} who speak {language}.

Return ONLY valid JSON:
{{
  "name": "A culturally appropriate first name for {region}",
  "age": 24,
  "gender": "male/female/non-binary",
  "occupation": "Their current/previous occupation (student, freelancer, etc.)",
  "appearance": {{
    "ethnicity": "Specific to {region} — be precise, not generic",
    "build": "average/slim/athletic — realistic, not model-like",
    "hair": "Specific natural hairstyle common in {region}",
    "clothing": "What they would actually wear at home/cafe while working (casual, real)",
    "distinguishing_features": "One small realistic detail (glasses, dimple, freckles, etc.)"
  }},
  "setting": "Where they are — a real-feeling location in {region}",
  "device": "What device they are using (laptop, phone, tablet)",
  "mood": "Relaxed, focused, or casually happy — NOT corporate-smiling",
  "backstory": "2 sentences: who they are and why they would do annotation work",
  "motivation": "What would make THIS person click on a recruitment ad?"
}}

IMPORTANT:
- The person must look like someone you would actually see in {region}.
- NO stock-photo vibes. NO corporate attire. NO perfect styling.
- They should look like they are working from home or a casual space.
- Age should be 18-45 (the OneForma contributor demographic)."""


def build_image_prompt(
    actor: dict,
    brief: dict,
    design: dict,
    region: str,
) -> str:
    """Build the Seedream image generation prompt for an actor.

    Includes all 10 realism anchors and region-specific setting details.
    """
    appearance = actor.get("appearance", {})
    settings = REGION_SETTINGS.get(region, REGION_SETTINGS["Global"])
    setting = actor.get("setting", settings[0])

    photography_dir = design.get("photography_direction", "candid, natural, UGC-style")

    prompt = f"""Portrait photograph of {actor.get("name", "a person")}, a {actor.get("age", 25)}-year-old {appearance.get("ethnicity", "")} {actor.get("gender", "person")}.

APPEARANCE:
- Build: {appearance.get("build", "average")}
- Hair: {appearance.get("hair", "natural")}
- Clothing: {appearance.get("clothing", "casual everyday clothes")}
- Distinguishing feature: {appearance.get("distinguishing_features", "natural look")}

SETTING: {setting}
DEVICE: {actor.get("device", "laptop")} visible in frame
MOOD: {actor.get("mood", "relaxed and focused")}
STYLE: {photography_dir}

REALISM ANCHORS (MANDATORY — the image MUST exhibit ALL of these):
{REALISM_ANCHORS_TEXT}

The final image should look like it was taken by a friend with an iPhone,
not by a professional photographer in a studio. This is for a recruitment
ad targeting real people in {region}."""

    return prompt


def build_visual_qa_prompt(actor: dict, region: str) -> str:
    """Build the VLM visual QA prompt for evaluating a generated actor image."""
    appearance = actor.get("appearance", {})

    return f"""Evaluate this recruitment ad image for cultural authenticity and realism.

EXPECTED SUBJECT:
- Name: {actor.get("name", "unknown")}
- Age: ~{actor.get("age", 25)}
- Gender: {actor.get("gender", "unknown")}
- Ethnicity: {appearance.get("ethnicity", "unknown")}
- Clothing: {appearance.get("clothing", "casual")}
- Setting: {actor.get("setting", "home office")}
- Region: {region}

Check EACH of these and score 0.0-1.0:

1. REALISM: Does this look like a real iPhone photo, not AI-generated or stock?
   - Check for: natural skin texture, realistic lighting, candid pose
   - Red flags: plastic skin, perfect symmetry, uncanny valley, studio lighting

2. CULTURAL AUTHENTICITY: Does this person look like they belong in {region}?
   - Check for: appropriate ethnicity, realistic clothing for the region, authentic setting
   - Red flags: generic/ambiguous ethnicity, Western-default clothing, mismatched setting

3. BRAND FIT: Would this work for a OneForma recruitment ad?
   - Check for: approachable, relatable, not intimidating, working-from-home vibe
   - Red flags: corporate attire, model-like appearance, luxury setting

4. TECHNICAL QUALITY: Is the image usable for an ad?
   - Check for: proper framing, no artifacts, face clearly visible, good resolution
   - Red flags: distorted features, extra fingers, blurry face, watermarks

Return ONLY valid JSON:
{{
  "overall_score": 0.0,
  "score": 0.0,
  "dimensions": {{
    "realism": {{"score": 0.0, "feedback": "..."}},
    "cultural_authenticity": {{"score": 0.0, "feedback": "..."}},
    "brand_fit": {{"score": 0.0, "feedback": "..."}},
    "technical_quality": {{"score": 0.0, "feedback": "..."}}
  }},
  "issues": ["List any problems that need fixing"],
  "passed": true
}}"""
