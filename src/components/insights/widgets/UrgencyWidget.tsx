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
  by_status: unknown[];
  by_urgency: { urgency: string; count: number }[];
  recent: unknown[];
}

const URGENCY_COLORS: Record<string, string> = {
  urgent: "#dc2626",
  standard: "#0693e3",
  pipeline: "#a3a3a3",
};

export default function UrgencyWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<PipelineData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/pipeline")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const chartData = data.by_urgency.filter((u) => u.count > 0);

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="flex-1 h-full min-h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="urgency"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.urgency} fill={URGENCY_COLORS[entry.urgency] ?? "#a3a3a3"} />
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
          <div key={entry.urgency} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: URGENCY_COLORS[entry.urgency] ?? "#a3a3a3" }}
            />
            <span className="text-[var(--muted-foreground)] capitalize">{entry.urgency}</span>
            <span className="font-semibold text-[var(--foreground)] ml-auto">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
