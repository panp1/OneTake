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
  Legend,
} from "recharts";
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from "../chartTheme";

interface CampaignItem {
  utm_campaign: string;
  clicks: number;
  link_count: number;
}

interface FunnelData {
  total_clicks: number;
  total_links: number;
  by_source: unknown[];
  by_medium: unknown[];
  by_campaign: CampaignItem[];
  source_medium_matrix: unknown[];
}

export default function CampaignRoiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<FunnelData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (config.recruiterScope === "self") params.set("recruiterId", "self");
    fetch(`/api/insights/metrics/utm-funnel?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.recruiterScope]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.by_campaign?.length) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">No campaign data yet</div>;
  }

  const chartData = data.by_campaign.map((c) => ({
    name: c.utm_campaign.length > 20 ? c.utm_campaign.slice(0, 18) + "..." : c.utm_campaign,
    clicks: c.clicks,
    links: c.link_count,
  }));

  return (
    <div className="h-full min-h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
          <CartesianGrid {...GRID_STYLE} vertical={false} />
          <XAxis dataKey="name" {...AXIS_STYLE} angle={-20} textAnchor="end" height={50} />
          <YAxis {...AXIS_STYLE} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE.contentStyle}
            itemStyle={TOOLTIP_STYLE.itemStyle}
            labelStyle={TOOLTIP_STYLE.labelStyle}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="clicks" name="Clicks" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
          <Bar dataKey="links" name="Links" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
