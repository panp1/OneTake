# Centric Recruitment Intake App — Claude Code Instructions

## Who You Are Working With

Steven Junop — 27-year-old full-stack developer and agency owner who builds at extreme velocity (2M LOC across 19 projects in 53 days). He is starting as Digital Marketing Manager at Centific/OneForma on April 6, 2026. This app is his Day 1 weapon — built to solve the chaotic recruitment marketing workflow described in his interview. He operates with urgency, ships fast, and expects Claude to match his pace.

## What This Project Is

An internal recruitment marketing intake app for OneForma (child brand of Centific). Recruiting team fills a form → AI generates creative brief + messaging + ad creatives → Designer gets notified → Steven approves → Package sent to ad agency. Replaces a 3-5 day panic workflow with a 30-minute proactive system.

**This app is a Trojan horse.** It proves VYRA (Steven's 557K LOC autonomous marketing platform) works in production. After 2-3 weeks of results, he pitches VYRA to the VP of Product.

## Tech Stack (Decided)

- **Framework:** Next.js 16 (App Router, already scaffolded)
- **Hosting:** Vercel
- **Database:** Neon (serverless Postgres) — also used as message bus for worker jobs
- **Auth:** Clerk (Microsoft SSO via SAML — Centific uses MS ecosystem)
- **Styling:** Tailwind CSS 4 (OneForma brand — LIGHT theme, NOT dark)
- **Icons:** Lucide React only (no emojis ever)
- **Notifications:** Microsoft Teams webhook (primary), Slack webhook (backup)
- **File Storage:** Vercel Blob
- **AI:** OpenRouter (Kimi K2.5 for channel research + RFP extraction)
- **Image Gen:** Local Python worker with Seedream 4.5 (MLX on Apple Silicon)
- **Worker:** Local Python poller (`worker/`) — polls Neon for pending compute_jobs

## Design System (OneForma Brand — MANDATORY)

- **Theme:** LIGHT (white backgrounds, dark text — opposite of VYRA's dark theme)
- **Background:** `#FFFFFF`
- **Text:** `#1A1A1A`
- **Muted:** `#F5F5F5` / `#737373`
- **Buttons:** `#32373C` charcoal, pill-shaped (`rounded-full`), white text
- **Border:** `#E5E5E5`
- **Accent gradient:** `linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))` — cyan-blue to purple
- **Fonts:** System stack — `-apple-system, system-ui, "Segoe UI", Roboto, sans-serif` — NO Google Fonts
- **Shadows:** Subtle only — `0 2px 8px rgba(0,0,0,0.08)` for cards
- **Radii:** Pills for buttons (`9999px`), `12px` for cards, `10px` for inputs
- **Status badges:** draft(gray), generating(blue), review(yellow), approved(green), sent(cyan), urgent(red)

CSS classes available in globals.css: `.btn-primary`, `.btn-secondary`, `.badge`, `.badge-*`, `.card`, `.gradient-accent`

## VYRA Code Copy Rules (CRITICAL)

This app contains adapted copies of VYRA Creative OS code. The originals live at `/Users/stevenjunop/vyra/`.

**RULE: NEVER modify, move, or delete anything in the VYRA repo. COPY ONLY.**

See `.claude/memory/vyra-code-copy-plan.md` for the full copy manifest.

Prompts are adapted for RECRUITMENT (candidate messaging, employer branding, job seeker targeting) — not consumer marketing.

## What's Already Built

- **Frontend:** Dashboard, dynamic intake form (schema-driven), detail/approval views, designer magic-link portal, export/ZIP route
- **Auth:** Clerk with role-based access (admin, recruiter, designer, viewer), middleware protection
- **Database:** Full Neon schema — intake_requests, generated_assets, creative_briefs, actor_profiles, approvals, magic_links, notifications, compute_jobs, task_type_schemas, option_registry, user_roles
- **Admin Portal:** User management, schema editor, worker/pipeline monitor (auto-refreshing)
- **Pipeline Routes:** Generate, regenerate (full + per-stage + per-asset), approve, compute job status polling
- **Notifications:** Teams webhook (adaptive cards), Slack webhook, Outlook routes
- **Worker:** Python poller (`worker/`) — 4-stage pipeline (intelligence, images, copy, composition), Neon client, Teams notifications, Seedream integration
- **Prompts:** Recruitment-specific prompt templates for all pipeline stages
- 0 TypeScript errors

## What Needs Building Next

1. **Environment setup** — Configure Vercel env vars (Neon, Clerk, OpenRouter, Blob, Teams webhook)
2. **Deploy to production** — `vercel --prod`, run DB migrations, verify end-to-end flow
3. **Microsoft SAML SSO** — Configure Clerk with Centific's Azure AD (post-deploy)

## How To Work

- Ship fast. Steven builds at 50K+ LOC/day. Match his pace.
- Use the existing CSS classes (btn-primary, card, badge-*). Don't reinvent.
- Server components by default. 'use client' only when needed.
- All interactive elements need `cursor-pointer`.
- Generous whitespace — `gap-6`, `p-6`, `space-y-4`.
- LIGHT theme only. No dark mode.
- System fonts only. No Google Fonts imports.
- Every feature should serve: recruiter fills form → AI generates → Steven approves → agency gets package.
- If a feature doesn't serve that flow, skip it.

## Memory Files (Auto-Loaded)

- `project-context.md` — The problem (panic workflow) and the solution (AI intake app)
- `tech-decisions.md` — Stack, architecture, DB schema, UX decisions
- `brand-design-system.md` — OneForma colors, fonts, buttons, shadows extracted from oneforma.com
- `vyra-code-copy-plan.md` — What to copy from VYRA, what to strip, prompt adaptations
