import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const sql = getDb();
    const rows = await sql`
      SELECT * FROM campaign_strategies
      WHERE request_id = ${id}
      ORDER BY created_at DESC
    `;
    return Response.json({ strategies: rows });
  } catch (error) {
    console.error('[api/generate/[id]/strategy] GET failed:', error);
    return Response.json(
      { error: 'Failed to fetch campaign strategies' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { strategy_id, strategy_data } = body;

    if (!strategy_id || !strategy_data) {
      return Response.json(
        { error: 'strategy_id and strategy_data are required' },
        { status: 400 }
      );
    }

    const sql = getDb();
    const rows = await sql`
      UPDATE campaign_strategies
      SET strategy_data = ${JSON.stringify(strategy_data)}::jsonb
      WHERE id = ${strategy_id}
        AND request_id = ${id}
      RETURNING id
    `;

    if (rows.length === 0) {
      return Response.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/generate/[id]/strategy] PATCH failed:', error);
    return Response.json(
      { error: 'Failed to update strategy' },
      { status: 500 }
    );
  }
}
