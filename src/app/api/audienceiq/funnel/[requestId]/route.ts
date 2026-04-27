import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getContributorFunnel } from '@/lib/db/audienceiq';
import { isCrmConnected } from '@/lib/crm/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  await requireAuth();
  const { requestId } = await params;
  const threshold = parseInt(req.nextUrl.searchParams.get('threshold') || '70');

  if (!isCrmConnected()) {
    return NextResponse.json({
      connected: false,
      message: 'CRM not connected. Set CRM_DATABASE_URL to enable contributor funnel.',
      stages: [
        { stage: 'clicks', label: 'Link Clicks', count: 0, conversion_rate: null },
        { stage: 'signups', label: 'CRM Signups', count: 0, conversion_rate: null },
        { stage: 'active', label: 'Active Contributors', count: 0, conversion_rate: null },
        { stage: 'quality', label: `Quality >= ${threshold}`, count: 0, conversion_rate: null },
      ],
    });
  }

  const funnel = await getContributorFunnel(requestId, threshold);
  const stages = [
    { stage: 'clicks', label: 'Link Clicks', count: funnel.total_clicks, conversion_rate: null as number | null },
    { stage: 'signups', label: 'CRM Signups', count: funnel.total_signups, conversion_rate: funnel.total_clicks > 0 ? Math.round((funnel.total_signups / funnel.total_clicks) * 1000) / 10 : null },
    { stage: 'active', label: 'Active Contributors', count: funnel.total_active, conversion_rate: funnel.total_signups > 0 ? Math.round((funnel.total_active / funnel.total_signups) * 1000) / 10 : null },
    { stage: 'quality', label: `Quality >= ${threshold}`, count: funnel.total_quality, conversion_rate: funnel.total_active > 0 ? Math.round((funnel.total_quality / funnel.total_active) * 1000) / 10 : null },
  ];

  return NextResponse.json({ connected: true, stages, ...funnel });
}
