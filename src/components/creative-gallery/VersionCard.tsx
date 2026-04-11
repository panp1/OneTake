"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { VersionGroup, ChannelDef } from "@/lib/channels";
import { ARCHETYPE_LABELS, getThumbnailDimensions } from "@/lib/channels";
import FormatThumbnail from "./FormatThumbnail";

interface VersionCardProps {
  version: VersionGroup;
  channelDef: ChannelDef;
  onAssetClick: (asset: GeneratedAsset) => void;
}

function getVqaColor(score: number): {
  bg: string;
  text: string;
} {
  if (score >= 0.85) return { bg: "#f0fdf4", text: "#16a34a" };
  if (score >= 0.7) return { bg: "#fefce8", text: "#d97706" };
  return { bg: "#fef2f2", text: "#dc2626" };
}

export default function VersionCard({
  version,
  channelDef,
  onAssetClick,
}: VersionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const vqaColor = getVqaColor(version.avgVqaScore);
  const archetypeLabel =
    ARCHETYPE_LABELS[version.archetype] || version.archetype || "";
  const pillarLabel =
    version.pillar.charAt(0).toUpperCase() + version.pillar.slice(1);

  // Match assets to format definitions for ordered display
  const formatAssets: Array<{
    asset: GeneratedAsset;
    format: (typeof channelDef.formats)[0];
  }> = [];

  for (const format of channelDef.formats) {
    const matchingAsset = version.assets.find((a) => {
      const p = a.platform;
      if (format.key === "feed" && (p.includes("_feed") || p === "wechat_moments"))
        return true;
      if (format.key === "story" && (p.includes("_story") || p.includes("_stories") || p === "whatsapp_story"))
        return true;
      if (format.key === "carousel" && p.includes("_carousel"))
        return true;
      if (format.key === "card" && p.includes("_card"))
        return true;
      if (format.key === "post" && p.includes("_post"))
        return true;
      if (format.key === "display" && p.includes("_display"))
        return true;
      if (format.key === "banner" && p.includes("_banner"))
        return true;
      if (format.key === "moments" && p === "wechat_moments")
        return true;
      if (format.key === "channels" && p === "wechat_channels")
        return true;
      if (format.key.startsWith("carousel_") && p.includes("_carousel"))
        return true;
      return false;
    });
    if (matchingAsset) {
      formatAssets.push({ asset: matchingAsset, format });
    }
  }

  return (
    <div
      className="rounded-2xl bg-white overflow-hidden mb-3 transition-shadow"
      style={{
        border: expanded
          ? "1px solid #6B21A8"
          : "1px solid #E5E5E5",
        boxShadow: expanded
          ? "0 2px 12px rgba(107,33,168,0.08)"
          : "none",
      }}
    >
      {/* Collapsed header — always visible, clickable */}
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-extrabold text-sm"
            style={{
              background: "linear-gradient(135deg, #6B21A8, #E91E8C)",
            }}
          >
            {version.versionLabel}
          </div>
          <div>
            <div className="text-[15px] font-semibold text-[#1A1A1A]">
              {version.headline}
            </div>
            <div className="text-xs text-[#999] mt-0.5">
              {archetypeLabel && `${archetypeLabel} · `}
              {pillarLabel} pillar · {version.formatCount} format
              {version.formatCount !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {version.avgVqaScore > 0 && (
            <span
              className="text-[11px] font-medium px-3 py-1 rounded-[10px]"
              style={{
                background: vqaColor.bg,
                color: vqaColor.text,
              }}
            >
              {version.avgVqaScore.toFixed(2)} VQA
            </span>
          )}
          {expanded && (
            <>
              <button
                className="btn-primary text-[11px] px-4 py-1.5 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  const firstAsset = version.assets[0];
                  if (firstAsset) {
                    window.open(
                      `/api/export/figma/${firstAsset.id}`,
                      "_blank",
                    );
                  }
                }}
              >
                Export for Figma
              </button>
              <button
                className="btn-secondary text-[11px] px-4 py-1.5 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  const firstAsset = version.assets[0];
                  if (firstAsset) {
                    window.open(
                      `/api/export/${firstAsset.request_id}?type=composed`,
                      "_blank",
                    );
                  }
                }}
              >
                Download All
              </button>
            </>
          )}
          <ChevronDown
            className={`w-5 h-5 transition-transform duration-200 ${
              expanded ? "rotate-180 text-[#6B21A8]" : "text-[#ccc]"
            }`}
          />
        </div>
      </div>

      {/* Expanded content — format thumbnails */}
      {expanded && (
        <div className="border-t border-[#f0f0f0] bg-[#fafafa] px-6 py-6">
          <div className="flex gap-6 items-end">
            {formatAssets.map(({ asset, format }) => {
              const dims = getThumbnailDimensions(format, 200);
              return (
                <FormatThumbnail
                  key={`${format.key}-${asset.id}`}
                  asset={asset}
                  formatLabel={format.label}
                  width={dims.width}
                  height={dims.height}
                  dimensions={`${format.width} × ${format.height}`}
                  onClick={onAssetClick}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
