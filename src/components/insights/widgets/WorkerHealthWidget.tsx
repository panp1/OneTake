"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Clock, XCircle } from "lucide-react";

interface WorkerData {
  by_status: { status: string; count: number }[];
  avg_duration_seconds: number;
  recent: unknown[];
}

function getCount(byStatus: { status: string; count: number }[], status: string): number {
  return byStatus.find((s) => s.status === status)?.count ?? 0;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export default function WorkerHealthWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<WorkerData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/workers")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const cards = [
    { label: "Complete", value: getCount(data.by_status, "completed"), icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4" },
    { label: "Processing", value: getCount(data.by_status, "processing"), icon: Loader2, color: "#2563eb", bg: "#eff6ff" },
    { label: "Pending", value: getCount(data.by_status, "pending"), icon: Clock, color: "#ca8a04", bg: "#fefce8" },
    { label: "Failed", value: getCount(data.by_status, "failed"), icon: XCircle, color: "#dc2626", bg: "#fef2f2" },
  ];

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 border border-[var(--border)]"
              style={{ background: card.bg }}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: card.color }} />
              <div>
                <div className="text-lg font-bold" style={{ color: card.color }}>{card.value}</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 bg-[var(--muted)]">
        <Clock className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
        <span className="text-xs text-[var(--muted-foreground)]">Avg Duration:</span>
        <span className="text-sm font-semibold text-[var(--foreground)]">{formatDuration(data.avg_duration_seconds)}</span>
      </div>
    </div>
  );
}
