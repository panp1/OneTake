import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLatestHealth } from '@/lib/db/audienceiq';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  await requireAuth();
  const { requestId } = await params;
  const health = await getLatestHealth(requestId);
  if (!health) return NextResponse.json({ computed: false, message: 'No health data yet. Trigger drift computation first.' });
  return NextResponse.json({ computed: true, ...health });
}
