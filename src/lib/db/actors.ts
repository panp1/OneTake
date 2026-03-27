import { getDb } from '../db';
import type { ActorProfile } from '@/lib/types';

export async function createActor(data: {
  request_id: string;
  name: string;
  face_lock: Record<string, unknown>;
  prompt_seed: string;
  outfit_variations?: Record<string, unknown> | null;
  signature_accessory?: string | null;
  backdrops?: string[];
}): Promise<ActorProfile> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO actor_profiles (
      request_id, name, face_lock, prompt_seed,
      outfit_variations, signature_accessory, backdrops
    )
    VALUES (
      ${data.request_id},
      ${data.name},
      ${JSON.stringify(data.face_lock)},
      ${data.prompt_seed},
      ${data.outfit_variations ? JSON.stringify(data.outfit_variations) : null},
      ${data.signature_accessory ?? null},
      ${data.backdrops ?? []}
    )
    RETURNING *
  `;
  return rows[0] as ActorProfile;
}

export async function getActorsByRequestId(requestId: string): Promise<ActorProfile[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM actor_profiles WHERE request_id = ${requestId}
  `;
  return rows as ActorProfile[];
}
