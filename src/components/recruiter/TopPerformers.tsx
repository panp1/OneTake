"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
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

function getChannelLabel(source: string): string {
  return CHANNEL_LABEL_MAP[source?.toLowerCase()] ?? source;
}

function stripDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

export default function TopPerformers({ links }: Props) {
  const top5 = links
    .filter((l) => l.click_count > 0)
    .sort((a, b) => b.click_count - a.click_count)
    .slice(0, 5);

  if (top5.length === 0) {
    return (
      <div
        style={{
          padding: "18px",
          textAlign: "center",
          color: "#737373",
          fontSize: 13,
        }}
      >
        No clicks yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {top5.map((link, i) => {
        const rank = i + 1;
        const isGold = rank === 1;
        const rankBg = isGold ? "#fef3c7" : "#F7F7F8";
        const rankColor = isGold ? "#92400e" : "#32373C";
        const slug = stripDomain(link.short_url);

        const handleCopy = () => {
          navigator.clipboard.writeText(link.short_url).then(() => {
            toast.success("Copied to clipboard");
          });
        };

        return (
          <div
            key={link.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderBottom: "1px solid #F7F7F8",
            }}
          >
            {/* Rank circle */}
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: rankBg,
                color: rankColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {rank}
            </div>

            {/* Link info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#1A1A1A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {slug}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#737373",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {getChannelLabel(link.utm_source)}
                {link.utm_term ? ` · ${link.utm_term}` : ""}
                {!link.asset_thumbnail ? " · No creative" : ""}
              </div>
            </div>

            {/* Click count */}
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#1A1A1A",
                flexShrink: 0,
              }}
            >
              {link.click_count}
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              title="Copy link"
              style={{
                width: 28,
                height: 28,
                border: "1px solid #E8E8EA",
                borderRadius: 6,
                background: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                padding: 0,
              }}
            >
              <Copy size={12} color="#737373" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
