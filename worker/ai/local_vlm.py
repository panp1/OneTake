"""Local VLM inference via MLX-VLM on Apple Silicon.

Model: Qwen3-VL-8B (visual QA, cultural authenticity, realism check).

Like ``local_llm``, the model is loaded lazily and GPU access is
serialised with a lock.
"""
import asyncio
import logging
import threading
from typing import Any

from config import VLM_MODEL

logger = logging.getLogger(__name__)

_gpu_lock = threading.RLock()
_model: tuple[Any, Any] | None = None


def _get_vlm() -> tuple[Any, Any]:
    """Load and cache the VLM model + processor."""
    global _model
    if _model is None:
        logger.info("Loading VLM %s (first use) ...", VLM_MODEL)
        from mlx_vlm import load as vlm_load
        _model = vlm_load(VLM_MODEL)
        logger.info("VLM %s loaded.", VLM_MODEL)
    return _model


async def analyze_image(
    image_path: str,
    prompt: str,
    max_tokens: int = 2048,
) -> str:
    """Analyze an image using Qwen3-VL and return the textual analysis.

    Parameters
    ----------
    image_path:
        Local filesystem path to the image (PNG/JPEG).
    prompt:
        The question / evaluation prompt to ask about the image.
    max_tokens:
        Maximum tokens for the response.

    Returns
    -------
    str
        The model's text output (typically JSON when prompted for it).
    """

    def _analyze() -> str:
        from mlx_vlm import generate as vlm_generate
        with _gpu_lock:
            model, processor = _get_vlm()
            return vlm_generate(
                model,
                processor,
                image_path,
                prompt,
                max_tokens=max_tokens,
            )

    return await asyncio.to_thread(_analyze)
