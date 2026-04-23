"use client";

import { useState, useEffect, useMemo } from "react";

interface MatrixEntry {
  utm_source: string;
  utm_medium: string;
  clicks: number;
}

interface FunnelData {
  total_clicks: number;
  total_links: number;
  by_source: unknown[];
  by_medium: unknown[];
  by_campaign: unknown[];
  source_medium_matrix: MatrixEntry[];
}

export default function SourceHeatmapWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<FunnelData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (config.recruiterScope === "self") params.set("recruiterId", "self");
    fetch(`/api/insights/metrics/utm-funnel?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.recruiterScope]);

  const { sources, mediums, maxClicks, lookupMap } = useMemo(() => {
    if (!data?.source_medium_matrix?.length) {
      return { sources: [] as string[], mediums: [] as string[], maxClicks: 0, lookupMap: new Map<string, number>() };
    }
    const srcSet = new Set<string>();
    const medSet = new Set<string>();
    let max = 0;
    const map = new Map<string, number>();
    for (const entry of data.source_medium_matrix) {
      srcSet.add(entry.utm_source);
      medSet.add(entry.utm_medium);
      map.set(`${entry.utm_source}|${entry.utm_medium}`, entry.clicks);
      if (entry.clicks > max) max = entry.clicks;
    }
    return { sources: Array.from(srcSet), mediums: Array.from(medSet), maxClicks: max, lookupMap: map };
  }, [data]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!sources.length || !mediums.length) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">No source/medium data yet</div>;
  }

  function getCellOpacity(clicks: number) {
    if (maxClicks === 0) return 0.05;
    return 0.1 + (clicks / maxClicks) * 0.9;
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left py-1.5 px-2 font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)]">
              Source / Medium
            </th>
            {mediums.map((m) => (
              <th key={m} className="text-center py-1.5 px-2 font-semibold text-[var(--muted-foreground)] border-b border-[var(--border)]">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sources.map((src) => (
            <tr key={src} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 px-2 font-medium text-[var(--foreground)]">{src}</td>
              {mediums.map((med) => {
                const clicks = lookupMap.get(`${src}|${med}`) ?? 0;
                return (
                  <td key={med} className="py-1.5 px-2 text-center">
                    <div
                      className="inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] font-semibold min-w-[32px]"
                      style={{
                        background: clicks > 0 ? `rgba(6,147,227,${getCellOpacity(clicks)})` : "var(--muted)",
                        color: clicks > 0 ? "#0369a1" : "var(--muted-foreground)",
                      }}
                    >
                      {clicks}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
