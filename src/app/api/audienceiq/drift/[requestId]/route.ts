import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLatestDrift } from '@/lib/db/audienceiq';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  await requireAuth();
  const { requestId } = await params;
  const drift = await getLatestDrift(requestId);
  if (!drift) return NextResponse.json({ computed: false, message: 'No drift data yet. Trigger computation first.' });
  return NextResponse.json({ computed: true, ...drift });
}
