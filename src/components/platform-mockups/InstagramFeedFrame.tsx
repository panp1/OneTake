'use client';

/**
 * Instagram feed post preview frame.
 *
 * Renders header bar (avatar + brand name + menu), square/portrait image,
 * action row (heart, comment, send, bookmark), like count, caption with
 * truncation, and hashtags.
 */

import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';
import type { MockupCreative } from '@/lib/mockup-types';

interface PlatformFrameProps {
  creative: MockupCreative;
  className?: string;
}

export function InstagramFeedFrame({ creative, className = '' }: PlatformFrameProps) {
  const imageUrl = creative.imageUrl ?? '';
  const primaryText = creative.primaryText ?? '';
  const headline = creative.headline ?? '';
  const description = creative.description ?? '';
  const ctaText = creative.ctaText ?? 'Learn More';
  const hashtags = creative.hashtags ?? [];
  const brandName = creative.brandName ?? 'OneForma';
  const displayUrl = creative.displayUrl ?? 'oneforma.com';

  return (
    <div className={`rounded-[14px] border border-white/[0.06] bg-[#141414] overflow-hidden ${className}`}>
      {/* Platform label */}
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="w-4 h-4 rounded-sm bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] flex items-center justify-center">
          <span className="text-[9px] font-bold text-white">I</span>
        </div>
        <span className="text-xs font-medium text-white/60">Instagram Feed</span>
      </div>

      {/* Instagram post mockup - white background */}
      <div className="bg-white">
        {/* Post header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] p-[2px]">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <span className="text-[10px] font-semibold text-[#262626]">
                  {brandName.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#262626] leading-tight">{brandName}</p>
              <p className="text-[11px] text-[#8e8e8e] leading-tight">Sponsored</p>
            </div>
          </div>
          <MoreHorizontal className="w-5 h-5 text-[#262626]" />
        </div>

        {/* Image */}
        <div className="aspect-square bg-gradient-to-br from-[#efefef] to-[#dbdbdb] relative">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#8e8e8e] text-sm">1080 x 1080</span>
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-4">
            <Heart className="w-6 h-6 text-[#262626]" />
            <MessageCircle className="w-6 h-6 text-[#262626]" />
            <Send className="w-6 h-6 text-[#262626]" />
          </div>
          <Bookmark className="w-6 h-6 text-[#262626]" />
        </div>

        {/* Likes */}
        <div className="px-3 pb-1">
          <p className="text-[13px] font-semibold text-[#262626]">1,234 likes</p>
        </div>

        {/* Caption */}
        <div className="px-3 pb-2">
          {primaryText && (
            <p className="text-[13px] text-[#262626] line-clamp-3">
              <span className="font-semibold">{brandName}</span>{' '}
              {primaryText}
            </p>
          )}
          {hashtags.length > 0 && (
            <p className="text-[13px] text-[#00376B] mt-0.5 line-clamp-1">
              {hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ')}
            </p>
          )}
        </div>

        {/* Headline + Description + CTA bar (below-image card) */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-[#efefef]">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-[11px] text-[#8e8e8e] uppercase tracking-wide truncate">
              {displayUrl}
            </p>
            <h4 className="text-[15px] font-semibold text-[#262626] truncate leading-tight">
              {headline || 'Headline goes here'}
            </h4>
            <p className="text-[13px] text-[#8e8e8e] truncate leading-tight">
              {description || 'Description goes here'}
            </p>
          </div>
          <button className="shrink-0 px-4 py-1.5 bg-[#0095F6] text-white text-[13px] font-semibold rounded-full">
            {ctaText}
          </button>
        </div>
      </div>
    </div>
  );
}
