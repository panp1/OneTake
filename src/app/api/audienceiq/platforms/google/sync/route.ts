import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { syncGoogleAds } from '@/lib/platforms/google-ads';

export async function POST() {
  await requireRole(['admin']);
  const result = await syncGoogleAds();
  return NextResponse.json(result);
}
