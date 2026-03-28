'use client';

/**
 * Telegram image card preview frame.
 *
 * Renders a Telegram-style message bubble with brand channel name,
 * blue verification badge, landscape image (1280x720), caption text,
 * views count, share button, and "Sponsored" label.
 */

import { Eye, Share2, Check } from 'lucide-react';
import type { MockupCreative } from '@/lib/mockup-types';

interface PlatformFrameProps {
  creative: MockupCreative;
  className?: string;
}

export function TelegramCardFrame({ creative, className = '' }: PlatformFrameProps) {
  const imageUrl = creative.imageUrl ?? '';
  const caption = creative.caption ?? creative.primaryText ?? '';
  const brandName = creative.brandName ?? 'OneForma';
  const ctaText = creative.ctaText ?? 'Learn More';

  return (
    <div className={`rounded-[14px] border border-white/[0.06] bg-[#141414] overflow-hidden ${className}`}>
      {/* Platform label */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="w-4 h-4 rounded-sm bg-[#0088cc] flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">T</span>
        </div>
        <span className="text-xs font-medium text-white/60">Telegram</span>
      </div>

      {/* Telegram chat background */}
      <div className="bg-[#0e1621] p-3">
        {/* Message bubble */}
        <div className="bg-[#182533] rounded-xl overflow-hidden max-w-[340px] shadow-lg">
          {/* Channel header */}
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <div className="w-8 h-8 rounded-full bg-[#32373C] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-white">
                {brandName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <p className="text-[14px] font-semibold text-white truncate">{brandName}</p>
              {/* Blue verification badge */}
              <div className="w-4 h-4 rounded-full bg-[#0088cc] flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </div>
            </div>
          </div>

          {/* Image - 1280x720 landscape */}
          <div className="aspect-[1280/720] bg-gradient-to-br from-[#1a2836] to-[#0e1621] relative mx-1.5 rounded-lg overflow-hidden">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white/30 text-sm">1280 x 720</span>
              </div>
            )}
          </div>

          {/* Caption */}
          {caption && (
            <div className="px-3 pt-2">
              <p className="text-[14px] text-white/90 leading-[1.4] line-clamp-3">{caption}</p>
            </div>
          )}

          {/* CTA button */}
          <div className="px-3 pt-2">
            <button className="w-full py-2 bg-[#0088cc] text-white text-[14px] font-medium rounded-lg hover:bg-[#0077b5] transition-colors">
              {ctaText}
            </button>
          </div>

          {/* Footer: views + timestamp + sponsored label */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-white/40">
                <Eye className="w-3.5 h-3.5" />
                <span className="text-[12px]">12.4K</span>
              </div>
              <span className="text-[12px] text-white/40">3:42 PM</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#0088cc] font-medium">Sponsored</span>
              <Share2 className="w-3.5 h-3.5 text-white/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
