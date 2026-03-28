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
    """Build the prompt for generating an actor identity card.

    The JSON output matches the DB schema: face_lock, prompt_seed,
    outfit_variations, signature_accessory, backdrops — following
    the UGC actor system for consistent character generation across
    all ad variants.
    """
    audience = brief.get("target_audience", {})
    persona = audience.get("persona", "A multilingual freelancer looking for flexible remote work")
    profile_types = audience.get("profile_types", ["students", "freelancers"])
    settings = REGION_SETTINGS.get(region, REGION_SETTINGS["Global"])

    return f"""Create an AI UGC actor identity card for a OneForma recruitment ad campaign.

TARGET REGION: {region}
TARGET LANGUAGE: {language}
CAMPAIGN PERSONA: {persona}
PROFILE TYPES: {", ".join(profile_types)}

This actor will appear across MULTIPLE ad creatives (feed, stories, carousel panels).
Their identity must be LOCKED — same person in every image. They must feel REAL and
RELATABLE to people in {region} who speak {language}.

Return ONLY valid JSON matching this EXACT schema:
{{
  "name": "A culturally appropriate first name for {region}",
  "face_lock": {{
    "skin_tone_hex": "#HEXCOLOR (realistic skin tone for someone from {region})",
    "eye_color": "specific eye color (brown, dark brown, hazel, etc.)",
    "jawline": "face shape description (round, defined, soft oval, angular, etc.)",
    "hair": "specific hairstyle common in {region} (include color, length, texture)",
    "nose_shape": "specific description (broad bridge, delicate, straight, etc.)",
    "age_range": "e.g. 22-26",
    "distinguishing_marks": "1-2 unique features (light stubble, dimple, beauty mark, laugh lines, glasses)"
  }},
  "prompt_seed": "One dense paragraph (80-120 words) describing this EXACT person that gets pasted into EVERY Seedream generation for consistency. Include: ethnicity, age, skin tone hex, face shape, hair, eye color, distinguishing marks, default expression. This is the IDENTITY LOCK — if you generate 20 images with this seed, they should all clearly be the same person.",
  "outfit_variations": {{
    "at_home_working": "What they wear while annotating data at home (e.g., casual t-shirt, headphones on, comfortable pants)",
    "at_home_relaxed": "Relaxed version — hoodie/sweater, sitting on couch or bed with laptop",
    "cafe_working": "What they wear to a cafe to work (slightly more put-together but still casual)",
    "celebrating_earnings": "Casual outfit, looking at phone with satisfied expression — just got paid"
  }},
  "signature_accessory": "ONE item they ALWAYS have visible (over-ear headphones, wireless earbuds, specific watch, bracelet, hair clip, glasses — pick something relevant to data annotation work)",
  "backdrops": [
    "A realistic {region} home setting (kitchen table, bedroom desk, etc.)",
    "A realistic {region} cafe or public workspace",
    "A realistic {region} outdoor or balcony setting",
    "A close-up framing for story/portrait format"
  ]
}}

RULES:
- Face lock = the person's PERMANENT features. Same in every image.
- Prompt seed = the dense text that Seedream uses for EVERY generation. It's the identity.
- Outfit variations = 4 different looks for different ad contexts.
- Signature accessory = appears in EVERY image (creates recognition across ad set).
- Backdrops = 4 realistic settings from {region} (NOT generic Western settings).
- Age 18-35 (the OneForma contributor demographic).
- NO stock-photo vibes. NO corporate attire. NO model-like appearance.
- They should look like a real {language}-speaking person in {region} who does gig work from home."""


def build_image_prompt(
    actor: dict,
    outfit_key: str = "at_home_working",
    backdrop_index: int = 0,
    design: dict | None = None,
    region: str = "Global",
) -> str:
    """Build the Seedream image generation prompt for an actor.

    Uses the actor's prompt_seed (identity lock) + selected outfit
    variation + backdrop + all 10 realism anchors.

    Parameters
    ----------
    actor:
        The actor identity card (face_lock, prompt_seed, outfits, etc.)
    outfit_key:
        Which outfit variation to use (at_home_working, at_home_relaxed,
        cafe_working, celebrating_earnings).
    backdrop_index:
        Index into the actor's backdrops array.
    design:
        Design direction from Stage 1 (optional, for style hints).
    region:
        Target region name for context.
    """
    face_lock = actor.get("face_lock", {})
    prompt_seed = actor.get("prompt_seed", "")
    outfits = actor.get("outfit_variations", {})
    outfit = outfits.get(outfit_key, outfits.get("at_home_working", "casual clothes, headphones"))
    backdrops = actor.get("backdrops", ["home office with laptop"])
    backdrop = backdrops[backdrop_index % len(backdrops)] if backdrops else "home office"
    accessory = actor.get("signature_accessory", "headphones")

    photography_dir = (design or {}).get("photography_direction", "candid, natural, UGC-style")

    prompt = f"""{prompt_seed}

OUTFIT FOR THIS SHOT: {outfit}
SIGNATURE ACCESSORY (MUST be visible): {accessory}
BACKDROP: {backdrop}
STYLE: {photography_dir}

FACE LOCK (these features MUST match the identity above):
- Skin tone: {face_lock.get("skin_tone_hex", "natural")}
- Eye color: {face_lock.get("eye_color", "brown")}
- Jawline: {face_lock.get("jawline", "natural")}
- Hair: {face_lock.get("hair", "natural")}
- Nose: {face_lock.get("nose_shape", "natural")}
- Distinguishing marks: {face_lock.get("distinguishing_marks", "none specified")}

REALISM ANCHORS (MANDATORY — the image MUST exhibit ALL of these):
{REALISM_ANCHORS_TEXT}

The final image should look like it was taken by a friend with an iPhone,
not by a professional photographer in a studio. This is for a recruitment
ad targeting real people in {region}."""

    return prompt


def build_visual_qa_prompt(actor: dict, region: str, outfit_key: str = "at_home_working") -> str:
    """Build the VLM visual QA prompt for evaluating a generated actor image."""
    face_lock = actor.get("face_lock", {})
    outfits = actor.get("outfit_variations", {})
    outfit = outfits.get(outfit_key, "casual clothes")
    accessory = actor.get("signature_accessory", "headphones")

    return f"""Evaluate this recruitment ad image for identity consistency, cultural authenticity, and realism.

EXPECTED ACTOR IDENTITY (face_lock — these MUST match):
- Name: {actor.get("name", "unknown")}
- Skin tone: {face_lock.get("skin_tone_hex", "unknown")}
- Eye color: {face_lock.get("eye_color", "unknown")}
- Jawline: {face_lock.get("jawline", "unknown")}
- Hair: {face_lock.get("hair", "unknown")}
- Nose: {face_lock.get("nose_shape", "unknown")}
- Distinguishing marks: {face_lock.get("distinguishing_marks", "none")}
- Age range: {face_lock.get("age_range", "20-35")}

EXPECTED OUTFIT: {outfit}
SIGNATURE ACCESSORY (must be visible): {accessory}
REGION: {region}

Check EACH of these and score 0.0-1.0:

1. IDENTITY CONSISTENCY: Does the person match the face_lock description above?
   - Check: skin tone matches hex, eye color matches, hair matches, jawline matches
   - Check: distinguishing marks present (stubble, beauty mark, glasses, etc.)
   - Check: age looks correct for the specified range
   - Red flags: wrong skin tone, different hair, missing distinguishing features
   - THIS IS THE MOST IMPORTANT DIMENSION — the actor must be recognizable across all images

2. REALISM: Does this look like a real iPhone photo, not AI-generated or stock?
   - Check for: natural skin pores, realistic lighting imperfections, candid pose
   - Check for: fabric texture/wrinkles, environmental noise (real objects)
   - Red flags: plastic skin, perfect symmetry, uncanny valley, studio lighting, extra fingers

3. CULTURAL AUTHENTICITY: Does this person look like they belong in {region}?
   - Check for: appropriate ethnicity, realistic clothing for the region, authentic setting
   - Red flags: generic/ambiguous ethnicity, Western-default clothing, mismatched setting

4. ACCESSORY CHECK: Is the signature accessory ({accessory}) visible in the image?
   - Must be clearly present — this creates recognition across the ad campaign
   - Red flag: accessory missing or wrong item shown

5. BRAND FIT: Would this work for a OneForma contributor recruitment ad?
   - Check for: approachable, relatable, working-from-home/cafe vibe
   - Red flags: corporate attire, model-like appearance, luxury setting

6. TECHNICAL QUALITY: Is the image usable for an ad?
   - Check for: proper framing, no artifacts, face clearly visible, good resolution
   - Red flags: distorted features, extra fingers, blurry face, watermarks

Return ONLY valid JSON:
{{
  "overall_score": 0.0,
  "score": 0.0,
  "dimensions": {{
    "identity_consistency": {{"score": 0.0, "feedback": "Does the face match the face_lock?"}},
    "realism": {{"score": 0.0, "feedback": "..."}},
    "cultural_authenticity": {{"score": 0.0, "feedback": "..."}},
    "accessory_check": {{"score": 0.0, "feedback": "Is {accessory} visible?"}},
    "brand_fit": {{"score": 0.0, "feedback": "..."}},
    "technical_quality": {{"score": 0.0, "feedback": "..."}}
  }},
  "issues": ["List any problems that need fixing"],
  "passed": true
}}"""
