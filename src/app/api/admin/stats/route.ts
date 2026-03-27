import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    await requireRole(['admin']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return Response.json({ error: msg }, { status });
  }

  try {
    const sql = getDb();

    // Request counts by status
    const statusCounts = await sql`
      SELECT status, COUNT(*)::int AS count
      FROM intake_requests
      GROUP BY status
    `;

    // Active compute jobs (pending + processing)
    const activeJobs = await sql`
      SELECT COUNT(*)::int AS count
      FROM compute_jobs
      WHERE status IN ('pending', 'processing')
    `;

    // Last job completed timestamp
    const lastCompleted = await sql`
      SELECT completed_at
      FROM compute_jobs
      WHERE status = 'complete' AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1
    `;

    // Recent activity (latest 10 requests)
    const recentRequests = await sql`
      SELECT id, title, task_type, urgency, status, created_at, updated_at
      FROM intake_requests
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    return Response.json({
      statusCounts: statusCounts as Array<{ status: string; count: number }>,
      activeJobCount: (activeJobs[0] as { count: number })?.count ?? 0,
      lastJobCompleted: (lastCompleted[0] as { completed_at: string } | undefined)?.completed_at ?? null,
      recentRequests,
    });
  } catch (error) {
    console.error('[api/admin/stats] Failed:', error);
    return Response.json({ error: 'Failed to fetch admin stats' }, { status: 500 });
  }
}
