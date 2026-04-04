import { getDb } from '../db';
import type { GeneratedAsset, AssetType } from '@/lib/types';

export async function createAsset(data: {
  request_id: string;
  actor_id?: string | null;
  asset_type: AssetType;
  platform: string;
  format: string;
  language?: string;
  content?: Record<string, unknown> | null;
  copy_data?: Record<string, unknown> | null;
  blob_url?: string | null;
  evaluation_score?: number | null;
  evaluation_data?: Record<string, unknown> | null;
  evaluation_passed?: boolean;
  stage?: number;
  version?: number;
}): Promise<GeneratedAsset> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO generated_assets (
      request_id, actor_id, asset_type, platform, format, language,
      content, copy_data, blob_url, evaluation_score, evaluation_data,
      evaluation_passed, stage, version
    )
    VALUES (
      ${data.request_id},
      ${data.actor_id ?? null},
      ${data.asset_type},
      ${data.platform},
      ${data.format},
      ${data.language ?? 'en'},
      ${data.content ? JSON.stringify(data.content) : null},
      ${data.copy_data ? JSON.stringify(data.copy_data) : null},
      ${data.blob_url ?? null},
      ${data.evaluation_score ?? null},
      ${data.evaluation_data ? JSON.stringify(data.evaluation_data) : null},
      ${data.evaluation_passed ?? false},
      ${data.stage ?? 1},
      ${data.version ?? 1}
    )
    RETURNING *
  `;
  return rows[0] as GeneratedAsset;
}

export async function getAssetsByRequestId(requestId: string): Promise<GeneratedAsset[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM generated_assets
    WHERE request_id = ${requestId}
    ORDER BY stage, platform
  `;
  return rows as GeneratedAsset[];
}

export async function deleteAsset(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM generated_assets WHERE id = ${id}`;
}

export async function deleteAssetsByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const sql = getDb();
  const result = await sql`DELETE FROM generated_assets WHERE id = ANY(${ids})`;
  return result.length;
}

export async function updateAssetEvaluation(
  id: string,
  data: {
    evaluation_score: number | null;
    evaluation_data: Record<string, unknown> | null;
    evaluation_passed: boolean;
  }
): Promise<GeneratedAsset> {
  const sql = getDb();
  const rows = await sql`
    UPDATE generated_assets
    SET
      evaluation_score = ${data.evaluation_score},
      evaluation_data = ${data.evaluation_data ? JSON.stringify(data.evaluation_data) : null},
      evaluation_passed = ${data.evaluation_passed}
    WHERE id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) {
    throw new Error(`Generated asset not found: ${id}`);
  }
  return rows[0] as GeneratedAsset;
}
