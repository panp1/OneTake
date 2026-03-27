// ============================================================
// Stage 5: Surface & Distribute
// Gather all assets, update status, create notification records
// ============================================================

import { getIntakeRequest, updateIntakeRequest } from '@/lib/db/intake';
import { getAssetsByRequestId } from '@/lib/db/assets';
import { getBriefByRequestId } from '@/lib/db/briefs';
import { createNotification } from '@/lib/db/notifications';

// ---------------------------------------------------------------------------
// Stage 5 Runner
// ---------------------------------------------------------------------------

export async function runStage5(
  requestId: string,
): Promise<Record<string, unknown>> {
  // 1. Get all assets for request from DB
  const request = await getIntakeRequest(requestId);
  if (!request) {
    throw new Error(`Intake request not found: ${requestId}`);
  }

  const assets = await getAssetsByRequestId(requestId);
  const brief = await getBriefByRequestId(requestId);

  // Categorize assets by type
  const baseImages = assets.filter((a) => a.asset_type === 'base_image');
  const composedCreatives = assets.filter(
    (a) => a.asset_type === 'composed_creative',
  );
  const carouselPanels = assets.filter(
    (a) => a.asset_type === 'carousel_panel',
  );
  const copyAssets = assets.filter((a) => a.stage === 3);

  // 2. Update intake_requests status to 'review'
  await updateIntakeRequest(requestId, { status: 'review' });

  // 3. Create notification records (but don't send yet -- that's Task 9)
  //    Notify the request creator via Slack
  await createNotification({
    request_id: requestId,
    channel: 'slack',
    recipient: request.created_by,
    status: 'sent', // Will be updated to 'delivered' by Task 9 when actually sent
    payload: {
      type: 'pipeline_complete',
      title: request.title,
      task_type: request.task_type,
      total_assets: assets.length,
      base_images: baseImages.length,
      composed_creatives: composedCreatives.length,
      carousel_panels: carouselPanels.length,
      copy_variants: copyAssets.length,
      message: `Pipeline complete for "${request.title}". ${assets.length} assets generated and ready for review.`,
    },
  });

  // Also create an Outlook notification record for email follow-up
  await createNotification({
    request_id: requestId,
    channel: 'outlook',
    recipient: request.created_by,
    status: 'sent',
    payload: {
      type: 'pipeline_complete',
      subject: `Creative assets ready for review: ${request.title}`,
      title: request.title,
      total_assets: assets.length,
    },
  });

  // 4. Return summary of what was generated
  const platforms = [...new Set(assets.map((a) => a.platform))];
  const languages = [...new Set(assets.map((a) => a.language))];

  return {
    request_id: requestId,
    status: 'review',
    summary: {
      total_assets: assets.length,
      base_images: baseImages.length,
      composed_creatives: composedCreatives.length,
      carousel_panels: carouselPanels.length,
      copy_variants: copyAssets.length,
      platforms,
      languages,
      all_evaluations_passed: assets
        .filter((a) => a.evaluation_score !== null)
        .every((a) => a.evaluation_passed),
    },
    brief_id: brief?.id ?? null,
    notifications_created: 2,
  };
}
