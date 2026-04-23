"use client";

import { useEffect, useState } from 'react';
import { MousePointerClick, Link2, TrendingUp, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const AXIS_STYLE = { tick: { fill: '#737373', fontSize: 11 }, axisLine: { stroke: '#e5e5e5' }, tickLine: { stroke: '#e5e5e5' } };
const TOOLTIP_STYLE = { contentStyle: { background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 12, color: '#1a1a1a' } };

interface Props {
  requestId: string;
  recruiterId: string;
}

export function MyAnalyticsTab({ requestId, recruiterId }: Props) {
  const [utmData, setUtmData] = useState<{
    total_clicks: number;
    total_links: number;
    by_source: { utm_source: string; clicks: number }[];
  } | null>(null);
  const [creativeData, setCreativeData] = useState<{
    creatives: { asset_id: string; platform: string; total_clicks: number }[];
  } | null>(null);

  useEffect(() => {
    const params = `recruiterId=${recruiterId}`;
    fetch(`/api/insights/metrics/utm-funnel?${params}`).then(r => r.json()).then(setUtmData).catch(() => {});
    fetch(`/api/insights/metrics/creative-performance?${params}`).then(r => r.json()).then(setCreativeData).catch(() => {});
  }, [recruiterId]);

  if (!utmData) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const topCreatives = (creativeData?.creatives ?? []).filter(c => c.total_clicks > 0).slice(0, 5);

  return (
    <div className="p-4 space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'My Clicks', value: utmData.total_clicks, icon: MousePointerClick, color: 'text-purple-600' },
          { label: 'My Links', value: utmData.total_links, icon: Link2, color: 'text-blue-600' },
          { label: 'Avg / Link', value: utmData.total_links > 0 ? Math.round(utmData.total_clicks / utmData.total_links) : 0, icon: TrendingUp, color: 'text-green-600' },
          { label: 'Sources Used', value: utmData.by_source.length, icon: Trophy, color: 'text-amber-600' },
        ].map(c => (
          <div key={c.label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--muted-foreground)]">{c.label}</span>
            </div>
            <span className="text-2xl font-bold text-[var(--foreground)]">{c.value}</span>
          </div>
        ))}
      </div>

      {/* Clicks by Source */}
      {utmData.by_source.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-[var(--foreground)] mb-3">My Clicks by Source</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utmData.by_source.slice(0, 8)}>
                <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" />
                <XAxis dataKey="utm_source" {...AXIS_STYLE} />
                <YAxis {...AXIS_STYLE} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="clicks" fill="#0693e3" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top Creatives */}
      {topCreatives.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-[var(--foreground)] mb-3">My Top-Performing Creatives</h3>
          <div className="space-y-2">
            {topCreatives.map((c, i) => (
              <div key={c.asset_id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--muted)]">
                <span className="text-xs font-bold text-[var(--muted-foreground)] w-5">#{i + 1}</span>
                <span className="text-xs text-[var(--foreground)] flex-1">{c.platform} creative</span>
                <span className="text-xs font-bold text-[var(--foreground)]">{c.total_clicks} clicks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {utmData.total_links === 0 && (
        <div className="card p-8 text-center">
          <Link2 className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">No tracked links yet</h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Use the link builder in the Creatives tab to create your first tracked link</p>
        </div>
      )}
    </div>
  );
}
