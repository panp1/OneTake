import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getQualityByChannel } from '@/lib/db/audienceiq';
import { isCrmConnected } from '@/lib/crm/client';

export async function GET() {
  await requireAuth();
  if (!isCrmConnected()) {
    return NextResponse.json({ connected: false, channels: [], message: 'CRM not connected.' });
  }
  const channels = await getQualityByChannel();
  return NextResponse.json({ connected: true, channels });
}
