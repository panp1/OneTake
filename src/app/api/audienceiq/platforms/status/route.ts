import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getGoogleAdsStatus } from '@/lib/platforms/google-ads';
import { getMetaAdsStatus } from '@/lib/platforms/meta-ads';
import { getLinkedInAdsStatus } from '@/lib/platforms/linkedin-ads';
import { getTikTokAdsStatus } from '@/lib/platforms/tiktok-ads';

export async function GET() {
  await requireAuth();
  const statuses = await Promise.all([getGoogleAdsStatus(), getMetaAdsStatus(), getLinkedInAdsStatus(), getTikTokAdsStatus()]);
  const connected = statuses.filter(s => s.connected).length;
  return NextResponse.json({ platforms: statuses, connected_count: connected, total: 4 });
}
