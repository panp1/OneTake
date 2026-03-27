import { getDb } from '../db';

export interface UserRoleRecord {
  id: string;
  clerk_id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUserRole(clerkId: string): Promise<UserRoleRecord | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM user_roles WHERE clerk_id = ${clerkId}
  `;
  return (rows[0] as UserRoleRecord) ?? null;
}

export async function listUsers(): Promise<UserRoleRecord[]> {
  const sql = getDb();
  return await sql`
    SELECT * FROM user_roles WHERE is_active = TRUE ORDER BY created_at DESC
  ` as UserRoleRecord[];
}

export async function createUserRole(data: {
  clerk_id: string;
  email: string;
  name?: string | null;
  role: string;
  invited_by?: string | null;
}): Promise<UserRoleRecord> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO user_roles (clerk_id, email, name, role, invited_by)
    VALUES (${data.clerk_id}, ${data.email}, ${data.name ?? null}, ${data.role}, ${data.invited_by ?? null})
    RETURNING *
  `;
  return rows[0] as UserRoleRecord;
}

export async function updateUserRole(
  clerkId: string,
  data: { role?: string; name?: string | null; email?: string }
): Promise<UserRoleRecord | null> {
  const sql = getDb();
  const rows = await sql`
    UPDATE user_roles
    SET
      role = COALESCE(${data.role ?? null}, role),
      name = COALESCE(${data.name ?? null}, name),
      email = COALESCE(${data.email ?? null}, email),
      updated_at = NOW()
    WHERE clerk_id = ${clerkId}
    RETURNING *
  `;
  return (rows[0] as UserRoleRecord) ?? null;
}

export async function deactivateUser(clerkId: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE user_roles SET is_active = FALSE, updated_at = NOW() WHERE clerk_id = ${clerkId}
  `;
}
