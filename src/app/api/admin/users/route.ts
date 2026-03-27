import { requireRole } from '@/lib/auth';
import { listUsers, createUserRole } from '@/lib/db/user-roles';

export async function GET() {
  try {
    await requireRole(['admin']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return Response.json({ error: msg }, { status });
  }

  try {
    const users = await listUsers();
    return Response.json(users);
  } catch (error) {
    console.error('[api/admin/users] GET failed:', error);
    return Response.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let adminUserId: string;
  try {
    const result = await requireRole(['admin']);
    adminUserId = result.userId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return Response.json({ error: msg }, { status });
  }

  try {
    const body = await request.json();

    if (!body.email || !body.role) {
      return Response.json(
        { error: 'email and role are required' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'recruiter', 'designer', 'viewer'];
    if (!validRoles.includes(body.role)) {
      return Response.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const user = await createUserRole({
      clerk_id: body.clerk_id ?? `invited_${Date.now()}`,
      email: body.email,
      name: body.name ?? null,
      role: body.role,
      invited_by: adminUserId,
    });

    return Response.json(user, { status: 201 });
  } catch (error) {
    console.error('[api/admin/users] POST failed:', error);
    return Response.json({ error: 'Failed to create user role' }, { status: 500 });
  }
}
