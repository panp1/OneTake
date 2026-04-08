# OneForma Brand Voice — Governance

This folder is the **single source of truth** for OneForma brand voice, positioning, messaging, CTAs, and visual design language in the centric-intake worker pipeline.

## Rule 1 — This is the only safe source

No other file in the codebase should contain hardcoded brand voice content. If a prompt needs the tagline, tone rules, CTAs, pillars, or color palette, it imports from here:

```python
from worker.brand import TAGLINE, TONE_RULES, get_cta, PILLARS
```

## Rule 2 — Never reference external brand files

The original brand source materials live outside this repository:

- `/Users/stevenjunop/oneformaseo/` (internal SEO working files)
- `/Users/stevenjunop/Downloads/OneForma*.pdf` (internal brand guidelines)
- Any internal agency deliverables, research briefs, or strategy decks

**Never reference, import from, or quote these files in any prompt, script, or code.** The content in `oneforma.py` was curated from the public portions of those materials with sensitive items stripped at curation time. Treat `oneforma.py` as the only runtime source.

## Rule 3 — What NEVER goes in `oneforma.py`

The verifier script at `scripts/verify-brand-module.mjs` enforces the following exclusions. Before committing any change to `oneforma.py`, run the verifier and fix any violations.

- **End-customer names**: OpenAI, Anthropic, Google (as AI customer), Meta, Amazon AI, Apple Intelligence, etc.
- **Enterprise client names**: Microsoft, FedEx, Lowe's, Allstate, Sony, etc.
- **Competitor names (even in anti-examples)**: Surge AI, Mercor, Outlier, Scale AI, Handshake AI, Appen, Prolific, iMerit, Toloka, Centaur Labs, etc. Anti-examples describe competitor *patterns* (e.g., "Ivy-League gating") but never name the competitor.
- **Internal people and agencies**: Olivine Marketing and any of its staff, OneForma internal team members, domain expert interviewees, marketing stakeholders.
- **Internal products and sister brands**: UHRS, Data Foundry, TryRating, oTMS, ATMS, Centific (the parent brand).
- **Internal project codenames**: Cutis, Lightspeed, MAPS program, Milky Way, Lumina, Vega, Karl LLM, Cherry Opal, Lighthouse, Andromeda, Olivine ReBrand.
- **Internal research numbers**: $22.5M H1 payouts, $165M revenue, n=934 survey, "441 mentions" of any term, 57% YoY, 42% YoY.

## Rule 4 — What IS allowed

- The **public trust strip** (1.8M members, 300+ languages, 222 markets, twice-monthly payouts, no fees) is approved for external use.
- The **locked tagline, mission, vision, positioning** from the brand voice doc.
- The **color hex values, Roboto font family, design motifs** from the public brand guidelines.
- The **4 tone rules, words-to-use/avoid, 3 pillars, hero templates, 2 locked CTAs** from the public brand voice doc.
- The **5 service categories** (annotation, data collection, judging, transcription, translation) — the public service taxonomy.

## Rule 5 — How to update

1. Edit `worker/brand/oneforma.py` directly
2. Run the verifier: `node --experimental-strip-types scripts/verify-brand-module.mjs`
3. Fix any banned pattern matches
4. Commit with a clear message explaining what brand element changed and why
5. The commit becomes part of the audit trail for brand governance
