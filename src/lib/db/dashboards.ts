import { getDb } from '@/lib/db';
import crypto from 'crypto';
import type { Dashboard, DashboardLayoutData } from '@/components/insights/types';

const emptyLayout: DashboardLayoutData = {
  widgets: [],
  gridLayouts: { lg: [], md: [], sm: [] },
};

export async function listDashboards(createdBy?: string): Promise<Dashboard[]> {
  const sql = getDb();
  if (createdBy) {
    const rows = await sql`
      SELECT * FROM dashboards
      WHERE created_by = ${createdBy} AND is_template = FALSE
      ORDER BY updated_at DESC
    `;
    return rows as Dashboard[];
  }
  const rows = await sql`
    SELECT * FROM dashboards WHERE is_template = FALSE ORDER BY updated_at DESC
  `;
  return rows as Dashboard[];
}

export async function getDashboard(id: string): Promise<Dashboard | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM dashboards WHERE id = ${id}`;
  return (rows[0] as Dashboard) ?? null;
}

export async function createDashboard(
  title: string,
  createdBy: string,
  layoutData?: DashboardLayoutData,
  description?: string,
): Promise<Dashboard> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO dashboards (title, description, layout_data, created_by)
    VALUES (${title}, ${description ?? null}, ${JSON.stringify(layoutData ?? emptyLayout)}, ${createdBy})
    RETURNING *
  `;
  return rows[0] as Dashboard;
}

export async function updateDashboard(
  id: string,
  updates: { title?: string; description?: string; layout_data?: DashboardLayoutData },
): Promise<Dashboard | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dashboards SET
      title = COALESCE(${updates.title ?? null}, title),
      description = COALESCE(${updates.description ?? null}, description),
      layout_data = COALESCE(${updates.layout_data ? JSON.stringify(updates.layout_data) : null}::jsonb, layout_data),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as Dashboard) ?? null;
}

export async function deleteDashboard(id: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`DELETE FROM dashboards WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function duplicateDashboard(id: string, createdBy: string): Promise<Dashboard | null> {
  const original = await getDashboard(id);
  if (!original) return null;
  const sql = getDb();
  const rows = await sql`
    INSERT INTO dashboards (title, description, layout_data, created_by)
    VALUES (${original.title + ' (copy)'}, ${original.description}, ${JSON.stringify(original.layout_data)}, ${createdBy})
    RETURNING *
  `;
  return rows[0] as Dashboard;
}

export async function toggleShare(id: string): Promise<{ is_shared: boolean; share_token: string | null }> {
  const sql = getDb();
  const dashboard = await getDashboard(id);
  if (!dashboard) throw new Error('Dashboard not found');
  if (dashboard.is_shared) {
    await sql`UPDATE dashboards SET is_shared = FALSE, share_token = NULL, updated_at = NOW() WHERE id = ${id}`;
    return { is_shared: false, share_token: null };
  }
  const token = crypto.randomBytes(24).toString('base64url');
  await sql`UPDATE dashboards SET is_shared = TRUE, share_token = ${token}, updated_at = NOW() WHERE id = ${id}`;
  return { is_shared: true, share_token: token };
}

export async function updateShareSettings(
  id: string,
  settings: { password_hash?: string; expires_at?: string | null },
): Promise<Dashboard | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE dashboards SET
      password_hash = COALESCE(${settings.password_hash ?? null}, password_hash),
      expires_at = ${settings.expires_at ?? null}::timestamptz,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return (rows[0] as Dashboard) ?? null;
}

export async function resolveShareToken(token: string): Promise<Dashboard | null> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM dashboards WHERE share_token = ${token} AND is_shared = TRUE`;
  const dashboard = (rows[0] as Dashboard) ?? null;
  if (!dashboard) return null;
  if (dashboard.expires_at && new Date(dashboard.expires_at) < new Date()) return null;
  await sql`UPDATE dashboards SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = ${dashboard.id}`;
  return dashboard;
}

export async function listTemplates(): Promise<Dashboard[]> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM dashboards WHERE is_template = TRUE ORDER BY title`;
  return rows as Dashboard[];
}
