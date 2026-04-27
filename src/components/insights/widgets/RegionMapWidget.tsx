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
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from "../chartTheme";

interface ActivityData {
  recent_campaigns: unknown[];
  by_region: { region: string; count: number }[];
  by_language: unknown[];
}

export default function RegionMapWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<ActivityData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/activity")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const chartData = (data.by_region || [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (!chartData.length) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">No region data yet</div>;
  }

  return (
    <div className="h-full min-h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
          <CartesianGrid {...GRID_STYLE} horizontal={false} />
          <XAxis type="number" {...AXIS_STYLE} />
          <YAxis type="category" dataKey="region" width={100} {...AXIS_STYLE} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE.contentStyle}
            itemStyle={TOOLTIP_STYLE.itemStyle}
            labelStyle={TOOLTIP_STYLE.labelStyle}
          />
          <Bar dataKey="count" fill={CHART_COLORS.teal} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
