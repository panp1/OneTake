'use client';

/**
 * LinkedIn sponsored post preview frame.
 *
 * Renders header (company logo + company name + "Promoted"), intro text,
 * image area (1200x627), headline + link below, CTA button.
 */

import { ThumbsUp, MessageCircle, Repeat2, Send, MoreHorizontal } from 'lucide-react';
import type { MockupCreative } from '@/lib/mockup-types';

interface PlatformFrameProps {
  creative: MockupCreative;
  className?: string;
}

export function LinkedInFeedFrame({ creative, className = '' }: PlatformFrameProps) {
  const imageUrl = creative.imageUrl ?? '';
  const primaryText = creative.primaryText ?? '';
  const headline = creative.headline ?? '';
  const description = creative.description ?? '';
  const ctaText = creative.ctaText ?? 'Learn More';
  const brandName = creative.brandName ?? 'OneForma';
  const displayUrl = creative.displayUrl ?? 'oneforma.com';

  return (
    <div className={`rounded-[14px] border border-white/[0.06] bg-[#141414] overflow-hidden ${className}`}>
      {/* Platform label */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="w-4 h-4 rounded-sm bg-[#0A66C2] flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">in</span>
        </div>
        <span className="text-xs font-medium text-white/60">LinkedIn Feed</span>
      </div>

      {/* LinkedIn post mockup - white background */}
      <div className="bg-white">
        {/* Post header */}
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 rounded-md bg-[#32373C] flex items-center justify-center">
              <span className="text-lg font-bold text-white">
                {brandName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#000000e6] leading-tight">{brandName}</p>
              <p className="text-[12px] text-[#00000099] leading-tight">1,234 followers</p>
              <p className="text-[12px] text-[#00000099] leading-tight">Promoted</p>
            </div>
          </div>
          <MoreHorizontal className="w-5 h-5 text-[#00000099]" />
        </div>

        {/* Intro text */}
        {primaryText && (
          <div className="px-3 pb-2">
            <p className="text-[14px] text-[#000000e6] leading-[1.4] line-clamp-3">{primaryText}</p>
          </div>
        )}

        {/* Image - 1200x627 landscape */}
        <div className="aspect-[1200/627] bg-gradient-to-br from-[#f3f2ef] to-[#e8e7e4] relative">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#00000066] text-sm">1200 x 627</span>
            </div>
          )}
        </div>

        {/* Headline + Description + CTA below image */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-[#e8e7e4]">
          <div className="flex-1 min-w-0 mr-3">
            <h4 className="text-[14px] font-semibold text-[#000000e6] truncate leading-tight">
              {headline || 'Headline goes here'}
            </h4>
            <p className="text-[12px] text-[#00000099] truncate leading-tight">
              {displayUrl}
            </p>
            <p className="text-[13px] text-[#00000099] truncate leading-tight mt-0.5">
              {description || 'Description goes here'}
            </p>
          </div>
          <button className="shrink-0 px-4 py-1.5 border-2 border-[#0A66C2] text-[#0A66C2] text-[14px] font-semibold rounded-full hover:bg-[#0A66C2]/5 transition-colors">
            {ctaText}
          </button>
        </div>

        {/* Engagement row */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#e8e7e4]">
          <button className="flex items-center gap-1.5 text-[#00000099] text-[13px] font-semibold hover:bg-[#f3f2ef] px-2 py-2 rounded transition-colors">
            <ThumbsUp className="w-4 h-4" /> Like
          </button>
          <button className="flex items-center gap-1.5 text-[#00000099] text-[13px] font-semibold hover:bg-[#f3f2ef] px-2 py-2 rounded transition-colors">
            <MessageCircle className="w-4 h-4" /> Comment
          </button>
          <button className="flex items-center gap-1.5 text-[#00000099] text-[13px] font-semibold hover:bg-[#f3f2ef] px-2 py-2 rounded transition-colors">
            <Repeat2 className="w-4 h-4" /> Repost
          </button>
          <button className="flex items-center gap-1.5 text-[#00000099] text-[13px] font-semibold hover:bg-[#f3f2ef] px-2 py-2 rounded transition-colors">
            <Send className="w-4 h-4" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
