import { auth } from '@clerk/nextjs/server';
import { createComputeJob } from '@/lib/db/compute-jobs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { asset_id, feedback } = await request.json();

  if (!asset_id || !feedback) {
    return Response.json(
      { error: 'asset_id and feedback required' },
      { status: 400 }
    );
  }

  const job = await createComputeJob({
    request_id: id,
    job_type: 'regenerate_asset',
    asset_id,
    feedback,
  });

  return Response.json(
    { job_id: job.id, status: 'queued' },
    { status: 202 }
  );
}
