'use client';

/**
 * Instagram story preview frame.
 *
 * Renders a 9:16 tall frame with image/video background, text overlay area,
 * swipe-up/link CTA at bottom, and progress bar at top.
 */

import { ChevronUp } from 'lucide-react';
import type { MockupCreative } from '@/lib/mockup-types';

interface PlatformFrameProps {
  creative: MockupCreative;
  className?: string;
}

export function InstagramStoryFrame({ creative, className = '' }: PlatformFrameProps) {
  const imageUrl = creative.imageUrl ?? '';
  const videoUrl = creative.videoUrl ?? '';
  const primaryText = creative.primaryText ?? '';
  const ctaText = creative.ctaText ?? 'Learn More';
  const brandName = creative.brandName ?? 'OneForma';

  const mediaUrl = videoUrl || imageUrl;

  return (
    <div className={`rounded-[14px] border border-white/[0.06] bg-[#141414] overflow-hidden ${className}`}>
      {/* Platform label */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">I</span>
        </div>
        <span className="text-xs font-medium text-white/60">Instagram Story</span>
      </div>

      {/* Story mockup - dark/full-bleed */}
      <div className="relative aspect-[9/16] max-h-[480px] bg-gradient-to-b from-[#1a1a2e] to-[#16213e] overflow-hidden">
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
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/40 text-sm">1080 x 1920</span>
          </div>
        )}

        {/* Progress bar at top */}
        <div className="absolute top-0 inset-x-0 px-2 pt-2 z-10">
          <div className="h-[2px] rounded-full bg-white/30 overflow-hidden">
            <div className="h-full w-1/3 bg-white rounded-full" />
          </div>
        </div>

        {/* Header */}
        <div className="absolute top-3 inset-x-0 px-3 flex items-center gap-2 z-10">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#833AB4] to-[#F77737] p-[1.5px]">
            <div className="w-full h-full rounded-full bg-[#262626] flex items-center justify-center">
              <span className="text-[9px] font-semibold text-white">
                {brandName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <span className="text-[13px] font-semibold text-white drop-shadow-sm">{brandName}</span>
          <span className="text-[11px] text-white/60 drop-shadow-sm">Sponsored</span>
        </div>

        {/* Text overlay */}
        {primaryText && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 z-10">
            <p className="text-white text-center text-lg font-semibold leading-tight drop-shadow-lg line-clamp-4">
              {primaryText}
            </p>
          </div>
        )}

        {/* CTA at bottom — Instagram native style */}
        <div className="absolute bottom-0 inset-x-0 z-10">
          <div className="flex flex-col items-center gap-2 pb-5 pt-10 bg-gradient-to-t from-black/60 to-transparent">
            <ChevronUp className="w-5 h-5 text-white animate-bounce" />
            <button className="px-6 py-2 bg-white text-[#262626] text-[13px] font-semibold rounded-full shadow-lg">
              {ctaText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
