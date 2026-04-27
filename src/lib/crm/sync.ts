/**
 * CRM Sync Service — pulls contributor profiles from CRM datalake into local cache.
 */

import { queryCrm, isCrmSyncEnabled, type CrmContributor } from './client';
import { upsertContributor } from '@/lib/db/audienceiq';

export interface SyncResult {
  success: boolean;
  synced: number;
  errors: number;
  duration_ms: number;
  message: string;
}

export async function syncContributors(options?: {
  limit?: number;
  sinceMinutes?: number;
}): Promise<SyncResult> {
  const start = Date.now();

  if (!isCrmSyncEnabled()) {
    return {
      success: false,
      synced: 0,
      errors: 0,
      duration_ms: 0,
      message: 'CRM sync is not enabled. Set CRM_DATABASE_URL and CRM_SYNC_ENABLED=true.',
    };
  }

  const limit = options?.limit ?? 1000;
  const sinceMinutes = options?.sinceMinutes ?? 60;

  const rows = await queryCrm<CrmContributor>(
    `SELECT
      user_id as crm_user_id,
      email,
      country,
      COALESCE(languages, ARRAY[]::text[]) as languages,
      COALESCE(skills, '{}'::jsonb) as skills,
      quality_score,
      COALESCE(activity_status, 'unknown') as activity_status,
      signup_date,
      utm_source,
      utm_medium,
      utm_campaign
    FROM contributors
    WHERE updated_at >= NOW() - INTERVAL '1 minute' * $1
    ORDER BY updated_at DESC
    LIMIT $2`,
    [sinceMinutes, limit],
  );

  if (rows === null) {
    return {
      success: false,
      synced: 0,
      errors: 0,
      duration_ms: Date.now() - start,
      message: 'CRM query failed — check CRM_DATABASE_URL and network connectivity.',
    };
  }

  let synced = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      await upsertContributor(row);
      synced++;
    } catch (err) {
      errors++;
      console.error('[CRM Sync] Upsert error:', (err as Error).message);
    }
  }

  return {
    success: true,
    synced,
    errors,
    duration_ms: Date.now() - start,
    message: `Synced ${synced} contributors (${errors} errors) in ${Date.now() - start}ms`,
  };
}
