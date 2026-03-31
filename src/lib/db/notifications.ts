import { getDb } from '../db';
import type { Notification, NotificationChannel, NotificationStatus } from '@/lib/types';

export async function createNotification(data: {
  request_id: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  payload?: Record<string, unknown> | null;
}): Promise<Notification> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO notification_deliveries (request_id, channel, recipient, status, payload)
    VALUES (
      ${data.request_id},
      ${data.channel},
      ${data.recipient},
      ${data.status},
      ${data.payload ? JSON.stringify(data.payload) : null}
    )
    RETURNING *
  `;
  return rows[0] as Notification;
}

export async function getNotificationsByRequestId(requestId: string): Promise<Notification[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM notification_deliveries
    WHERE request_id = ${requestId}
    ORDER BY created_at DESC
  `;
  return rows as Notification[];
}
