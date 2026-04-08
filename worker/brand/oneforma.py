"""
OneForma Brand Voice — SINGLE SAFE SOURCE

This module is the ONLY place in the codebase that stores brand voice,
positioning, messaging, CTAs, and visual design language for OneForma.

CRITICAL RULES (see README.md for full governance):
1. Do NOT reference or import from files outside this folder for brand content.
2. Do NOT include specific company names (end customers, enterprise clients,
   competitors) in any constant in this file.
3. Do NOT include internal research numbers, financial data, or project codenames.
4. Any brand update goes through a git commit to this file — creates audit trail.
5. Before committing changes, run: node scripts/verify-brand-module.mjs

The content here was curated from public OneForma brand materials (Brand Guidelines
PDF, Brand Voice doc) with all sensitive items stripped at source time.
"""
from __future__ import annotations

# ══════════════════════════════════════════════════════════════════════
# 1. TAGLINE, POSITIONING, MISSION, VISION
# ══════════════════════════════════════════════════════════════════════

TAGLINE = "OneForma is the AI platform that sees the expert in everyone."

POSITIONING = (
    "For experts from every walk of life and every corner of the globe who want "
    "to be respected, not treated like a resource, OneForma is the only "
    "marketplace that recognizes the expert in all of us, with jobs and support "
    "worthy of your unique expertise, whether you're looking to earn, grow, or "
    "shape the future of your field."
)

MISSION = (
    "To unlock the expertise in everyone — connecting skilled professionals "
    "worldwide with the AI systems that need them most."
)

VISION = (
    "A world where every domain expert, multilingual professional, and skilled "
    "contributor has a meaningful role in shaping the AI systems that will "
    "define their industry — with support and recognition as a valued "
    "collaborator, not an anonymous task-completer."
)

UNIQUE_VALUE = (
    "OneForma is where global scale meets domain depth. While other platforms "
    "treat contributors as interchangeable resources, OneForma recognizes that "
    "every contributor brings a distinct form of expertise — whether that's "
    "their language, culture, profession, or otherwise. OneForma is the only "
    "platform built around the expert."
)

# ══════════════════════════════════════════════════════════════════════
# 2. TONE RULES (4 binding rules for all copy output)
# ══════════════════════════════════════════════════════════════════════

TONE_RULES: list[dict] = [
    {
        "id": "expertise_first",
        "name": "Expertise First, Not Output First",
        "rule": "Talk about the expert and their expertise, not about the job or the earnings.",
        "do": "Your physics PhD is exactly what AI is missing",
        "dont": "Earn $X/hr labeling data",
    },
    {
        "id": "human_first",
        "name": "Human First, Not AI First",
        "rule": "AI is context, not the hook. Lead with value to the human.",
        "do": "Your fluency in Tagalog shapes how AI talks to 30 million people",
        "dont": "Help train large language models on Tagalog",
    },
    {
        "id": "purposeful",
        "name": "Purposeful, Not Transactional",
        "rule": "Start with purpose and support, backed up with transactional detail.",
        "do": "Your work improved medical reasoning accuracy by 12%",
        "dont": "We pay $46/hr for medical annotation",
    },
    {
        "id": "specific",
        "name": "Specific, Not Vague",
        "rule": "Copy models the transparency users seek — no vague task descriptions, no unclear pay, no missing feedback.",
        "do": "Twice-monthly payouts via Payoneer and PayPal. $10 minimum. No fees, ever.",
        "dont": "Reliable payments",
    },
]

# ══════════════════════════════════════════════════════════════════════
# 3. WORD LISTS — Use vs Avoid
# ══════════════════════════════════════════════════════════════════════

WORDS_TO_USE: list[str] = [
    # Brand center of gravity (use heavily)
    "expert", "expertise", "recognize", "recognition",
    "worth", "worthy", "respected", "respect",
    # Audience descriptors
    "every walk of life", "every corner of the globe",
    # Pillar language
    "earn", "grow", "shape", "shape the future of your field",
    "unlock", "collaborator",
    # Differentiators
    "global", "native", "local", "real-world", "trustworthy",
    "discover", "discovery",
]

WORDS_TO_AVOID: list[str] = [
    # The explicit anti-word
    "resource",
    # Crowd framing (treats workers as interchangeable)
    "crowd", "crowdworker", "crowdsource",
    # Task-first framing
    "microtask", "annotator alone",
    # Cheap/commodity language
    "cheap", "low-cost", "affordable",
    # Legacy BPO framing
    "BPO", "outsourcing", "vendor",
    # Side-hustle as primary framing (acceptable only inside Earn angle as a nuance)
    "side hustle",
    # Generic AI work without specificity
    "AI work",
    # Transactional money-first leads
    "earn $",
]

# ══════════════════════════════════════════════════════════════════════
# 4. BRAND PILLARS — Earn / Grow / Shape
# ══════════════════════════════════════════════════════════════════════

PILLARS: dict = {
    "earn": {
        "id": "earn",
        "display_name": "Earn",
        "emoji": "🛠",
        "jtbd": "Make it easy, predictable, and worth my time",
        "reasons_to_believe": [
            "Predictable pay and flexible work",
            "Global breadth — 300+ languages, 222 markets",
            "Task variety and easy filtering (20k+ projects)",
            "Transparent application process",
        ],
        "voice": "Reliability and pay first. This angle acknowledges the practical need for income without framing the person as 'just' a gig worker.",
    },
    "grow": {
        "id": "grow",
        "display_name": "Grow",
        "emoji": "🧭",
        "jtbd": "Help me grow while I earn",
        "reasons_to_believe": [
            "Certification programs",
            "Skill development and project pathways",
            "Shareable skills profile with badges and project history",
            "Proactive matching to career interests",
        ],
        "voice": "Learning and career-building angle. Projects are portfolio pieces, certifications are credentials, the work builds real experience.",
    },
    "shape": {
        "id": "shape",
        "display_name": "Shape",
        "emoji": "🎓",
        "jtbd": "Treat me as a collaborator, not a contributor",
        "reasons_to_believe": [
            "Direct contribution to AI systems in your field",
            "Community of credentialed peers",
            "Post-project feedback on how your work was used",
            "Transparency on AI use cases",
        ],
        "voice": "Authority and impact angle. The person is an expert whose judgment actually shapes how AI works in their domain.",
    },
}

# ══════════════════════════════════════════════════════════════════════
# 5. HERO COPY TEMPLATES BY PILLAR
# ══════════════════════════════════════════════════════════════════════

HERO_TEMPLATES_BY_PILLAR: dict = {
    "earn": {
        "h1_template": "Put your {expertise} to work. From wherever you are.",
        "h1_examples": [
            "Put your Tagalog to work. From wherever you are.",
            "Put your part-time hours to work training the next generation of AI.",
            "Put your eye for detail to work. Real projects, real pay, on your schedule.",
        ],
        "subhead_template": "Twice-monthly payouts. Real projects. No fees, ever.",
        "cta_ref": "CTA_PRIMARY",
    },
    "grow": {
        "h1_template": "Build the AI experience your career deserves.",
        "h1_examples": [
            "Build the AI experience your career deserves.",
            "Already studying ML? Get the real-world AI work experience textbooks can't teach.",
            "Your native {language} is a credential. Use it to build an AI career, not just a side income.",
        ],
        "subhead_template": "Real projects from real AI teams — with certifications and a shareable skills profile that hiring managers actually recognize.",
        "cta_ref": "CTA_SECONDARY",
    },
    "shape": {
        "h1_template": "Your {profession} expertise is exactly what AI is missing.",
        "h1_examples": [
            "Your cardiology expertise is exactly what AI is missing.",
            "Your securities-law experience is exactly what AI is missing.",
            "Your physics PhD is exactly what AI is missing.",
        ],
        "subhead_template": "Shape the future of {your field} alongside a global network of credentialed peers. Flexible, asynchronous, and worthy of your time.",
        "cta_ref": "CTA_SECONDARY",
    },
}

# ══════════════════════════════════════════════════════════════════════
# 6. LOCKED CTAs — Intent-based, with approved variations + translations
# ══════════════════════════════════════════════════════════════════════

CTA_PRIMARY: dict = {
    "intent_id": "your_expertise_has_value",
    "intent_description": "Your expertise is valued — bring it here, use it here",
    "canonical_en": "Put your expertise to work",
    "approved_variations_en": [
        "Put your expertise to work",
        "Put your skills to work",
        "Make your expertise count",
        "Your skills belong here",
        "Bring your expertise to AI",
    ],
    "approved_translations": {
        "es": ["Haz valer tu experiencia", "Pon tus conocimientos en acción"],
        "fr": ["Mettez votre expertise à profit", "Faites valoir vos compétences"],
        "pt": ["Coloque sua experiência em ação", "Mostre o que você sabe"],
        "de": ["Zeigen Sie, was Sie können", "Bringen Sie Ihre Expertise ein"],
        "it": ["Metti la tua esperienza al lavoro"],
        "ja": ["あなたの専門知識を活かそう"],
        "zh": ["让您的专业发挥价值"],
        "ko": ["당신의 전문성을 발휘하세요"],
        "ar": ["ضع خبرتك موضع التنفيذ"],
        "hi": ["अपनी विशेषज्ञता को काम में लाएं"],
        "id": ["Manfaatkan keahlian Anda"],
        "tl": ["Gamitin ang iyong kahusayan"],
    },
}

CTA_SECONDARY: dict = {
    "intent_id": "find_work_that_respects_you",
    "intent_description": "Find work that respects you — recognizes your worth, values your judgment",
    "canonical_en": "Find a project that knows your worth",
    "approved_variations_en": [
        "Find a project that knows your worth",
        "Find work that values your expertise",
        "Discover projects worthy of your expertise",
        "Find a project built around your expertise",
        "Find work that respects what you know",
    ],
    "approved_translations": {
        "es": ["Encuentra un proyecto que reconozca tu valor"],
        "fr": ["Trouvez un projet qui connaît votre valeur"],
        "pt": ["Encontre um projeto que reconheça seu valor"],
        "de": ["Finden Sie ein Projekt, das Ihren Wert kennt"],
        "it": ["Trova un progetto che conosce il tuo valore"],
        "ja": ["あなたの価値を認めるプロジェクトを見つけよう"],
        "zh": ["寻找认可您价值的项目"],
        "ko": ["당신의 가치를 아는 프로젝트를 찾으세요"],
        "ar": ["اعثر على مشروع يقدر قيمتك"],
        "hi": ["अपनी योग्यता को पहचानने वाला प्रोजेक्ट खोजें"],
        "id": ["Temukan proyek yang menghargai Anda"],
        "tl": ["Maghanap ng proyektong alam ang iyong halaga"],
    },
}

APPROVED_LOCALES: list[str] = [
    "en", "es", "fr", "pt", "de", "it", "ja", "zh", "ko", "ar", "hi", "id", "tl",
]


def get_cta(pillar: str, lang: str = "en", prefer_variation: int = 0) -> str:
    """Return the approved CTA string for a pillar × language.

    Rules:
    - Earn pillar → CTA_PRIMARY ("Put your expertise to work")
    - Grow pillar → CTA_SECONDARY ("Find a project that knows your worth")
    - Shape pillar → CTA_SECONDARY ("Find a project that knows your worth")

    If the language is not in the approved translation table, fall back to
    the English canonical form. The prefer_variation argument picks from
    the approved variations list (0 = canonical, 1+ = alternative variations).
    """
    if pillar == "earn":
        cta = CTA_PRIMARY
    elif pillar in ("grow", "shape"):
        cta = CTA_SECONDARY
    else:
        raise ValueError(f"Unknown pillar: {pillar!r} — must be earn, grow, or shape")

    lang_key = (lang or "en").lower().split("-")[0]  # 'en-US' -> 'en'
    if lang_key == "en":
        variations = cta["approved_variations_en"]
        idx = max(0, min(prefer_variation, len(variations) - 1))
        return variations[idx]

    translations = cta["approved_translations"].get(lang_key)
    if not translations:
        return cta["canonical_en"]  # fallback to English canonical

    idx = max(0, min(prefer_variation, len(translations) - 1))
    return translations[idx]


# ══════════════════════════════════════════════════════════════════════
# 7. TRUST STRIP (public fact ticker)
# ══════════════════════════════════════════════════════════════════════

TRUST_STRIP = (
    "1.8M members · 300+ languages · 222 markets · "
    "twice-monthly payouts via Payoneer & PayPal · no fees, ever"
)

# ══════════════════════════════════════════════════════════════════════
# 8. SERVICE CATEGORIES — The 5 kinds of work OneForma offers
# ══════════════════════════════════════════════════════════════════════

SERVICE_CATEGORIES: list[dict] = [
    {
        "id": "annotation",
        "label": "Annotation",
        "description": (
            "Labeling images, text, audio, and video for AI training — "
            "bounding boxes, sentiment tags, entity extraction, scene segmentation, "
            "face landmarks, semantic masks."
        ),
    },
    {
        "id": "data_collection",
        "label": "Data Collection",
        "description": (
            "Gathering new data for AI models — photos, voice recordings, "
            "handwriting samples, product information, real-world observations, "
            "multilingual speech, contextual scene captures."
        ),
    },
    {
        "id": "judging",
        "label": "Judging",
        "description": (
            "Evaluating AI outputs against quality standards — search relevance, "
            "response ranking, multiple-choice quality assessment, factuality checks, "
            "safety review."
        ),
    },
    {
        "id": "transcription",
        "label": "Transcription",
        "description": (
            "Converting spoken audio to written text — voice segmentation, "
            "speaker identification, timestamp alignment, conversation labeling, "
            "multilingual transcription."
        ),
    },
    {
        "id": "translation",
        "label": "Translation",
        "description": (
            "Native-language translation and localization — cultural adaptation, "
            "idiomatic nuance, multi-directional language pairs, domain-specific "
            "terminology."
        ),
    },
]

# ══════════════════════════════════════════════════════════════════════
# 9. OPERATIONAL CONTEXT (for LLM internal reasoning ONLY — never quoted)
# ══════════════════════════════════════════════════════════════════════

OPERATIONAL_CONTEXT = """OneForma is a global platform where experts contribute to AI
development through five kinds of work: annotation, data collection, judging,
transcription, and translation. Contributors come from every walk of life and
every corner of the globe — 1.8M members across 300+ languages and 222 markets.

Work is remote, flexible, and paid twice-monthly via Payoneer and PayPal with
no fees. Experts set their own schedule. Projects range from small atomic tasks
to long-form credentialed domain review. The platform serves leading AI labs,
frontier research teams, and enterprise AI programs worldwide.

Contributors are referred to as experts or collaborators — never as workers,
resources, crowd, or annotators alone. Compensation details are mentioned only
as supporting proof (Purposeful, Not Transactional) — the lead is always the
expertise and the impact, never the hourly rate.

Use this context to reason about what a task actually involves. NEVER quote
this paragraph verbatim in user-facing output. All output language must follow
the BRAND_VOICE section (tagline, tone rules, word lists, pillar templates)."""

# ══════════════════════════════════════════════════════════════════════
# 10. VISUAL DESIGN — Palette, Typography, Motifs
# ══════════════════════════════════════════════════════════════════════

PALETTE: dict = {
    "primary_gradient": "linear-gradient(135deg, #0452BF 0%, #CD128A 100%)",
    "sapphire": {
        "80": "#0452BF",
        "60": "#237DFB",
        "40": "#73ACFC",
        "20": "#AFD0FD",
        "10": "#D7E7FE",
    },
    "egyptian_blue": {
        "80": "#00359B",
        "60": "#0056F5",
        "40": "#5C95FF",
        "20": "#C2D7FF",
        "10": "#EBF2FF",
    },
    "pink": {
        "80": "#CD128A",
        "60": "#EF43B3",
        "40": "#F58ED1",
        "20": "#FCD9F0",
        "10": "#FDECF7",
    },
    "gray": {
        "80": "#001427",
        "70": "#28394A",
        "60": "#495766",
        "50": "#6C8089",
        "40": "#90A4AE",
        "30": "#AFC2D4",
        "20": "#D7E0EA",
        "10": "#F1F4F9",
    },
    "semantic": {
        "positive": "#16A34A",
        "alert": "#CD128A",
        "warning": "#F59E0B",
    },
    "text": {
        "primary": "#001427",
        "secondary": "#495766",
        "on_primary": "#FFFFFF",
    },
    "background": {
        "primary": "#FFFFFF",
        "ui": "#F1F4F9",
        "border": "#D7E0EA",
    },
}

TYPOGRAPHY: dict = {
    "family": "Roboto",
    "fallback_stack": "Roboto, -apple-system, system-ui, 'Segoe UI', Arial, sans-serif",
    "weights": {
        "thin": 100,
        "light": 300,
        "regular": 400,
        "medium": 500,
        "bold": 700,
        "black": 900,
    },
    "scale": {
        "display": {"size_px": 64, "weight": 900, "line_height": 1.05},
        "h1": {"size_px": 44, "weight": 700, "line_height": 1.1},
        "h2": {"size_px": 32, "weight": 700, "line_height": 1.15},
        "h3": {"size_px": 22, "weight": 500, "line_height": 1.25},
        "body": {"size_px": 16, "weight": 400, "line_height": 1.5},
        "caption": {"size_px": 12, "weight": 400, "line_height": 1.4},
    },
}

DESIGN_MOTIFS: list[dict] = [
    {
        "name": "organic_blob",
        "description": (
            "Organic cell-like blob shapes derived from the logo icon. Use as "
            "photo containers, section dividers, or background graphics. Blob "
            "shapes should feel fluid and asymmetric — NOT geometric circles. "
            "Fill with the primary gradient or a solid from the Pink or Sapphire family."
        ),
    },
    {
        "name": "photo_as_blob",
        "description": (
            "Crop a person-photo inside a blob-shaped mask (clip-path). The person "
            "is the emotional anchor; the blob is the brand container. Preferred "
            "for hero sections and persona-led creatives."
        ),
    },
    {
        "name": "gradient_strip",
        "description": (
            "Thin 3-4px gradient strip along the top or left edge of a card, "
            "using the primary gradient. Used for emphasis on card borders, "
            "section breaks, and CTAs."
        ),
    },
    {
        "name": "gradient_pill_cta",
        "description": (
            "Pill-shaped CTA button filled with the primary gradient (Sapphire → Pink). "
            "White text. Generous horizontal padding. Right-arrow icon optional. "
            "Primary action on every marketing surface."
        ),
    },
    {
        "name": "curved_corner_accent",
        "description": (
            "Large curved gradient shape anchored to a corner (top-right or bottom-left) "
            "of a card or poster. Acts as visual warmth without overwhelming the copy. "
            "Use for social posts, flyers, posters."
        ),
    },
    {
        "name": "white_canvas",
        "description": (
            "Clean white (#FFFFFF) background with generous whitespace is the default. "
            "Color accents are punctuation, not wallpaper. Avoid full-bleed dark backgrounds "
            "except for hero moments."
        ),
    },
]

# ══════════════════════════════════════════════════════════════════════
# 11. ANTI-EXAMPLES — Patterns to AVOID (no competitor names used)
# ══════════════════════════════════════════════════════════════════════

ANTI_EXAMPLES: list[dict] = [
    {
        "pattern_name": "elite_university_gating",
        "bad_example": "Our Research Fellowship accepts only the top 1% of PhD applicants.",
        "why_it_violates": (
            "Ivy-League gating contradicts the radical-inclusion thesis. "
            "OneForma's wedge is 'every walk of life' — credentials are recognized "
            "but never a gate for participation."
        ),
    },
    {
        "pattern_name": "exclusivity_first",
        "bad_example": "Top-tier AI work, available only on our platform.",
        "why_it_violates": (
            "Exclusivity framing ('top-tier', 'available only on') positions "
            "the platform as scarce and selective. OneForma's wedge is inclusive "
            "and global — every expert has a place."
        ),
    },
    {
        "pattern_name": "geography_gating",
        "bad_example": "Get paid for remote AI work — US residents only.",
        "why_it_violates": (
            "Geography gates (US-only, English-only, EU-only) contradict the "
            "global wedge. OneForma operates across 222 markets and 300+ languages; "
            "the global positioning is structurally true."
        ),
    },
    {
        "pattern_name": "credential_gating",
        "bad_example": "Join thousands of MAs, PhDs, and college graduates.",
        "why_it_violates": (
            "Requires advanced degrees to participate. OneForma recognizes expertise "
            "in every form — linguistic, cultural, professional, or lived. A native "
            "speaker is an expert; a cardiologist is an expert; a gig worker with 5 "
            "years of detail-oriented work is an expert."
        ),
    },
    {
        "pattern_name": "money_first_shouty",
        "bad_example": "EARN $75 IN OUR PAID STUDY!",
        "why_it_violates": (
            "Leads with money as the hook, in all-caps. Violates Lead With Impact "
            "Not Income and Purposeful Not Transactional. Money is a proof point, "
            "not the headline."
        ),
    },
    {
        "pattern_name": "commodity_crowd",
        "bad_example": "Our crowd of thousands of contributors handles your tasks.",
        "why_it_violates": (
            "'Crowd' and 'contributors' treat people as interchangeable units. "
            "Violates Expertise First and Human First. Use 'experts' or 'collaborators'."
        ),
    },
    {
        "pattern_name": "task_first_microwork",
        "bad_example": "Earn per-task rates on quick microtasks from home.",
        "why_it_violates": (
            "'Microtask' framing commoditizes the work. Even atomic tasks should "
            "be framed as contributing expertise (e.g., 'your eye for detail')."
        ),
    },
]

# ══════════════════════════════════════════════════════════════════════
# 12. SYSTEM PROMPT HELPER
# ══════════════════════════════════════════════════════════════════════

def build_brand_voice_block() -> str:
    """Format the brand voice for inline inclusion in LLM system prompts.

    Returns a ~800-char formatted string covering the tagline, 4 tone rules,
    words to avoid, 3 pillars, and CTA guidance. Safe to include in any
    system prompt that generates user-facing copy.
    """
    tone_lines = "\n".join(
        f"  {i + 1}. {rule['name']}: {rule['rule']}\n"
        f"     DO: {rule['do']}\n"
        f"     DON'T: {rule['dont']}"
        for i, rule in enumerate(TONE_RULES)
    )
    pillar_lines = "\n".join(
        f"  - {p['display_name']} ({p['jtbd']}): {p['voice']}"
        for p in PILLARS.values()
    )
    words_avoid = ", ".join(WORDS_TO_AVOID)

    return f"""BRAND VOICE (binding):

TAGLINE: {TAGLINE}

TONE RULES:
{tone_lines}

WORDS YOU MUST AVOID (automatic rejection if any of these appear in output):
{words_avoid}

THE THREE BRAND PILLARS (angles you can emphasize — not personas):
{pillar_lines}

CTA RULES:
- Earn angle → use CTA_PRIMARY ("Put your expertise to work" or approved variation)
- Grow angle → use CTA_SECONDARY ("Find a project that knows your worth" or approved variation)
- Shape angle → use CTA_SECONDARY
- Never invent new CTAs. Pick from the approved list in the brand module.
"""
