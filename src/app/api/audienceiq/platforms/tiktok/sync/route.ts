import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { syncTikTokAds } from '@/lib/platforms/tiktok-ads';

export async function POST() {
  await requireRole(['admin']);
  const result = await syncTikTokAds();
  return NextResponse.json(result);
}
