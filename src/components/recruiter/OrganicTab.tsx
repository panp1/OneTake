"use client";

import { useState, useMemo } from "react";
import CarouselPreviewCard from "./CarouselPreviewCard";
import type { GeneratedAsset } from "@/lib/types";

interface OrganicTabProps {
  assets: GeneratedAsset[];
}

const PLATFORM_TABS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
] as const;

export default function OrganicTab({ assets }: OrganicTabProps) {
  const [activePlatform, setActivePlatform] = useState<string>("linkedin");

  const organicAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.asset_type === "organic_carousel" &&
          a.evaluation_passed === true &&
          a.blob_url,
      ),
    [assets],
  );

  const filtered = useMemo(() => {
    return organicAssets.filter((a) => {
      const content = (a.content ?? {}) as Record<string, unknown>;
      const platform = String(
        content.platform ?? a.platform ?? "",
      ).toLowerCase();
      return platform.includes(activePlatform);
    });
  }, [organicAssets, activePlatform]);

  if (organicAssets.length === 0) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#8A8A8E", lineHeight: 1.6 }}>
          No organic content generated yet.
          <br />
          Organic carousels are created automatically when the pipeline runs.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Platform sub-tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid #E5E5E5",
        }}
      >
        {PLATFORM_TABS.map((tab) => {
          const count = organicAssets.filter((a) => {
            const content = (a.content ?? {}) as Record<string, unknown>;
            const p = String(
              content.platform ?? a.platform ?? "",
            ).toLowerCase();
            return p.includes(tab.key);
          }).length;
          const isActive = activePlatform === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActivePlatform(tab.key)}
              style={{
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#1A1A1A" : "#8A8A8E",
                background: "none",
                border: "none",
                borderBottom: isActive
                  ? "2px solid #32373C"
                  : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Carousel grid */}
      {filtered.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: "#8A8A8E",
            fontStyle: "italic",
            padding: "24px 0",
          }}
        >
          No{" "}
          {activePlatform === "linkedin" ? "LinkedIn" : "Instagram"}{" "}
          carousels generated yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {filtered.map((asset) => (
            <CarouselPreviewCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
