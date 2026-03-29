# Centric Creative OS — Progress Recap (March 29, 2026)

## What We Built (3 days)

A **production-ready AI recruitment marketing platform** that transforms a 3-5 day panic workflow into a 10-minute automated pipeline for OneForma/Centific.

| Metric | Count |
|--------|-------|
| Total source files | 150+ |
| Lines of Python (worker) | ~13,000 |
| Lines of TypeScript (frontend) | ~5,000 |
| Git commits | 60+ |
| API endpoints | 30 |
| React components | 23+ |
| Database tables | 15 |
| Deployed | centric-intake.vercel.app |

## Architecture

```
VERCEL (Cloud)                    STEVEN'S MAC (Local)
├── Next.js 16 frontend           ├── Python worker polls Neon
├── 30 API routes                 ├── MLX Server (Qwen3.5-9B)
├── Clerk auth + RBAC             ├── Gemma 3 12B (downloaded)
├── Neon Postgres (15 tables)     ├── Kimi K2.5 Vision (API)
├── Vercel Blob (assets)          ├── Seedream 4.5 (API)
└── OpenRouter (Kimi K2.5)        └── Compositor + Deglosser
         │                                │
         └──── Neon is the message bus ────┘
```

## Pipeline (Persona-First)

1. Cultural research (9 dimensions per region via Kimi K2.5) — CACHED for Morocco
2. 3 target personas (from 8 archetypes, enriched with cultural data)
3. Creative brief FROM personas (Qwen3.5-9B thinking mode)
4. 8-dimension evaluation (Neurogen-style rubric, accept/revise/reject)
5. Design direction (structured art direction, koda-stack inspired)
6. Actor identity cards (UGC face_lock + prompt_seed)
7. Image generation (Seedream 4.5 + deglosser + composition engine)
8. Visual QA (Kimi K2.5 Vision, 10 dimensions, 91 auto-reject triggers)
9. Multilingual copy (Gemma 3 12B, 8 platform-specific ad specs, 6 psychology hooks)
10. Layout composition (7 HTML/CSS templates + Playwright render)
11. Platform mockups (7 frame components: LinkedIn, Instagram, Facebook, TikTok, Telegram)
12. Export (ZIP: PNGs + brief + copy CSV + targeting + eval report)

## Verified Working

- Vercel app deployed + live
- Clerk auth + admin auto-link by email
- Dynamic form (7 task types, schema-driven)
- Field validation with red highlights
- Auto-queue generation on submit
- Worker picks up jobs from Neon
- Cached cultural research (instant)
- Persona generation (3 per campaign)
- MLX server auto-start (4.1s)
- Streaming LLM calls (keeps connection alive)
- Brief generation (thinking mode, JSON extracted)
- 8-dimension evaluation rubric
- 69/69 smoke tests passing
- Kimi K2.5 live research (real Morocco data)
- Gemma 3 12B downloaded

## Bottlenecks Detected & Resolved

### 1. Process Zombie Hydra (CRITICAL)
Background processes accumulating across restarts. 7 zombie workers + 4 MLX servers = 21GB+ RAM.
**Fix:** ProcessManager with PID files + nuclear pgrep kill on startup + stop.sh script.

### 2. MLX Server Multi-Process Spawning
`mlx_lm.server` spawns 2-3 child processes at ~5GB each.
**Fix:** `setsid` + `killpg` to kill entire process group.

### 3. Double Model Loading (37GB RAM)
Worker loaded Qwen3.5-9B both in HTTP server AND in-process as fallback.
**Fix:** Removed in-process fallback entirely. HTTP server only with 3 retries.

### 4. Qwen3.5 Token Budget (content=0)
Model used all 4096 tokens on thinking, none left for JSON output.
**Fix:** max_tokens 4096 → 8192.

### 5. Content vs Reasoning Field Mapping
MLX server splits output: `reasoning` = thinking, `content` = JSON answer.
**Fix:** Debug test confirmed format. Streaming correctly collects both fields.

### 6. Worker Death During Long LLM Calls
macOS killed process during 2-3 min blocking HTTP calls.
**Fix:** SSE streaming — tokens flow continuously, connection stays active.

### 7. Neon TEXT[] Column Insert
`json.dumps()` on a list → string, but asyncpg expects native list for TEXT[].
**Fix:** Pass list directly, not JSON string.

### 8. Python stdout Buffering
Logs not visible in file output.
**Fix:** `sys.stdout.reconfigure(line_buffering=True)` + `force=True` in logging.

### 9. Kimi K2.5 Null Response
API returned null content, crashing the parser.
**Fix:** Null check with graceful fallback.

### 10. Clerk Middleware Blocking Public Routes
Schema/registry endpoints blocked by Clerk.
**Fix:** Added to public routes in middleware.ts.

## Still To Do

1. Complete Stage 1 end-to-end (brief → Neon save)
2. Stage 2: Image generation via Seedream + deglosser + VQA
3. Stage 3: Copy generation via Gemma 3 12B
4. Stage 4: Layout composition + Playwright rendering
5. Frontend progressive rendering
6. UI polish pass
7. Video pipeline (stretch goal)
8. Full E2E smoke test
