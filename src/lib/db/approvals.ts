import { getDb } from '../db';
import type { Approval, ApprovalStatus } from '@/lib/types';

export async function createApproval(data: {
  request_id: string;
  approved_by: string;
  status: ApprovalStatus;
  notes?: string | null;
}): Promise<Approval> {
  const sql = getDb();
  const rows = await sql`
    INSERT INTO approvals (request_id, approved_by, status, notes)
    VALUES (
      ${data.request_id},
      ${data.approved_by},
      ${data.status},
      ${data.notes ?? null}
    )
    RETURNING *
  `;
  return rows[0] as Approval;
}

export async function getApprovalsByRequestId(requestId: string): Promise<Approval[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM approvals
    WHERE request_id = ${requestId}
    ORDER BY created_at DESC
  `;
  return rows as Approval[];
}
