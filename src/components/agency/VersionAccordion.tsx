"use client";

import { useState } from "react";
import { ChevronRight, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { extractField } from "@/lib/format";
import { CHANNEL_DEFINITIONS, getThumbnailDimensions } from "@/lib/channels";
import { buildDestinationUrl } from "@/lib/tracked-links/build-url";
import type { VersionGroup } from "@/lib/channels";

interface VersionAccordionProps {
  version: VersionGroup;
  channelName: string;
  adSetSlug: string;
  campaignSlug: string;
  trackingBaseUrl: string | null;
}

export default function VersionAccordion({
  version,
  channelName,
  adSetSlug,
  campaignSlug,
  trackingBaseUrl,
}: VersionAccordionProps) {
  const [open, setOpen] = useState(false);
  const channelDef = CHANNEL_DEFINITIONS[channelName];

  // Build UTM link
  const utmUrl = trackingBaseUrl
    ? buildDestinationUrl(trackingBaseUrl, {
        utm_campaign: campaignSlug,
        utm_source: channelName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        utm_medium: "paid",
        utm_term: adSetSlug,
        utm_content: version.versionLabel.toLowerCase(),
      })
    : null;

  // Get format labels for the pill
  const formatLabels = channelDef
    ? [...new Set(version.assets.map((a) => {
        const plat = a.platform || "";
        const match = channelDef.formats.find((f) =>
          plat.includes(f.key) || plat.endsWith(`_${f.key}`)
        );
        return match?.label || a.format || plat;
      }))].join(" · ")
    : version.assets.map((a) => a.format || a.platform).join(" · ");

  // Get first asset's copy data for ad copy display
  const firstAsset = version.assets[0];
  const copyData = (firstAsset?.copy_data || {}) as Record<string, unknown>;
  const content = (firstAsset?.content || {}) as Record<string, unknown>;
  const primaryText = extractField(copyData, "primary_text") || extractField(copyData, "caption") || "";
  const headline = extractField(copyData, "headline") || extractField(content, "overlay_headline") || "";
  const description = extractField(copyData, "description") || "";
  const cta = extractField(copyData, "cta") || extractField(content, "overlay_cta") || "";

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    for (const a of version.assets) {
      if (a.blob_url) window.open(a.blob_url, "_blank");
    }
    toast.success(`Downloading ${version.versionLabel} (${version.assets.length} files)`);
  }

  function handleCopyUtm(e: React.MouseEvent) {
    e.stopPropagation();
    if (!utmUrl) return;
    navigator.clipboard.writeText(utmUrl).then(
      () => toast.success("UTM link copied!"),
      () => toast.error("Could not copy"),
    );
  }

  return (
    <div style={{ border: "1px solid #E8E8EA", borderRadius: 8, marginBottom: 8, overflow: "hidden" }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12,
          background: open ? "#FAFAFA" : "white", border: "none", cursor: "pointer",
          fontFamily: "inherit", textAlign: "left" as const,
          borderBottom: open ? "1px solid #E8E8EA" : "none",
        }}
      >
        <ChevronRight size={12} style={{ color: "#8A8A8E", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
        <div style={{ fontSize: 11, fontWeight: 700, width: 28, height: 28, borderRadius: 6, background: "#F7F7F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#32373C" }}>
          {version.versionLabel}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1A1A1A" }}>
          {version.headline}
        </div>
        <div style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: "#F7F7F8", color: "#8A8A8E", flexShrink: 0 }}>
          {formatLabels}
        </div>
        {version.avgVqaScore > 0 && (
          <div style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: version.avgVqaScore >= 0.85 ? "#15803d" : version.avgVqaScore >= 0.7 ? "#a16207" : "#dc2626" }}>
            VQA {version.avgVqaScore.toFixed(2)}
          </div>
        )}
        <button onClick={handleDownload} style={{ padding: "7px 16px", fontSize: 11, borderRadius: 9999, border: "1px solid #E8E8EA", background: "white", color: "#8A8A8E", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 600, fontFamily: "inherit", marginLeft: 8 }}>
          <Download size={10} /> Download {version.versionLabel}
        </button>
      </button>

      {/* Expanded body — stacked layout */}
      {open && (
        <div style={{ padding: 16, background: "#FAFAFA" }}>
          {/* Thumbnails on top */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #E8E8EA" }}>
            {version.assets.map((asset) => {
              const format = channelDef?.formats.find((f) => asset.platform?.includes(f.key));
              const dims = format ? getThumbnailDimensions(format, 96) : { width: 96, height: 96 };
              const label = format?.label
                ? `${format.label} ${format.ratio}`
                : asset.format || asset.platform || "";
              return (
                <div key={asset.id} style={{ width: dims.width, height: dims.height, borderRadius: 8, overflow: "hidden", border: "1px solid #E8E8EA", background: "#EBEBEB", position: "relative" }}>
                  {asset.blob_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.blob_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                  )}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 8, fontWeight: 600, textAlign: "center" as const, padding: "2px 0" }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ad copy below */}
          {primaryText && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#8A8A8E", marginBottom: 4 }}>Primary Text</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "#333", padding: "10px 14px", background: "white", border: "1px solid #E8E8EA", borderRadius: 8, userSelect: "all" as const }}>{primaryText}</div>
            </div>
          )}
          {(headline || description) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {headline && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#8A8A8E", marginBottom: 4 }}>Headline</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", padding: "10px 14px", background: "white", border: "1px solid #E8E8EA", borderRadius: 8, userSelect: "all" as const }}>{headline}</div>
                </div>
              )}
              {description && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#8A8A8E", marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", padding: "10px 14px", background: "white", border: "1px solid #E8E8EA", borderRadius: 8, userSelect: "all" as const }}>{description}</div>
                </div>
              )}
            </div>
          )}
          {cta && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, color: "#8A8A8E", marginBottom: 4 }}>CTA</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", padding: "10px 14px", background: "white", border: "1px solid #E8E8EA", borderRadius: 8, userSelect: "all" as const }}>{cta}</div>
            </div>
          )}

          {/* UTM Link */}
          {utmUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#1A1A1A", borderRadius: 8, marginTop: 16 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
              <div style={{ fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 11, color: "#888", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {utmUrl.replace(/^https?:\/\//, "")}
              </div>
              <button onClick={handleCopyUtm} style={{ fontSize: 10, fontWeight: 600, padding: "4px 12px", borderRadius: 9999, background: "white", color: "#32373C", border: "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 3, fontFamily: "inherit" }}>
                <Copy size={10} /> Copy Link
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#8A8A8E", marginTop: 16, fontStyle: "italic" }}>No tracking URL available — add a landing page URL to enable UTM links.</div>
          )}
        </div>
      )}
    </div>
  );
}
