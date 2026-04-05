# worker/run_stage5_test.py
"""Manual test: Run Stage 5 for the first persona in the latest request."""
import asyncio
import json
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")

REQUEST_ID = sys.argv[1] if len(sys.argv) > 1 else "fd318779-45f2-45bb-b0ff-5420c5c10260"


async def main():
    from neon_client import _get_pool
    from pipeline.stage5_video import run_stage5

    pool = await _get_pool()

    # Load brief
    row = await pool.fetchrow("SELECT brief_data FROM creative_briefs WHERE request_id = $1", REQUEST_ID)
    brief = json.loads(row["brief_data"]) if row else {}

    # Load request
    req = await pool.fetchrow("SELECT * FROM intake_requests WHERE id = $1", REQUEST_ID)
    form_data = json.loads(req["form_data"]) if req and req.get("form_data") else {}

    context = {
        "request_id": REQUEST_ID,
        "brief": brief,
        "personas": brief.get("personas", [])[:1],  # Just first persona for testing
        "target_languages": ["Portuguese"],
        "form_data": form_data,
    }

    print(f"Running Stage 5 for request {REQUEST_ID}")
    print(f"Persona: {context['personas'][0].get('persona_name', '?') if context['personas'] else 'none'}")

    result = await run_stage5(context)
    print(f"\nResult: {json.dumps(result, indent=2, default=str)}")


if __name__ == "__main__":
    asyncio.run(main())
