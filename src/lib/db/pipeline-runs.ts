import { getDb } from '../db';
import type { PipelineRun, PipelineStageStatus } from '@/lib/types';

export async function createPipelineRun(data: {
  request_id: string;
  stage: number;
  stage_name: string;
  status: PipelineStageStatus;
  attempt?: number;
  input_data?: Record<string, unknown> | null;
}): Promise<PipelineRun> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO pipeline_runs (request_id, stage, stage_name, status, attempt, input_data)
    VALUES (
      ${data.request_id},
      ${data.stage},
      ${data.stage_name},
      ${data.status},
      ${data.attempt ?? 1},
      ${data.input_data ? JSON.stringify(data.input_data) : null}
    )
    RETURNING *
  `;
  return rows[0] as PipelineRun;
}

export async function updatePipelineRun(
  id: string,
  data: Partial<{
    status: PipelineStageStatus;
    output_data: Record<string, unknown> | null;
    evaluation_data: Record<string, unknown> | null;
    error_message: string | null;
    duration_ms: number | null;
    completed_at: string | null;
  }>
): Promise<PipelineRun> {
  const sql = getDb();
  const rows = await sql`
    UPDATE pipeline_runs
    SET
      status = COALESCE(${data.status ?? null}, status),
      output_data = COALESCE(${data.output_data !== undefined ? JSON.stringify(data.output_data) : null}, output_data),
      evaluation_data = COALESCE(${data.evaluation_data !== undefined ? JSON.stringify(data.evaluation_data) : null}, evaluation_data),
      error_message = COALESCE(${data.error_message ?? null}, error_message),
      duration_ms = COALESCE(${data.duration_ms ?? null}, duration_ms),
      completed_at = COALESCE(${data.completed_at ?? null}, completed_at)
    WHERE id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) {
    throw new Error(`Pipeline run not found: ${id}`);
  }
  return rows[0] as PipelineRun;
}

export async function getRunsByRequestId(requestId: string): Promise<PipelineRun[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM pipeline_runs
    WHERE request_id = ${requestId}
    ORDER BY stage ASC, started_at DESC
  `;
  return rows as PipelineRun[];
}
