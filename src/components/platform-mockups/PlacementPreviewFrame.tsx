'use client';

/**
 * PlacementPreviewFrame -- Dispatcher component.
 *
 * Switches on creative.platform to render the correct platform-specific
 * preview frame. Falls back to a generic preview for unknown platforms.
 */

import type { MockupCreative } from '@/lib/mockup-types';
import { InstagramFeedFrame } from './InstagramFeedFrame';
import { InstagramStoryFrame } from './InstagramStoryFrame';
import { FacebookFeedFrame } from './FacebookFeedFrame';
import { LinkedInFeedFrame } from './LinkedInFeedFrame';
import { TikTokFrame } from './TikTokFrame';
import { TelegramCardFrame } from './TelegramCardFrame';

interface PlacementPreviewFrameProps {
  creative: MockupCreative;
  className?: string;
}

/**
 * Dispatcher that renders the correct platform frame based on
 * creative.platform and creative.placement.
 */
export function PlacementPreviewFrame({ creative, className = '' }: PlacementPreviewFrameProps) {
  switch (creative.platform) {
    case 'instagram':
      // Instagram has multiple placements
      if (creative.placement === 'stories' || creative.placement === 'reels') {
        return <InstagramStoryFrame creative={creative} className={className} />;
      }
      return <InstagramFeedFrame creative={creative} className={className} />;

    case 'facebook':
      return <FacebookFeedFrame creative={creative} className={className} />;

    case 'linkedin':
      return <LinkedInFeedFrame creative={creative} className={className} />;

    case 'tiktok':
      return <TikTokFrame creative={creative} className={className} />;

    case 'telegram':
      return <TelegramCardFrame creative={creative} className={className} />;

    default:
      return <GenericPreview creative={creative} className={className} />;
  }
}

// -- Fallback for unknown platforms ----------------------------------------

function GenericPreview({ creative, className = '' }: PlacementPreviewFrameProps) {
  return (
    <div className={`rounded-[14px] border border-white/[0.06] bg-[#141414] overflow-hidden ${className}`}>
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
        <div className="w-4 h-4 rounded-sm bg-white/10 flex items-center justify-center">
          <span className="text-[9px] font-bold text-white/60">?</span>
        </div>
        <span className="text-xs font-medium text-white/60">
          {creative.platform} / {creative.placement}
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">
          Creative Preview
        </p>
        <div className="text-xs text-white/60 bg-[#0A0A0A] rounded-[10px] p-3 overflow-auto max-h-[300px] space-y-1">
          {Object.entries(creative).map(([key, val]) => {
            if (!val || key === "id") return null;
            const display = typeof val === "object" ? null : String(val);
            if (!display) return null;
            return (
              <div key={key}>
                <span className="text-white/30 text-[10px] uppercase">{key.replace(/_/g, " ")}: </span>
                <span className="text-white/70">{display}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
