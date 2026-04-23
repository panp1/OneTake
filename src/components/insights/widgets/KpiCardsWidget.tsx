"use client";

import { useState, useEffect } from "react";
import { BarChart3, Loader2, CheckCircle2, Send } from "lucide-react";

interface PipelineData {
  total: number;
  by_status: { status: string; count: number }[];
  by_urgency: { urgency: string; count: number }[];
  recent: unknown[];
}

function getCount(byStatus: { status: string; count: number }[], status: string): number {
  return byStatus.find((s) => s.status === status)?.count ?? 0;
}

export default function KpiCardsWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<PipelineData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/pipeline")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const cards = [
    { label: "Total Campaigns", value: data.total, icon: BarChart3, color: "#32373c" },
    { label: "Generating", value: getCount(data.by_status, "generating"), icon: Loader2, color: "#2563eb" },
    { label: "Approved", value: getCount(data.by_status, "approved"), icon: CheckCircle2, color: "#16a34a" },
    { label: "Sent", value: getCount(data.by_status, "sent"), icon: Send, color: "#0693e3" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-full">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-white p-3"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            <Icon className="w-5 h-5" style={{ color: card.color }} />
            <span className="text-2xl font-bold text-[var(--foreground)]">{card.value}</span>
            <span className="text-xs text-[var(--muted-foreground)] text-center">{card.label}</span>
          </div>
        );
      })}
    </div>
  );
}
