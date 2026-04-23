import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  await requireAuth();
  const sql = getDb();
  const recruiterId = req.nextUrl.searchParams.get('recruiterId');

  const [summary, bySource, topLinks] = recruiterId
    ? await Promise.all([
        sql`SELECT COUNT(*)::int as total_links, COALESCE(SUM(click_count), 0)::int as total_clicks, COUNT(DISTINCT recruiter_clerk_id)::int as recruiter_count FROM tracked_links WHERE recruiter_clerk_id = ${recruiterId}`,
        sql`SELECT utm_source, SUM(click_count)::int as clicks FROM tracked_links WHERE recruiter_clerk_id = ${recruiterId} GROUP BY utm_source ORDER BY clicks DESC LIMIT 10`,
        sql`SELECT slug, utm_campaign, utm_source, click_count, created_at FROM tracked_links WHERE recruiter_clerk_id = ${recruiterId} ORDER BY click_count DESC LIMIT 10`,
      ])
    : await Promise.all([
        sql`SELECT COUNT(*)::int as total_links, COALESCE(SUM(click_count), 0)::int as total_clicks, COUNT(DISTINCT recruiter_clerk_id)::int as recruiter_count FROM tracked_links`,
        sql`SELECT utm_source, SUM(click_count)::int as clicks FROM tracked_links GROUP BY utm_source ORDER BY clicks DESC LIMIT 10`,
        sql`SELECT slug, utm_campaign, utm_source, click_count, created_at FROM tracked_links ORDER BY click_count DESC LIMIT 10`,
      ]);

  return NextResponse.json({
    summary: summary[0] ?? { total_links: 0, total_clicks: 0, recruiter_count: 0 },
    by_source: bySource,
    top_links: topLinks,
  });
}
