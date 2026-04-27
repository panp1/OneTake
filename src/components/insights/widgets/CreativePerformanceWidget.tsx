"use client";

import { useState, useEffect } from "react";
import { Image, MousePointerClick, Award } from "lucide-react";

interface Creative {
  asset_id: string;
  asset_type: string;
  platform: string;
  blob_url: string | null;
  evaluation_score: number | null;
  evaluation_passed: boolean;
  total_clicks: number;
  link_count: number;
}

interface CreativeData {
  creatives: Creative[];
}

function getScoreBadge(score: number | null, passed: boolean) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  const color = passed ? "text-green-700 bg-green-50 border-green-200" : "text-amber-700 bg-amber-50 border-amber-200";
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${color}`}>
      <Award className="w-2.5 h-2.5" />
      {pct}
    </span>
  );
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
    .slice(0, 12);

  if (!sorted.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Image className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">No Creative Data</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Generate creatives and create tracked links to see performance</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sorted.map((creative, i) => (
          <div
            key={creative.asset_id}
            className="group rounded-xl border border-[var(--border)] overflow-hidden bg-white hover:shadow-[var(--shadow-elevated)] transition-shadow"
          >
            {/* Creative image */}
            <div className="relative aspect-[4/3] bg-[var(--muted)]">
              {creative.blob_url ? (
                <img
                  src={creative.blob_url}
                  alt={`${creative.platform} ${creative.asset_type}`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image className="w-8 h-8 text-[var(--muted-foreground)] opacity-30" />
                </div>
              )}

              {/* Rank badge */}
              <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{i + 1}</span>
              </div>

              {/* Platform pill */}
              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-black/60 text-[8px] font-semibold text-white uppercase tracking-wider">
                {creative.platform}
              </div>
            </div>

            {/* Stats */}
            <div className="p-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 text-[var(--foreground)]">
                  <MousePointerClick className="w-3 h-3 text-purple-600" />
                  <span className="text-sm font-bold">{creative.total_clicks}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">clicks</span>
                </div>
                {getScoreBadge(creative.evaluation_score, creative.evaluation_passed)}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--muted-foreground)]">
                <span className="capitalize">{creative.asset_type.replace(/_/g, " ")}</span>
                <span>{creative.link_count} link{creative.link_count !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
