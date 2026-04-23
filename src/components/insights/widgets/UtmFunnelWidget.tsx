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

type TabKey = "source" | "medium" | "campaign";

interface FunnelItem {
  clicks: number;
  link_count: number;
}

interface SourceItem extends FunnelItem { utm_source: string }
interface MediumItem extends FunnelItem { utm_medium: string }
interface CampaignItem extends FunnelItem { utm_campaign: string }

interface FunnelData {
  total_clicks: number;
  total_links: number;
  by_source: SourceItem[];
  by_medium: MediumItem[];
  by_campaign: CampaignItem[];
  source_medium_matrix: unknown[];
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "medium", label: "Medium" },
  { key: "campaign", label: "Campaign" },
];

const TAB_COLORS: Record<TabKey, string> = {
  source: CHART_COLORS.blue,
  medium: CHART_COLORS.purple,
  campaign: CHART_COLORS.green,
};

export default function UtmFunnelWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<FunnelData | null>(null);
  const [tab, setTab] = useState<TabKey>("source");

  useEffect(() => {
    const params = new URLSearchParams();
    if (config.recruiterScope === "self") params.set("recruiterId", "self");
    fetch(`/api/insights/metrics/utm-funnel?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.recruiterScope]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  let chartData: { name: string; clicks: number }[] = [];
  if (tab === "source") {
    chartData = data.by_source.map((d) => ({ name: d.utm_source, clicks: d.clicks }));
  } else if (tab === "medium") {
    chartData = data.by_medium.map((d) => ({ name: d.utm_medium, clicks: d.clicks }));
  } else {
    chartData = data.by_campaign.map((d) => ({ name: d.utm_campaign, clicks: d.clicks }));
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex gap-1 p-0.5 rounded-full bg-[var(--muted)] w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-all cursor-pointer ${
              tab === t.key
                ? "bg-white text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
            <CartesianGrid {...GRID_STYLE} vertical={false} />
            <XAxis dataKey="name" {...AXIS_STYLE} />
            <YAxis {...AXIS_STYLE} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE.contentStyle}
              itemStyle={TOOLTIP_STYLE.itemStyle}
              labelStyle={TOOLTIP_STYLE.labelStyle}
            />
            <Bar dataKey="clicks" fill={TAB_COLORS[tab]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
