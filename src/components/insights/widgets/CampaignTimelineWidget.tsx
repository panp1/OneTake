"use client";

import { useState, useEffect } from "react";

interface RecentCampaign {
  id: string;
  title: string;
  status: string;
  urgency: string;
  task_type: string;
  created_at: string;
}

interface PipelineData {
  total: number;
  by_status: unknown[];
  by_urgency: unknown[];
  recent: RecentCampaign[];
}

const STATUS_BADGE: Record<string, string> = {
  draft: "badge badge-draft",
  generating: "badge badge-generating",
  review: "badge badge-review",
  approved: "badge badge-approved",
  sent: "badge badge-sent",
  rejected: "badge badge-urgent",
};

const URGENCY_BADGE: Record<string, string> = {
  urgent: "badge badge-urgent",
  standard: "badge badge-generating",
  pipeline: "badge badge-draft",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CampaignTimelineWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<PipelineData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/pipeline")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.recent?.length) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">No campaigns yet</div>;
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)]">Campaign</th>
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)]">Status</th>
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)]">Urgency</th>
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)]">Created</th>
          </tr>
        </thead>
        <tbody>
          {data.recent.map((c) => (
            <tr key={c.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] transition-colors">
              <td className="py-2 px-2 text-[var(--foreground)] font-medium truncate max-w-[200px]">{c.title}</td>
              <td className="py-2 px-2">
                <span className={STATUS_BADGE[c.status] ?? "badge badge-draft"}>{c.status}</span>
              </td>
              <td className="py-2 px-2">
                <span className={URGENCY_BADGE[c.urgency] ?? "badge badge-draft"}>{c.urgency}</span>
              </td>
              <td className="py-2 px-2 text-[var(--muted-foreground)]">{formatDate(c.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
