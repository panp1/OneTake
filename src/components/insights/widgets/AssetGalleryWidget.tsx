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
  Cell,
} from "recharts";
import { CHART_PALETTE, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from "../chartTheme";

interface AssetData {
  total: number;
  by_type: { asset_type: string; count: number }[];
  by_platform: { platform: string; count: number }[];
  pass_rate: { total: number; passed: number };
}

export default function AssetGalleryWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<AssetData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/assets")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const passRate = data.pass_rate.total > 0
    ? Math.round((data.pass_rate.passed / data.pass_rate.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-xl font-bold text-[var(--foreground)]">{data.total}</div>
          <div className="text-xs text-[var(--muted-foreground)]">Total Assets</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: passRate >= 80 ? "#16a34a" : "#ca8a04" }}>
            {passRate}%
          </div>
          <div className="text-xs text-[var(--muted-foreground)]">Pass Rate</div>
        </div>
      </div>
      <div className="flex-1 min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.by_type} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
            <CartesianGrid {...GRID_STYLE} horizontal={false} />
            <XAxis type="number" {...AXIS_STYLE} />
            <YAxis type="category" dataKey="asset_type" width={80} {...AXIS_STYLE} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle}
              itemStyle={TOOLTIP_STYLE.itemStyle}
              labelStyle={TOOLTIP_STYLE.labelStyle}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.by_type.map((_, i) => (
                <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
