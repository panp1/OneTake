# Vyra Tracking Deployment Plan — OneForma Humus Project
**Created:** 2026-04-12
**Status:** Planning
**Goal:** Solve multi-device attribution gap (mobile ad click → desktop conversion) by deploying Vyra's Hyros-like tracking alongside GA4

---

## The Problem

GA4 cannot connect the expected user journey:
```
Meta Ad (mobile) → /humus-twins/ → bounce (90%+) → return via desktop direct/organic → /jobs/humus-3-adults/ → apply_click → survey_complete
```

Because GA4 uses device-specific cookies (`client_id`). Mobile cookie ≠ Desktop cookie = two separate "users." Result: 7,600 paid-acquired users show ZERO survey completions in GA4.

## The Solution: Vyra CrossTrex + Identity Stitching

Vyra's tracking system (reverse-engineered from Hyros) provides:
- **Cross-domain handoff tokens** (HMAC-SHA256 signed `_vxh` params)
- **Identity stitching** (email_hash, device_id, cookie_id, user_id priority chain)
- **Click ID capture** (fbclid, gclid, ttclid persistence across sessions)
- **Journey-level multi-touch attribution** (6 models including time_decay + markov)
- **GA4 session enrichment bridge** (links Vyra visitor_id to GA4 session_id)

---

## Phase 1: Infrastructure Setup

### 1.1 Create Vyra Workspace
- [ ] Create workspace for OneForma
- [ ] Generate API key (`X-Vyra-Key`)
- [ ] Configure workspace settings (session TTL: 1800s, linker TTL: 120s)

### 1.2 Register Funnel Surfaces
| Surface | URL | Type | Priority |
|---|---|---|---|
| Humus Twins LP | /humus-twins/ | landing_page | High |
| Humus Minors LP | /humus3-minors/ | landing_page | High |
| Humus Adults Job | /jobs/humus-3-adults/ | website | High |
| Humus Kids Job | /jobs/humus-3-kids/ | website | High |
| Demographics Survey | /humus-new-participant-demographics-survey | website | High |
| Survey Thank You | /humus-new-participant-demographics-survey/thank-you | website | High |
| Minor Survey | /humus-minor-demographics-survey-copy | website | Medium |
| Join Page | /humus/join.html | landing_page | Medium |
| OneForma Homepage | / | website | Low |
| Registration | /center/signup | website | High |
| Login | /center/login | website | Medium |

### 1.3 Create CrossDomainGroup
- [ ] Group name: "Humus Funnel"
- [ ] Add all surfaces above as members
- [ ] Generate HMAC signing key
- [ ] Set session TTL: 1800s (30 min)
- [ ] Set linker TTL: 120s (2 min)
- [ ] Configure allowed hosts: oneforma.com, www.oneforma.com

---

## Phase 2: Script Deployment (via GTM)

### 2.1 Deploy Core Tracking Pixel
```html
<script
  src="https://app.vyra.io/api/t/v.js"
  data-workspace="{workspace_id}"
  data-key="{api_key}"
  data-client="{client_id}"
  data-surface="{surface_id}"
  data-cross-domain-group="{group_id}"
  data-linker-mode="auto"
  data-allowed-hosts="oneforma.com,www.oneforma.com"
  async
></script>
```

**GTM Implementation:**
- [ ] Create Custom HTML tag with Vyra script
- [ ] Trigger: All Pages (or Humus page group)
- [ ] Set surface_id dynamically via GTM variable (lookup table by page path)
- [ ] Fire BEFORE existing GA4 tags (priority: 100)

### 2.2 Deploy Behavioral Tracking (HIE)
- [ ] Add `vyra-tracking-hie.js` as secondary tag
- [ ] Trigger: Same pages as core pixel
- [ ] Captures: clicks, scroll depth, form interactions, element visibility

### 2.3 Identity Events
- [ ] **Registration page** (`/center/signup`): Fire `vyra.identify({ email: sha256(email) })` on successful registration
- [ ] **Login page** (`/center/login`): Fire `vyra.identify({ user_id: user_id, email: sha256(email) })` on successful login
- [ ] This is the CRITICAL link — when a mobile ad clicker registers on desktop, email_hash merges the journeys

### 2.4 Conversion Events
- [ ] `apply_click` → Fire `vyra.track('apply_click', { surface_id })`
- [ ] `job_apply_click` → Fire `vyra.track('job_apply_click', { surface_id })`
- [ ] `survey_complete` → Fire `vyra.revenue({ event_type: 'lead', revenue: 0 })` (marks as conversion)
- [ ] `register_click` → Fire `vyra.track('register_click', { surface_id })`

---

## Phase 3: GA4 Enrichment Bridge

### 3.1 Link Vyra to GA4
- [ ] Configure `ga4_session_enrichment.py` with GA4 property 330157295
- [ ] Map Vyra `visitor_id` → GA4 `client_id` via shared session
- [ ] Forward enriched touchpoint data as GA4 custom dimensions

### 3.2 GA4 Custom Dimensions to Create
| Dimension | Scope | Source |
|---|---|---|
| `vyra_visitor_id` | User | Vyra visitor cookie |
| `vyra_journey_id` | Session | Active journey UUID |
| `vyra_cross_domain` | Event | Boolean: is_cross_domain_entry |
| `vyra_first_touch_source` | User | First touchpoint channel |
| `vyra_first_touch_campaign` | User | First touchpoint campaign |
| `vyra_attribution_model` | Event | Which model attributed |

### 3.3 Implementation via GTM
- [ ] Create GTM variables reading Vyra cookies (`vyra_vid`, `vyra_hsid`)
- [ ] Pass as custom dimensions in GA4 config tag
- [ ] This allows GA4 reports to segment by Vyra's cross-device visitor ID

---

## Phase 4: Data Surfacing — Where to View the Data

### Option A: GA4 + Looker Studio (Partial — recommended for Phase 1)
**What works:**
- GA4 custom dimensions (`vyra_visitor_id`, `vyra_first_touch_source`) enable Looker Studio dashboards that show cross-device attribution
- Can build "Paid media first touch → Survey complete" reports using `vyra_first_touch_source` dimension
- Looker Studio connects directly to GA4 — no custom app needed

**Limitations:**
- GA4 only stores aggregate data, not individual journey paths
- Can't visualize the full touchpoint sequence (ad click → bounce → return → apply → survey)
- Multi-touch attribution models (linear, time_decay, markov) can't run in GA4
- No identity stitching visibility — GA4 just sees the enriched dimension values

**Best for:** Quick wins, executive dashboards, CVR by first-touch source

### Option B: Looker Studio + BigQuery (Full power — recommended for Phase 2)
**What works:**
- Export Vyra touchpoint + journey data to BigQuery
- Full SQL access to individual user journeys
- Build custom Looker Studio dashboards with:
  - Complete journey path visualization
  - Multi-touch attribution model comparison
  - Cross-device path analysis
  - Time-decay and Markov model outputs
  - Recruiter performance with full attribution

**Requirements:**
- BigQuery dataset for Vyra data (can use existing GCP project)
- Vyra → BigQuery export pipeline (scheduled or real-time)
- Looker Studio BigQuery connector (free)

**Best for:** Full attribution analysis, journey visualization, model comparison

### Option C: Vyra Dashboard (Custom App — Phase 3)
**What works:**
- Vyra's own API endpoints serve attribution data
- Build custom dashboard in the Vyra web app (`/apps/web/`)
- Full journey visualization with interactive touchpoint timelines
- Real-time cross-domain handoff monitoring
- Identity stitching audit trail
- HIE behavioral data (heatmaps, scroll depth, click maps)

**Requirements:**
- Deploy Vyra web app
- Connect to Vyra API
- Custom frontend development

**Best for:** Operational team use, real-time monitoring, behavioral analysis

### Recommended Phased Approach
| Phase | Timeline | Data Surface | Effort |
|---|---|---|---|
| **Phase 1** | Week 1-2 | GA4 custom dims → Looker Studio | Low |
| **Phase 2** | Week 3-4 | BigQuery export → Looker Studio | Medium |
| **Phase 3** | Week 5-8 | Vyra custom dashboard | High |

---

## Phase 5: Validation & Testing

### 5.1 Pre-Launch Validation
- [ ] Test cross-domain handoff: navigate between surfaces, verify `_vxh` token adoption
- [ ] Test identity stitching: click ad (incognito) → register → verify journey merge
- [ ] Verify GA4 custom dimensions populate correctly
- [ ] Check no conflicts with existing GA4/GTM tags

### 5.2 A/B Validation
- [ ] Run 2 weeks with Vyra tracking alongside GA4
- [ ] Compare: GA4-only attribution vs Vyra attribution for the same conversions
- [ ] Quantify the "dark funnel" — how many paid-attributed conversions does Vyra find that GA4 missed?

### 5.3 Success Metrics
- [ ] Can we attribute survey_complete events to paid media first-touch? (Currently: 0)
- [ ] What % of "direct" conversions were actually paid-first-touch?
- [ ] Does the mobile→desktop journey path appear in Vyra data?
- [ ] Reduction in "(not set)" attribution

---

## Phase 6: Statistical Re-Analysis

Once Vyra has 4+ weeks of data:
- [ ] Re-run the paid media → survey_complete correlation analysis
- [ ] Use Vyra's `first_touch_source` instead of GA4's `firstUserSource`
- [ ] Apply time_decay attribution model to Vyra journeys
- [ ] Compare Vyra-attributed CVR vs GA4-attributed CVR
- [ ] Update the Humus multi-attribution report with Vyra data

---

## Key Files Reference

| File | Location | Purpose |
|---|---|---|
| Core tracking pixel | `/Users/stevenjunop/vyra/apps/api/static/vyra-tracking.js` | Client-side visitor/session/UTM tracking |
| Behavioral tracking | `/Users/stevenjunop/vyra/apps/api/static/vyra-tracking-hie.js` | Click, scroll, form, visibility tracking |
| Cross-domain handoff | `/Users/stevenjunop/vyra/apps/api/app/services/crosstrex_handoff.py` | HMAC token issue/validate |
| Identity stitching | `/Users/stevenjunop/vyra/apps/api/app/services/attribution/identity.py` | Multi-identifier resolution |
| Journey builder | `/Users/stevenjunop/vyra/apps/api/app/services/attribution/journey_builder.py` | Touchpoint → journey lifecycle |
| GA4 enrichment | `/Users/stevenjunop/vyra/apps/api/app/services/ga4_session_enrichment.py` | GA4 session linkage |
| Surface models | `/Users/stevenjunop/vyra/apps/api/app/models/crosstrex.py` | Surface, group, handoff models |
| Snippet generator | `/Users/stevenjunop/vyra/apps/api/app/services/crosstrex_snippet.py` | Script tag generation |
| Auth script | `/Users/stevenjunop/Downloads/Oneformadata/ga4_auth.py` | OAuth for GA4 + GTM API access |

---

## Risk & Dependencies

| Risk | Mitigation |
|---|---|
| Vyra API not deployed yet | Need to deploy Vyra backend first |
| GTM access needed | Auth script updated with tagmanager.edit.containers scope |
| Cookie consent / privacy | Vyra hashes emails client-side (SHA-256), no PII transmitted |
| Existing GA4 tag conflicts | Deploy Vyra as additive — does not modify GA4 tags |
| Dec 24 tracking break (from analysis) | Audit GTM tags first to fix existing issue before adding Vyra |

---

## Immediate Next Steps

1. **Get GTM API auth working** (tagmanager scopes added to OAuth client)
2. **Audit existing GTM tags** — find the Dec 24 conversion tracking break
3. **Fix broken GA4 conversion tracking** (prerequisite before adding Vyra)
4. **Deploy Vyra Phase 1** (core pixel + cross-domain on Humus pages)
5. **Create GA4 custom dimensions** for Vyra enrichment
6. **Build Looker Studio dashboard** connecting GA4 + Vyra dimensions
