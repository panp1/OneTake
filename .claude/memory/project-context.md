---
name: Centric Intake App — Problem & Solution Context
description: Full context from the hiring interview about the chaotic recruitment marketing workflow at Centric, and Steven's pre-built solution using VYRA Creative OS. Critical reading before any development work.
type: project
---

## The Centric Deal

- **Company:** Centric
- **Role:** Digital Marketing Manager
- **Compensation:** $100K base + full benefits + 401K (no bonus structure — yet)
- **Contract:** LOCKED March 26, 2026
- **Start date:** April 6, 2026
- **Hired to fix:** The recruitment marketing workflow

## The Problem (Described in Interview)

The current workflow is pure chaos:

```
1. Recruiting team panics — "WE NEED TO FILL THIS ROLE!"
   ↓ (frantic email or Slack message)
2. Marketing manager (Steven's role) drops everything
   ↓ (brainstorm ideas in panic mode)
3. Steven has to come up with creative ideas manually
   ↓ (write a brief from scratch)
4. Brief + messaging sent to designer
   ↓ (designer scrambles, drops their other work)
5. Designer creates concepts, sends back
   ↓ (back and forth revisions — "can you change this?")
6. Steven approves
   ↓ (email the package to the ad agency)
7. Ad agency receives and runs the ads

Timeline: 3-5 DAYS of reactive chaos per role
Quality: Inconsistent, rushed, panic-driven
Everyone involved: stressed, interrupted, reactive
```

**The core issue:** The entire process is REACTIVE. By the time the ad runs, the recruiting team has been waiting almost a week. Every person in the chain gets interrupted from their actual work. There's no system, no templates, no automation. It's all manual, every single time.

## The Solution (Pre-Built by Steven)

A web app that transforms this into a 30-minute proactive process:

```
1. Recruiter opens the intake app (5 minutes)
   → Fills structured form: role, department, requirements, urgency, budget, notes

2. VYRA Creative OS auto-generates (2-3 minutes):
   ├── Creative brief (formatted, professional)
   ├── Messaging strategy (value props for CANDIDATES, not customers)
   ├── Target audience definition (job seekers, passive candidates, demographics)
   ├── Channels of acquisition recommendation (LinkedIn, Meta, Indeed, Google)
   ├── 3-5 ad creative variants (static images via Seedream + compositor)
   ├── Platform-specific sizing (LinkedIn 1200x627, Meta 1200x628, etc.)
   └── Evaluation scores on every asset (7-dimension quality gate)

3. Designer gets Slack + Outlook notification with download link
   → Package is 90% done — designer refines, doesn't create from scratch

4. Steven reviews and approves with one click
   → Or requests changes with a note

5. Approved package auto-sent to ad agency
   → ZIP: creatives + brief + specs + targeting recommendations

Timeline: 30 MINUTES
Quality: Consistent, brand-aligned, evaluated, proactive
```

## Why This Gets Built BEFORE Day 1

Steven's concern: "The worst case scenario is me starting on Monday then NOT being able to set up VYRA integrations because I am swamped with the messy workflow."

If the old workflow catches him on day 1, he becomes the thing he was hired to replace — a manual bottleneck. The intake app must be ready before April 6 so the first recruiting request goes through the new system, not the old chaos.

## The Strategic Play

This app is the Trojan horse for VYRA at Centric:

1. **Week 1:** Show VP of Product the intake app on day 1. Frame: "I built this specifically for the intake bottleneck you described in my interview. Can I have 15 minutes to show you?"
2. **Week 2-3:** Intake app proves itself. Recruiting team loves it. Designer loves it. Time savings are measurable.
3. **Week 4-6:** First performance metrics from the ads run through the system.
4. **Week 7-8:** Pitch: "I built the platform behind this. What if we fine-tuned it on Centric's data?"
5. **Outcome:** Internal product team, raise, or VYRA becomes Centric's marketing OS.

## Key Constraint

Centric uses **Microsoft ecosystem** — the app must use Microsoft SSO (via Clerk SAML/OIDC). All notifications should work with Outlook (not just Slack). The designer and ad agency need to access the approved packages without needing an account (magic link or public download with expiry).

## Who Uses This App

| Role | What They Do | Frequency |
|---|---|---|
| **Recruiter** | Fills intake form | Per open role (~2-5/week) |
| **Steven** (Marketing Manager) | Reviews, approves, manages | Daily |
| **Designer** | Downloads package, refines creatives, uploads finals | Per request |
| **Ad Agency** | Receives approved package, runs ads | Per approved request |

## VYRA Modules Powering This App

Not the full 13-module VYRA deploy — just the creative pipeline as a standalone API:

- **Qwen3.5-9B** — Brief generation, channel strategy, messaging
- **Gemma 3 12B** — Ad copy, job posting copy, candidate messaging
- **Seedream 4.5** — Ad imagery (workplace photos, team culture visuals)
- **Compositor** — Platform-specific ad assembly (LinkedIn, Meta, Indeed sizing)
- **Evaluator** — Quality gate on every generated asset
- **Font Cache** — Centric brand fonts cached for pixel-perfect creatives

**Why:** This is the foundational context for the entire project. Any developer (or Claude session) working on this app needs to understand the problem, the solution, and the strategic play.

**How to apply:** Every feature decision should be evaluated against: "Does this help the recruiting team go from panic to proactive?" If yes, build it. If no, skip it.
