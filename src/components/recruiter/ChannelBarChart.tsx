"use client";

import { TrackedLinkWithAsset } from "@/lib/types";

interface Props {
  links: TrackedLinkWithAsset[];
}

const CHANNEL_LABEL_MAP: Record<string, string> = {
  social: "Social",
  job_board: "Job Board",
  email: "Email",
  referral: "Referral",
  paid: "Paid",
  organic: "Organic",
  direct: "Direct",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
};

const BAR_SHADES = [
  "#32373C",
  "#555555",
  "#737373",
  "#999999",
  "#B0B0B0",
  "#CCCCCC",
];

function getChannelLabel(source: string): string {
  return CHANNEL_LABEL_MAP[source.toLowerCase()] ?? source;
}

export default function ChannelBarChart({ links }: Props) {
  // Aggregate clicks by utm_source
  const aggregated: Record<string, number> = {};
  for (const link of links) {
    const src = link.utm_source || "unknown";
    aggregated[src] = (aggregated[src] ?? 0) + link.click_count;
  }

  const sorted = Object.entries(aggregated)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (sorted.length === 0) {
    return (
      <div
        style={{
          padding: 18,
          textAlign: "center",
          color: "#737373",
          fontSize: 13,
        }}
      >
        No link data yet.
      </div>
    );
  }

  const maxClicks = sorted[0][1];

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
      {sorted.map(([source, count], i) => {
        const pct = maxClicks > 0 ? (count / maxClicks) * 100 : 0;
        const barWidth = Math.max(pct, 8);
        const shade = BAR_SHADES[i] ?? BAR_SHADES[BAR_SHADES.length - 1];
        const label = getChannelLabel(source);

        return (
          <div
            key={source}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* Channel label */}
            <div
              style={{
                width: 76,
                textAlign: "right",
                fontSize: 12,
                color: "#1A1A1A",
                flexShrink: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {label}
            </div>

            {/* Bar track */}
            <div
              style={{
                flex: 1,
                height: 22,
                background: "#F7F7F8",
                borderRadius: 5,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Bar fill */}
              <div
                style={{
                  width: `${barWidth}%`,
                  height: "100%",
                  background: shade,
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 8,
                  boxSizing: "border-box",
                  transition: "width 0.3s ease",
                }}
              >
                {barWidth >= 20 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "#FFFFFF",
                      fontWeight: 600,
                      userSelect: "none",
                    }}
                  >
                    {Math.round(pct)}%
                  </span>
                )}
              </div>
            </div>

            {/* Count */}
            <div
              style={{
                width: 34,
                textAlign: "right",
                fontSize: 12,
                fontWeight: 600,
                color: "#1A1A1A",
                flexShrink: 0,
              }}
            >
              {count}
            </div>
          </div>
        );
      })}
    </div>
  );
}
