# Nove/Centric Intake

Centric Intake is an AI-assisted recruitment campaign operating system for intake, creative generation, marketing review, designer collaboration, recruiter handoff, and agency delivery.

The platform turns a recruiter brief or RFP into a structured campaign workspace with strategy, personas, creative assets, landing-page handoff details, tracked links, and exportable packages.

## What It Does

- Captures structured recruitment requests through schema-driven intake forms.
- Extracts campaign details from pasted briefs or uploaded RFP files.
- Queues AI generation jobs for a local compute worker.
- Generates strategy, personas, actor images, ad copy, composed creatives, carousels, and optional video assets.
- Gives marketing managers a review workspace for campaign quality control.
- Provides designers with campaign context, download kits, asset notes, and upload flows.
- Gives recruiters approved creative libraries and campaign tracking links.
- Packages approved assets for agency handoff and ZIP export.

## Core Workflow

```text
Intake request
  -> schema validation
  -> compute job queued
  -> AI generation pipeline
  -> marketing manager review
  -> approval or revision
  -> designer handoff
  -> recruiter handoff
  -> agency package export
```

Workflow diagrams are available in:

- `docs/workflow/end-to-end-workflow.mmd`
- `docs/workflow/generation-pipeline.mmd`
- `docs/workflow/workflow-map.json`

## Product Areas

| Area | Purpose |
| --- | --- |
| Intake | Recruiters or admins submit campaign requests using dynamic task schemas. |
| Generation | A local worker claims queued jobs and runs the staged creative pipeline. |
| Marketing Review | Admin users review strategy, personas, assets, and approve or request changes. |
| Designer Portal | Designers receive context, download assets, leave notes, and upload finals. |
| Recruiter Workspace | Recruiters access approved creatives and create tracked campaign links. |
| Agency Handoff | Agencies receive a packaged campaign view and downloadable ZIP exports. |

## Generation Pipeline

The compute worker runs a staged pipeline where each stage feeds the next:

| Stage | Name | Output |
| --- | --- | --- |
| 1 | Strategic Intelligence | Cultural research, personas, campaign strategy, creative brief, design direction. |
| 2 | Character-Driven Image Generation | Actor profiles, validated seed images, image variations, base image assets. |
| 3 | Copy Generation | Persona-targeted copy variants by channel and language. |
| 4 | Layout Composition | Platform-ready composed creatives, overlays, and carousel assets. |
| 5 | Video Generation | Optional short-form UGC-style campaign videos. |

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Clerk authentication
- Neon Postgres
- Vercel Blob storage
- Microsoft Teams notifications
- Python local compute worker
- NVIDIA NIM, OpenRouter, Seedream, Kling, and related model providers
- Playwright-based creative rendering

## Repository Structure

```text
src/
  app/                 Next.js routes, pages, and API handlers
  components/          Product UI components and role-specific workspaces
  lib/                 Database helpers, permissions, export, tracking, utilities

worker/
  pipeline/            AI generation stages and orchestration
  ai/                  Model clients, creative rendering helpers, VQA tools
  prompts/             Prompt systems, evaluators, brand rules, stage prompts
  brand/               OneForma brand and copy constraints

docs/
  workflow/            Mermaid and JSON workflow artifacts
```

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create environment files:

```bash
cp .env.example .env.local
cp worker/.env.example worker/.env
```

Run the web app:

```bash
pnpm dev
```

Run the compute worker:

```bash
cd worker
python main.py
```

The web app runs at:

```text
http://localhost:3000
```

## Environment Variables

The app and worker require access to the same database and storage layer.

Common app variables:

```text
DATABASE_URL
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL
BLOB_READ_WRITE_TOKEN
TEAMS_WEBHOOK_URL
OPENROUTER_API_KEY
NVIDIA_NIM_API_KEY
```

Common worker variables:

```text
DATABASE_URL
BLOB_READ_WRITE_TOKEN
APP_URL
NVIDIA_NIM_API_KEY
OPENROUTER_API_KEY
POLL_INTERVAL_SECONDS
COMPOSE_CONCURRENCY
KLING_ACCESS_KEY
KLING_SECRET_KEY
```

See `.env.example` and `worker/.env.example` for the complete baseline.

## Scripts

```bash
pnpm dev      # Start the Next.js app
pnpm build    # Build the app
pnpm start    # Start production server
pnpm lint     # Run linting
```

## Documentation

- Technical breakdown: `docs/technical-breakdown.md`
- Workflow diagrams: `docs/workflow/`
- Worker details: `worker/README.md`

