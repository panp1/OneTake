"use client";

import { useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { Theme } from "./tokens";
import { FONT, FIGMA_ICON } from "./tokens";

interface AssetLightboxProps {
  asset: GeneratedAsset;
  allAssets: GeneratedAsset[];
  onClose: () => void;
  onNavigate: (asset: GeneratedAsset) => void;
  theme: Theme;
}

const PLATFORM_LABELS: Record<string, string> = {
  ig_feed: "Instagram Feed",
  ig_story: "Instagram Story",
  ig_stories: "Instagram Story",
  ig_carousel: "Instagram Carousel",
  fb_feed: "Facebook Feed",
  fb_story: "Facebook Story",
  fb_carousel: "Facebook Carousel",
  linkedin_feed: "LinkedIn Feed",
  linkedin_card: "LinkedIn Card",
  twitter_post: "Twitter Post",
  tiktok_feed: "TikTok Feed",
  youtube_banner: "YouTube Banner",
  display_banner: "Display Banner",
};

function derivePlatformLabel(platform: string): string {
  if (!platform) return "Creative";
  const key = Object.keys(PLATFORM_LABELS).find((k) => platform.includes(k));
  if (key) return PLATFORM_LABELS[key];
  // Fallback: capitalize and humanize
  return platform
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getVqaColor(score: number, theme: Theme): string {
  if (score >= 0.85) return theme.vqaGood;
  if (score >= 0.70) return theme.vqaOk;
  return theme.vqaBad;
}

function getVqaBg(score: number, theme: Theme): string {
  const color = getVqaColor(score, theme);
  return `${color}33`;
}

function deriveDimensions(asset: GeneratedAsset): string {
  const c = (asset.content || {}) as Record<string, unknown>;
  if (c.width && c.height) return `${c.width} \u00D7 ${c.height}`;
  // Infer from platform
  const p = asset.platform || "";
  if (p.includes("story") || p.includes("stories")) return "1080 \u00D7 1920";
  if (p.includes("feed") && p.includes("ig")) return "1080 \u00D7 1080";
  if (p.includes("feed") && p.includes("fb")) return "1200 \u00D7 628";
  if (p.includes("linkedin")) return "1200 \u00D7 628";
  if (p.includes("carousel")) return "1080 \u00D7 1080";
  if (p.includes("banner")) return "1920 \u00D7 1080";
  return "";
}

export default function AssetLightbox({
  asset,
  allAssets,
  onClose,
  onNavigate,
  theme,
}: AssetLightboxProps) {
  const [loaded, setLoaded] = useState(false);

  const currentIndex = allAssets.findIndex((a) => a.id === asset.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allAssets.length - 1;

  const navigatePrev = useCallback(() => {
    if (hasPrev) onNavigate(allAssets[currentIndex - 1]);
  }, [hasPrev, currentIndex, allAssets, onNavigate]);

  const navigateNext = useCallback(() => {
    if (hasNext) onNavigate(allAssets[currentIndex + 1]);
  }, [hasNext, currentIndex, allAssets, onNavigate]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") navigatePrev();
      if (e.key === "ArrowRight") navigateNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, onClose, navigatePrev, navigateNext]);

  // Reset loaded state when asset changes
  useEffect(() => {
    setLoaded(false);
  }, [asset.id]);

  const platformLabel = derivePlatformLabel(asset.platform);
  const dims = deriveDimensions(asset);
  const vqaScore = asset.evaluation_score;
  const hasVqa = vqaScore != null && vqaScore > 0;

  function handleDownload() {
    if (!asset.blob_url) return;
    const a = document.createElement("a");
    a.href = asset.blob_url;
    a.download = `${asset.platform || "creative"}.jpg`;
    a.click();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Top bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
        }}
      >
        {/* Platform label */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            fontFamily: FONT.sans,
            color: "rgba(255,255,255,0.9)",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 6,
            padding: "4px 10px",
            letterSpacing: "0.02em",
          }}
        >
          {platformLabel}
        </span>

        {/* Dimensions */}
        {dims && (
          <span
            style={{
              fontSize: 11,
              fontFamily: FONT.mono,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            {dims}
          </span>
        )}

        {/* VQA score badge */}
        {hasVqa && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: FONT.mono,
              color: getVqaColor(vqaScore, theme),
              background: getVqaBg(vqaScore, theme),
              borderRadius: 6,
              padding: "4px 10px",
            }}
          >
            VQA {Math.round(vqaScore * 100)}%
          </span>
        )}

        {/* Nav counter */}
        {allAssets.length > 1 && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontFamily: FONT.mono,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {currentIndex + 1} / {allAssets.length}
          </span>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Close (Esc)"
        style={{
          position: "absolute",
          top: 16,
          right: 24,
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.1)",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 10,
          transition: "background 150ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.1)";
        }}
      >
        <X size={16} />
      </button>

      {/* Left nav arrow */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigatePrev();
          }}
          title="Previous (←)"
          style={{
            position: "absolute",
            left: 20,
            top: "50%",
            transform: "translateY(-50%)",
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.1)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
            transition: "background 150ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,255,255,0.1)";
          }}
        >
          <ChevronLeft size={20} />
        </button>
      )}

      {/* Right nav arrow */}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigateNext();
          }}
          title="Next (→)"
          style={{
            position: "absolute",
            right: 20,
            top: "50%",
            transform: "translateY(-50%)",
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.1)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
            transition: "background 150ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,255,255,0.1)";
          }}
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Image container — centered, stops click propagation */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxWidth: "90vw",
          maxHeight: "80vh",
        }}
      >
        {/* Skeleton pulse while loading */}
        {!loaded && asset.blob_url && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 8,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
              backgroundSize: "200% 100%",
              animation: "lightbox-pulse 1.5s ease-in-out infinite",
              minWidth: 320,
              minHeight: 240,
            }}
          />
        )}

        {asset.blob_url ? (
          <img
            src={asset.blob_url}
            alt={platformLabel}
            onLoad={() => setLoaded(true)}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              objectFit: "contain",
              borderRadius: 8,
              display: "block",
              opacity: loaded ? 1 : 0,
              transition: "opacity 0.2s ease",
            }}
          />
        ) : (
          // No image placeholder
          <div
            style={{
              width: 480,
              height: 480,
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontFamily: FONT.mono,
                color: "rgba(255,255,255,0.1)",
                fontWeight: 700,
              }}
            >
              {dims || "1:1"}
            </span>
            <span
              style={{
                fontSize: 12,
                fontFamily: FONT.sans,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              Image not yet generated
            </span>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
        }}
      >
        {/* Download button */}
        <button
          onClick={handleDownload}
          title="Download"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 20px",
            borderRadius: 9999,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.1)",
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: FONT.sans,
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,255,255,0.18)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,255,255,0.1)";
          }}
        >
          <Download size={14} />
          Download
        </button>

        {/* Figma export button */}
        <button
          onClick={() => {
            if (asset.id) {
              window.open(`/api/export/figma/${asset.id}`, "_blank");
            }
          }}
          title="Export to Figma"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 20px",
            borderRadius: 9999,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: FONT.sans,
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,255,255,0.08)";
          }}
        >
          <span dangerouslySetInnerHTML={{ __html: FIGMA_ICON }} />
          Export to Figma
        </button>
      </div>

      {/* Pulse keyframe (injected once) */}
      <style>{`
        @keyframes lightbox-pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
