import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfiles } from '@/lib/db/audienceiq';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  await requireAuth();
  const { requestId } = await params;
  const profiles = await getProfiles(requestId);
  return NextResponse.json({ profiles });
}
