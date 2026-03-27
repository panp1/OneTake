"""Seedream 4.5 image generation via the Volcengine API.

Generates photorealistic hero images for recruitment creatives.
Supports multiple output dimensions keyed by platform name.
"""
import base64
import logging

import httpx

from config import SEEDREAM_API_ENDPOINT, SEEDREAM_API_KEY, SEEDREAM_MODEL

logger = logging.getLogger(__name__)

DIMENSIONS: dict[str, tuple[int, int]] = {
    "square": (1080, 1080),
    "landscape": (1200, 628),
    "portrait": (1080, 1920),
    "linkedin": (1200, 627),
    "telegram": (1280, 720),
    "twitter": (1200, 675),
    "indeed": (1200, 628),
    "facebook": (1080, 1080),
    "google_display": (1200, 628),
    "tiktok": (1080, 1920),
}


async def generate_image(
    prompt: str,
    dimension_key: str = "square",
    negative_prompt: str = "",
) -> bytes:
    """Generate an image via Seedream 4.5 and return raw PNG bytes.

    Parameters
    ----------
    prompt:
        The text-to-image prompt. Should include realism anchors.
    dimension_key:
        A key into ``DIMENSIONS`` (e.g. ``"square"``, ``"landscape"``).
    negative_prompt:
        Optional negative prompt for things to avoid in the image.

    Returns
    -------
    bytes
        Raw image bytes (PNG).
    """
    width, height = DIMENSIONS.get(dimension_key, (1080, 1080))

    default_negative = (
        "cartoon, anime, illustration, 3d render, painting, watermark, "
        "text overlay, blurry, distorted hands, extra fingers, "
        "corporate stock photo, stiff pose, oversaturated"
    )
    neg = negative_prompt or default_negative

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{SEEDREAM_API_ENDPOINT}/images/generations",
            headers={
                "Authorization": f"Bearer {SEEDREAM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": SEEDREAM_MODEL,
                "prompt": prompt,
                "negative_prompt": neg,
                "width": width,
                "height": height,
                "num_images": 1,
            },
        )
        response.raise_for_status()
        data = response.json()

        # Handle both URL-based and base64-based responses.
        image_entry = data["images"][0]

        if "url" in image_entry:
            img_resp = await client.get(image_entry["url"])
            img_resp.raise_for_status()
            return img_resp.content

        if "b64_json" in image_entry:
            return base64.b64decode(image_entry["b64_json"])

        raise ValueError("Seedream response contained neither url nor b64_json.")
