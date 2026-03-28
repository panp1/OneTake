'use client';

/**
 * Facebook feed ad preview frame.
 *
 * Renders header (page avatar + page name + "Sponsored"), primary text,
 * landscape image, headline + description bar below image, and CTA button.
 */

import { ThumbsUp, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';
import type { MockupCreative } from '@/lib/mockup-types';

interface PlatformFrameProps {
  creative: MockupCreative;
  className?: string;
}

export function FacebookFeedFrame({ creative, className = '' }: PlatformFrameProps) {
  const imageUrl = creative.imageUrl ?? '';
  const primaryText = creative.primaryText ?? '';
  const headline = creative.headline ?? '';
  const description = creative.description ?? '';
  const ctaText = creative.ctaText ?? 'Learn More';
  const brandName = creative.brandName ?? 'OneForma';

  return (
    <div className={`rounded-[14px] border border-white/[0.06] bg-[#141414] overflow-hidden ${className}`}>
      {/* Platform label */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="w-4 h-4 rounded-sm bg-[#1877F2] flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">f</span>
        </div>
        <span className="text-xs font-medium text-white/60">Facebook Feed</span>
      </div>

      {/* Facebook post mockup - light background */}
      <div className="bg-white">
        {/* Post header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#32373C] flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                {brandName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#050505] leading-tight">{brandName}</p>
              <p className="text-[12px] text-[#65676B] leading-tight">
                Sponsored · <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#65676B]/30 align-middle" />
              </p>
            </div>
          </div>
          <MoreHorizontal className="w-5 h-5 text-[#65676B]" />
        </div>

        {/* Primary text */}
        {primaryText && (
          <div className="px-3 pb-2">
            <p className="text-[15px] text-[#050505] leading-[1.33] line-clamp-3">{primaryText}</p>
          </div>
        )}

        {/* Image - landscape */}
        <div className="aspect-[1200/628] bg-gradient-to-br from-[#f0f2f5] to-[#dadde1] relative">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#65676B] text-sm">1200 x 628</span>
            </div>
          )}
        </div>

        {/* Below-image headline + CTA */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-[#f0f2f5] border-t border-[#dadde1]">
          <div className="flex-1 min-w-0 mr-3">
            {headline && (
              <h4 className="text-[15px] font-semibold text-[#050505] truncate">{headline}</h4>
            )}
            {description && (
              <p className="text-[13px] text-[#65676B] truncate">{description}</p>
            )}
          </div>
          <button className="shrink-0 px-4 py-1.5 bg-[#e4e6eb] text-[#050505] text-[13px] font-semibold rounded-md hover:bg-[#d8dadf] transition-colors">
            {ctaText}
          </button>
        </div>

        {/* Engagement row */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-[#dadde1]">
          <button className="flex items-center gap-1.5 text-[#65676B] text-[14px] font-semibold hover:bg-[#f0f2f5] px-3 py-1.5 rounded-md transition-colors">
            <ThumbsUp className="w-4 h-4" /> Like
          </button>
          <button className="flex items-center gap-1.5 text-[#65676B] text-[14px] font-semibold hover:bg-[#f0f2f5] px-3 py-1.5 rounded-md transition-colors">
            <MessageCircle className="w-4 h-4" /> Comment
          </button>
          <button className="flex items-center gap-1.5 text-[#65676B] text-[14px] font-semibold hover:bg-[#f0f2f5] px-3 py-1.5 rounded-md transition-colors">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>
    </div>
  );
}
