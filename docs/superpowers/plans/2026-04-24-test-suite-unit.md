# Test Suite Plan A: Unit Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 81 unit tests across 7 test files covering drift calculator, health scorer, profile builder, normalizer, HIE ingest, HIE diagnostics, identity stitching, and widget registry.

**Architecture:** All unit tests mock the DB layer (`vi.mock('@/lib/db')`). Tests verify pure logic — algorithm correctness, not SQL. Vitest with globals enabled, `@` path alias configured.

**Tech Stack:** Vitest 4.x, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-23-test-suite-design.md`

---

## File Structure

### New files:
```
tests/
├── setup.ts                              # Global setup (env vars)
├── helpers.ts                            # Test ID generator, mock factories
└── unit/
    ├── drift-calculator.test.ts          # 15 tests
    ├── health-scorer.test.ts             # 12 tests
    ├── profile-builder.test.ts           # 10 tests
    ├── normalizer.test.ts               # 8 tests
    ├── hie-ingest.test.ts               # 10 tests
    ├── hie-diagnostics.test.ts          # 12 tests
    ├── identity-stitching.test.ts       # 8 tests
    └── widget-registry.test.ts          # 6 tests
```

### Files to modify:
```
vitest.config.ts                          # Add setupFiles, testTimeout
```

---

## Task 1: Test Infrastructure (vitest config + helpers)

**Files:**
- Modify: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/helpers.ts`

- [ ] **Step 1: Update vitest config**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 2: Create test setup**

`tests/setup.ts`:
```typescript
// Load env for integration tests (unit tests mock everything)
import { config } from 'dotenv';
config({ path: '.env.local' });
```

- [ ] **Step 3: Create test helpers**

`tests/helpers.ts`:
```typescript
import crypto from 'crypto';
import type { AudienceProfileRow } from '@/lib/db/audienceiq';

export function testId(): string {
  return `test-${crypto.randomUUID().slice(0, 8)}`;
}

export function testEmail(prefix: string): string {
  return `${prefix}-${testId()}@test.nova.local`;
}

export function makeProfile(overrides: Partial<AudienceProfileRow> & { ring: string }): AudienceProfileRow {
  return {
    id: testId(),
    request_id: testId(),
    ring: overrides.ring,
    demographics: {},
    skills: {},
    languages: [],
    regions: [],
    sample_size: 10,
    confidence: 'medium',
    source: 'test',
    captured_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Creates a mock Neon tagged-template SQL function that returns pre-set results */
export function createMockSql() {
  const results: unknown[][] = [];
  const sql = ((_strings: TemplateStringsArray, ..._values: unknown[]) => {
    return results.shift() ?? [];
  }) as ReturnType<typeof import('@/lib/db').getDb>;
  (sql as unknown as { _pushResult: (rows: unknown[]) => void })._pushResult = (rows: unknown[]) => { results.push(rows); };
  return sql as typeof sql & { _pushResult: (rows: unknown[]) => void };
}
```

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/setup.ts tests/helpers.ts
git commit -m "test: add test infrastructure — vitest config, setup, helpers"
```

---

## Task 2: Drift Calculator Tests (15 tests)

**Files:**
- Create: `tests/unit/drift-calculator.test.ts`

Tests `computeDrift` from `src/lib/audienceiq/drift-calculator.ts`. Must mock `@/lib/db` and `@/lib/db/audienceiq` (specifically `insertDriftSnapshot`).

Key test scenarios:
1. Identical profiles → 0 drift, severity='low'
2. Completely different profiles → high drift, severity='high'
3. Partial overlap → moderate drift
4. Empty profiles (sample_size=0) → 0 drift (insufficient data)
5. Weights: paid_vs_converted has 0.30 weight (highest)
6. Severity thresholds: <=15 low, 15-25 moderate, >25 high
7. segment_mismatch true when drift > 15
8. Recommendations generated for high paid_vs_converted
9. All-null profiles → 0 drift
10. Mixed: some rings have data, others empty
11-15. Edge cases: single region overlap, empty skills, language overlap math

The mock for `insertDriftSnapshot` should be a no-op (vi.fn() returning `{ id: 'test' }`).

- [ ] **Step 1: Write all 15 tests**
- [ ] **Step 2: Run and verify all pass**: `pnpm vitest run tests/unit/drift-calculator.test.ts`
- [ ] **Step 3: Commit**

```bash
git add tests/unit/drift-calculator.test.ts
git commit -m "test: add 15 drift calculator unit tests"
```

---

## Task 3: Health Scorer Tests (12 tests)

**Files:**
- Create: `tests/unit/health-scorer.test.ts`

Tests `computeHealth` from `src/lib/audienceiq/health-scorer.ts`. Must mock `@/lib/db`, `@/lib/db/audienceiq` (insertHealthScore), and `@/lib/crm/client` (isCrmConnected).

Key test scenarios:
1. Healthy data → score=100, no issues
2. quality_drift: avg_quality < 50 → -30 (critical)
3. quality_drift: avg_quality 50-70 → -20 (warning)
4. retention_drift: active_pct < 50, sample >= 10 → -25
5. skill_mismatch: overlap < 30% → -25
6. geo_mismatch: region overlap < 30% → -20
7. high_drift: overall_drift > 25 → -15
8. paid_conversion_gap: paid_vs_converted > 30 → -15
9. small_sample: sample < 10 → info only, no deduction
10. CRM unavailable → info issue, no deduction
11. Multiple issues stack → score can hit 0 (clamped)
12. Each issue has correct fields (type, message, recommended_action, severity, deduction)

- [ ] **Step 1: Write all 12 tests**
- [ ] **Step 2: Run and verify**: `pnpm vitest run tests/unit/health-scorer.test.ts`
- [ ] **Step 3: Commit**

```bash
git add tests/unit/health-scorer.test.ts
git commit -m "test: add 12 health scorer unit tests"
```

---

## Task 4: Profile Builder Tests (10 tests)

**Files:**
- Create: `tests/unit/profile-builder.test.ts`

Tests `buildDeclaredProfile`, `buildConvertedProfile`, `buildPaidProfile`, `buildOrganicProfile` from `src/lib/audienceiq/profile-builder.ts`. Mock `@/lib/db`, `@/lib/crm/client`, `@/lib/db/audienceiq`.

Key scenarios:
1. buildDeclaredProfile extracts target_regions
2. buildDeclaredProfile extracts target_languages
3. buildDeclaredProfile extracts qualifications as skills
4. buildDeclaredProfile returns confidence='high', source='intake_form'
5. buildDeclaredProfile returns empty for missing request
6. buildConvertedProfile returns crm_unavailable when CRM disconnected
7. buildConvertedProfile aggregates countries from CRM data
8. buildConvertedProfile computes avg_quality and active_pct
9. buildConvertedProfile sets confidence by sample_size
10. buildPaidProfile returns platforms_unavailable when no platforms

- [ ] **Step 1: Write all 10 tests**
- [ ] **Step 2: Run and verify**: `pnpm vitest run tests/unit/profile-builder.test.ts`
- [ ] **Step 3: Commit**

```bash
git add tests/unit/profile-builder.test.ts
git commit -m "test: add 10 profile builder unit tests"
```

---

## Task 5: Normalizer Tests (8 tests)

**Files:**
- Create: `tests/unit/normalizer.test.ts`

Tests `getMergedPaidAudience` from `src/lib/platforms/normalizer.ts`. Mock all 4 platform clients.

Key scenarios:
1. No platforms connected → empty platforms_available
2. Merges impressions/clicks/conversions/spend
3. Merges region counts
4. Merges demographics age_ranges
5. Deduplicates interests
6. Single platform (only Google) → works correctly
7. All 4 platforms → full merge
8. Per_platform array has individual data

- [ ] **Step 1: Write all 8 tests**
- [ ] **Step 2: Run and verify**: `pnpm vitest run tests/unit/normalizer.test.ts`
- [ ] **Step 3: Commit**

```bash
git add tests/unit/normalizer.test.ts
git commit -m "test: add 8 normalizer unit tests"
```

---

## Task 6: HIE Ingest Tests (10 tests)

**Files:**
- Create: `tests/unit/hie-ingest.test.ts`

Tests `registerSession` and `ingestBatch` from `src/lib/hie/ingest.ts`. Mock `@/lib/db`.

Key scenarios:
1-2. registerSession rejects missing session_id / visitor_id
3-5. Device type derivation: mobile (<768), tablet (768-1023), desktop (>=1024)
6. ingestBatch routes scroll_depth to scroll table
7. ingestBatch routes click_interaction to interaction table
8. ingestBatch routes cta_click to interaction table
9. ingestBatch rejects unknown event_type
10. ingestBatch rejects missing session_id

- [ ] **Step 1: Write all 10 tests**
- [ ] **Step 2: Run and verify**: `pnpm vitest run tests/unit/hie-ingest.test.ts`
- [ ] **Step 3: Commit**

```bash
git add tests/unit/hie-ingest.test.ts
git commit -m "test: add 10 HIE ingest unit tests"
```

---

## Task 7: HIE Diagnostics Tests (12 tests)

**Files:**
- Create: `tests/unit/hie-diagnostics.test.ts`

Tests `runDiagnostics` from `src/lib/hie/diagnostics.ts`. Mock `@/lib/db`.

Key scenarios:
1. No data → empty observations
2. Scroll cliff: >30% drop → detected
3. Scroll cliff: <30% drop → not detected
4-6. Confidence: high (>=100), medium (30-99), low (<30)
7. CTA weakness: hovers > 10 + clicks = 0 → detected
8. Form friction: 100% abandonment → detected
9. Form friction: >70% abandonment → detected
10. Form friction: <70% → not detected
11. Platform mismatch: mobile < 40% of desktop → detected
12. Each observation has recommended_action

- [ ] **Step 1: Write all 12 tests**
- [ ] **Step 2: Run and verify**: `pnpm vitest run tests/unit/hie-diagnostics.test.ts`
- [ ] **Step 3: Commit**

```bash
git add tests/unit/hie-diagnostics.test.ts
git commit -m "test: add 12 HIE diagnostics unit tests"
```

---

## Task 8: Identity Stitching + Widget Registry Tests (14 tests)

**Files:**
- Create: `tests/unit/identity-stitching.test.ts`
- Create: `tests/unit/widget-registry.test.ts`

### Identity Stitching (8 tests)
Mock `@/lib/db` and `@/lib/db/audienceiq`.

1. Email hash is consistent SHA-256
2. Email hash normalizes lowercase + trim
3. stitchSignup creates identity with email_hash
4. stitchSignup passes utm_slug
5. autoMatchContributors matches CRM to tracked_links
6. autoMatchContributors skips already-matched
7. autoMatchContributors returns match count
8. autoMatchContributors handles 0 unmatched

### Widget Registry (6 tests)
NO mocking needed — tests the static registry object.

1. Registry has exactly 30 entries
2. Every WidgetType has a registry entry
3. Every entry has valid category
4. Every entry has non-empty label + description
5. defaultSize has w > 0 and h > 0
6. minSize <= defaultSize for all widgets

- [ ] **Step 1: Write identity stitching tests**
- [ ] **Step 2: Write widget registry tests**
- [ ] **Step 3: Run all**: `pnpm vitest run tests/unit/`
- [ ] **Step 4: Commit**

```bash
git add tests/unit/identity-stitching.test.ts tests/unit/widget-registry.test.ts
git commit -m "test: add 14 identity stitching + widget registry unit tests"
```

---

## Task 9: Run Full Unit Suite + Fix Issues

- [ ] **Step 1: Run entire unit test suite**

```bash
pnpm vitest run tests/unit/ --reporter=verbose
```

Expected: 81 tests, all passing.

- [ ] **Step 2: Fix any failures**

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "test: fix unit test issues — all 81 passing"
```
