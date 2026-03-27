"""Creative compositor: builds HTML/CSS overlay on a Seedream image
and renders it to PNG via Playwright.

Templates
---------
HERO_HEADLINE       -- Large headline at bottom over gradient
BOTTOM_BAND         -- Solid band at bottom with text
CENTERED_OVERLAY    -- Centred text over semi-transparent overlay
SPLIT_LEFT_TEXT     -- Left 40% text panel, right 60% image
MINIMAL_CTA         -- Small CTA pill, no headline
CAROUSEL_STAT       -- Big number/stat centred
CAROUSEL_TESTIMONIAL-- Quote with attribution
"""
import logging
import os
import tempfile

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Platform specs
# ---------------------------------------------------------------------------

PLATFORM_SPECS: dict[str, dict[str, int]] = {
    "linkedin_feed": {"width": 1200, "height": 627},
    "linkedin_carousel": {"width": 1080, "height": 1080},
    "facebook_feed": {"width": 1080, "height": 1080},
    "facebook_stories": {"width": 1080, "height": 1920},
    "telegram_card": {"width": 1280, "height": 720},
    "indeed_banner": {"width": 1200, "height": 628},
    "google_display": {"width": 1200, "height": 628},
    "tiktok_feed": {"width": 1080, "height": 1920},
    "twitter_post": {"width": 1200, "height": 675},
}

TEMPLATES = {
    "HERO_HEADLINE",
    "BOTTOM_BAND",
    "CENTERED_OVERLAY",
    "SPLIT_LEFT_TEXT",
    "MINIMAL_CTA",
    "CAROUSEL_STAT",
    "CAROUSEL_TESTIMONIAL",
}


# ---------------------------------------------------------------------------
# HTML builders (one per template)
# ---------------------------------------------------------------------------

def _base_css(width: int, height: int) -> str:
    return (
        f"* {{ margin:0; padding:0; box-sizing:border-box; }}\n"
        f"body {{ width:{width}px; height:{height}px; overflow:hidden; "
        f"font-family:-apple-system,system-ui,'Segoe UI',Roboto,sans-serif; }}\n"
    )


def _hero_headline(props: dict, width: int, height: int) -> str:
    opacity = props.get("gradient_opacity", 0.65)
    return f"""<!DOCTYPE html><html><head><style>
{_base_css(width, height)}
</style></head><body>
<div style="position:relative;width:{width}px;height:{height}px;
  background-image:url('{props.get("hero_image_url","")}');
  background-size:cover;background-position:center;">
  <div style="position:absolute;inset:0;
    background:linear-gradient(to top,rgba(0,0,0,{opacity}) 0%,transparent 60%);"></div>
  <div style="position:absolute;bottom:60px;left:60px;right:60px;z-index:2;color:#fff;">
    <div style="font-size:42px;font-weight:700;
      text-shadow:0 2px 4px rgba(0,0,0,0.3);">{props.get("headline","")}</div>
    <div style="font-size:20px;margin-top:10px;opacity:0.9;">{props.get("subheadline","")}</div>
    <div style="display:inline-block;margin-top:20px;
      background:{props.get("cta_color","#32373C")};color:#fff;
      padding:14px 32px;border-radius:9999px;font-size:16px;
      font-weight:600;">{props.get("cta_text","Learn More")}</div>
  </div>
  {_logo_tag(props)}
</div></body></html>"""


def _bottom_band(props: dict, width: int, height: int) -> str:
    band_h = int(height * 0.25)
    return f"""<!DOCTYPE html><html><head><style>
{_base_css(width, height)}
</style></head><body>
<div style="position:relative;width:{width}px;height:{height}px;
  background-image:url('{props.get("hero_image_url","")}');
  background-size:cover;background-position:center;">
  <div style="position:absolute;bottom:0;left:0;right:0;height:{band_h}px;
    background:#32373C;display:flex;align-items:center;padding:0 40px;
    justify-content:space-between;">
    <div style="color:#fff;">
      <div style="font-size:28px;font-weight:700;">{props.get("headline","")}</div>
      <div style="font-size:16px;opacity:0.85;margin-top:4px;">{props.get("subheadline","")}</div>
    </div>
    <div style="background:#fff;color:#32373C;padding:12px 28px;
      border-radius:9999px;font-size:14px;font-weight:600;
      white-space:nowrap;">{props.get("cta_text","Apply Now")}</div>
  </div>
  {_logo_tag(props)}
</div></body></html>"""


def _centered_overlay(props: dict, width: int, height: int) -> str:
    return f"""<!DOCTYPE html><html><head><style>
{_base_css(width, height)}
</style></head><body>
<div style="position:relative;width:{width}px;height:{height}px;
  background-image:url('{props.get("hero_image_url","")}');
  background-size:cover;background-position:center;">
  <div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;padding:60px;">
    <div style="font-size:48px;font-weight:700;color:#fff;
      text-shadow:0 2px 8px rgba(0,0,0,0.4);">{props.get("headline","")}</div>
    <div style="font-size:22px;color:#fff;opacity:0.9;margin-top:16px;
      max-width:80%;">{props.get("subheadline","")}</div>
    <div style="margin-top:28px;background:{props.get("cta_color","#32373C")};
      color:#fff;padding:16px 40px;border-radius:9999px;font-size:18px;
      font-weight:600;">{props.get("cta_text","Start Earning")}</div>
  </div>
  {_logo_tag(props)}
</div></body></html>"""


def _split_left(props: dict, width: int, height: int) -> str:
    left_w = int(width * 0.4)
    right_w = width - left_w
    return f"""<!DOCTYPE html><html><head><style>
{_base_css(width, height)}
</style></head><body>
<div style="display:flex;width:{width}px;height:{height}px;">
  <div style="width:{left_w}px;background:#32373C;color:#fff;
    display:flex;flex-direction:column;justify-content:center;padding:40px;">
    <div style="font-size:36px;font-weight:700;line-height:1.2;">
      {props.get("headline","")}</div>
    <div style="font-size:18px;opacity:0.85;margin-top:12px;">
      {props.get("subheadline","")}</div>
    <div style="margin-top:24px;background:#fff;color:#32373C;
      padding:12px 28px;border-radius:9999px;font-size:14px;
      font-weight:600;display:inline-block;">
      {props.get("cta_text","Apply Now")}</div>
    {_logo_tag(props, style="margin-top:auto;opacity:0.7;height:24px;")}
  </div>
  <div style="width:{right_w}px;
    background-image:url('{props.get("hero_image_url","")}');
    background-size:cover;background-position:center;"></div>
</div></body></html>"""


def _minimal_cta(props: dict, width: int, height: int) -> str:
    return f"""<!DOCTYPE html><html><head><style>
{_base_css(width, height)}
</style></head><body>
<div style="position:relative;width:{width}px;height:{height}px;
  background-image:url('{props.get("hero_image_url","")}');
  background-size:cover;background-position:center;">
  <div style="position:absolute;bottom:40px;right:40px;
    background:{props.get("cta_color","#32373C")};color:#fff;
    padding:16px 36px;border-radius:9999px;font-size:16px;
    font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
    {props.get("cta_text","Apply Now")}</div>
  {_logo_tag(props)}
</div></body></html>"""


def _carousel_stat(props: dict, width: int, height: int) -> str:
    return f"""<!DOCTYPE html><html><head><style>
{_base_css(width, height)}
</style></head><body>
<div style="width:{width}px;height:{height}px;background:#32373C;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;color:#fff;">
  <div style="font-size:72px;font-weight:800;">{props.get("headline","")}</div>
  <div style="font-size:22px;opacity:0.8;margin-top:12px;">
    {props.get("subheadline","")}</div>
  {_logo_tag(props, style="position:absolute;bottom:20px;opacity:0.5;height:24px;")}
</div></body></html>"""


def _carousel_testimonial(props: dict, width: int, height: int) -> str:
    return f"""<!DOCTYPE html><html><head><style>
{_base_css(width, height)}
</style></head><body>
<div style="width:{width}px;height:{height}px;background:#f8f9fa;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:60px;color:#32373C;">
  <div style="font-size:64px;opacity:0.15;font-weight:700;">&ldquo;</div>
  <div style="font-size:28px;font-style:italic;max-width:80%;line-height:1.4;">
    {props.get("headline","")}</div>
  <div style="font-size:18px;margin-top:20px;font-weight:600;">
    {props.get("subheadline","")}</div>
  <div style="margin-top:24px;background:#32373C;color:#fff;
    padding:12px 28px;border-radius:9999px;font-size:14px;
    font-weight:600;">{props.get("cta_text","Read More")}</div>
</div></body></html>"""


def _logo_tag(props: dict, style: str = "position:absolute;bottom:20px;left:20px;height:30px;opacity:0.8;") -> str:
    url = props.get("logo_url", "")
    if not url:
        return ""
    return f'<img src="{url}" style="{style}" />'


_TEMPLATE_BUILDERS = {
    "HERO_HEADLINE": _hero_headline,
    "BOTTOM_BAND": _bottom_band,
    "CENTERED_OVERLAY": _centered_overlay,
    "SPLIT_LEFT_TEXT": _split_left,
    "MINIMAL_CTA": _minimal_cta,
    "CAROUSEL_STAT": _carousel_stat,
    "CAROUSEL_TESTIMONIAL": _carousel_testimonial,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_overlay_html(props: dict) -> str:
    """Build single-file HTML with Seedream image background + text overlay.

    ``props`` should contain:
    - platform (str) -- key into PLATFORM_SPECS
    - template (str) -- key into TEMPLATES
    - hero_image_url, headline, subheadline, cta_text, cta_color, etc.
    """
    spec = PLATFORM_SPECS.get(props.get("platform", ""), {"width": 1080, "height": 1080})
    width = spec["width"]
    height = spec["height"]
    template = props.get("template", "HERO_HEADLINE")
    builder = _TEMPLATE_BUILDERS.get(template, _hero_headline)
    return builder(props, width, height)


async def render_to_png(html: str, width: int, height: int) -> bytes:
    """Render HTML to PNG using Playwright headless Chromium."""
    from playwright.async_api import async_playwright

    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w") as f:
        f.write(html)
        html_path = f.name

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.goto(f"file://{html_path}")
            await page.wait_for_load_state("networkidle")
            png_bytes = await page.screenshot(type="png")
            await browser.close()
        return png_bytes
    finally:
        os.unlink(html_path)


async def compose_creative(props: dict) -> bytes:
    """Full pipeline: build HTML from template, render to PNG."""
    html = build_overlay_html(props)
    spec = PLATFORM_SPECS.get(props.get("platform", ""), {"width": 1080, "height": 1080})
    return await render_to_png(html, spec["width"], spec["height"])
