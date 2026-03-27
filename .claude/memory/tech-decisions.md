---
name: Centric Intake App — Technical Decisions
description: Stack choices, architecture decisions, and VYRA integration strategy. Reference before making any technical choices.
type: project
---

## Stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | Next.js (latest) | Vercel-native, SSR, API routes, fast |
| **Hosting** | Vercel | Zero-config deploy, edge functions, preview URLs |
| **Database** | Neon (Postgres) | Serverless Postgres, Vercel integration, branching |
| **Auth** | Clerk | Microsoft SSO via SAML/OIDC (Centric uses MS) |
| **Styling** | Tailwind CSS + shadcn/ui | Matches VYRA design system, dark theme |
| **Notifications** | Slack webhook + Microsoft Graph (Outlook) | Designer gets both channels |
| **File Storage** | Vercel Blob | Generated creatives, export ZIPs |
| **AI/Creative** | VYRA Creative OS (API) | Standalone deployment of creative pipeline |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Vercel (Next.js App)                                    │
│                                                          │
│  Pages:                                                  │
│  ├── /               → Dashboard (Steven's view)         │
│  ├── /intake/new     → Recruiter intake form             │
│  ├── /intake/[id]    → Request detail + approval         │
│  ├── /designer/[id]  → Designer view (download/upload)   │
│  └── /settings       → Slack webhook, team config        │
│                                                          │
│  API Routes:                                             │
│  ├── /api/intake     → CRUD for intake requests          │
│  ├── /api/generate   → Trigger VYRA Creative OS          │
│  ├── /api/approve    → Approval workflow                 │
│  ├── /api/notify     → Slack + Outlook notifications     │
│  └── /api/export     → Package ZIP for agency            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Neon Postgres                                           │
│  ├── intake_requests (role, dept, requirements, status)  │
│  ├── generated_assets (creatives, briefs, per request)   │
│  ├── approvals (who approved, when, notes)               │
│  └── notifications (sent, delivered, read)               │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  VYRA Creative OS (Standalone API)                       │
│  ├── POST /generate → brief + messaging + creatives      │
│  ├── Uses: Qwen3.5-9B, Gemma 3 12B, Seedream 4.5       │
│  ├── Compositor: platform-specific ad assembly            │
│  └── Evaluator: 7-dimension quality gate                 │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Integrations                                            │
│  ├── Clerk → Microsoft SSO (SAML/OIDC)                  │
│  ├── Slack → Designer notification webhook               │
│  ├── Microsoft Graph → Outlook email notifications       │
│  └── Vercel Blob → Asset storage + download links        │
└─────────────────────────────────────────────────────────┘
```

## Database Schema (Initial)

```sql
-- Intake requests from recruiting team
intake_requests:
  id              UUID PRIMARY KEY
  title           TEXT NOT NULL        -- "Senior Frontend Engineer"
  department      TEXT                 -- "Engineering"
  location        TEXT                 -- "Remote / NYC"
  urgency         TEXT                 -- "urgent" | "standard" | "pipeline"
  requirements    TEXT                 -- Job description / requirements
  budget_notes    TEXT                 -- Budget for ad spend
  special_notes   TEXT                 -- Any special instructions
  status          TEXT DEFAULT 'draft' -- draft → generating → review → approved → sent
  created_by      TEXT                 -- Clerk user ID (recruiter)
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ DEFAULT NOW()

-- Generated creative assets per request
generated_assets:
  id              UUID PRIMARY KEY
  request_id      UUID REFERENCES intake_requests(id)
  asset_type      TEXT                 -- "brief" | "messaging" | "creative" | "targeting"
  content         JSONB                -- The generated content
  platform        TEXT                 -- "linkedin" | "meta" | "indeed" | "google"
  evaluation_score FLOAT               -- 0.0-1.0 from evaluator
  evaluation_data  JSONB               -- Full 7-dimension breakdown
  blob_url        TEXT                 -- Vercel Blob URL for images
  version         INT DEFAULT 1
  created_at      TIMESTAMPTZ DEFAULT NOW()

-- Approval workflow
approvals:
  id              UUID PRIMARY KEY
  request_id      UUID REFERENCES intake_requests(id)
  approved_by     TEXT                 -- Clerk user ID (Steven)
  status          TEXT                 -- "approved" | "changes_requested" | "rejected"
  notes           TEXT
  created_at      TIMESTAMPTZ DEFAULT NOW()

-- Designer uploads (refined creatives)
designer_uploads:
  id              UUID PRIMARY KEY
  request_id      UUID REFERENCES intake_requests(id)
  file_name       TEXT
  blob_url        TEXT                 -- Vercel Blob URL
  uploaded_by     TEXT                 -- Designer name/email
  created_at      TIMESTAMPTZ DEFAULT NOW()

-- Notification log
notifications:
  id              UUID PRIMARY KEY
  request_id      UUID REFERENCES intake_requests(id)
  channel         TEXT                 -- "slack" | "outlook" | "email"
  recipient       TEXT
  status          TEXT                 -- "sent" | "delivered" | "failed"
  created_at      TIMESTAMPTZ DEFAULT NOW()
```

## Key UX Decisions

1. **Recruiter form is MINIMAL** — role title, department, requirements, urgency. That's it. No fields they don't understand. VYRA figures out the rest.
2. **Designer gets a magic link** — no account needed. Click link → see the package → download → upload refined versions. Expires in 7 days.
3. **Steven's dashboard shows pipeline** — all requests in columns: Draft → Generating → Review → Approved → Sent to Agency
4. **One-click approve** — Steven sees the brief, the messaging, the creatives with evaluation scores. Green button = approve, sends to designer. Orange button = request changes.
5. **Agency export is a ZIP** — creatives (PNG per platform) + brief (PDF) + targeting specs (CSV/text) + evaluation report.

## What This App Is NOT

- NOT a full VYRA deployment (no attribution, no HIE, no RevBrain)
- NOT a CRM or ATS (doesn't replace their recruiting tools)
- NOT an ad platform (doesn't run ads — sends packages to their agency)
- NOT complex — recruiter fills a form, AI generates, Steven approves, designer refines, agency gets the package

**Why:** Reference for all technical decisions. Keep it simple. The app's value is in the AI generation + approval workflow, not in feature count.

**How to apply:** When in doubt, cut scope. This app needs to be functional before April 6. Every feature that doesn't serve the recruiter → AI → approve → agency flow is out of scope for v1.
