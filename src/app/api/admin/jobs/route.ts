import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    await requireRole(['admin']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return Response.json({ error: msg }, { status });
  }

  try {
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);

    const sql = getDb();

    let jobs;
    if (statusFilter && statusFilter !== 'all') {
      jobs = await sql`
        SELECT
          cj.id,
          cj.request_id,
          cj.job_type,
          cj.status,
          cj.stage_target,
          cj.asset_id,
          cj.error_message,
          cj.started_at,
          cj.completed_at,
          cj.created_at,
          ir.title AS request_title
        FROM compute_jobs cj
        LEFT JOIN intake_requests ir ON ir.id = cj.request_id
        WHERE cj.status = ${statusFilter}
        ORDER BY cj.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      jobs = await sql`
        SELECT
          cj.id,
          cj.request_id,
          cj.job_type,
          cj.status,
          cj.stage_target,
          cj.asset_id,
          cj.error_message,
          cj.started_at,
          cj.completed_at,
          cj.created_at,
          ir.title AS request_title
        FROM compute_jobs cj
        LEFT JOIN intake_requests ir ON ir.id = cj.request_id
        ORDER BY cj.created_at DESC
        LIMIT ${limit}
      `;
    }

    return Response.json(jobs);
  } catch (error) {
    console.error('[api/admin/jobs] GET failed:', error);
    return Response.json({ error: 'Failed to list compute jobs' }, { status: 500 });
  }
}
