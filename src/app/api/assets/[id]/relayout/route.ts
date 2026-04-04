import { auth } from '@clerk/nextjs/server';
import { getAuthContext } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { createComputeJob } from '@/lib/db/compute-jobs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: assetId } = await params;

    // Look up the asset to get request_id
    const sql = getDb();
    const rows = await sql`SELECT request_id FROM generated_assets WHERE id = ${assetId} LIMIT 1`;
    if (rows.length === 0) {
      return Response.json({ error: 'Asset not found' }, { status: 404 });
    }
    const requestId = rows[0].request_id;

    // Create compute job for the worker
    const job = await createComputeJob({
      request_id: requestId,
      job_type: 'relayout_creative',
      stage_target: 4,
      asset_id: assetId,
      feedback: 'Change layout — generate a new visual layout for this creative while preserving the same copy and persona.',
      feedback_data: { action: 'change_layout', asset_id: assetId },
    });

    return Response.json(
      { message: 'Layout change queued', job_id: job.id },
      { status: 202 }
    );
  } catch (error) {
    console.error('[api/assets/[id]/relayout] POST failed:', error);
    return Response.json(
      { error: 'Failed to queue layout change' },
      { status: 500 }
    );
  }
}
