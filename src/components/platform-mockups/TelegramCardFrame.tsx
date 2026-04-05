'use client';

/**
 * Telegram sponsored message preview frame.
 *
 * Telegram sponsored messages are TEXT-ONLY — no images, no external URLs.
 * Renders: "Sponsored" label, message text (160 chars max), single button
 * (auto-labeled "Open Channel" / "Open Bot"), Telegram blue theme.
 */

import type { MockupCreative } from '@/lib/mockup-types';

interface PlatformFrameProps {
  creative: MockupCreative;
  className?: string;
}

export function TelegramCardFrame({ creative, className = '' }: PlatformFrameProps) {
  const messageText = creative.caption ?? creative.primaryText ?? '';
  const brandName = creative.brandName ?? 'OneForma';
  const ctaText = creative.ctaText ?? 'Open Channel';

  return (
    <div className={`rounded-[14px] border border-white/[0.06] bg-[#141414] overflow-hidden ${className}`}>
      {/* Platform label */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="w-4 h-4 rounded-sm bg-[#0088cc] flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">T</span>
        </div>
        <span className="text-xs font-medium text-white/60">Telegram Sponsored</span>
      </div>

      {/* Telegram chat background */}
      <div className="bg-[#0e1621] p-4">
        {/* Sponsored message bubble */}
        <div className="bg-[#182533] rounded-xl overflow-hidden max-w-[340px] shadow-lg">
          {/* Sponsored label */}
          <div className="px-3 pt-2.5 pb-1">
            <span className="text-[11px] text-[#0088cc] font-medium">Sponsored</span>
          </div>

          {/* Brand avatar + name */}
          <div className="flex items-center gap-2 px-3 pb-2">
            <div className="w-8 h-8 rounded-full bg-[#32373C] flex items-center justify-center shrink-0">
              <span className="text-[11px] font-bold text-white">
                {brandName.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-[14px] font-semibold text-white truncate">{brandName}</p>
          </div>

          {/* Message text — 160 char max, text-only */}
          <div className="px-3 pb-2">
            <p className="text-[14px] text-white/90 leading-[1.45] whitespace-pre-wrap">
              {messageText || 'Your sponsored message text goes here. Telegram supports bold and italic formatting. 160 characters max.'}
            </p>
          </div>

          {/* Single CTA button */}
          <div className="px-3 pb-2.5">
            <button className="w-full py-2 bg-[#0088cc]/15 text-[#6AB3F3] text-[14px] font-medium rounded-lg border border-[#0088cc]/20">
              {ctaText}
            </button>
          </div>

          {/* Timestamp */}
          <div className="flex items-center justify-end px-3 pb-2">
            <span className="text-[12px] text-white/30">3:42 PM</span>
          </div>
        </div>

        {/* Info note */}
        <div className="mt-3 text-center">
          <p className="text-[11px] text-white/25">Text-only &middot; No images &middot; 160 char limit</p>
        </div>
      </div>
    </div>
  );
}
