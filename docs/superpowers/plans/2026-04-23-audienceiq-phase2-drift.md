# AudienceIQ Phase 2: Drift Engine + Health Scoring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four-ring audience drift calculator and recruitment health scorer — the core AudienceIQ intelligence that detects the gap between who you're targeting and who you're actually closing.

**Architecture:** Profile builders extract audience snapshots from each ring (declared from intake form, converted from CRM cache). Drift calculator compares profiles pairwise with weighted scoring (paid_vs_converted gets 30% — highest weight). Health scorer starts at 100 and deducts for recruitment-specific issues (quality drift, retention drift, skill mismatch, geo mismatch). Results stored in Neon tables, surfaced via 2 new Insights widgets.

**Tech Stack:** Next.js 16 App Router, Neon Postgres, Recharts, Tailwind CSS 4, Lucide React

**Spec:** `docs/superpowers/specs/2026-04-23-audienceiq-design.md`

---

## File Structure

### New files:
```
src/
├── lib/
│   └── audienceiq/
│       ├── profile-builder.ts          # Build audience profiles from each ring
│       ├── drift-calculator.ts         # Four-ring drift comparison engine
│       └── health-scorer.ts            # Recruitment health scoring (100-point system)
├── components/
│   └── insights/
│       └── widgets/
│           ├── DriftRadarWidget.tsx     # Four-ring drift visualization
│           └── AudienceHealthWidget.tsx # Circular gauge + issue list
└── app/
    └── api/audienceiq/
        ├── drift/
        │   ├── [requestId]/route.ts    # GET drift snapshot
        │   └── compute/route.ts        # POST compute drift for campaign
        ├── health/
        │   └── [requestId]/route.ts    # GET health score
        └── profiles/
            └── [requestId]/route.ts    # GET all ring profiles
```

### Files to modify:
```
src/lib/db/schema.ts                     # Add 3 tables
src/lib/db/audienceiq.ts                 # Add drift/health/profile queries
src/components/insights/types.ts         # Add 2 new WidgetTypes
src/components/insights/widgetRegistry.ts # Register 2 new widgets
```

---

## Task 1: DB Migration — 3 New Tables

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add audience_profiles, audience_drift_snapshots, audience_health_scores tables**

Add after the `visitor_identities` table in `schema.ts`:

```typescript
  // 20. audience_profiles — unified audience profile per campaign per ring
  await sql`
    CREATE TABLE IF NOT EXISTS audience_profiles (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      ring            TEXT NOT NULL CHECK (ring IN ('declared', 'paid', 'organic', 'converted')),
      demographics    JSONB NOT NULL DEFAULT '{}',
      skills          JSONB NOT NULL DEFAULT '{}',
      languages       TEXT[] NOT NULL DEFAULT '{}',
      regions         TEXT[] NOT NULL DEFAULT '{}',
      sample_size     INT NOT NULL DEFAULT 0,
      confidence      TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
      source          TEXT NOT NULL,
      captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(request_id, ring)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_audience_profiles_request ON audience_profiles(request_id)`;

  // 21. audience_drift_snapshots — point-in-time drift calculations
  await sql`
    CREATE TABLE IF NOT EXISTS audience_drift_snapshots (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id            UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      declared_vs_paid      FLOAT NOT NULL DEFAULT 0,
      declared_vs_organic   FLOAT NOT NULL DEFAULT 0,
      paid_vs_converted     FLOAT NOT NULL DEFAULT 0,
      organic_vs_converted  FLOAT NOT NULL DEFAULT 0,
      overall_drift         FLOAT NOT NULL DEFAULT 0,
      severity              TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'moderate', 'high')),
      segment_mismatch      BOOLEAN NOT NULL DEFAULT FALSE,
      evidence              JSONB NOT NULL DEFAULT '{}',
      recommendations       TEXT[] NOT NULL DEFAULT '{}',
      computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_drift_snapshots_request ON audience_drift_snapshots(request_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_drift_snapshots_computed ON audience_drift_snapshots(computed_at DESC)`;

  // 22. audience_health_scores — per-campaign health with issues
  await sql`
    CREATE TABLE IF NOT EXISTS audience_health_scores (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id      UUID NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
      score           INT NOT NULL DEFAULT 100,
      issues          JSONB NOT NULL DEFAULT '[]',
      computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_health_scores_request ON audience_health_scores(request_id)`;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(audienceiq): add audience_profiles, drift_snapshots, health_scores tables"
```

---

## Task 2: Drift/Health DB Queries

**Files:**
- Modify: `src/lib/db/audienceiq.ts`

- [ ] **Step 1: Add profile, drift, and health query functions**

Append to the existing `src/lib/db/audienceiq.ts`:

```typescript
// ── Audience Profiles ──────────────────────────────────────────────────────

export interface AudienceProfileRow {
  id: string;
  request_id: string;
  ring: string;
  demographics: Record<string, unknown>;
  skills: Record<string, unknown>;
  languages: string[];
  regions: string[];
  sample_size: number;
  confidence: string;
  source: string;
  captured_at: string;
}

export async function upsertProfile(profile: Omit<AudienceProfileRow, 'id' | 'captured_at'>): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO audience_profiles (request_id, ring, demographics, skills, languages, regions, sample_size, confidence, source)
    VALUES (${profile.request_id}, ${profile.ring}, ${JSON.stringify(profile.demographics)}, ${JSON.stringify(profile.skills)}, ${profile.languages}, ${profile.regions}, ${profile.sample_size}, ${profile.confidence}, ${profile.source})
    ON CONFLICT (request_id, ring) DO UPDATE SET
      demographics = EXCLUDED.demographics,
      skills = EXCLUDED.skills,
      languages = EXCLUDED.languages,
      regions = EXCLUDED.regions,
      sample_size = EXCLUDED.sample_size,
      confidence = EXCLUDED.confidence,
      source = EXCLUDED.source,
      captured_at = NOW()
  `;
}

export async function getProfiles(requestId: string): Promise<AudienceProfileRow[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM audience_profiles WHERE request_id = ${requestId} ORDER BY ring`;
  return rows as AudienceProfileRow[];
}

// ── Drift Snapshots ────────────────────────────────────────────────────────

export async function insertDriftSnapshot(snapshot: {
  request_id: string;
  declared_vs_paid: number;
  declared_vs_organic: number;
  paid_vs_converted: number;
  organic_vs_converted: number;
  overall_drift: number;
  severity: string;
  segment_mismatch: boolean;
  evidence: Record<string, unknown>;
  recommendations: string[];
}): Promise<{ id: string }> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO audience_drift_snapshots (request_id, declared_vs_paid, declared_vs_organic, paid_vs_converted, organic_vs_converted, overall_drift, severity, segment_mismatch, evidence, recommendations)
    VALUES (${snapshot.request_id}, ${snapshot.declared_vs_paid}, ${snapshot.declared_vs_organic}, ${snapshot.paid_vs_converted}, ${snapshot.organic_vs_converted}, ${snapshot.overall_drift}, ${snapshot.severity}, ${snapshot.segment_mismatch}, ${JSON.stringify(snapshot.evidence)}, ${snapshot.recommendations})
    RETURNING id
  `;
  return { id: (rows[0] as { id: string }).id };
}

export async function getLatestDrift(requestId: string): Promise<Record<string, unknown> | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM audience_drift_snapshots WHERE request_id = ${requestId} ORDER BY computed_at DESC LIMIT 1
  `;
  return (rows[0] as Record<string, unknown>) ?? null;
}

// ── Health Scores ──────────────────────────────────────────────────────────

export async function insertHealthScore(score: {
  request_id: string;
  score: number;
  issues: { type: string; message: string; recommended_action: string; severity: string; deduction: number }[];
}): Promise<{ id: string }> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO audience_health_scores (request_id, score, issues)
    VALUES (${score.request_id}, ${score.score}, ${JSON.stringify(score.issues)})
    RETURNING id
  `;
  return { id: (rows[0] as { id: string }).id };
}

export async function getLatestHealth(requestId: string): Promise<Record<string, unknown> | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM audience_health_scores WHERE request_id = ${requestId} ORDER BY computed_at DESC LIMIT 1
  `;
  return (rows[0] as Record<string, unknown>) ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/audienceiq.ts
git commit -m "feat(audienceiq): add profile, drift, health DB queries"
```

---

## Task 3: Profile Builder Service

**Files:**
- Create: `src/lib/audienceiq/profile-builder.ts`

- [ ] **Step 1: Create the profile builder**

Builds audience profiles from Ring 1 (declared — intake form) and Ring 4 (converted — CRM cache). Rings 2 and 3 return empty profiles with 'unavailable' source until GA4/platform integrations are built (Phases 3 and 5).

```typescript
/**
 * Profile Builder — extracts audience profiles from each data ring.
 *
 * Ring 1 (declared): intake_requests form data
 * Ring 2 (paid): placeholder — requires ad platform APIs (Phase 5)
 * Ring 3 (organic): placeholder — requires GA4 integration (Phase 3)
 * Ring 4 (converted): crm_sync_cache contributor data
 */

import { getDb } from '@/lib/db';
import { upsertProfile, type AudienceProfileRow } from '@/lib/db/audienceiq';
import { isCrmConnected } from '@/lib/crm/client';

type ProfileData = Omit<AudienceProfileRow, 'id' | 'captured_at'>;

export async function buildDeclaredProfile(requestId: string): Promise<ProfileData> {
  const sql = getDb();
  const rows = await sql`
    SELECT target_regions, target_languages, qualifications_required, qualifications_preferred,
           location_scope, engagement_model, form_data
    FROM intake_requests WHERE id = ${requestId}
  `;

  const req = rows[0] as Record<string, unknown> | undefined;
  if (!req) {
    return {
      request_id: requestId,
      ring: 'declared',
      demographics: {},
      skills: {},
      languages: [],
      regions: [],
      sample_size: 0,
      confidence: 'low',
      source: 'intake_form',
    };
  }

  const skills: Record<string, unknown> = {};
  if (req.qualifications_required) skills.required = req.qualifications_required;
  if (req.qualifications_preferred) skills.preferred = req.qualifications_preferred;

  const demographics: Record<string, unknown> = {};
  if (req.location_scope) demographics.location_scope = req.location_scope;
  if (req.engagement_model) demographics.engagement_model = req.engagement_model;

  return {
    request_id: requestId,
    ring: 'declared',
    demographics,
    skills,
    languages: (req.target_languages as string[]) ?? [],
    regions: (req.target_regions as string[]) ?? [],
    sample_size: 1,
    confidence: 'high',
    source: 'intake_form',
  };
}

export async function buildConvertedProfile(requestId: string): Promise<ProfileData> {
  if (!isCrmConnected()) {
    return {
      request_id: requestId,
      ring: 'converted',
      demographics: {},
      skills: {},
      languages: [],
      regions: [],
      sample_size: 0,
      confidence: 'low',
      source: 'crm_unavailable',
    };
  }

  const sql = getDb();

  // Find campaigns linked to this request
  const campaignRows = await sql`
    SELECT DISTINCT utm_campaign FROM tracked_links WHERE request_id = ${requestId}
  `;
  const campaigns = campaignRows.map((r: Record<string, unknown>) => (r as { utm_campaign: string }).utm_campaign);

  if (campaigns.length === 0) {
    return {
      request_id: requestId,
      ring: 'converted',
      demographics: {},
      skills: {},
      languages: [],
      regions: [],
      sample_size: 0,
      confidence: 'low',
      source: 'crm',
    };
  }

  // Aggregate CRM data for these campaigns
  const contributors = await sql`
    SELECT country, languages, skills, quality_score, activity_status
    FROM crm_sync_cache WHERE utm_campaign = ANY(${campaigns})
  `;

  const regionCounts: Record<string, number> = {};
  const langCounts: Record<string, number> = {};
  const skillCounts: Record<string, number> = {};
  let totalQuality = 0;
  let qualityCount = 0;
  let activeCount = 0;

  for (const row of contributors) {
    const c = row as { country: string | null; languages: string[]; skills: Record<string, unknown>; quality_score: number | null; activity_status: string };
    if (c.country) regionCounts[c.country] = (regionCounts[c.country] ?? 0) + 1;
    for (const lang of c.languages ?? []) langCounts[lang] = (langCounts[lang] ?? 0) + 1;
    if (c.skills && typeof c.skills === 'object') {
      for (const skill of Object.keys(c.skills)) skillCounts[skill] = (skillCounts[skill] ?? 0) + 1;
    }
    if (c.quality_score != null) { totalQuality += c.quality_score; qualityCount++; }
    if (c.activity_status === 'active') activeCount++;
  }

  const sampleSize = contributors.length;
  const confidence = sampleSize >= 50 ? 'high' : sampleSize >= 10 ? 'medium' : 'low';

  return {
    request_id: requestId,
    ring: 'converted',
    demographics: {
      geo_distribution: regionCounts,
      avg_quality_score: qualityCount > 0 ? Math.round((totalQuality / qualityCount) * 10) / 10 : null,
      active_pct: sampleSize > 0 ? Math.round((activeCount / sampleSize) * 100) : 0,
    },
    skills: skillCounts,
    languages: Object.entries(langCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k),
    regions: Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).map(([k]) => k),
    sample_size: sampleSize,
    confidence,
    source: 'crm',
  };
}

export async function buildPaidProfile(requestId: string): Promise<ProfileData> {
  // Phase 5: will pull from ad platform APIs
  return {
    request_id: requestId,
    ring: 'paid',
    demographics: {},
    skills: {},
    languages: [],
    regions: [],
    sample_size: 0,
    confidence: 'low',
    source: 'unavailable',
  };
}

export async function buildOrganicProfile(requestId: string): Promise<ProfileData> {
  // Phase 3: will pull from GA4 session data
  return {
    request_id: requestId,
    ring: 'organic',
    demographics: {},
    skills: {},
    languages: [],
    regions: [],
    sample_size: 0,
    confidence: 'low',
    source: 'unavailable',
  };
}

export async function buildAndStoreAllProfiles(requestId: string): Promise<ProfileData[]> {
  const profiles = await Promise.all([
    buildDeclaredProfile(requestId),
    buildPaidProfile(requestId),
    buildOrganicProfile(requestId),
    buildConvertedProfile(requestId),
  ]);

  for (const profile of profiles) {
    await upsertProfile(profile);
  }

  return profiles;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/audienceiq/profile-builder.ts
git commit -m "feat(audienceiq): add profile builder — declared + converted ring extraction"
```

---

## Task 4: Drift Calculator

**Files:**
- Create: `src/lib/audienceiq/drift-calculator.ts`

- [ ] **Step 1: Create drift calculator**

Adapted from VYRA's `detect_drift()` in `audience_engine.py`. Four-way comparison with weighted overall drift.

```typescript
/**
 * Drift Calculator — four-ring audience drift detection.
 *
 * Compares audience profiles pairwise and computes weighted overall drift.
 * Adapted from VYRA's detect_drift() with a 4th ring (converted/CRM).
 */

import type { AudienceProfileRow } from '@/lib/db/audienceiq';
import { insertDriftSnapshot } from '@/lib/db/audienceiq';

interface DriftResult {
  declared_vs_paid: number;
  declared_vs_organic: number;
  paid_vs_converted: number;
  organic_vs_converted: number;
  overall_drift: number;
  severity: 'low' | 'moderate' | 'high';
  segment_mismatch: boolean;
  evidence: Record<string, unknown>;
  recommendations: string[];
}

// Weights for overall drift (sum = 1.0)
const WEIGHTS = {
  declared_vs_paid: 0.25,
  declared_vs_organic: 0.20,
  paid_vs_converted: 0.30,
  organic_vs_converted: 0.25,
};

function compareRegions(a: string[], b: string[]): { overlap_pct: number; only_a: string[]; only_b: string[] } {
  const setA = new Set(a);
  const setB = new Set(b);
  const overlap = a.filter(r => setB.has(r));
  const union = new Set([...a, ...b]);
  return {
    overlap_pct: union.size > 0 ? Math.round((overlap.length / union.size) * 100) : 100,
    only_a: a.filter(r => !setB.has(r)),
    only_b: b.filter(r => !setA.has(r)),
  };
}

function compareLanguages(a: string[], b: string[]): { overlap_pct: number } {
  const setA = new Set(a);
  const setB = new Set(b);
  const overlap = a.filter(l => setB.has(l));
  const union = new Set([...a, ...b]);
  return { overlap_pct: union.size > 0 ? Math.round((overlap.length / union.size) * 100) : 100 };
}

function compareSkills(a: Record<string, unknown>, b: Record<string, unknown>): { overlap_pct: number } {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  const setA = new Set(keysA);
  const overlap = keysB.filter(k => setA.has(k));
  const union = new Set([...keysA, ...keysB]);
  return { overlap_pct: union.size > 0 ? Math.round((overlap.length / union.size) * 100) : 100 };
}

function computePairwiseDrift(profileA: AudienceProfileRow | null, profileB: AudienceProfileRow | null): {
  drift: number;
  evidence: Record<string, unknown>;
} {
  // If either profile is unavailable or empty, return 0 drift (no data to compare)
  if (!profileA || !profileB || profileA.sample_size === 0 || profileB.sample_size === 0) {
    return { drift: 0, evidence: { reason: 'insufficient_data' } };
  }

  const regionComp = compareRegions(profileA.regions, profileB.regions);
  const langComp = compareLanguages(profileA.languages, profileB.languages);
  const skillComp = compareSkills(profileA.skills, profileB.skills);

  // Drift = 100 - average overlap
  const avgOverlap = (regionComp.overlap_pct + langComp.overlap_pct + skillComp.overlap_pct) / 3;
  const drift = Math.round((100 - avgOverlap) * 10) / 10;

  return {
    drift: Math.max(0, Math.min(100, drift)),
    evidence: {
      region_overlap_pct: regionComp.overlap_pct,
      language_overlap_pct: langComp.overlap_pct,
      skill_overlap_pct: skillComp.overlap_pct,
      regions_only_a: regionComp.only_a,
      regions_only_b: regionComp.only_b,
    },
  };
}

function generateRecommendations(result: DriftResult, profiles: Record<string, AudienceProfileRow | null>): string[] {
  const recs: string[] = [];

  if (result.paid_vs_converted > 25) {
    recs.push('High drift between paid audience and actual converters — consider building lookalike audiences from your top CRM contributors instead of interest-based targeting.');
  }
  if (result.declared_vs_paid > 20) {
    recs.push('Your ad targeting does not match your declared ICP — review audience settings in your ad platforms.');
  }
  if (result.organic_vs_converted > 20) {
    recs.push('Organic visitors differ significantly from your quality contributors — your content may be attracting the wrong audience.');
  }

  const converted = profiles['converted'];
  if (converted && converted.sample_size > 0) {
    const demo = converted.demographics as Record<string, unknown>;
    const avgQuality = demo.avg_quality_score as number | null;
    if (avgQuality != null && avgQuality < 70) {
      recs.push(`Average contributor quality score is ${avgQuality} — below the 70 threshold. Review targeting and qualification criteria.`);
    }
  }

  if (recs.length === 0) {
    recs.push('Audience drift is within acceptable range. Continue monitoring.');
  }

  return recs;
}

export async function computeDrift(requestId: string, profiles: AudienceProfileRow[]): Promise<DriftResult> {
  const profileMap: Record<string, AudienceProfileRow | null> = {
    declared: profiles.find(p => p.ring === 'declared') ?? null,
    paid: profiles.find(p => p.ring === 'paid') ?? null,
    organic: profiles.find(p => p.ring === 'organic') ?? null,
    converted: profiles.find(p => p.ring === 'converted') ?? null,
  };

  const dvp = computePairwiseDrift(profileMap.declared, profileMap.paid);
  const dvo = computePairwiseDrift(profileMap.declared, profileMap.organic);
  const pvc = computePairwiseDrift(profileMap.paid, profileMap.converted);
  const ovc = computePairwiseDrift(profileMap.organic, profileMap.converted);

  const overallDrift = Math.round(
    (dvp.drift * WEIGHTS.declared_vs_paid +
     dvo.drift * WEIGHTS.declared_vs_organic +
     pvc.drift * WEIGHTS.paid_vs_converted +
     ovc.drift * WEIGHTS.organic_vs_converted) * 10
  ) / 10;

  const severity: 'low' | 'moderate' | 'high' =
    overallDrift > 25 ? 'high' : overallDrift > 15 ? 'moderate' : 'low';

  const result: DriftResult = {
    declared_vs_paid: dvp.drift,
    declared_vs_organic: dvo.drift,
    paid_vs_converted: pvc.drift,
    organic_vs_converted: ovc.drift,
    overall_drift: overallDrift,
    severity,
    segment_mismatch: overallDrift > 15,
    evidence: {
      declared_vs_paid: dvp.evidence,
      declared_vs_organic: dvo.evidence,
      paid_vs_converted: pvc.evidence,
      organic_vs_converted: ovc.evidence,
    },
    recommendations: [],
  };

  result.recommendations = generateRecommendations(result, profileMap);

  // Persist
  await insertDriftSnapshot({
    request_id: requestId,
    ...result,
  });

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/audienceiq/drift-calculator.ts
git commit -m "feat(audienceiq): add four-ring drift calculator"
```

---

## Task 5: Health Scorer

**Files:**
- Create: `src/lib/audienceiq/health-scorer.ts`

- [ ] **Step 1: Create health scorer**

Recruitment-adapted from VYRA's `score_audience_health()`. Starts at 100, deducts for issues.

```typescript
/**
 * Health Scorer — recruitment-adapted audience health scoring.
 *
 * Starts at 100, deducts for detected issues.
 * Adapted from VYRA's score_audience_health() with recruitment-specific detectors.
 */

import type { AudienceProfileRow } from '@/lib/db/audienceiq';
import { insertHealthScore } from '@/lib/db/audienceiq';
import { isCrmConnected } from '@/lib/crm/client';
import { getDb } from '@/lib/db';

interface HealthIssue {
  type: string;
  message: string;
  recommended_action: string;
  severity: 'critical' | 'warning' | 'info';
  deduction: number;
}

interface HealthResult {
  score: number;
  issues: HealthIssue[];
}

export async function computeHealth(
  requestId: string,
  profiles: AudienceProfileRow[],
  driftData?: { overall_drift: number; paid_vs_converted: number },
): Promise<HealthResult> {
  const issues: HealthIssue[] = [];
  let score = 100;

  const declared = profiles.find(p => p.ring === 'declared');
  const converted = profiles.find(p => p.ring === 'converted');

  // ── CRM-based detectors (only if CRM connected + data available) ──

  if (isCrmConnected() && converted && converted.sample_size > 0) {
    const demo = converted.demographics as Record<string, unknown>;
    const avgQuality = demo.avg_quality_score as number | null;
    const activePct = demo.active_pct as number | null;

    // Quality drift: avg quality below threshold
    if (avgQuality != null && avgQuality < 70) {
      const deduction = avgQuality < 50 ? 30 : 20;
      issues.push({
        type: 'quality_drift',
        message: `Average contributor quality score is ${avgQuality} (below 70 threshold)`,
        recommended_action: 'Review targeting criteria — current campaigns may attract under-qualified contributors',
        severity: avgQuality < 50 ? 'critical' : 'warning',
        deduction,
      });
      score -= deduction;
    }

    // Retention drift: low active percentage
    if (activePct != null && activePct < 50 && converted.sample_size >= 10) {
      issues.push({
        type: 'retention_drift',
        message: `Only ${activePct}% of campaign contributors are still active`,
        recommended_action: 'Investigate onboarding flow — high churn suggests mismatch between ad promise and actual work',
        severity: activePct < 30 ? 'critical' : 'warning',
        deduction: 25,
      });
      score -= 25;
    }

    // Skill mismatch: declared vs converted skills have low overlap
    if (declared && Object.keys(declared.skills).length > 0 && Object.keys(converted.skills).length > 0) {
      const declaredKeys = new Set(Object.keys(declared.skills));
      const convertedKeys = Object.keys(converted.skills);
      const overlap = convertedKeys.filter(k => declaredKeys.has(k));
      const overlapPct = convertedKeys.length > 0 ? Math.round((overlap.length / convertedKeys.length) * 100) : 100;

      if (overlapPct < 30) {
        issues.push({
          type: 'skill_mismatch',
          message: `Only ${overlapPct}% skill overlap between declared requirements and actual contributors`,
          recommended_action: 'Update targeting — you are closing contributors with different skills than specified',
          severity: 'warning',
          deduction: 25,
        });
        score -= 25;
      }
    }

    // Geo mismatch: declared vs converted regions have low overlap
    if (declared && declared.regions.length > 0 && converted.regions.length > 0) {
      const declaredSet = new Set(declared.regions);
      const overlap = converted.regions.filter(r => declaredSet.has(r));
      const overlapPct = Math.round((overlap.length / Math.max(declared.regions.length, converted.regions.length)) * 100);

      if (overlapPct < 30) {
        issues.push({
          type: 'geo_mismatch',
          message: `Low geographic overlap (${overlapPct}%) between targeted and actual contributor regions`,
          recommended_action: `Top actual regions: ${converted.regions.slice(0, 3).join(', ')}. Consider adjusting targeting.`,
          severity: 'warning',
          deduction: 20,
        });
        score -= 20;
      }
    }
  } else if (!isCrmConnected()) {
    issues.push({
      type: 'crm_unavailable',
      message: 'CRM not connected — quality, retention, and skill analysis unavailable',
      recommended_action: 'Set CRM_DATABASE_URL to enable full health scoring',
      severity: 'info',
      deduction: 0,
    });
  }

  // ── Drift-based detectors ──

  if (driftData) {
    if (driftData.overall_drift > 25) {
      issues.push({
        type: 'high_drift',
        message: `Overall audience drift is ${driftData.overall_drift}% (HIGH)`,
        recommended_action: 'Significant mismatch between targeting and results — review all campaign audience settings',
        severity: 'critical',
        deduction: 15,
      });
      score -= 15;
    }

    if (driftData.paid_vs_converted > 30) {
      issues.push({
        type: 'paid_conversion_gap',
        message: `${driftData.paid_vs_converted}% drift between paid audience and actual converters`,
        recommended_action: 'Build CRM-matched lookalike audiences instead of interest-based targeting',
        severity: 'warning',
        deduction: 15,
      });
      score -= 15;
    }
  }

  // ── Sample size warning ──

  if (converted && converted.sample_size < 10 && converted.sample_size > 0) {
    issues.push({
      type: 'small_sample',
      message: `Only ${converted.sample_size} contributors in CRM for this campaign — results may not be representative`,
      recommended_action: 'Wait for more data before making targeting changes',
      severity: 'info',
      deduction: 0,
    });
  }

  score = Math.max(0, score);

  // Persist
  await insertHealthScore({
    request_id: requestId,
    score,
    issues,
  });

  return { score, issues };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/audienceiq/health-scorer.ts
git commit -m "feat(audienceiq): add recruitment health scorer — 100-point system with 7 detectors"
```

---

## Task 6: API Routes — Drift, Health, Profiles

**Files:**
- Create: `src/app/api/audienceiq/drift/[requestId]/route.ts`
- Create: `src/app/api/audienceiq/drift/compute/route.ts`
- Create: `src/app/api/audienceiq/health/[requestId]/route.ts`
- Create: `src/app/api/audienceiq/profiles/[requestId]/route.ts`

- [ ] **Step 1: GET drift snapshot**

File: `src/app/api/audienceiq/drift/[requestId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLatestDrift } from '@/lib/db/audienceiq';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  await requireAuth();
  const { requestId } = await params;
  const drift = await getLatestDrift(requestId);
  if (!drift) return NextResponse.json({ computed: false, message: 'No drift data yet. Trigger computation first.' });
  return NextResponse.json({ computed: true, ...drift });
}
```

- [ ] **Step 2: POST compute drift**

File: `src/app/api/audienceiq/drift/compute/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { buildAndStoreAllProfiles } from '@/lib/audienceiq/profile-builder';
import { computeDrift } from '@/lib/audienceiq/drift-calculator';
import { computeHealth } from '@/lib/audienceiq/health-scorer';
import { getProfiles } from '@/lib/db/audienceiq';

export async function POST(req: NextRequest) {
  await requireRole(['admin']);
  const body = await req.json();
  const requestId = body.request_id;

  if (!requestId) return NextResponse.json({ error: 'request_id required' }, { status: 400 });

  // Step 1: Build all profiles
  await buildAndStoreAllProfiles(requestId);

  // Step 2: Get stored profiles
  const profiles = await getProfiles(requestId);

  // Step 3: Compute drift
  const driftResult = await computeDrift(requestId, profiles);

  // Step 4: Compute health
  const healthResult = await computeHealth(requestId, profiles, {
    overall_drift: driftResult.overall_drift,
    paid_vs_converted: driftResult.paid_vs_converted,
  });

  return NextResponse.json({
    drift: driftResult,
    health: healthResult,
    profiles_built: profiles.length,
  });
}
```

- [ ] **Step 3: GET health score**

File: `src/app/api/audienceiq/health/[requestId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLatestHealth } from '@/lib/db/audienceiq';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  await requireAuth();
  const { requestId } = await params;
  const health = await getLatestHealth(requestId);
  if (!health) return NextResponse.json({ computed: false, message: 'No health data yet. Trigger drift computation first.' });
  return NextResponse.json({ computed: true, ...health });
}
```

- [ ] **Step 4: GET profiles**

File: `src/app/api/audienceiq/profiles/[requestId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfiles } from '@/lib/db/audienceiq';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  await requireAuth();
  const { requestId } = await params;
  const profiles = await getProfiles(requestId);
  return NextResponse.json({ profiles });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/audienceiq/drift/ src/app/api/audienceiq/health/ src/app/api/audienceiq/profiles/
git commit -m "feat(audienceiq): add drift, health, profiles API routes"
```

---

## Task 7: Widget Registry + Types Update

**Files:**
- Modify: `src/components/insights/types.ts`
- Modify: `src/components/insights/widgetRegistry.ts`

- [ ] **Step 1: Add 2 new widget types**

In `types.ts`, add to the `WidgetType` union after `'targeting-vs-reality'`:

```typescript
  | 'drift-radar'
  | 'audience-health'
```

- [ ] **Step 2: Add 2 new widget entries to registry**

In `widgetRegistry.ts`, add imports: `Radar, HeartPulse` to lucide-react import.

Add to `WIDGET_REGISTRY` in the AudienceIQ section:

```typescript
  'drift-radar': {
    component: lazy(() => import('./widgets/DriftRadarWidget')),
    category: 'audienceiq', label: 'Drift Radar', icon: Radar,
    description: 'Four-ring audience drift visualization with severity indicators',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
  },
  'audience-health': {
    component: lazy(() => import('./widgets/AudienceHealthWidget')),
    category: 'audienceiq', label: 'Audience Health', icon: HeartPulse,
    description: 'Health score gauge (0-100) with actionable issue detection',
    defaultSize: { w: 6, h: 5 }, minSize: { w: 4, h: 4 },
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/components/insights/types.ts src/components/insights/widgetRegistry.ts
git commit -m "feat(audienceiq): register DriftRadar + AudienceHealth widgets"
```

---

## Task 8: DriftRadarWidget

**Files:**
- Create: `src/components/insights/widgets/DriftRadarWidget.tsx`

- [ ] **Step 1: Create drift radar widget**

Four-ring drift visualization. Shows overall drift with severity color, then 4 pairwise comparisons as horizontal bars.

```typescript
"use client";

import { useEffect, useState } from 'react';
import { Radar, AlertTriangle, CheckCircle, Unplug } from 'lucide-react';

interface DriftData {
  computed: boolean;
  declared_vs_paid: number;
  declared_vs_organic: number;
  paid_vs_converted: number;
  organic_vs_converted: number;
  overall_drift: number;
  severity: 'low' | 'moderate' | 'high';
  segment_mismatch: boolean;
  recommendations: string[];
}

const SEVERITY_COLORS = {
  low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle },
  moderate: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle },
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle },
};

const PAIR_LABELS: Record<string, string> = {
  declared_vs_paid: 'Declared vs Paid',
  declared_vs_organic: 'Declared vs Organic',
  paid_vs_converted: 'Paid vs Converted',
  organic_vs_converted: 'Organic vs Converted',
};

const PAIR_COLORS: Record<string, string> = {
  declared_vs_paid: '#0693e3',
  declared_vs_organic: '#9b51e0',
  paid_vs_converted: '#dc2626',
  organic_vs_converted: '#ca8a04',
};

export default function DriftRadarWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<DriftData | null>(null);
  const requestId = config.requestId as string;

  useEffect(() => {
    if (!requestId) return;
    fetch(`/api/audienceiq/drift/${requestId}`).then(r => r.json()).then(setData).catch(() => {});
  }, [requestId]);

  if (!requestId) {
    return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a campaign in widget settings</div>;
  }

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.computed) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Radar className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">No Drift Data</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Trigger drift computation from the admin panel to generate the first snapshot</p>
      </div>
    );
  }

  const sev = SEVERITY_COLORS[data.severity];
  const SevIcon = sev.icon;
  const pairs = ['declared_vs_paid', 'declared_vs_organic', 'paid_vs_converted', 'organic_vs_converted'] as const;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* Overall drift header */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${sev.bg} ${sev.border}`}>
        <SevIcon className={`w-5 h-5 ${sev.text}`} />
        <div>
          <div className={`text-lg font-bold ${sev.text}`}>{data.overall_drift}%</div>
          <div className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Overall Drift — {data.severity}</div>
        </div>
      </div>

      {/* Pairwise bars */}
      <div className="space-y-2.5">
        {pairs.map(key => {
          const value = data[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{PAIR_LABELS[key]}</span>
                <span className="text-xs font-bold text-[var(--foreground)]">{value}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(value, 100)}%`, background: PAIR_COLORS[key] }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="space-y-1.5 mt-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Recommendations</div>
          {data.recommendations.map((rec, i) => (
            <div key={i} className="text-[10px] text-[var(--foreground)] bg-[var(--muted)] rounded-lg px-3 py-2">
              {rec}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/widgets/DriftRadarWidget.tsx
git commit -m "feat(audienceiq): add DriftRadarWidget — four-ring drift visualization"
```

---

## Task 9: AudienceHealthWidget

**Files:**
- Create: `src/components/insights/widgets/AudienceHealthWidget.tsx`

- [ ] **Step 1: Create audience health widget**

Circular gauge (0-100) with issue list. Color-coded by score range.

```typescript
"use client";

import { useEffect, useState } from 'react';
import { HeartPulse, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface HealthIssue {
  type: string;
  message: string;
  recommended_action: string;
  severity: 'critical' | 'warning' | 'info';
  deduction: number;
}

interface HealthData {
  computed: boolean;
  score: number;
  issues: HealthIssue[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#ca8a04';
  if (score >= 40) return '#ea580c';
  return '#dc2626';
}

const SEVERITY_ICONS = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

const SEVERITY_STYLES = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-600 border-blue-200',
};

export default function AudienceHealthWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<HealthData | null>(null);
  const requestId = config.requestId as string;

  useEffect(() => {
    if (!requestId) return;
    fetch(`/api/audienceiq/health/${requestId}`).then(r => r.json()).then(setData).catch(() => {});
  }, [requestId]);

  if (!requestId) {
    return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a campaign in widget settings</div>;
  }

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.computed) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <HeartPulse className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">No Health Data</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Trigger drift computation to generate health scores</p>
      </div>
    );
  }

  const color = getScoreColor(data.score);
  const circumference = 2 * Math.PI * 45;
  const strokeDasharray = `${(data.score / 100) * circumference} ${circumference}`;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* Gauge */}
      <div className="flex items-center justify-center py-2">
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--muted)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              stroke={color} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color }}>{data.score}</span>
            <span className="text-[9px] text-[var(--muted-foreground)]">/ 100</span>
          </div>
        </div>
      </div>

      {/* Issues */}
      {data.issues.length > 0 && (
        <div className="space-y-1.5">
          {data.issues.map((issue, i) => {
            const Icon = SEVERITY_ICONS[issue.severity];
            const styles = SEVERITY_STYLES[issue.severity];
            return (
              <div key={i} className={`flex gap-2 p-2.5 rounded-lg border ${styles}`}>
                <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold">{issue.message}</div>
                  <div className="text-[9px] opacity-80 mt-0.5">{issue.recommended_action}</div>
                </div>
                {issue.deduction > 0 && (
                  <span className="text-[9px] font-bold shrink-0">-{issue.deduction}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data.issues.length === 0 && (
        <div className="text-center text-xs text-green-600 font-medium">No issues detected</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/insights/widgets/AudienceHealthWidget.tsx
git commit -m "feat(audienceiq): add AudienceHealthWidget — gauge + issue detection"
```

---

## Task 10: TypeScript Verification

- [ ] **Step 1: Type check**
```bash
pnpm tsc --noEmit
```

- [ ] **Step 2: Verify 24 total widgets resolve in registry**

- [ ] **Step 3: Commit any fixes**
```bash
git add -A
git commit -m "fix(audienceiq): resolve Phase 2 TypeScript issues"
```
