"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { MousePointerClick, Link2, Users } from "lucide-react";
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from "../chartTheme";

interface ClickData {
  summary: { total_links: number; total_clicks: number; recruiter_count: number };
  by_source: { utm_source: string; clicks: number }[];
  top_links: unknown[];
}

export default function ClickAnalyticsWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<ClickData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/clicks")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const stats = [
    { label: "Total Clicks", value: data.summary.total_clicks, icon: MousePointerClick, color: CHART_COLORS.blue },
    { label: "Links", value: data.summary.total_links, icon: Link2, color: CHART_COLORS.purple },
    { label: "Recruiters", value: data.summary.recruiter_count, icon: Users, color: CHART_COLORS.green },
  ];

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex flex-col items-center gap-1 py-2 rounded-lg border border-[var(--border)]">
              <Icon className="w-4 h-4" style={{ color: s.color }} />
              <span className="text-lg font-bold text-[var(--foreground)]">{s.value}</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">{s.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex-1 min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.by_source} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
            <CartesianGrid {...GRID_STYLE} vertical={false} />
            <XAxis dataKey="utm_source" {...AXIS_STYLE} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle}
              itemStyle={TOOLTIP_STYLE.itemStyle}
              labelStyle={TOOLTIP_STYLE.labelStyle}
            />
            <Bar dataKey="clicks" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
