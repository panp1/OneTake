import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { getAssetsByRequestId } from '@/lib/db/assets';
import { sendTeamsNotification } from '@/lib/notifications/teams';
import { createNotification } from '@/lib/db/notifications';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const intake = await getIntakeRequest(id);
  if (!intake) return Response.json({ error: 'Not found' }, { status: 404 });

  const assets = await getAssetsByRequestId(id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const sent = await sendTeamsNotification({
    title: `Creative Package Ready: ${intake.title}`,
    subtitle: `${assets.length} creatives generated for review`,
    facts: [
      { title: 'Task Type', value: intake.task_type },
      { title: 'Urgency', value: intake.urgency },
      { title: 'Creatives', value: String(assets.length) },
    ],
    actionUrl: `${appUrl}/intake/${id}`,
    actionLabel: 'Review Package',
  });

  await createNotification({
    request_id: id,
    channel: 'teams',
    recipient: 'teams-webhook',
    status: sent ? 'sent' : 'failed',
    payload: { title: intake.title, asset_count: assets.length },
  });

  return Response.json({ sent });
}
