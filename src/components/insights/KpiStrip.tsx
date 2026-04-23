"use client";

import { useEffect, useState } from 'react';
import { TrendingUp, Clock, CheckCircle, Send, MousePointerClick } from 'lucide-react';

export function KpiStrip() {
  const [pipeline, setPipeline] = useState<{ total: number; by_status: { status: string; count: number }[] } | null>(null);
  const [clicks, setClicks] = useState<{ summary: { total_clicks: number } } | null>(null);

  useEffect(() => {
    fetch('/api/insights/metrics/pipeline').then(r => r.json()).then(setPipeline).catch(() => {});
    fetch('/api/insights/metrics/clicks').then(r => r.json()).then(setClicks).catch(() => {});
  }, []);

  if (!pipeline) return <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>;

  const byStatus = Object.fromEntries(pipeline.by_status.map(s => [s.status, s.count]));
  const cards = [
    { label: 'Campaigns', value: pipeline.total, icon: TrendingUp, color: 'text-[var(--ring)]' },
    { label: 'Generating', value: byStatus['generating'] ?? 0, icon: Clock, color: 'text-blue-600' },
    { label: 'Approved', value: byStatus['approved'] ?? 0, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Sent', value: byStatus['sent'] ?? 0, icon: Send, color: 'text-cyan-600' },
    { label: 'Total Clicks', value: clicks?.summary?.total_clicks ?? 0, icon: MousePointerClick, color: 'text-purple-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {cards.map(c => (
        <div key={c.label} className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--muted)] flex items-center justify-center shrink-0">
            <c.icon className={`w-4 h-4 ${c.color}`} />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{c.label}</div>
            <div className="text-xl font-bold text-[var(--foreground)]">{c.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
