"""High-fidelity HTML reference templates for creative design LLMs.

These are CONCRETE EXAMPLES the LLM can study and adapt — not abstract concepts.
Each template is a complete, working HTML document that renders correctly in
headless Chromium at the specified dimensions.

The LLM should use these as starting points and adapt:
- Swap image URLs for the actual actor photos
- Change copy to the pre-approved headlines/sub/CTA
- Adjust colors to match OneForma brand palette
- Modify layout proportions to fit the content

Templates are organized by layout pattern:
A. GRADIENT OVERLAY — photo fills canvas, gradient creates text zone
B. SPLIT PANEL — photo on one side, brand zone on other
C. SHAPE OVERLAY — colored shape on full photo creates text zone (like the LSG Sky Chefs example)
"""
from __future__ import annotations


# ── Template A: Gradient Overlay ──────────────────────────────────
# Photo fills canvas. Dark gradient from bottom creates readable text zone.
# Best for: TikTok, IG Stories, Facebook Stories, vertical formats.

TEMPLATE_A_GRADIENT = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
  <!-- Full-bleed photo -->
  <div style="position:absolute; top:0; left:0; width:100%; height:100%;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:center 20%;" />
  </div>
  <!-- Gradient overlay for text readability -->
  <div style="position:absolute; bottom:0; left:0; width:100%; height:65%; background:linear-gradient(to top, rgba(61,16,89,0.88) 0%, rgba(61,16,89,0.6) 35%, rgba(61,16,89,0.15) 65%, transparent 100%);"></div>
  <!-- Text zone (safe area) -->
  <div style="position:absolute; bottom:{safe_bottom}px; left:{safe_left}px; right:{safe_right}px; color:#FFFFFF;">
    <div style="font-size:42px; font-weight:800; line-height:1.15; margin-bottom:12px;">{headline}</div>
    <div style="font-size:18px; font-weight:400; line-height:1.4; opacity:0.9; margin-bottom:24px;">{subheadline}</div>
    <div style="display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#6B21A8,#E91E8C); border-radius:9999px; font-size:16px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 4px 16px rgba(233,30,140,0.3);">{cta} →</div>
  </div>
  <!-- Trust badge -->
  <div style="position:absolute; top:{safe_top}px; right:{safe_right}px; padding:8px 16px; background:rgba(255,255,255,0.15); backdrop-filter:blur(8px); border-radius:8px; font-size:12px; color:rgba(255,255,255,0.8);">Powered by Centific</div>
</body>
</html>'''


# ── Template B: Split Panel ───────────────────────────────────────
# Photo on right (~60%), brand zone on left (~40%).
# Best for: Facebook Feed, LinkedIn Feed, Telegram, landscape/square formats.

TEMPLATE_B_SPLIT = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
  <!-- Brand zone (left 40%) -->
  <div style="position:absolute; top:0; left:0; width:42%; height:100%; background:linear-gradient(180deg,#3D1059 0%,#6B21A8 100%); display:flex; flex-direction:column; justify-content:center; padding:0 {safe_left}px;">
    <!-- Accent lines -->
    <div style="width:60px; height:4px; background:#E91E8C; border-radius:2px; margin-bottom:8px;"></div>
    <div style="width:40px; height:4px; background:#E91E8C; border-radius:2px; margin-bottom:28px; opacity:0.6;"></div>
    <!-- Headline -->
    <div style="font-size:36px; font-weight:800; line-height:1.15; color:#FFFFFF; margin-bottom:14px;">{headline}</div>
    <!-- Subheadline -->
    <div style="font-size:16px; font-weight:400; line-height:1.5; color:rgba(255,255,255,0.85); margin-bottom:28px;">{subheadline}</div>
    <!-- CTA button -->
    <div style="display:inline-block; padding:12px 28px; background:linear-gradient(135deg,#E91E8C,#FF6BB5); border-radius:9999px; font-size:14px; font-weight:700; color:#FFFFFF; text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 4px 16px rgba(233,30,140,0.3); width:fit-content;">{cta} →</div>
    <!-- Trust badge -->
    <div style="margin-top:auto; padding-bottom:24px; font-size:11px; color:rgba(255,255,255,0.5);">Powered by Centific</div>
  </div>
  <!-- Photo (right 58%) -->
  <div style="position:absolute; top:0; right:0; width:58%; height:100%;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover; object-position:center;" />
  </div>
  <!-- Subtle blob decoration at the split edge -->
  <svg style="position:absolute; top:15%; left:38%; width:120px; height:120px; opacity:0.12;" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#E91E8C"/></svg>
</body>
</html>'''


# ── Template C: Shape Overlay on Full Photo ───────────────────────
# Full photo + rounded colored shape creates text zone.
# Inspired by the LSG Sky Chefs example. Shape sits on TOP of photo.
# Best for: Facebook Feed, IG Feed, square formats.

TEMPLATE_C_SHAPE = '''<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; width:{width}px; height:{height}px; overflow:hidden; font-family:-apple-system,'Segoe UI',Roboto,sans-serif;">
  <!-- Full-bleed photo -->
  <div style="position:absolute; top:0; left:0; width:100%; height:100%;">
    <img src="{image_url}" style="width:100%; height:100%; object-fit:cover;" />
  </div>
  <!-- Colored shape overlay for text zone (top-left rounded rectangle) -->
  <div style="position:absolute; top:0; left:0; width:52%; height:55%; background:rgba(61,16,89,0.88); border-radius:0 0 40% 0; display:flex; flex-direction:column; justify-content:center; padding:{safe_top}px {safe_left}px {safe_left}px {safe_left}px;">
    <!-- Accent lines (brand energy) -->
    <div style="margin-bottom:16px;">
      <div style="width:70px; height:5px; background:#E91E8C; border-radius:3px; margin-bottom:6px;"></div>
      <div style="width:45px; height:5px; background:#E91E8C; border-radius:3px; opacity:0.5;"></div>
    </div>
    <!-- Headline -->
    <div style="font-size:38px; font-weight:800; line-height:1.12; color:#FFFFFF; margin-bottom:12px;">
      <span>{headline_word1}</span><br/>
      <span style="color:#E91E8C;">{headline_word2}</span>
      <span> {headline_rest}</span>
    </div>
    <!-- Subheadline -->
    <div style="font-size:15px; font-weight:400; line-height:1.5; color:rgba(255,255,255,0.85); margin-bottom:20px;">{subheadline}</div>
    <!-- Trust badge -->
    <div style="display:inline-block; padding:6px 14px; background:rgba(255,255,255,0.15); backdrop-filter:blur(4px); border-radius:6px; font-size:11px; color:rgba(255,255,255,0.7); width:fit-content; margin-bottom:12px;">Powered by Centific</div>
    <!-- CTA -->
    <div style="display:inline-block; padding:12px 28px; background:linear-gradient(135deg,#E91E8C,#FF6BB5); border-radius:9999px; font-size:14px; font-weight:700; color:#FFFFFF; text-transform:uppercase; letter-spacing:0.5px; box-shadow:0 4px 16px rgba(233,30,140,0.3); width:fit-content;">{cta} →</div>
  </div>
  <!-- Logo badge (bottom-right) -->
  <div style="position:absolute; bottom:{safe_bottom}px; right:{safe_right}px; display:flex; align-items:center; gap:8px; padding:10px 16px; background:rgba(255,255,255,0.9); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="font-size:14px; font-weight:700; color:#3D1059;">OneForma</div>
  </div>
</body>
</html>'''


# ── Template map ──────────────────────────────────────────────────
# Maps layout pattern to (template_string, description, best_for)

REFERENCE_TEMPLATES = {
    "gradient_overlay": {
        "html": TEMPLATE_A_GRADIENT,
        "description": "Full-bleed photo with gradient overlay creating text zone at bottom. Premium, immersive.",
        "best_for": ["tiktok_feed", "ig_story", "facebook_stories", "whatsapp_story", "wechat_channels"],
    },
    "split_panel": {
        "html": TEMPLATE_B_SPLIT,
        "description": "Photo on right, purple brand zone on left. Professional, clean separation.",
        "best_for": ["facebook_feed", "linkedin_feed", "telegram_card", "google_display", "indeed_banner"],
    },
    "shape_overlay": {
        "html": TEMPLATE_C_SHAPE,
        "description": "Full photo with rounded colored shape overlay for text zone (LSG Sky Chefs style).",
        "best_for": ["ig_feed", "facebook_feed", "wechat_moments", "twitter_post", "instagram_feed"],
    },
}


def get_reference_html(platform: str) -> str:
    """Get the best reference HTML template for a platform.

    Returns the template string with placeholders, or empty string if none found.
    """
    for pattern_name, data in REFERENCE_TEMPLATES.items():
        if platform in data["best_for"]:
            return data["html"]
    # Default to shape overlay
    return TEMPLATE_C_SHAPE["html"] if isinstance(TEMPLATE_C_SHAPE, dict) else TEMPLATE_C_SHAPE


def get_all_references_for_prompt() -> str:
    """Build a prompt block showing all 3 reference templates.

    This gets injected into the designer's system prompt so the LLM
    has concrete HTML examples to study and adapt.
    """
    blocks = []
    for name, data in REFERENCE_TEMPLATES.items():
        # Show a simplified version (not full HTML — too long for prompt)
        blocks.append(
            f"\n### REFERENCE TEMPLATE: {name.upper()}\n"
            f"Best for: {', '.join(data['best_for'])}\n"
            f"Description: {data['description']}\n"
            f"```html\n{data['html'][:800]}...\n```\n"
            f"KEY TECHNIQUES: Full photo as base → overlay shape/gradient for text zone → "
            f"text in the overlay zone (100% readable) → CTA pill button → trust badge → accent lines\n"
        )
    return "\n".join(blocks)
