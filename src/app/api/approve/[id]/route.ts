import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest, updateIntakeRequest } from '@/lib/db/intake';
import { createApproval } from '@/lib/db/approvals';
import { createMagicLink } from '@/lib/db/magic-links';
import { notifyDesignerAssigned } from '@/lib/notifications/teams';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const intakeRequest = await getIntakeRequest(id);

    if (!intakeRequest) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    // Create approval record
    const approval = await createApproval({
      request_id: id,
      approved_by: userId,
      status: 'approved',
    });

    // Generate magic link token with 7-day expiry
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await createMagicLink({
      request_id: id,
      token,
      expires_at: expiresAt.toISOString(),
    });

    // Update intake request status to approved
    await updateIntakeRequest(id, { status: 'approved' });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLinkUrl = `/designer/${id}?token=${token}`;

    // Notify Teams that a designer has been assigned
    await notifyDesignerAssigned(
      { id, title: intakeRequest.title, task_type: intakeRequest.task_type },
      `${appUrl}${magicLinkUrl}`
    ).catch((err) => console.error('[api/approve] Teams notification failed:', err));

    return Response.json({
      approval,
      magic_link_url: magicLinkUrl,
    });
  } catch (error) {
    console.error('[api/approve/[id]] Failed to approve request:', error);
    return Response.json(
      { error: 'Failed to approve request' },
      { status: 500 }
    );
  }
}
