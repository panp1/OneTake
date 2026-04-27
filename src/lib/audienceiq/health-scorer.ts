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
