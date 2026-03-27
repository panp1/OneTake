---
name: VYRA Creative OS Code Copy Plan
description: Plan for copying (NOT moving) VYRA Creative OS code into the Centric intake app. VYRA repo stays 100% untouched. Centric gets recruitment-specific adapted copies of the creative pipeline.
type: project
---

## CRITICAL RULE: COPY ONLY — NEVER MOVE FROM VYRA

```
VYRA repo (/Users/stevenjunop/vyra)     →  UNTOUCHED. ZERO changes. EVER.
                                              │
                                          COPY ↓ (duplicate files only)
                                              │
Centric repo (/Users/stevenjunop/centric-intake)  →  Adapted recruitment copies
```

VYRA is the source of truth. This project gets a recruitment-specific fork.

## What to Copy + Adapt

| VYRA Source File | Copy To | Adaptation Needed |
|---|---|---|
| `apps/api/app/providers/local_llm.py` | `src/lib/llm/` (or Python API route) | Keep Gemma 3 12B + Qwen3.5-9B. Adapt prompts for recruitment copy. |
| `apps/api/app/services/optimize/creative_compositor.py` | `src/lib/compositor/` | Simplify to recruitment ad templates only (LinkedIn, Indeed, Meta). Strip carousel/video. |
| `apps/api/app/services/optimize/creative_evaluator.py` | `src/lib/evaluator/` | Keep 7-dimension scoring. Adapt dimensions for recruitment (employer brand fit, candidate appeal, etc.) |
| `apps/api/app/services/optimize/creative_pipeline.py` | `src/lib/pipeline/` | Rewrite for recruitment flow: intake form → brief → messaging → creatives. |
| `apps/api/app/services/optimize/font_cache.py` | `src/lib/fonts/` | Cache OneForma/Centific brand fonts only. |
| `packages/llm-engine/vyra_llm/providers/seedream.py` | `src/lib/image-gen/` | Keep Seedream 4.5 for recruitment imagery (workplace, team, culture). |

## What NOT to Copy (Strip These)

| VYRA Module | Why Not Needed |
|---|---|
| Carousel pipeline | Recruitment ads don't use carousels |
| Creative intelligence workflows (competitor analysis) | Not analyzing competitor job ads (yet) |
| Pattern library | Overkill for v1 internal tool |
| Test matrix / A/B | Not running A/B on recruitment ads in v1 |
| Remotion video renderer | Not generating video recruitment ads in v1 |
| MCP clients (WordPress/Elementor/Divi/GTM) | Not deploying to CMS |
| Attribution engine | Not tracking candidate conversion funnels in v1 |
| HIE / RevBrain / CrossTrex | Not relevant to recruitment |

## Prompt Adaptations (Recruitment-Specific)

### Brief Generation (Qwen3.5-9B)
```
VYRA: "Generate creative brief for [product] targeting [consumer audience]"
CENTRIC: "Generate recruitment marketing brief for [role title] at OneForma/Centific.
          Target: [candidate persona — experience level, skills, motivations]
          Employer Value Props: AI-first company, global team (300+ languages),
          remote-first, career growth, cutting-edge AI/ML projects
          Tone: Professional but approachable, tech-forward, inclusive"
```

### Ad Copy (Gemma 3 12B)
```
VYRA: "Write ad headlines and descriptions for [platform] targeting [audience]"
CENTRIC: "Write recruitment ad copy for [role] on [LinkedIn/Indeed/Meta].
          Headline: max 30 chars, speak to candidate aspirations not company needs
          Description: max 90 chars, highlight ONE differentiator
          Primary text: 125 chars, open with the candidate's dream scenario
          CTA: 'Apply Now' | 'Learn More' | 'Join Our Team'
          Avoid: corporate jargon, 'we are looking for', passive voice"
```

### Image Generation (Seedream 4.5)
```
VYRA: "Professional marketing photograph featuring [product]"
CENTRIC: "Professional workplace photograph for recruitment ad.
          Diverse team collaborating in modern office/remote setup.
          Natural lighting, candid feel, not stock-photo posed.
          Show: technology, collaboration, inclusive culture.
          Style: editorial, authentic, aspirational."
```

### Evaluator Dimensions (Adapted for Recruitment)
```
VYRA dimensions:           → CENTRIC dimensions:
brand_fit                  → employer_brand_fit (matches OneForma voice)
hook_strength              → candidate_hook (would a job seeker stop scrolling?)
readability                → readability (same — clear, scannable)
visual_text_harmony        → visual_text_harmony (same)
cta_clarity                → application_cta (is the apply action clear?)
platform_compliance        → platform_compliance (LinkedIn vs Meta vs Indeed specs)
proof_credibility          → culture_proof (does it feel authentic, not corporate?)
```

## Architecture Decision: Python API Route vs TypeScript

**Option A: Python API route (recommended)**
- Next.js API route calls a Python subprocess for LLM inference
- Keeps MLX/Qwen/Gemma in Python (where they work)
- Same pattern as VYRA's `generate_async()`

**Option B: TypeScript with cloud LLM**
- Call Anthropic/OpenAI API directly from Next.js API routes
- No local model dependency
- Higher per-token cost but simpler deployment

**Decision:** Start with Option B for v1 (ship fast, works on Vercel). Migrate to Option A when VYRA backend is deployed (uses local models, zero cost).

## Timeline

- March 27: Copy + adapt pipeline files
- March 28-29: Wire into intake form → generate → display
- March 30-April 5: Polish, test with real Clerk SSO, deploy to Vercel
- April 6: Walk in to Centric with it running

**Why:** This is the execution plan for integrating VYRA's creative intelligence into the Centric app WITHOUT touching VYRA's codebase. Reference before copying any files.

**How to apply:** When copying a file from VYRA, always: (1) duplicate it, (2) adapt prompts for recruitment, (3) strip unused features, (4) NEVER modify the VYRA original.
