# Test Suite Plan C: End-to-End Flow Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 17 e2e tests across 4 files — simulate full data journeys from campaign creation through drift scoring, proving the entire pipeline works end-to-end.

**Architecture:** Real Neon DB, real API route handlers. Each test file is a self-contained story: seed data → execute pipeline steps → verify final state. Test data cleaned up in afterAll.

**Tech Stack:** Vitest 4.x, Neon Postgres, Next.js 16 API routes

**Prerequisite:** Unit tests (Plan A) + Integration tests (Plan B) passing.

---

## Test Files

| File | Tests | Flow |
|------|-------|------|
| `tests/e2e/campaign-to-drift.test.ts` | 6 | Campaign → tracked links → clicks → CRM contributors → drift computation → verify 4-ring output |
| `tests/e2e/dashboard-lifecycle.test.ts` | 5 | Create dashboard → add widgets → save layout → share → public access → cleanup |
| `tests/e2e/identity-flow.test.ts` | 4 | Create tracked link → CRM signup → autoMatchContributors → verify identity chain |
| `tests/e2e/hie-flow.test.ts` | 4 | Register session → ingest clicks + scrolls → query heatmap → run diagnostics |

---

## Detailed Flow Descriptions

### campaign-to-drift.test.ts (6 tests)

The holy grail test — proves the full AudienceIQ attribution loop works.

```
Step 1: Create intake_request with target_regions=['Morocco','Egypt'], target_languages=['ar','fr']
Step 2: Create 3 tracked_links for the request (utm_campaign='test-morocco-campaign', different utm_sources)
Step 3: Update click_count on links (simulate recruiter sharing)
Step 4: Insert 5 CRM contributors matching the utm_campaign — 3 from Egypt (not Morocco!), 2 from Morocco, varied quality scores
Step 5: Call POST /api/audienceiq/drift/compute with the request_id
Step 6: Verify:
  - 4 profiles built (declared, paid, organic, converted)
  - Declared profile has regions=['Morocco','Egypt'], languages=['ar','fr']
  - Converted profile has regions=['Egypt','Morocco'] (Egypt dominant — 3 vs 2)
  - Drift snapshot exists with declared_vs_converted > 0 (region mismatch detected)
  - Health score reflects geo_mismatch issue
  - Recommendations mention the geographic drift
```

Tests:
1. Creates intake request with targeting data
2. Creates tracked links and simulates clicks
3. Inserts CRM contributors with deliberate mismatch
4. Drift compute builds all 4 profiles
5. Drift score detects the declared-vs-converted region gap
6. Health score includes geo_mismatch issue

### dashboard-lifecycle.test.ts (5 tests)

Full dashboard CRUD + sharing lifecycle.

```
Step 1: POST /api/insights → create dashboard
Step 2: PATCH with layout_data containing 3 widgets (kpi-cards, pipeline-overview, utm-funnel)
Step 3: POST /api/insights/[id]/share → enable sharing, get token
Step 4: GET /api/insights/public/[token] → verify layout_data returned without auth
Step 5: DELETE /api/insights/[id] → cleanup, verify 404 after
```

Tests:
1. Dashboard created with title
2. Layout updated with 3 widgets, layout persisted correctly
3. Sharing enabled, share_token returned
4. Public access works without auth, returns correct layout
5. Deletion works, subsequent GET returns 404

### identity-flow.test.ts (4 tests)

Anonymous → known identity resolution.

```
Step 1: Create intake_request + tracked_link (utm_campaign='test-identity-campaign')
Step 2: Insert CRM contributor with matching utm_campaign + email
Step 3: Call autoMatchContributors()
Step 4: Verify visitor_identities row exists with crm_user_id + email_hash + utm_slug
```

Tests:
1. Tracked link created for campaign
2. CRM contributor inserted with matching UTM
3. autoMatch creates visitor_identity record
4. Identity has correct crm_user_id, email_hash, and utm_slug from tracked_link

### hie-flow.test.ts (4 tests)

Full HIE session → data → query flow.

```
Step 1: POST /api/hie/session → register session with test session_id + visitor_id
Step 2: POST /api/hie/batch → ingest 10 click events + 5 scroll events for a test page_url
Step 3: GET /api/hie/heatmap?page_url=test → verify cells returned with click counts
Step 4: GET /api/hie/scrollmap?page_url=test → verify depth bands returned
```

Tests:
1. Session registered successfully (201)
2. Batch ingests 15 events (10 accepted clicks + 5 accepted scrolls)
3. Heatmap returns cells for the test page
4. Scrollmap returns depth bands for the test page

---

## Cleanup Pattern

Each e2e test file uses:
```typescript
afterAll(async () => {
  await cleanupTestData(); // from tests/integration/helpers.ts
});
```

This deletes all `test-*` prefixed rows from every table, ensuring no pollution between runs.

---

## Expected Run Time

| Tier | Tests | Estimated Duration |
|------|-------|--------------------|
| Unit | 81 | ~250ms |
| Integration | 80 | ~15s |
| E2E | 17 | ~8s |
| **Total** | **178** | **~24s** |

## NPM Script

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run tests/unit/",
    "test:integration": "vitest run tests/integration/",
    "test:e2e": "vitest run tests/e2e/",
    "test:watch": "vitest"
  }
}
```
