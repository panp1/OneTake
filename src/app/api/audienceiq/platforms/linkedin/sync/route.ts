import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { syncLinkedInAds } from '@/lib/platforms/linkedin-ads';

export async function POST() {
  await requireRole(['admin']);
  const result = await syncLinkedInAds();
  return NextResponse.json(result);
}
