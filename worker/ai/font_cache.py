"""Font cache for creative composition.

OneForma uses system fonts (``-apple-system``, ``system-ui``, ``Segoe UI``),
so most of the time this module returns an empty string. For custom fonts
it downloads and caches WOFF2 files from Google Fonts.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.expanduser("~/.centric-fonts")


async def resolve_font(font_family: str = "system-ui") -> str:
    """Return ``@font-face`` CSS for *font_family*.

    For system fonts the return value is an empty string. For custom
    fonts, a WOFF2 file is downloaded from Google Fonts and cached to
    ``~/.centric-fonts/``.

    Parameters
    ----------
    font_family:
        CSS font-family name (e.g. ``"Inter"``, ``"system-ui"``).

    Returns
    -------
    str
        A ``@font-face`` CSS block, or ``""`` for system fonts.
    """
    if font_family in ("system-ui", "-apple-system", "sans-serif", "Segoe UI", "Roboto"):
        return ""

    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_key = hashlib.sha256(font_family.encode()).hexdigest()[:16]
    cache_path = os.path.join(CACHE_DIR, f"{cache_key}.woff2")

    if os.path.exists(cache_path):
        return _font_face_css(font_family, cache_path)

    # Try Google Fonts CDN.
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            css_resp = await client.get(
                f"https://fonts.googleapis.com/css2?family={font_family.replace(' ', '+')}:wght@400;700",
                headers={"User-Agent": "Mozilla/5.0 Chrome/120.0"},
            )
            if css_resp.status_code == 200:
                urls = re.findall(r"url\((https://[^)]+\.woff2)\)", css_resp.text)
                if urls:
                    font_resp = await client.get(urls[0])
                    font_resp.raise_for_status()
                    with open(cache_path, "wb") as f:
                        f.write(font_resp.content)
                    logger.info("Cached font '%s' -> %s", font_family, cache_path)
                    return _font_face_css(font_family, cache_path)
    except Exception as exc:
        logger.warning("Failed to download font '%s': %s", font_family, exc)

    return ""


def _font_face_css(family: str, path: str) -> str:
    """Build a ``@font-face`` rule pointing at a local WOFF2 file."""
    return f"@font-face {{ font-family: '{family}'; src: url('file://{path}') format('woff2'); }}"
