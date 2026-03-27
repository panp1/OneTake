import { auth } from '@clerk/nextjs/server';
import { getUserRole } from '@/lib/db/user-roles';
import type { UserRole } from '@/lib/types';

export async function requireAuth(): Promise<{ userId: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return { userId };
}

export async function requireRole(
  allowedRoles: UserRole[]
): Promise<{ userId: string; role: UserRole }> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const userRole = await getUserRole(userId);

  // If no role record exists, default to 'viewer' for now
  // Steven (first user) should be manually set to 'admin' in DB
  const role = (userRole?.role as UserRole) ?? 'viewer';

  if (!allowedRoles.includes(role)) {
    throw new Error('Forbidden');
  }

  return { userId, role };
}
