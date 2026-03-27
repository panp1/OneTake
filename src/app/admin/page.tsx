import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';

interface StatusCount {
  status: string;
  count: number;
}

interface RecentRequest {
  id: string;
  title: string;
  task_type: string;
  urgency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'badge-draft',
  generating: 'badge-generating',
  review: 'badge-review',
  approved: 'badge-approved',
  sent: 'badge-sent',
  rejected: 'badge-rejected',
};

export default async function AdminDashboard() {
  try {
    await requireRole(['admin']);
  } catch {
    redirect('/');
  }

  const sql = getDb();

  const [statusCountsRaw, activeJobs, lastCompleted, recentRequestsRaw] = await Promise.all([
    sql`
      SELECT status, COUNT(*)::int AS count
      FROM intake_requests
      GROUP BY status
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM compute_jobs
      WHERE status IN ('pending', 'processing')
    `,
    sql`
      SELECT completed_at
      FROM compute_jobs
      WHERE status = 'complete' AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1
    `,
    sql`
      SELECT id, title, task_type, urgency, status, created_at, updated_at
      FROM intake_requests
      ORDER BY updated_at DESC
      LIMIT 10
    `,
  ]);

  const statusCounts = statusCountsRaw as StatusCount[];
  const recentRequests = recentRequestsRaw as RecentRequest[];

  const activeJobCount = (activeJobs[0] as { count: number } | undefined)?.count ?? 0;
  const lastJobTime = (lastCompleted[0] as { completed_at: string } | undefined)?.completed_at ?? null;

  const allStatuses = ['draft', 'generating', 'review', 'approved', 'sent', 'rejected'];
  const countsMap: Record<string, number> = {};
  for (const s of allStatuses) countsMap[s] = 0;
  for (const row of statusCounts) countsMap[row.status] = row.count;
  const totalRequests = Object.values(countsMap).reduce((a, b) => a + b, 0);

  return (
    <div className="px-6 md:px-10 lg:px-12 xl:px-16 py-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Admin Dashboard</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
          System overview and monitoring
        </p>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Link href="/admin/users" className="btn-secondary">
          User Management
        </Link>
        <Link href="/admin/schemas" className="btn-secondary">
          Schema Management
        </Link>
        <Link href="/admin/pipeline" className="btn-secondary">
          Worker Monitor
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            Total Requests
          </p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{totalRequests}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            Active Compute Jobs
          </p>
          <p className="text-2xl font-bold text-[var(--foreground)]">{activeJobCount}</p>
          {activeJobCount > 0 && (
            <p className="text-xs text-[#2563eb] mt-1">Processing...</p>
          )}
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            Pending Review
          </p>
          <p className="text-2xl font-bold text-[#ca8a04]">{countsMap.review}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            Worker Health
          </p>
          {lastJobTime ? (
            <>
              <p className="text-sm font-medium text-[#16a34a]">Last job completed</p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {new Date(lastJobTime).toLocaleString()}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-[var(--muted-foreground)]">No jobs completed yet</p>
          )}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="card p-5 mb-8">
        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">Requests by Status</h2>
        <div className="flex flex-wrap gap-4">
          {allStatuses.map((status) => (
            <div key={status} className="flex items-center gap-2">
              <span className={`badge ${statusColors[status] ?? 'badge-draft'}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
              <span className="text-sm font-semibold text-[var(--foreground)]">{countsMap[status]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">Recent Activity</h2>
        {recentRequests.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">Title</th>
                  <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">Type</th>
                  <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">Urgency</th>
                  <th className="text-left py-2 pr-4 font-medium text-[var(--muted-foreground)]">Status</th>
                  <th className="text-left py-2 font-medium text-[var(--muted-foreground)]">Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentRequests.map((req) => (
                  <tr key={req.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/intake/${req.id}`}
                        className="text-[var(--foreground)] hover:underline font-medium"
                      >
                        {req.title}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--muted-foreground)]">
                      {req.task_type.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`badge ${req.urgency === 'urgent' ? 'badge-urgent' : 'badge-draft'}`}>
                        {req.urgency}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`badge ${statusColors[req.status] ?? 'badge-draft'}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-[var(--muted-foreground)]">
                      {new Date(req.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
