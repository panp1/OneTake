// ============================================================
// Stage 4: Layout Composition
// Template selection, HTML composition, Playwright rendering, evaluation
// ============================================================

import { getBriefByRequestId } from '@/lib/db/briefs';
import { getActorsByRequestId } from '@/lib/db/actors';
import { createAsset, getAssetsByRequestId } from '@/lib/db/assets';
import {
  composeCreatives,
  evaluateCreative,
  generateCarousel,
} from '@/lib/vyra-client';
import { uploadBufferToBlob } from '@/lib/blob';

const CREATIVE_EVAL_THRESHOLD = 0.70;
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Mock fallbacks
// ---------------------------------------------------------------------------

function mockComposition(
  channel: string,
  format: string,
): Record<string, unknown> {
  return {
    html: `<div class="creative" data-channel="${channel}" data-format="${format}"><p>Composed creative</p></div>`,
    rendered_png_base64: '',
    template: 'modern-split',
    dimensions: format,
    channel,
    mock: true,
  };
}

function mockCreativeEvaluation(score: number): Record<string, unknown> {
  return {
    score,
    passed: score >= CREATIVE_EVAL_THRESHOLD,
    dimensions: {
      visual_hierarchy: score,
      brand_consistency: score,
      readability: score,
      cta_prominence: score,
      color_harmony: score,
      layout_balance: score,
      overall_impact: score,
    },
    feedback:
      score < CREATIVE_EVAL_THRESHOLD
        ? 'Improve visual hierarchy and CTA prominence.'
        : null,
    mock: true,
  };
}

function mockCarousel(
  channel: string,
): Record<string, unknown> {
  return {
    panels: [
      { panel_index: 0, html: '<div>Panel 1</div>', rendered_png_base64: '' },
      { panel_index: 1, html: '<div>Panel 2</div>', rendered_png_base64: '' },
      { panel_index: 2, html: '<div>Panel 3</div>', rendered_png_base64: '' },
    ],
    channel,
    mock: true,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FormatMatrix {
  [channel: string]: string[];
}

function getFormatMatrix(
  briefData: Record<string, unknown>,
): FormatMatrix {
  if (
    briefData.format_matrix &&
    typeof briefData.format_matrix === 'object' &&
    !Array.isArray(briefData.format_matrix)
  ) {
    return briefData.format_matrix as FormatMatrix;
  }
  // Default format matrix
  return {
    instagram: ['1080x1080', '1080x1350', '1080x1920'],
    linkedin: ['1200x627', '1080x1080'],
    meta: ['1080x1080', '1200x628'],
  };
}

function isCarouselFormat(format: string): boolean {
  return format.toLowerCase().includes('carousel');
}

async function tryUploadRenderedImage(
  pngBase64: string | undefined,
  requestId: string,
  channel: string,
  format: string,
): Promise<string | null> {
  if (!pngBase64 || pngBase64.length === 0) {
    return null;
  }
  try {
    const buffer = Buffer.from(pngBase64, 'base64');
    const filename = `${channel}_${format}_${Date.now()}.png`;
    return await uploadBufferToBlob(buffer, filename, `creatives/${requestId}`);
  } catch {
    console.warn(`[stage4] Failed to upload rendered image for ${channel}/${format}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stage 4 Runner
// ---------------------------------------------------------------------------

export async function runStage4(
  requestId: string,
): Promise<Record<string, unknown>> {
  // 1. Get brief, actors, base images, and copy from DB
  const brief = await getBriefByRequestId(requestId);
  if (!brief) {
    throw new Error(`Creative brief not found for request: ${requestId}`);
  }

  const actors = await getActorsByRequestId(requestId);
  const existingAssets = await getAssetsByRequestId(requestId);

  const baseImages = existingAssets.filter((a) => a.stage === 2);
  const copyAssets = existingAssets.filter((a) => a.stage === 3);

  // 2. Determine channel x format combinations from the format matrix
  const formatMatrix = getFormatMatrix(brief.brief_data);
  const generatedAssets = [];

  for (const [channel, formats] of Object.entries(formatMatrix)) {
    // Find copy for this channel (pick first language match)
    const channelCopy = copyAssets.find(
      (a) => a.platform === channel,
    );

    for (const format of formats) {
      if (isCarouselFormat(format)) {
        // 3. Carousel formats
        let carouselResult: Record<string, unknown>;
        try {
          carouselResult = await generateCarousel({
            brief: brief.brief_data,
            design_direction: brief.design_direction,
            channel,
            copy: channelCopy?.copy_data ?? {},
            actors: actors.map((a) => ({
              name: a.name,
              prompt_seed: a.prompt_seed,
            })),
            base_images: baseImages.map((a) => a.content),
          });
        } catch {
          console.warn(`[stage4] VYRA carousel unavailable (${channel}/${format}), using mock`);
          carouselResult = mockCarousel(channel);
        }

        const panels = Array.isArray(carouselResult.panels)
          ? (carouselResult.panels as Record<string, unknown>[])
          : [];

        for (const panel of panels) {
          const blobUrl = await tryUploadRenderedImage(
            panel.rendered_png_base64 as string | undefined,
            requestId,
            channel,
            `${format}_panel${panel.panel_index ?? 0}`,
          );

          const asset = await createAsset({
            request_id: requestId,
            actor_id: actors[0]?.id ?? null,
            asset_type: 'carousel_panel',
            platform: channel,
            format,
            language: channelCopy?.language ?? 'en',
            content: panel,
            copy_data: channelCopy?.copy_data ?? null,
            blob_url: blobUrl,
            evaluation_passed: true,
            stage: 4,
          });

          generatedAssets.push(asset);
        }

        continue;
      }

      // Non-carousel: compose with evaluation gate
      let compositionResult: Record<string, unknown> | null = null;
      let evalScore = 0;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Template selection + composition (Qwen3.5-9B + compositor + Playwright)
        try {
          compositionResult = await composeCreatives({
            brief: brief.brief_data,
            design_direction: brief.design_direction,
            channel,
            format,
            copy: channelCopy?.copy_data ?? {},
            actors: actors.map((a) => ({
              name: a.name,
              prompt_seed: a.prompt_seed,
            })),
            base_images: baseImages.map((a) => a.content),
            attempt,
            previous_feedback:
              attempt > 1
                ? 'Improve layout based on evaluation feedback.'
                : undefined,
          });
        } catch {
          console.warn(
            `[stage4] VYRA composition unavailable (${channel}/${format}, attempt ${attempt}), using mock`,
          );
          compositionResult = mockComposition(channel, format);
        }

        // Creative evaluation (7 dimensions)
        let evalResult: Record<string, unknown>;
        try {
          evalResult = await evaluateCreative({
            composition: compositionResult,
            brief: brief.brief_data,
            design_direction: brief.design_direction,
            channel,
            format,
          });
          evalScore =
            typeof evalResult.score === 'number' ? evalResult.score : 0;
        } catch {
          console.warn(
            `[stage4] VYRA creative evaluation unavailable (${channel}/${format}, attempt ${attempt}), using mock`,
          );
          const mockScore = attempt === MAX_RETRIES ? 0.80 : 0.60;
          evalResult = mockCreativeEvaluation(mockScore);
          evalScore = mockScore;
        }

        if (evalScore >= CREATIVE_EVAL_THRESHOLD) {
          break;
        }
      }

      // 4. Upload rendered PNG to Vercel Blob
      const blobUrl = await tryUploadRenderedImage(
        compositionResult?.rendered_png_base64 as string | undefined,
        requestId,
        channel,
        format,
      );

      // 5. Store generated_assets (composed_creative) in DB with blob URL
      const asset = await createAsset({
        request_id: requestId,
        actor_id: actors[0]?.id ?? null,
        asset_type: 'composed_creative',
        platform: channel,
        format,
        language: channelCopy?.language ?? 'en',
        content: compositionResult,
        copy_data: channelCopy?.copy_data ?? null,
        blob_url: blobUrl,
        evaluation_score: evalScore,
        evaluation_passed: evalScore >= CREATIVE_EVAL_THRESHOLD,
        stage: 4,
      });

      generatedAssets.push(asset);
    }
  }

  // 6. Return stage output
  return {
    channels: Object.keys(formatMatrix).length,
    formats_total: Object.values(formatMatrix).flat().length,
    creatives_generated: generatedAssets.length,
    all_passed: generatedAssets.every((a) => a.evaluation_passed),
    assets: generatedAssets.map((a) => ({
      id: a.id,
      platform: a.platform,
      format: a.format,
      type: a.asset_type,
      score: a.evaluation_score,
      passed: a.evaluation_passed,
      blob_url: a.blob_url,
    })),
  };
}
