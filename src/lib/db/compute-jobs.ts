import { getDb } from '../db';

export interface ComputeJob {
  id: string;
  request_id: string;
  job_type: string;
  status: string;
  stage_target: number | null;
  asset_id: string | null;
  feedback: string | null;
  feedback_data: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export async function createComputeJob(data: {
  request_id: string;
  job_type: string;
  stage_target?: number | null;
  asset_id?: string | null;
  feedback?: string | null;
  feedback_data?: Record<string, unknown> | null;
}): Promise<ComputeJob> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO compute_jobs (request_id, job_type, stage_target, asset_id, feedback, feedback_data)
    VALUES (${data.request_id}, ${data.job_type}, ${data.stage_target ?? null}, ${data.asset_id ?? null}, ${data.feedback ?? null}, ${data.feedback_data ? JSON.stringify(data.feedback_data) : null})
    RETURNING *
  `;
  return rows[0] as ComputeJob;
}

export async function getJobsByRequestId(requestId: string): Promise<ComputeJob[]> {
  const sql = getDb();
  return await sql`
    SELECT * FROM compute_jobs WHERE request_id = ${requestId} ORDER BY created_at DESC
  ` as ComputeJob[];
}

export async function getLatestJobForRequest(requestId: string): Promise<ComputeJob | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM compute_jobs WHERE request_id = ${requestId} ORDER BY created_at DESC LIMIT 1
  `;
  return (rows[0] as ComputeJob) ?? null;
}

export async function markJobProcessing(jobId: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE compute_jobs SET status = 'processing', started_at = NOW() WHERE id = ${jobId}`;
}

export async function markJobComplete(jobId: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE compute_jobs SET status = 'complete', completed_at = NOW() WHERE id = ${jobId}`;
}

export async function markJobFailed(jobId: string, errorMessage: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE compute_jobs SET status = 'failed', error_message = ${errorMessage}, completed_at = NOW() WHERE id = ${jobId}`;
}
