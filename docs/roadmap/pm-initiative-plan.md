# OneForma Marketing Operations — Initiative Plan

**Prepared by:** Steven Junop, Digital Marketing Manager
**Date:** April 14, 2026
**For:** PM Team Planning Session with Jenn

---

## Three Initiatives, One Goal

Replace reactive, manual marketing operations with automated, measurable systems. All three initiatives are independent but reinforce each other.

---

## Initiative 1: Nova — Creative Operations Automation

**Status:** Built and deployed (nova-intake.vercel.app)
**What it does:** Recruiter pastes a job description → Nova generates a complete campaign package in 30 minutes: personas, ad creatives, ad copy, landing pages, organic social carousels, WordPress job postings, and UTM tracked links.

### Deliverables (Built)
| Capability | Status |
|---|---|
| 5-step intake wizard with AI pre-fill from RFP | Deployed |
| 6-stage AI pipeline (intelligence → images → copy → composition → video → landing pages) | Deployed |
| Per-persona landing page generation with drift validation | Deployed |
| WordPress job description auto-publish with taxonomy tagging | Built, pending WP credentials |
| Organic carousel generation (LinkedIn + IG, 12 per campaign) | Deployed |
| Inline-editable media strategy (budgets, interests, split tests) | Deployed |
| Designer portal with edit suite + Figma integration | Deployed |
| Agency magic link portal with targeting + downloads | Deployed |
| Recruiter creative library with UTM tracked link builder | Deployed |
| 3-stage approval flow (marketing → designer → final) | Deployed |
| Teams + Outlook notifications at every handoff | Deployed |

### What's Needed from PM/Org
- 1-2 recruiter volunteers for pilot testing (week of April 21)
- WP Application Password for auto-publish
- Recruiter training session (15 min) once pilot validates

### Timeline
| Week | Milestone |
|---|---|
| Apr 14-18 | Run 2-3 real campaigns end-to-end, fix issues |
| Apr 21-25 | Recruiter pilot (1-2 people), designer daily testing |
| Apr 28-May 2 | Full recruiter team training, first agency handoff |

---

## Initiative 2: Tracking Stabilization — GA4 + GTM Remediation

**Status:** Audit complete, fixes written, ready to deploy
**What it does:** Fixes 7 identified tracking issues, adds missing event tags, implements cross-device identity tracking, and enables recruiter-level attribution.

### Critical Findings
| Issue | Severity | Impact |
|---|---|---|
| `urm_content` typo (Variable 17) | HIGH | Recruiter channel tracking broken since Nov 2025 |
| `apply_click` wrong GA4 property | HIGH | 1,861 apply events invisible in marketing analytics |
| Key events not marked as conversions | HIGH | Can't optimize campaigns toward apply actions |
| No cross-device identity | CRITICAL | 7,600 paid visitors show 0 survey completions |
| UTM params lost after landing page | MEDIUM | All downstream events lose acquisition source |

### Solution (No Budget Required)
- Phase 1 (Day 1): Fix 5 existing bugs — GTM publish only
- Phase 2 (Days 2-3): Add 7 missing event tags + UTM persistence + visitor ID + cross-domain linker
- Phase 3 (Day 4-5): GA4 custom dimensions + Looker Studio dashboard

### What's Needed from PM/Org
- GTM publish access for container GTM-NR965959
- GA4 admin access for property 330157295
- Coordination with Poola (GTM Implementation Lead)
- Legal review of cookie/privacy approach (first-party cookies only, SHA-256 hashed emails)

### Timeline
| Day | Actions | Risk |
|---|---|---|
| Day 1 | Fix 5 existing GTM bugs | None |
| Day 2 | Add 7 new event tags + UTM persistence | Low |
| Day 3 | Cross-domain linker + identity stitch + QA | Low |
| Day 4 | Create 12 GA4 custom dimensions | None |
| Day 5 | Verify data flow + initial reporting dashboard | None |

---

## Initiative 3: VYRA Visualize — Campaign Analytics Platform

**Status:** Planning (code exists at src-command, needs integration)
**What it does:** Real-time campaign performance dashboards with KPI rollups, channel breakdowns, multi-touch attribution, funnel visualization, and AI-powered budget recommendations.

### What It Provides
- KPI dashboard (spend, revenue, conversions, ROAS, CTR, CPA)
- Channel-level performance breakdown
- RevBrain — AI recommendations for budget shifts per channel
- Granular funnel (campaign → ad → creative → landing page)
- Export/share for leadership reporting

### Dependencies
- Initiative 2 (tracking) must be live first — analytics needs clean data
- 2-4 weeks of production tracking data before dashboards are meaningful
- GA4 API access + ad platform API credentials (Meta, LinkedIn, Google Ads)

### Timeline
| Week | Milestone |
|---|---|
| May 5-9 | Port SRC Command Center API to Nova |
| May 12-16 | KPI dashboard + channel rollups in marketing view |
| May 19-23 | RevBrain recommendations + funnel visualization |
| May 26-30 | Exports + share links for leadership |

---

## Microsoft Integration Requirements (Cross-Initiative)

These are needed across all three initiatives:

| Integration | What | Who | Priority |
|---|---|---|---|
| Azure AD SSO | Clerk SAML → Centific Azure AD | IT Admin | P1 — blocks internal team access |
| Teams Webhooks (prod) | Production webhook URL for marketing channel | IT Admin | P1 — using test URL currently |
| Outlook Send | Graph API app registration for @centific.com sending | IT Admin | P1 — needed for notifications |
| SharePoint | Auto-create campaign folders, save approved assets | IT Admin | P2 — nice to have |
| WordPress | Application Password for auto-publish | Jenn/Steven | P1 — blocks Initiative 1 WP feature |

---

## Meeting Agenda (Suggested)

1. **5 min** — Overview: 3 initiatives, how they connect
2. **10 min** — Initiative 1 (Nova) live demo — run a real JD through the pipeline
3. **5 min** — Initiative 2 (Tracking) findings — the 7,600 paid visitors with 0 conversions
4. **5 min** — Initiative 3 (Analytics) vision — what we'll see once tracking is fixed
5. **5 min** — What I need from PM: pilot recruiters, GTM access, WP credentials, MS integrations
6. **5 min** — Q&A + next steps

---

## Success Metrics (30/60/90 Day)

| Metric | 30 Days | 60 Days | 90 Days |
|---|---|---|---|
| Campaigns through Nova | 5-10 | 20-30 | 50+ |
| Time per campaign | <1 hour (vs 3-5 days) | <30 min | <15 min (fully automated) |
| Tracking accuracy | Phase 1+2 bugs fixed | Cross-device attribution live | Full funnel visibility |
| Recruiter adoption | 1-2 pilots | Full team trained | Self-service |
| Cost | $0 (free AI APIs + Vercel) | $0 | Kling video credits only |
