import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCrmSyncStatus } from '@/lib/db/audienceiq';

export async function GET() {
  await requireAuth();
  const status = await getCrmSyncStatus();
  return NextResponse.json(status);
}
