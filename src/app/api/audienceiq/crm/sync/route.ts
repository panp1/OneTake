import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { syncContributors } from '@/lib/crm/sync';
import { autoMatchContributors } from '@/lib/crm/identity';

export async function POST() {
  await requireRole(['admin']);
  const syncResult = await syncContributors();
  let matched = 0;
  if (syncResult.success) {
    matched = await autoMatchContributors();
  }
  return NextResponse.json({ ...syncResult, identities_matched: matched });
}
