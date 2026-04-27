/**
 * GA4 Client — fetches analytics data from cache or triggers sync.
 *
 * GA4 data comes in via the analytics-mcp server.
 * This module queries the local ga4_session_cache table.
 * The sync route calls the MCP to populate the cache.
 */

import { getDb } from '@/lib/db';

export interface Ga4SessionRow {
  id: string;
  ga4_client_id: string | null;
  date: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  country: string | null;
  city: string | null;
  device_category: string | null;
  sessions: number;
  engaged_sessions: number;
  conversions: number;
  demographics: Record<string, unknown>;
  last_synced_at: string;
}

export async function isGa4Connected(): Promise<boolean> {
  // GA4 is "connected" if we have any cached data
  const sql = getDb();
  const rows = await sql`SELECT COUNT(*)::int as count FROM ga4_session_cache`;
  return (rows[0] as { count: number }).count > 0;
}

export async function getGa4TrafficSummary(days: number = 30): Promise<{
  total_sessions: number;
  total_engaged: number;
  total_conversions: number;
  by_source: { source: string; sessions: number; conversions: number }[];
  by_country: { country: string; sessions: number }[];
  by_device: { device_category: string; sessions: number }[];
}> {
  const sql = getDb();

  const [totals, bySource, byCountry, byDevice] = await Promise.all([
    sql`SELECT
          COALESCE(SUM(sessions), 0)::int as total_sessions,
          COALESCE(SUM(engaged_sessions), 0)::int as total_engaged,
          COALESCE(SUM(conversions), 0)::int as total_conversions
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int`,
    sql`SELECT source, SUM(sessions)::int as sessions, SUM(conversions)::int as conversions
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND source IS NOT NULL
        GROUP BY source ORDER BY sessions DESC LIMIT 10`,
    sql`SELECT country, SUM(sessions)::int as sessions
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND country IS NOT NULL
        GROUP BY country ORDER BY sessions DESC LIMIT 10`,
    sql`SELECT device_category, SUM(sessions)::int as sessions
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND device_category IS NOT NULL
        GROUP BY device_category ORDER BY sessions DESC`,
  ]);

  return {
    total_sessions: (totals[0] as Record<string, number>)?.total_sessions ?? 0,
    total_engaged: (totals[0] as Record<string, number>)?.total_engaged ?? 0,
    total_conversions: (totals[0] as Record<string, number>)?.total_conversions ?? 0,
    by_source: bySource as { source: string; sessions: number; conversions: number }[],
    by_country: byCountry as { country: string; sessions: number }[],
    by_device: byDevice as { device_category: string; sessions: number }[],
  };
}

export async function getGa4Demographics(days: number = 30): Promise<{
  countries: { name: string; count: number }[];
  devices: { name: string; count: number }[];
}> {
  const sql = getDb();

  const [countries, devices] = await Promise.all([
    sql`SELECT country as name, SUM(sessions)::int as count
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND country IS NOT NULL
        GROUP BY country ORDER BY count DESC`,
    sql`SELECT device_category as name, SUM(sessions)::int as count
        FROM ga4_session_cache
        WHERE date >= CURRENT_DATE - ${days}::int AND device_category IS NOT NULL
        GROUP BY device_category ORDER BY count DESC`,
  ]);

  return {
    countries: countries as { name: string; count: number }[],
    devices: devices as { name: string; count: number }[],
  };
}

export async function upsertGa4Session(row: Omit<Ga4SessionRow, 'id' | 'last_synced_at'>): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO ga4_session_cache (ga4_client_id, date, source, medium, campaign, country, city, device_category, sessions, engaged_sessions, conversions, demographics)
    VALUES (${row.ga4_client_id}, ${row.date}, ${row.source}, ${row.medium}, ${row.campaign}, ${row.country}, ${row.city}, ${row.device_category}, ${row.sessions}, ${row.engaged_sessions}, ${row.conversions}, ${JSON.stringify(row.demographics)})
  `;
}
