import { auth } from '@clerk/nextjs/server';
import { sql } from '@/lib/db';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const notifications = await sql`
      SELECT id, request_id, type, title, body, read, created_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const unreadCount = notifications.filter((n: any) => !n.read).length;
    return Response.json({ notifications, unreadCount });
  } catch (error) {
    console.error('[api/notifications] Error:', error);
    return Response.json({ notifications: [], unreadCount: 0 });
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const ids = body.ids;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      for (const id of ids) {
        await sql`UPDATE notifications SET read = true WHERE id = ${id}::uuid AND user_id = ${userId}`;
      }
    } else {
      await sql`UPDATE notifications SET read = true WHERE user_id = ${userId}`;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[api/notifications] Error:', error);
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}
