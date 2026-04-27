import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getContributorsByCampaign, getContributorsBySource } from '@/lib/db/audienceiq';

export async function GET(req: NextRequest) {
  await requireAuth();
  const campaign = req.nextUrl.searchParams.get('campaign');
  const source = req.nextUrl.searchParams.get('source');
  if (campaign) {
    const contributors = await getContributorsByCampaign(campaign);
    return NextResponse.json({ contributors });
  }
  if (source) {
    const contributors = await getContributorsBySource(source);
    return NextResponse.json({ contributors });
  }
  return NextResponse.json({ error: 'Provide ?campaign= or ?source= parameter' }, { status: 400 });
}
