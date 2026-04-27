"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Unplug } from 'lucide-react';
import { CHART_COLORS, AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface ChannelQuality {
  utm_source: string;
  avg_quality: number;
  contributor_count: number;
  active_count: number;
  churned_count: number;
}

export default function QualityByChannelWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<{ connected: boolean; channels: ChannelQuality[] } | null>(null);

  useEffect(() => {
    fetch('/api/audienceiq/quality').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">CRM Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Set CRM_DATABASE_URL to enable quality tracking</p>
      </div>
    );
  }

  if (data.channels.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No quality data yet</div>;
  }

  const getBarColor = (quality: number) => {
    if (quality >= 85) return CHART_COLORS.green;
    if (quality >= 70) return CHART_COLORS.blue;
    if (quality >= 50) return CHART_COLORS.amber;
    return CHART_COLORS.red;
  };

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.channels}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis dataKey="utm_source" {...AXIS_STYLE} />
          <YAxis domain={[0, 100]} {...AXIS_STYLE} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Bar dataKey="avg_quality" radius={[4, 4, 0, 0]}>
            {data.channels.map((entry, i) => (
              <Cell key={i} fill={getBarColor(entry.avg_quality)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
