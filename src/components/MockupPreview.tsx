'use client';

import { PlacementPreviewFrame } from '@/components/platform-mockups/PlacementPreviewFrame';
import type { MockupCreative } from '@/lib/mockup-types';
import type { GeneratedAsset } from '@/lib/types';

interface MockupPreviewProps {
  asset: GeneratedAsset;
}

/**
 * Maps a GeneratedAsset to MockupCreative and wraps it in
 * the platform-specific preview frame.
 */
export default function MockupPreview({ asset }: MockupPreviewProps) {
  const content = asset.content as Record<string, unknown> | null;
  const copyData = asset.copy_data as Record<string, unknown> | null;

  const creative: MockupCreative = {
    platform: asset.platform.toLowerCase(),
    placement: (content?.placement as string) || 'feed',
    imageUrl: asset.blob_url || undefined,
    headline: (copyData?.headline as string) || (content?.headline as string) || undefined,
    description: (copyData?.description as string) || (content?.subheadline as string) || undefined,
    primaryText: (copyData?.primary_text as string) || undefined,
    ctaText: (copyData?.cta_text as string) || (content?.cta_text as string) || undefined,
    brandName: (content?.brand_name as string) || undefined,
    brandLogoUrl: (content?.brand_logo_url as string) || undefined,
    caption: (copyData?.caption as string) || undefined,
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-2 bg-[#1a1a1a] rounded-xl">
      <PlacementPreviewFrame creative={creative} className="w-full" />
    </div>
  );
}
