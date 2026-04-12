"use client";

import { Download, Clock, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import { groupCreativesByVersion } from "@/lib/channels";
import VersionAccordion from "./VersionAccordion";
import type { GeneratedAsset } from "@/lib/types";

interface AdSetInfo {
  name: string;
  personaName: string;
  pillar: string;
  objective?: string;
  dailyBudget?: string;
  splitTestVariable?: string;
  interests: {
    hyper: string[];
    hot: string[];
    broad: string[];
  };
}

interface AdSetCardProps {
  adSet: AdSetInfo;
  assets: GeneratedAsset[];
  channelName: string;
  campaignSlug: string;
  trackingBaseUrl: string | null;
}

const INTEREST_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  hyper: { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
  hot: { bg: "#fce7f3", color: "#9d174d", border: "#fbcfe8" },
  broad: { bg: "#F7F7F8", color: "#32373C", border: "#E8E8EA" },
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdSetCard({ adSet, assets, channelName, campaignSlug, trackingBaseUrl }: AdSetCardProps) {
  const versions = groupCreativesByVersion(assets, channelName);
  const adSetSlug = slugify(adSet.name);

  function handleDownloadAdSet() {
    for (const a of assets) {
      if (a.blob_url) window.open(a.blob_url, "_blank");
    }
    toast.success(`Downloading ${assets.length} creatives for ${adSet.name}`);
  }

  return (
    <div style={{ border: "1px solid #E8E8EA", borderRadius: 10, background: "white", marginBottom: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "16px 18px", borderBottom: "1px solid #F0F0F0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{adSet.name}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 12px", borderRadius: 9999, background: "rgba(109,40,217,0.06)", color: "#6D28D9" }}>
              {adSet.personaName} · {adSet.pillar}
            </span>
            <button onClick={handleDownloadAdSet} style={{ padding: "7px 16px", fontSize: 11, borderRadius: 9999, border: "1px solid #E8E8EA", background: "white", color: "#8A8A8E", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontWeight: 600, fontFamily: "inherit", marginLeft: 8 }}>
              <Download size={12} /> Download Ad Set
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#8A8A8E", display: "flex", gap: 12 }}>
          {adSet.objective && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {adSet.objective}</span>}
          {adSet.dailyBudget && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><DollarSign size={11} /> ${adSet.dailyBudget}/day</span>}
          {adSet.splitTestVariable && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={11} /> Split test: {adSet.splitTestVariable}</span>}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 18 }}>
        {/* Targeting Interests */}
        {(adSet.interests.hyper.length > 0 || adSet.interests.hot.length > 0 || adSet.interests.broad.length > 0) && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.6, color: "#8A8A8E", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              Targeting Interests
              <span style={{ flex: 1, height: 1, background: "#E8E8EA" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
              {(["hyper", "hot", "broad"] as const).map((tier) => {
                const items = adSet.interests[tier];
                if (items.length === 0) return <div key={tier} />;
                const label = tier === "hyper" ? "Hyper (Exact Match)" : tier === "hot" ? "Hot (Strong Signal)" : "Broad (Reach)";
                const style = INTEREST_STYLES[tier];
                return (
                  <div key={tier}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.6, color: "#8A8A8E", marginBottom: 6 }}>{label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {items.map((interest) => (
                        <span key={interest} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 9999, fontWeight: 500, background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Version Accordions */}
        {versions.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.6, color: "#8A8A8E", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              Creatives & Ad Copy
              <span style={{ flex: 1, height: 1, background: "#E8E8EA" }} />
            </div>
            {versions.map((v) => (
              <VersionAccordion
                key={v.versionLabel}
                version={v}
                channelName={channelName}
                adSetSlug={adSetSlug}
                campaignSlug={campaignSlug}
                trackingBaseUrl={trackingBaseUrl}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
