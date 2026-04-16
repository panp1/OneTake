import { getDb } from '../db';
import type { MagicLink } from '@/lib/types';

export async function createMagicLink(data: {
  request_id: string;
  token: string;
  expires_at: string;
}): Promise<MagicLink> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO magic_links (request_id, token, expires_at)
    VALUES (
      ${data.request_id},
      ${data.token},
      ${data.expires_at}
    )
    RETURNING *
  `;
  return rows[0] as MagicLink;
}

export async function validateMagicLink(token: string): Promise<MagicLink | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM magic_links
    WHERE token = ${token} AND expires_at > NOW() AND used_at IS NULL
  `;
  return (rows[0] as MagicLink) ?? null;
}

export async function consumeMagicLink(token: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE magic_links SET used_at = NOW() WHERE token = ${token}
  `;
}

export async function deleteMagicLink(token: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM magic_links WHERE token = ${token}`;
}
