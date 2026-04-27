import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { stitchSignup } from '@/lib/crm/identity';

export async function POST(req: NextRequest) {
  await requireAuth();
  const body = await req.json();
  if (!body.email || !body.crm_user_id) {
    return NextResponse.json({ error: 'email and crm_user_id required' }, { status: 400 });
  }
  await stitchSignup({
    email: body.email,
    crm_user_id: body.crm_user_id,
    utm_slug: body.utm_slug,
    visitor_id: body.visitor_id,
    ga4_client_id: body.ga4_client_id,
  });
  return NextResponse.json({ ok: true });
}
