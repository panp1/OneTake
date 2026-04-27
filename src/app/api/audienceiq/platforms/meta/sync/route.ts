import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { syncMetaAds } from '@/lib/platforms/meta-ads';

export async function POST() {
  await requireRole(['admin']);
  const result = await syncMetaAds();
  return NextResponse.json(result);
}
