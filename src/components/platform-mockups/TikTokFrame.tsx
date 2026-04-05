'use client';

/**
 * TikTok feed preview frame.
 *
 * Renders a 9:16 tall frame with video/image background, right sidebar
 * (heart, comment, share, music icons), bottom text overlay with caption
 * + hashtags + music info, and "Ad" badge.
 */

import { Heart, MessageCircle, Share2, Music } from 'lucide-react';
import type { MockupCreative } from '@/lib/mockup-types';

interface PlatformFrameProps {
  creative: MockupCreative;
  className?: string;
}

export function TikTokFrame({ creative, className = '' }: PlatformFrameProps) {
  const imageUrl = creative.imageUrl ?? '';
  const videoUrl = creative.videoUrl ?? '';
  const primaryText = creative.primaryText ?? '';
  const ctaText = creative.ctaText ?? 'Learn More';
  const hashtags = creative.hashtags ?? [];
  const brandName = creative.brandName ?? 'OneForma';

  const mediaUrl = videoUrl || imageUrl;

  return (
    <div className={`rounded-[14px] border border-white/[0.06] bg-[#141414] overflow-hidden ${className}`}>
      {/* Platform label */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="w-4 h-4 rounded-sm bg-black flex items-center justify-center border border-white/10">
          <span className="text-[8px] font-bold text-white">TT</span>
        </div>
        <span className="text-xs font-medium text-white/60">TikTok</span>
      </div>

      {/* TikTok feed mockup - dark, full-bleed */}
      <div className="relative aspect-[9/16] max-h-[480px] bg-black overflow-hidden">
        {/* Background media */}
        {mediaUrl ? (
          videoUrl ? (
            <video
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
            />
          ) : (
            <img src={mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#1a1a1a] to-[#000]">
            <span className="text-white/30 text-sm">1080 x 1920</span>
          </div>
        )}

        {/* Ad badge */}
        <div className="absolute top-3 left-3 z-10">
          <span className="bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded">
            Sponsored
          </span>
        </div>

        {/* Right sidebar */}
        <div className="absolute right-2 bottom-28 flex flex-col items-center gap-5 z-10">
          {/* Profile */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#32373C] border-2 border-white flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                {brandName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#FE2C55] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">+</span>
            </div>
          </div>

          {/* Heart */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 flex items-center justify-center">
              <Heart className="w-7 h-7 text-white drop-shadow-lg" />
            </div>
            <span className="text-[11px] text-white font-semibold drop-shadow-lg">45.2K</span>
          </div>

          {/* Comment */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
            </div>
            <span className="text-[11px] text-white font-semibold drop-shadow-lg">892</span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 flex items-center justify-center">
              <Share2 className="w-7 h-7 text-white drop-shadow-lg" />
            </div>
            <span className="text-[11px] text-white font-semibold drop-shadow-lg">1,234</span>
          </div>

          {/* Music disc */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#333] to-[#111] border-2 border-[#444] flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
            <div className="w-3 h-3 rounded-full bg-[#FE2C55]" />
          </div>
        </div>

        {/* Bottom text overlay */}
        <div className="absolute bottom-12 inset-x-0 z-10 p-3 pr-16 bg-gradient-to-t from-black/70 to-transparent pt-16">
          {/* Brand name */}
          <p className="text-[15px] font-semibold text-white mb-1 drop-shadow-lg">
            @{brandName.toLowerCase().replace(/\s+/g, '')}
          </p>

          {/* Caption */}
          {primaryText && (
            <p className="text-[13px] text-white leading-[1.3] line-clamp-2 mb-1 drop-shadow-lg">
              {primaryText}
            </p>
          )}

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <p className="text-[13px] text-white/90 line-clamp-1 mb-2 drop-shadow-lg">
              {hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ')}
            </p>
          )}

          {/* Music bar */}
          <div className="flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-white" />
            <div className="overflow-hidden flex-1">
              <p className="text-[12px] text-white truncate">Original Sound</p>
            </div>
          </div>
        </div>

        {/* CTA button — full-width at bottom */}
        <div className="absolute bottom-0 inset-x-0 z-10 px-3 pb-3">
          <button className="w-full py-2.5 bg-[#FE2C55] text-white text-[14px] font-semibold rounded-lg">
            {ctaText}
          </button>
        </div>
      </div>
    </div>
  );
}
