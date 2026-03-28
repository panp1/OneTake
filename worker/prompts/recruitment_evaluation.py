"""Recruitment-adapted 7-dimension creative evaluation prompts (Stage 4).

These prompts are used by the evaluator to score composed creatives
(image + text overlay) before they are approved for review.
"""
from __future__ import annotations

EVAL_SYSTEM_PROMPT = (
    "You are a creative director evaluating recruitment ads for OneForma, "
    "a data annotation company that recruits global contributors.\n\n"
    "You evaluate composed creatives (hero image + text overlay) across "
    "7 dimensions specific to recruitment marketing. Your scores must be "
    "honest and actionable — a score of 0.70+ means 'good enough to ship', "
    "not 'perfect'.\n\n"
    "Remember: these ads target gig workers, students, and freelancers — "
    "NOT corporate professionals. The vibe should be 'opportunity' not 'job posting'."
)


def build_eval_prompt(creative_data: dict) -> str:
    """Build the 7-dimension evaluation prompt for a composed creative.

    Parameters
    ----------
    creative_data:
        Dict with keys like ``headline``, ``subheadline``, ``cta_text``,
        ``platform``, ``template``, ``actor_region``.
    """
    return f"""Evaluate this recruitment creative for OneForma.

CREATIVE DETAILS:
- Headline: "{creative_data.get("headline", "")}"
- Subheadline: "{creative_data.get("subheadline", "")}"
- CTA button: "{creative_data.get("cta_text", "")}"
- Platform: {creative_data.get("platform", "unknown")}
- Template: {creative_data.get("template", "unknown")}
- Target region: {creative_data.get("actor_region", "unknown")}

Score EACH dimension 0.0 to 1.0 with specific feedback:

1. EMPLOYER_BRAND_FIT (threshold: 0.70)
   Does this match OneForma's voice? OneForma is:
   - Friendly, not corporate
   - Opportunity-focused, not job-posting
   - Modern and clean (charcoal #32373C + white + pill buttons)
   - Approachable, like a fintech app

2. CANDIDATE_HOOK (threshold: 0.65)
   Would a {creative_data.get("actor_region", "global")} gig worker stop scrolling?
   - Is the headline specific and benefit-led?
   - Does it address a real pain point or desire?
   - Would YOU click this if you were looking for flexible work?

3. READABILITY (threshold: 0.70)
   Can someone scan this in 2 seconds on mobile?
   - Headline under 8 words?
   - No jargon or buzzwords?
   - Clear visual hierarchy?

4. VISUAL_TEXT_HARMONY (threshold: 0.60)
   Do the template choice and text work together?
   - Is the template appropriate for the headline length?
   - Would the text be readable over the image?
   - Is there enough contrast?

5. APPLICATION_CTA (threshold: 0.70)
   Is the apply/signup action unmistakable?
   - Does the CTA use an action verb (Start, Join, Earn, Apply)?
   - Is it specific ("Start Earning Today" > "Learn More")?
   - Would someone know exactly what happens when they click?

6. PLATFORM_COMPLIANCE (threshold: 0.75)
   Does this suit {creative_data.get("platform", "the target platform")}?
   - Are dimensions correct for the platform?
   - Does the tone match platform conventions?
   - Would this blend naturally into the feed?

7. CULTURE_PROOF (threshold: 0.50)
   Does this feel authentic, not corporate?
   - Would a real contributor share this?
   - Does it feel like UGC or at least UGC-adjacent?
   - No stock-photo / corporate-brochure vibes?

Return ONLY valid JSON:
{{
  "dimensions": {{
    "employer_brand_fit": {{"score": 0.0, "feedback": "..."}},
    "candidate_hook": {{"score": 0.0, "feedback": "..."}},
    "readability": {{"score": 0.0, "feedback": "..."}},
    "visual_text_harmony": {{"score": 0.0, "feedback": "..."}},
    "application_cta": {{"score": 0.0, "feedback": "..."}},
    "platform_compliance": {{"score": 0.0, "feedback": "..."}},
    "culture_proof": {{"score": 0.0, "feedback": "..."}}
  }},
  "overall_score": 0.0,
  "improvement_suggestions": [
    "Specific, actionable suggestion 1",
    "Specific, actionable suggestion 2"
  ]
}}"""
