import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { syncGoogleAds } from '@/lib/platforms/google-ads';
import { syncMetaAds } from '@/lib/platforms/meta-ads';
import { syncLinkedInAds } from '@/lib/platforms/linkedin-ads';
import { syncTikTokAds } from '@/lib/platforms/tiktok-ads';

export async function POST() {
  await requireRole(['admin']);
  const results = await Promise.all([syncGoogleAds(), syncMetaAds(), syncLinkedInAds(), syncTikTokAds()]);
  return NextResponse.json({ results });
}
