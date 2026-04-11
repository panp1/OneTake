import { requireRole } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    await requireRole(['admin']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return Response.json({ error: msg }, { status });
  }

  try {
    const sql = getDb();
    const artifacts = await sql`
      SELECT
        artifact_id,
        category,
        description,
        blob_url,
        dimensions,
        css_class,
        usage_snippet,
        usage_notes,
        pillar_affinity,
        format_affinity,
        is_active,
        created_at,
        updated_at
      FROM design_artifacts
      ORDER BY category ASC, created_at DESC
    `;
    return Response.json(artifacts);
  } catch (error) {
    console.error('[api/admin/artifacts] GET failed:', error);
    return Response.json({ error: 'Failed to list artifacts' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireRole(['admin']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return Response.json({ error: msg }, { status });
  }

  try {
    const body = await request.json();

    if (!body.artifact_id || !body.category || !body.description || !body.blob_url || !body.usage_snippet) {
      return Response.json(
        { error: 'artifact_id, category, description, blob_url, and usage_snippet are required' },
        { status: 400 }
      );
    }

    const sql = getDb();
    const [artifact] = await sql`
      INSERT INTO design_artifacts (
        artifact_id,
        category,
        description,
        blob_url,
        dimensions,
        css_class,
        usage_snippet,
        usage_notes,
        pillar_affinity,
        format_affinity,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        ${body.artifact_id},
        ${body.category},
        ${body.description},
        ${body.blob_url},
        ${body.dimensions ?? null},
        ${body.css_class ?? null},
        ${body.usage_snippet},
        ${body.usage_notes ?? null},
        ${body.pillar_affinity ?? null},
        ${body.format_affinity ?? null},
        ${body.is_active ?? true},
        NOW(),
        NOW()
      )
      ON CONFLICT (artifact_id) DO UPDATE SET
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        blob_url = EXCLUDED.blob_url,
        dimensions = EXCLUDED.dimensions,
        css_class = EXCLUDED.css_class,
        usage_snippet = EXCLUDED.usage_snippet,
        usage_notes = EXCLUDED.usage_notes,
        pillar_affinity = EXCLUDED.pillar_affinity,
        format_affinity = EXCLUDED.format_affinity,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *
    `;

    return Response.json(artifact);
  } catch (error) {
    console.error('[api/admin/artifacts] PUT failed:', error);
    return Response.json({ error: 'Failed to upsert artifact' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(['admin']);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unauthorized';
    const status = msg === 'Forbidden' ? 403 : 401;
    return Response.json({ error: msg }, { status });
  }

  try {
    const body = await request.json();

    if (!body.artifact_id) {
      return Response.json({ error: 'artifact_id is required' }, { status: 400 });
    }

    const sql = getDb();
    const [artifact] = await sql`
      UPDATE design_artifacts
      SET is_active = false, updated_at = NOW()
      WHERE artifact_id = ${body.artifact_id}
      RETURNING artifact_id, is_active
    `;

    if (!artifact) {
      return Response.json({ error: 'Artifact not found' }, { status: 404 });
    }

    return Response.json(artifact);
  } catch (error) {
    console.error('[api/admin/artifacts] DELETE failed:', error);
    return Response.json({ error: 'Failed to deactivate artifact' }, { status: 500 });
  }
}
