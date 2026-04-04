"use client";

import { useState, useMemo, useRef } from "react";
import {
  Star,
  Users,
  Layers,
  Monitor,
  Film,
  Filter,
  Search,
  Download,
  RefreshCw,
  Pencil,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import MiniTabs from "@/components/MiniTabs";
import MockupPreview from "@/components/MockupPreview";
import EditableField from "@/components/EditableField";
import { extractField } from "@/lib/format";
import { toast } from "sonner";
import type { GeneratedAsset } from "@/lib/types";

interface AssetReviewPanelProps {
  assets: GeneratedAsset[];
  onRefine?: (asset: GeneratedAsset) => void;
  onRetry?: (asset: GeneratedAsset) => void;
}

// ── Carousel grouping types ─────────────────────────────

interface CarouselGroup {
  platform: string;
  slides: GeneratedAsset[];
  totalSlides: number;
}

function groupCarousels(carouselAssets: GeneratedAsset[]): CarouselGroup[] {
  const groups = new Map<string, GeneratedAsset[]>();

  for (const asset of carouselAssets) {
    const platform = asset.platform || "unknown";
    if (!groups.has(platform)) groups.set(platform, []);
    groups.get(platform)!.push(asset);
  }

  return Array.from(groups.entries()).map(([platform, slides]) => {
    // Sort by slide_index from content metadata
    const sorted = [...slides].sort((a, b) => {
      const ai = (a.content as Record<string, any>)?.slide_index ?? 99;
      const bi = (b.content as Record<string, any>)?.slide_index ?? 99;
      return ai - bi;
    });
    const total = (sorted[0]?.content as Record<string, any>)?.carousel_total_slides ?? sorted.length;
    return { platform, slides: sorted, totalSlides: total };
  });
}

function platformLabel(platform: string): string {
  const labels: Record<string, string> = {
    linkedin_carousel: "LinkedIn Carousel",
    ig_carousel: "Instagram Carousel",
    tiktok_carousel: "TikTok Carousel",
    wechat_carousel: "WeChat Carousel",
    ig_feed: "Instagram Feed",
    facebook_feed: "Facebook Feed",
    tiktok_feed: "TikTok Feed",
    linkedin_feed: "LinkedIn Feed",
  };
  return labels[platform] || platform.replace(/_/g, " ");
}

// ── Filter Dropdown ──────────────────────────────────

function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-1.5 pr-7 text-[11px] text-[var(--foreground)] cursor-pointer focus:outline-none focus:border-[#6B21A8]/30"
      >
        <option value="all">All {label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {platformLabel(opt)}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
    </div>
  );
}

// ── Asset Thumbnail ──────────────────────────────────

function AssetThumb({
  asset,
  onRefine,
  onRetry,
  showPlatform = false,
  showScore = true,
  showSlideIndex = false,
}: {
  asset: GeneratedAsset;
  onRefine?: (asset: GeneratedAsset) => void;
  onRetry?: (asset: GeneratedAsset) => void;
  showPlatform?: boolean;
  showScore?: boolean;
  showSlideIndex?: boolean;
}) {
  const score = asset.evaluation_score || 0;
  const scoreColor = score >= 0.85 ? "#22c55e" : score >= 0.70 ? "#f59e0b" : "#ef4444";
  const content = (asset.content || {}) as Record<string, any>;
  const copyData = (asset.copy_data || {}) as Record<string, any>;

  return (
    <div className="group border border-[var(--border)] rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-square bg-[var(--muted)]">
        {asset.blob_url ? (
          <img
            src={asset.blob_url}
            alt={extractField(asset.content, "actor_name", "Asset")}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--muted-foreground)]">
            <Layers size={20} className="opacity-30" />
          </div>
        )}

        {/* Score badge */}
        {showScore && score > 0 && (
          <div
            className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white"
            style={{ backgroundColor: scoreColor }}
          >
            {(score * 100).toFixed(0)}%
          </div>
        )}

        {/* Slide index badge */}
        {showSlideIndex && content.slide_index && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white text-[10px] font-bold flex items-center justify-center">
            {content.slide_index}
          </div>
        )}

        {/* Platform badge */}
        {showPlatform && !showSlideIndex && asset.platform && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/60 text-white backdrop-blur-sm">
            {platformLabel(asset.platform)}
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          {onRefine && (
            <button
              onClick={(e) => { e.stopPropagation(); onRefine(asset); }}
              className="p-2 bg-white rounded-lg text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
              title="Request revision"
            >
              <Pencil size={14} />
            </button>
          )}
          {asset.blob_url && (
            <button
              onClick={(e) => { e.stopPropagation(); window.open(asset.blob_url!, "_blank"); }}
              className="p-2 bg-white rounded-lg text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
              title="Download"
            >
              <Download size={14} />
            </button>
          )}
          {onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(asset); }}
              className="p-2 bg-white rounded-lg text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
              title="Regenerate"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2">
        <p className="text-[12px] font-medium text-[var(--foreground)] truncate">
          {content.slide_headline || extractField(asset.content, "actor_name", "") || extractField(asset.content, "overlay_headline", "") || asset.platform?.replace(/_/g, " ") || "Asset"}
        </p>
        <p className="text-[10px] text-[var(--muted-foreground)] truncate">
          {content.slide_role ? `${content.slide_role}` : ""}
          {extractField(asset.content, "outfit_key", "").replace(/_/g, " ") || asset.format || ""}
          {copyData.headline ? ` · ${copyData.headline}` : ""}
        </p>
      </div>
    </div>
  );
}

// ── Carousel Strip — horizontal scrollable slide strip ──

function CarouselStrip({
  group,
  onRefine,
  onRetry,
}: {
  group: CarouselGroup;
  onRefine?: (asset: GeneratedAsset) => void;
  onRetry?: (asset: GeneratedAsset) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const platformColors: Record<string, string> = {
    linkedin_carousel: "#0A66C2",
    ig_carousel: "#E1306C",
    tiktok_carousel: "#000000",
    wechat_carousel: "#07C160",
  };
  const accent = platformColors[group.platform] || "#6B21A8";

  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-[var(--muted)] flex items-center justify-between" style={{ borderLeft: `3px solid ${accent}` }}>
        <div className="flex items-center gap-2">
          <LayoutGrid size={14} style={{ color: accent }} />
          <span className="text-[13px] font-semibold text-[var(--foreground)]">
            {platformLabel(group.platform)}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)]">
            {group.slides.length} / {group.totalSlides} slides
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => scroll("left")} className="p-1 rounded-md hover:bg-white/80 cursor-pointer transition-colors">
            <ChevronLeft size={16} className="text-[var(--muted-foreground)]" />
          </button>
          <button onClick={() => scroll("right")} className="p-1 rounded-md hover:bg-white/80 cursor-pointer transition-colors">
            <ChevronRight size={16} className="text-[var(--muted-foreground)]" />
          </button>
        </div>
      </div>

      {/* Slides strip */}
      <div
        ref={scrollRef}
        className="flex gap-3 p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {group.slides.map((slide, idx) => {
          const content = (slide.content || {}) as Record<string, any>;
          const isVertical = group.platform === "tiktok_carousel";

          return (
            <div
              key={slide.id}
              className="flex-shrink-0 group"
              style={{
                width: isVertical ? "160px" : "200px",
                scrollSnapAlign: "start",
              }}
            >
              <div className={`relative ${isVertical ? "aspect-[9/16]" : "aspect-square"} rounded-lg overflow-hidden bg-[var(--muted)] border border-[var(--border)]`}>
                {slide.blob_url ? (
                  <img
                    src={slide.blob_url}
                    alt={`Slide ${idx + 1}`}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Layers size={16} className="text-[var(--muted-foreground)] opacity-30" />
                  </div>
                )}
                {/* Slide number */}
                <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: accent }}>
                  {content.slide_index || idx + 1}
                </div>
                {/* Role badge */}
                {content.slide_role && (
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-medium text-white bg-black/60 backdrop-blur-sm truncate text-center">
                    {content.slide_role}
                  </div>
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                  {onRefine && (
                    <button onClick={(e) => { e.stopPropagation(); onRefine(slide); }} className="p-1.5 bg-white rounded-lg cursor-pointer" title="Revise">
                      <Pencil size={12} />
                    </button>
                  )}
                  {slide.blob_url && (
                    <button onClick={(e) => { e.stopPropagation(); window.open(slide.blob_url!, "_blank"); }} className="p-1.5 bg-white rounded-lg cursor-pointer" title="Download">
                      <Download size={12} />
                    </button>
                  )}
                </div>
              </div>
              {/* Slide info */}
              <p className="text-[10px] font-medium text-[var(--foreground)] mt-1.5 truncate">
                {content.slide_headline || `Slide ${content.slide_index || idx + 1}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Carousel Mockup Strip — slides in device frames ─────

function CarouselMockupStrip({
  group,
  onRefine,
}: {
  group: CarouselGroup;
  onRefine?: (asset: GeneratedAsset) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const platformColors: Record<string, string> = {
    linkedin_carousel: "#0A66C2",
    ig_carousel: "#E1306C",
    tiktok_carousel: "#000000",
    wechat_carousel: "#07C160",
  };
  const accent = platformColors[group.platform] || "#6B21A8";

  return (
    <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-[var(--muted)] flex items-center justify-between" style={{ borderLeft: `3px solid ${accent}` }}>
        <div className="flex items-center gap-2">
          <LayoutGrid size={14} style={{ color: accent }} />
          <span className="text-[13px] font-semibold text-[var(--foreground)]">
            {platformLabel(group.platform)}
          </span>
          <span className="text-[11px] text-[var(--muted-foreground)]">
            {group.slides.length} slides
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => scroll("left")} className="p-1 rounded-md hover:bg-white/80 cursor-pointer transition-colors">
            <ChevronLeft size={16} className="text-[var(--muted-foreground)]" />
          </button>
          <button onClick={() => scroll("right")} className="p-1 rounded-md hover:bg-white/80 cursor-pointer transition-colors">
            <ChevronRight size={16} className="text-[var(--muted-foreground)]" />
          </button>
        </div>
      </div>

      {/* Mockup slides */}
      <div
        ref={scrollRef}
        className="flex gap-4 p-4 overflow-x-auto scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {group.slides.map((slide, idx) => {
          const content = (slide.content || {}) as Record<string, any>;
          const copyData = (slide.copy_data || {}) as Record<string, any>;

          return (
            <div
              key={slide.id}
              className="flex-shrink-0 group"
              style={{ width: "280px", scrollSnapAlign: "start" }}
            >
              {/* Device frame */}
              <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-white">
                <div className="bg-[#1a1a1a] p-2 relative">
                  <MockupPreview asset={slide} />
                  {onRefine && (
                    <button
                      onClick={() => onRefine(slide)}
                      className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Request revision"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>

                {/* Slide info */}
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: accent }}>
                      {content.slide_index || idx + 1}
                    </div>
                    {content.slide_role && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold capitalize" style={{ backgroundColor: `${accent}10`, color: accent, border: `1px solid ${accent}20` }}>
                        {content.slide_role}
                      </span>
                    )}
                    {slide.evaluation_score && slide.evaluation_score > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto ${
                        slide.evaluation_score >= 0.85 ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
                      }`}>
                        {(slide.evaluation_score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  {(content.slide_headline || copyData.headline) && (
                    <p className="text-[12px] font-semibold text-[var(--foreground)] line-clamp-2">
                      {content.slide_headline || copyData.headline}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────

export default function AssetReviewPanel({
  assets,
  onRefine,
  onRetry,
}: AssetReviewPanelProps) {
  const [actorFilter, setActorFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  // Categorize assets
  const characters = useMemo(
    () => assets.filter((a) => a.asset_type === "base_image"),
    [assets]
  );
  const singleCreatives = useMemo(
    () => assets.filter((a) => a.asset_type === "composed_creative"),
    [assets]
  );
  const carouselPanels = useMemo(
    () => assets.filter((a) => a.asset_type === "carousel_panel"),
    [assets]
  );
  const carouselGroups = useMemo(
    () => groupCarousels(carouselPanels),
    [carouselPanels]
  );
  const videos = useMemo(
    () => assets.filter((a) => (a.asset_type as string) === "video"),
    [assets]
  );

  // All creatives (singles + carousels) for count
  const allCreatives = useMemo(
    () => [...singleCreatives, ...carouselPanels],
    [singleCreatives, carouselPanels]
  );

  // Top scored for overview
  const topScored = useMemo(
    () =>
      [...characters]
        .filter((a) => (a.evaluation_score || 0) >= 0.85 && a.blob_url)
        .sort((a, b) => (b.evaluation_score || 0) - (a.evaluation_score || 0))
        .slice(0, 9),
    [characters]
  );

  // Unique actor names and platforms for filters
  const actorNames = useMemo(() => {
    const names = new Set<string>();
    characters.forEach((a) => {
      const name = extractField(a.content, "actor_name", "");
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [characters]);

  const platforms = useMemo(() => {
    const plats = new Set<string>();
    allCreatives.forEach((a) => {
      if (a.platform) plats.add(a.platform);
    });
    return Array.from(plats).sort();
  }, [allCreatives]);

  // Filtered views
  const filteredCharacters = useMemo(() => {
    if (actorFilter === "all") return characters;
    return characters.filter(
      (a) => extractField(a.content, "actor_name", "") === actorFilter
    );
  }, [characters, actorFilter]);

  const filteredSingleCreatives = useMemo(() => {
    if (platformFilter === "all") return singleCreatives;
    return singleCreatives.filter((a) => a.platform === platformFilter);
  }, [singleCreatives, platformFilter]);

  const filteredCarouselGroups = useMemo(() => {
    if (platformFilter === "all") return carouselGroups;
    return carouselGroups.filter((g) => g.platform === platformFilter);
  }, [carouselGroups, platformFilter]);

  return (
    <MiniTabs
      defaultTab="overview"
      tabs={[
        // Tab 1: Overview — top scored
        {
          key: "overview",
          label: "Overview",
          count: topScored.length,
          content: (
            <div>
              <p className="text-[12px] text-[var(--muted-foreground)] mb-3">
                Top-scoring character images (85%+ VQA score)
              </p>
              {topScored.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                  {topScored.map((asset) => (
                    <AssetThumb
                      key={asset.id}
                      asset={asset}
                      onRefine={onRefine}
                      onRetry={onRetry}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--muted-foreground)] py-8 text-center">
                  No images with 85%+ score yet. Assets will appear as they pass VQA.
                </p>
              )}
            </div>
          ),
        },

        // Tab 2: Actors + Variations
        ...(characters.length > 0
          ? [
              {
                key: "actors",
                label: "Actors",
                count: characters.length,
                content: (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <FilterDropdown
                        label="Actors"
                        options={actorNames}
                        value={actorFilter}
                        onChange={setActorFilter}
                      />
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {filteredCharacters.length} images
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                      {filteredCharacters.map((asset) => (
                        <AssetThumb
                          key={asset.id}
                          asset={asset}
                          onRefine={onRefine}
                          onRetry={onRetry}
                        />
                      ))}
                    </div>
                  </div>
                ),
              },
            ]
          : []),

        // Tab 3: Creatives — singles + carousels
        ...(allCreatives.length > 0
          ? [
              {
                key: "creatives",
                label: "Creatives",
                count: allCreatives.length,
                content: (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <FilterDropdown
                        label="Platforms"
                        options={platforms}
                        value={platformFilter}
                        onChange={setPlatformFilter}
                      />
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {filteredSingleCreatives.length} singles
                        {filteredCarouselGroups.length > 0 && ` · ${filteredCarouselGroups.length} carousels`}
                      </span>
                    </div>

                    {/* Carousel strips */}
                    {filteredCarouselGroups.length > 0 && (
                      <div className="space-y-4 mb-6">
                        {filteredCarouselGroups.map((group) => (
                          <CarouselStrip
                            key={group.platform}
                            group={group}
                            onRefine={onRefine}
                            onRetry={onRetry}
                          />
                        ))}
                      </div>
                    )}

                    {/* Single creatives grid */}
                    {filteredSingleCreatives.length > 0 && (
                      <>
                        {filteredCarouselGroups.length > 0 && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                            Single Creatives
                          </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                          {filteredSingleCreatives.map((asset) => (
                            <AssetThumb
                              key={asset.id}
                              asset={asset}
                              onRefine={onRefine}
                              onRetry={onRetry}
                              showPlatform
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ),
              },
            ]
          : []),

        // Tab 4: Ad Mockups — singles + carousel mockups
        ...(allCreatives.length > 0
          ? [
              {
                key: "mockups",
                label: "Ad Mockups",
                content: (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <FilterDropdown
                        label="Platforms"
                        options={platforms}
                        value={platformFilter}
                        onChange={setPlatformFilter}
                      />
                    </div>

                    {/* Carousel mockup strips */}
                    {filteredCarouselGroups.length > 0 && (
                      <div className="space-y-4 mb-6">
                        {filteredCarouselGroups.map((group) => (
                          <CarouselMockupStrip
                            key={group.platform}
                            group={group}
                            onRefine={onRefine}
                          />
                        ))}
                      </div>
                    )}

                    {/* Single creative mockups */}
                    {filteredSingleCreatives.length > 0 && (
                      <>
                        {filteredCarouselGroups.length > 0 && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
                            Single Ad Mockups
                          </p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                          {filteredSingleCreatives.slice(0, 12).map((asset) => {
                            const content = (asset.content || {}) as Record<string, any>;
                            const copyData = (asset.copy_data || {}) as Record<string, any>;
                            return (
                              <div
                                key={`mock-${asset.id}`}
                                className="border border-[var(--border)] rounded-xl overflow-hidden bg-white group"
                              >
                                {/* Mockup */}
                                <div className="bg-[#1a1a1a] p-3 relative">
                                  <MockupPreview asset={asset} />
                                  {onRefine && (
                                    <button
                                      onClick={() => onRefine(asset)}
                                      className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                      title="Request revision"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  )}
                                </div>
                                {/* Ad Copy — editable */}
                                <div className="p-4 space-y-2.5">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#0693E308] text-[#0693E3] border border-[#0693E315]">
                                      {platformLabel(asset.platform)}
                                    </span>
                                    <span className="text-[10px] text-[var(--muted-foreground)]">
                                      {asset.format}
                                    </span>
                                    {asset.evaluation_score && (
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ml-auto ${
                                        asset.evaluation_score >= 0.85 ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
                                      }`}>
                                        {(asset.evaluation_score * 100).toFixed(0)}%
                                      </span>
                                    )}
                                  </div>
                                  {/* Headline */}
                                  <div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-0.5">Headline</span>
                                    <EditableField
                                      value={content.overlay_headline || copyData.headline || ""}
                                      editable
                                      onSave={(v) => toast.success(`Headline updated: ${v.slice(0, 30)}...`)}
                                      textClassName="text-[13px] font-semibold text-[var(--foreground)]"
                                    />
                                  </div>
                                  {/* Primary Text / Description */}
                                  <div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-0.5">Description</span>
                                    <EditableField
                                      value={copyData.primary_text || copyData.description || content.overlay_sub || "No description yet"}
                                      editable
                                      onSave={(v) => toast.success("Description updated")}
                                      textClassName="text-[12px] text-[var(--muted-foreground)] leading-relaxed"
                                      multiline
                                    />
                                  </div>
                                  {/* Caption */}
                                  {(copyData.caption || copyData.primary_text) && (
                                    <div>
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-0.5">Caption</span>
                                      <EditableField
                                        value={copyData.caption || copyData.primary_text || ""}
                                        editable
                                        onSave={(v) => toast.success("Caption updated")}
                                        textClassName="text-[11px] text-[var(--muted-foreground)] leading-relaxed"
                                        multiline
                                      />
                                    </div>
                                  )}
                                  {/* CTA */}
                                  <div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-0.5">CTA</span>
                                    <EditableField
                                      value={content.overlay_cta || copyData.cta || "Apply Now"}
                                      editable
                                      onSave={(v) => toast.success(`CTA updated: ${v}`)}
                                      textClassName="text-[12px] font-medium text-[#6B21A8]"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ),
              },
            ]
          : []),

        // Videos moved to own parent LiveSection
      ]}
    />
  );
}
