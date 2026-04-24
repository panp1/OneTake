# Test Suite Plan B: Integration Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 80 integration tests across 8 files — hit real Neon DB, real API routes, verify SQL correctness, auth gates, recruiter scoping, and CRM graceful degradation.

**Architecture:** Tests use the real `DATABASE_URL` Neon connection. Test data created with `test-*` prefixed IDs, cleaned up in `afterAll`. API routes tested via direct function import (Next.js route handler pattern) or fetch against dev server.

**Tech Stack:** Vitest 4.x, Neon Postgres, Next.js 16 API routes

**Prerequisite:** Unit tests (Plan A) passing. `DATABASE_URL` set in `.env.local`.

---

## Test Files

| File | Tests | What |
|------|-------|------|
| `tests/integration/dashboard-crud.test.ts` | 12 | Create/get/update/delete/duplicate/share lifecycle |
| `tests/integration/insights-metrics.test.ts` | 10 | Pipeline, assets, clicks, UTM funnel, leaderboard endpoints |
| `tests/integration/audienceiq-apis.test.ts` | 14 | CRM sync/status/contributors, funnel, quality, identity |
| `tests/integration/drift-health-apis.test.ts` | 8 | Compute drift, get drift/health/profiles |
| `tests/integration/hie-apis.test.ts` | 10 | Session, batch, heatmap, scrollmap, diagnostics |
| `tests/integration/platform-apis.test.ts` | 8 | Sync-all, status, per-platform sync |
| `tests/integration/auth-gates.test.ts` | 10 | Admin-only rejection, public routes, recruiter scoping |
| `tests/integration/crm-degradation.test.ts` | 8 | Every CRM endpoint graceful fallback |

## DB Isolation Pattern

```typescript
// tests/integration/helpers.ts
import { getDb } from '@/lib/db';

const TEST_PREFIX = 'test-';

export async function cleanupTestData() {
  const sql = getDb();
  await sql`DELETE FROM dashboards WHERE title LIKE ${TEST_PREFIX + '%'}`;
  await sql`DELETE FROM intake_requests WHERE title LIKE ${TEST_PREFIX + '%'}`;
  await sql`DELETE FROM tracked_links WHERE slug LIKE ${TEST_PREFIX + '%'}`;
  await sql`DELETE FROM crm_sync_cache WHERE crm_user_id LIKE ${TEST_PREFIX + '%'}`;
  await sql`DELETE FROM visitor_identities WHERE email_hash LIKE ${TEST_PREFIX + '%'}`;
  await sql`DELETE FROM audience_profiles WHERE request_id IN (SELECT id FROM intake_requests WHERE title LIKE ${TEST_PREFIX + '%'})`;
  await sql`DELETE FROM audience_drift_snapshots WHERE request_id IN (SELECT id FROM intake_requests WHERE title LIKE ${TEST_PREFIX + '%'})`;
  await sql`DELETE FROM audience_health_scores WHERE request_id IN (SELECT id FROM intake_requests WHERE title LIKE ${TEST_PREFIX + '%'})`;
  await sql`DELETE FROM hie_sessions WHERE session_id LIKE ${TEST_PREFIX + '%'}`;
  await sql`DELETE FROM hie_interaction_events WHERE session_id LIKE ${TEST_PREFIX + '%'}`;
  await sql`DELETE FROM hie_scroll_events WHERE session_id LIKE ${TEST_PREFIX + '%'}`;
}

export async function seedIntakeRequest(overrides?: Record<string, unknown>): Promise<string> {
  const sql = getDb();
  const title = `${TEST_PREFIX}campaign-${Date.now()}`;
  const rows = await sql`
    INSERT INTO intake_requests (title, task_type, urgency, status, created_by, target_regions, target_languages)
    VALUES (${overrides?.title ?? title}, 'data_collection', ${overrides?.urgency ?? 'standard'}, ${overrides?.status ?? 'draft'}, ${overrides?.created_by ?? 'test-user'}, ${(overrides?.target_regions as string[]) ?? ['US', 'UK']}, ${(overrides?.target_languages as string[]) ?? ['en']})
    RETURNING id
  `;
  return (rows[0] as { id: string }).id;
}

export async function seedTrackedLink(requestId: string, overrides?: Record<string, unknown>): Promise<string> {
  const sql = getDb();
  const slug = `${TEST_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const rows = await sql`
    INSERT INTO tracked_links (slug, request_id, recruiter_clerk_id, destination_url, base_url, utm_campaign, utm_source, utm_medium, utm_term, utm_content, click_count)
    VALUES (${slug}, ${requestId}, ${overrides?.recruiter_clerk_id ?? 'test-recruiter'}, 'https://example.com', 'https://example.com', ${overrides?.utm_campaign ?? 'test-campaign'}, ${overrides?.utm_source ?? 'linkedin'}, 'social', 'recruiter', 'test', ${overrides?.click_count ?? 5})
    RETURNING id
  `;
  return (rows[0] as { id: string }).id;
}

export async function seedCrmContributor(overrides?: Record<string, unknown>): Promise<string> {
  const sql = getDb();
  const crmId = `${TEST_PREFIX}crm-${Date.now()}`;
  const rows = await sql`
    INSERT INTO crm_sync_cache (crm_user_id, email, country, languages, skills, quality_score, activity_status, utm_source, utm_medium, utm_campaign)
    VALUES (${overrides?.crm_user_id ?? crmId}, ${overrides?.email ?? `${crmId}@test.local`}, ${overrides?.country ?? 'US'}, ${(overrides?.languages as string[]) ?? ['en']}, ${JSON.stringify(overrides?.skills ?? { annotation: true })}, ${overrides?.quality_score ?? 85}, ${overrides?.activity_status ?? 'active'}, ${overrides?.utm_source ?? 'linkedin'}, 'social', ${overrides?.utm_campaign ?? 'test-campaign'})
    RETURNING id
  `;
  return (rows[0] as { id: string }).id;
}
```

## Auth Mocking

For integration tests that call API route handlers directly, mock Clerk auth:
```typescript
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'test-admin' })),
  currentUser: vi.fn(async () => ({ emailAddresses: [{ emailAddress: 'admin@test.local' }] })),
}));

vi.mock('@/lib/db/user-roles', () => ({
  getUserRole: vi.fn(async () => ({ role: 'admin' })),
}));
```

For recruiter-role tests, change the mock return value per test.

---

## Detailed Test Descriptions

### dashboard-crud.test.ts (12 tests)
1. POST /api/insights creates dashboard → 201 + valid JSON
2. GET /api/insights lists dashboards including the new one
3. GET /api/insights/[id] returns the specific dashboard
4. PATCH /api/insights/[id] updates title → new title persisted
5. PATCH /api/insights/[id] updates layout_data with widgets
6. POST /api/insights/[id]/duplicate → new dashboard with '(copy)'
7. DELETE /api/insights/[id] → 200
8. GET after DELETE → 404
9. POST /api/insights/[id]/share → is_shared=true + share_token
10. POST share again → is_shared=false + token null
11. PATCH /api/insights/[id]/share with password → password_hash set
12. GET /api/insights/public/[token] → returns layout_data

### insights-metrics.test.ts (10 tests)
Seed intake_requests + tracked_links + generated_assets, then query each metric endpoint and verify counts/aggregations match seeded data.

### audienceiq-apis.test.ts (14 tests)
Seed CRM contributors + tracked_links, test funnel computation, quality aggregation, identity stitching, and CRM status.

### drift-health-apis.test.ts (8 tests)
Seed campaign + CRM data, trigger drift compute, verify profiles/drift/health are stored and retrievable.

### hie-apis.test.ts (10 tests)
Register session, ingest click+scroll events, query heatmap+scrollmap, run diagnostics.

### platform-apis.test.ts (8 tests)
Verify all 4 platform status endpoints return connected=false, sync endpoints return wired stub messages.

### auth-gates.test.ts (10 tests)
Test that admin-only routes reject non-admin, public routes work unauthenticated, recruiter scoping filters correctly.

### crm-degradation.test.ts (8 tests)
With CRM mocked as disconnected, verify every CRM-dependent endpoint returns graceful fallback.
