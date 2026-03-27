import { requireRole } from '@/lib/auth';
import { updateUserRole, deactivateUser } from '@/lib/db/user-roles';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clerkId: string }> }
) {
  try {
    await requireRole(['admin']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return Response.json({ error: msg }, { status });
  }

  try {
    const { clerkId } = await params;
    const body = await request.json();

    const validRoles = ['admin', 'recruiter', 'designer', 'viewer'];
    if (body.role && !validRoles.includes(body.role)) {
      return Response.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await updateUserRole(clerkId, {
      role: body.role,
      name: body.name,
      email: body.email,
    });

    if (!updated) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error('[api/admin/users] PATCH failed:', error);
    return Response.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clerkId: string }> }
) {
  try {
    await requireRole(['admin']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return Response.json({ error: msg }, { status });
  }

  try {
    const { clerkId } = await params;
    await deactivateUser(clerkId);
    return Response.json({ success: true });
  } catch (error) {
    console.error('[api/admin/users] DELETE failed:', error);
    return Response.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}
