"use client";

import { useState, useEffect } from "react";
import { Image, CheckCircle, XCircle } from "lucide-react";

interface GalleryAsset {
  id: string;
  asset_type: string;
  platform: string;
  format: string;
  blob_url: string;
  evaluation_score: number | null;
  evaluation_passed: boolean;
  created_at: string;
}

interface AssetData {
  total: number;
  by_type: { asset_type: string; count: number }[];
  by_platform: { platform: string; count: number }[];
  pass_rate: { total: number; passed: number };
  gallery: GalleryAsset[];
}

export default function AssetGalleryWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<AssetData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/assets?gallery=true")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const passRate = data.pass_rate.total > 0
    ? Math.round((data.pass_rate.passed / data.pass_rate.total) * 100)
    : 0;

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Stats row */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="px-3 py-1.5 rounded-lg bg-[var(--muted)]">
          <span className="text-[10px] text-[var(--muted-foreground)] block">Total</span>
          <span className="text-lg font-bold text-[var(--foreground)]">{data.total}</span>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-[var(--muted)]">
          <span className="text-[10px] text-[var(--muted-foreground)] block">Pass Rate</span>
          <span className="text-lg font-bold" style={{ color: passRate >= 80 ? "#16a34a" : "#ca8a04" }}>
            {passRate}%
          </span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {data.by_platform.slice(0, 4).map((p) => (
            <span key={p.platform} className="tag-pill">{p.platform} ({p.count})</span>
          ))}
        </div>
      </div>

      {/* Creative gallery grid */}
      {data.gallery && data.gallery.length > 0 ? (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {data.gallery.map((asset) => (
              <div
                key={asset.id}
                className="group relative rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--muted)] aspect-square hover:shadow-[var(--shadow-elevated)] transition-shadow"
              >
                {/* Thumbnail */}
                <img
                  src={asset.blob_url}
                  alt={`${asset.platform} ${asset.asset_type}`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* VQA badge overlay */}
                <div className="absolute top-1 right-1">
                  {asset.evaluation_passed ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 drop-shadow-md" />
                  ) : asset.evaluation_score !== null ? (
                    <XCircle className="w-3.5 h-3.5 text-amber-500 drop-shadow-md" />
                  ) : null}
                </div>

                {/* Platform + type overlay (hover) */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-[8px] font-bold text-white uppercase tracking-wider">{asset.platform}</div>
                  <div className="text-[7px] text-white/70 capitalize">{asset.asset_type.replace(/_/g, " ")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Image className="w-8 h-8 text-[var(--muted-foreground)]" />
          <p className="text-xs text-[var(--muted-foreground)]">No creative images available</p>
        </div>
      )}
    </div>
  );
}
