import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { buildAndStoreAllProfiles } from '@/lib/audienceiq/profile-builder';
import { computeDrift } from '@/lib/audienceiq/drift-calculator';
import { computeHealth } from '@/lib/audienceiq/health-scorer';
import { getProfiles } from '@/lib/db/audienceiq';

export async function POST(req: NextRequest) {
  await requireRole(['admin']);
  const body = await req.json();
  const requestId = body.request_id;
  if (!requestId) return NextResponse.json({ error: 'request_id required' }, { status: 400 });

  await buildAndStoreAllProfiles(requestId);
  const profiles = await getProfiles(requestId);
  const driftResult = await computeDrift(requestId, profiles);
  const healthResult = await computeHealth(requestId, profiles, {
    overall_drift: driftResult.overall_drift,
    paid_vs_converted: driftResult.paid_vs_converted,
  });

  return NextResponse.json({ drift: driftResult, health: healthResult, profiles_built: profiles.length });
}
