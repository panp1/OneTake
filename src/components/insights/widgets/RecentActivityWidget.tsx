"use client";

import { useState, useEffect } from "react";

interface Campaign {
  id: string;
  title: string;
  status: string;
  urgency: string;
  updated_at: string;
}

interface ActivityData {
  recent_campaigns: Campaign[];
  by_region: unknown[];
  by_language: unknown[];
}

const STATUS_BADGE: Record<string, string> = {
  draft: "badge badge-draft",
  generating: "badge badge-generating",
  review: "badge badge-review",
  approved: "badge badge-approved",
  sent: "badge badge-sent",
  rejected: "badge badge-urgent",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RecentActivityWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<ActivityData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/activity")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.recent_campaigns?.length) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">No recent activity</div>;
  }

  return (
    <div className="flex flex-col gap-2 overflow-auto h-full">
      {data.recent_campaigns.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
        >
          <span className={STATUS_BADGE[c.status] ?? "badge badge-draft"}>{c.status}</span>
          <span className="text-sm text-[var(--foreground)] font-medium truncate flex-1">{c.title}</span>
          <span className="text-xs text-[var(--muted-foreground)] shrink-0">{timeAgo(c.updated_at)}</span>
        </div>
      ))}
    </div>
  );
}
