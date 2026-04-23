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

interface Creative {
  asset_id: string;
  asset_type: string;
  platform: string;
  blob_url: string;
  evaluation_score: number | null;
  evaluation_passed: boolean;
  total_clicks: number;
  link_count: number;
}

interface CreativeData {
  creatives: Creative[];
}

export default function CreativePerformanceWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<CreativeData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (config.recruiterScope === "self") params.set("recruiterId", "self");
    fetch(`/api/insights/metrics/creative-performance?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.recruiterScope]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const sorted = [...(data.creatives || [])]
    .sort((a, b) => b.total_clicks - a.total_clicks)
    .slice(0, 10);

  if (!sorted.length) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">No creative data yet</div>;
  }

  const chartData = sorted.map((c, i) => ({
    name: `${c.asset_type} #${i + 1}`,
    clicks: c.total_clicks,
    platform: c.platform,
  }));

  return (
    <div className="h-full min-h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis dataKey="name" {...AXIS_STYLE} angle={-30} textAnchor="end" height={50} />
          <YAxis {...AXIS_STYLE} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE.contentStyle}
            itemStyle={TOOLTIP_STYLE.itemStyle}
            labelStyle={TOOLTIP_STYLE.labelStyle}
            formatter={(value) => [`${value} clicks`, "Performance"]}
          />
          <Bar dataKey="clicks" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
