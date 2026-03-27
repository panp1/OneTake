"""Local LLM inference via MLX on Apple Silicon.

Models
------
- **Qwen3.5-9B** (``LLM_MODEL``) -- orchestrator, brief generation, template
  selection.
- **Gemma 3 12B** (``COPY_MODEL``) -- multilingual ad copy writer.

Thread safety is guaranteed by an ``RLock`` so that only one model runs on
the GPU at a time.  Models are loaded lazily and cached for the process
lifetime.
"""
import asyncio
import logging
import threading
from typing import Any

from mlx_lm import generate as mlx_generate
from mlx_lm import load

from config import COPY_MODEL, LLM_MODEL

logger = logging.getLogger(__name__)

_gpu_lock = threading.RLock()
_models: dict[str, tuple[Any, Any]] = {}


def _get_model(model_name: str) -> tuple[Any, Any]:
    """Load and cache an MLX-LM model + tokenizer."""
    if model_name not in _models:
        logger.info("Loading model %s (first use) ...", model_name)
        _models[model_name] = load(model_name)
        logger.info("Model %s loaded.", model_name)
    return _models[model_name]


async def generate_text(
    system_prompt: str,
    user_prompt: str,
    model_name: str | None = None,
    max_tokens: int = 4096,
    temperature: float = 0.7,
) -> str:
    """Generate text using a local MLX model.

    Parameters
    ----------
    system_prompt:
        The system message that sets the AI persona.
    user_prompt:
        The user query or task description.
    model_name:
        Override the default model. Falls back to ``LLM_MODEL``.
    max_tokens:
        Maximum number of tokens to generate.
    temperature:
        Sampling temperature (0 = deterministic, 1 = creative).

    Returns
    -------
    str
        The model's generated text.
    """
    model_name = model_name or LLM_MODEL

    def _generate() -> str:
        with _gpu_lock:
            model, tokenizer = _get_model(model_name)
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            prompt = tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True,
            )
            return mlx_generate(
                model,
                tokenizer,
                prompt=prompt,
                max_tokens=max_tokens,
                temp=temperature,
            )

    return await asyncio.to_thread(_generate)


async def generate_copy(
    system_prompt: str,
    user_prompt: str,
    **kwargs: Any,
) -> str:
    """Generate ad copy using Gemma 3 12B.

    Convenience wrapper that routes to ``COPY_MODEL``.
    """
    return await generate_text(
        system_prompt, user_prompt, model_name=COPY_MODEL, **kwargs,
    )
