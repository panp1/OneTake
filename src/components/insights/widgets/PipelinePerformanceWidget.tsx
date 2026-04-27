"use client";

import { useState, useEffect } from "react";

interface RecentJob {
  id: string;
  request_id: string;
  job_type: string;
  status: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface WorkerData {
  by_status: unknown[];
  avg_duration_seconds: number;
  recent: RecentJob[];
}

const JOB_STATUS_BADGE: Record<string, string> = {
  completed: "badge badge-approved",
  processing: "badge badge-generating",
  pending: "badge badge-draft",
  failed: "badge badge-urgent",
};

function formatDuration(started: string | null, completed: string | null): string {
  if (!started || !completed) return "--";
  const ms = new Date(completed).getTime() - new Date(started).getTime();
  if (ms < 0) return "--";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

function formatTime(iso: string | null) {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PipelinePerformanceWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<WorkerData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/workers")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.recent?.length) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">No compute jobs yet</div>;
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)]">Job Type</th>
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)]">Status</th>
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)]">Started</th>
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)]">Duration</th>
          </tr>
        </thead>
        <tbody>
          {data.recent.map((job) => (
            <tr key={job.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors">
              <td className="py-2 px-2 text-[var(--foreground)] font-medium">{job.job_type}</td>
              <td className="py-2 px-2">
                <span className={JOB_STATUS_BADGE[job.status] ?? "badge badge-draft"}>{job.status}</span>
              </td>
              <td className="py-2 px-2 text-[var(--muted-foreground)]">{formatTime(job.started_at)}</td>
              <td className="py-2 px-2 text-[var(--foreground)] font-medium">{formatDuration(job.started_at, job.completed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
