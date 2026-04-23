"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { TOOLTIP_STYLE } from "../chartTheme";

interface PipelineData {
  total: number;
  by_status: { status: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#a3a3a3",
  generating: "#2563eb",
  review: "#ca8a04",
  approved: "#16a34a",
  sent: "#0693e3",
  rejected: "#dc2626",
};

export default function PipelineOverviewWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<PipelineData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/pipeline")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const chartData = data.by_status.filter((s) => s.count > 0);

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="flex-1 h-full min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#a3a3a3"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle}
              itemStyle={TOOLTIP_STYLE.itemStyle}
              labelStyle={TOOLTIP_STYLE.labelStyle}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2 shrink-0 pr-2">
        {chartData.map((entry) => (
          <div key={entry.status} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: STATUS_COLORS[entry.status] ?? "#a3a3a3" }}
            />
            <span className="text-[var(--muted-foreground)] capitalize">{entry.status}</span>
            <span className="font-semibold text-[var(--foreground)] ml-auto">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
