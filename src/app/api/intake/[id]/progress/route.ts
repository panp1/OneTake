import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

function safeJsonParse(val: unknown): unknown {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val ?? null;
}

/**
 * GET /api/intake/[id]/progress
 *
 * Returns the CURRENT partial state of a request — whatever has been
 * generated so far. The marketing manager's detail page polls this
 * every 3-5 seconds to progressively render results as they arrive.
 *
 * Returns sections as they become available:
 * - brief (null until Stage 1 completes)
 * - personas (null until Stage 1 completes)
 * - cultural_research (null until Stage 1 completes)
 * - actors ([] until Stage 2 starts producing)
 * - assets ([] until Stage 2/3/4 produce images/copy/composites)
 * - compute_job (current job status)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const sql = getDb();

  try {
    // Fetch everything in parallel for speed
    const [
      requestRows,
      briefRows,
      actorRows,
      assetRows,
      jobRows,
    ] = await Promise.all([
      sql`SELECT * FROM intake_requests WHERE id = ${id} LIMIT 1`,
      sql`SELECT * FROM creative_briefs WHERE request_id = ${id} ORDER BY version DESC LIMIT 1`,
      sql`SELECT * FROM actor_profiles WHERE request_id = ${id} ORDER BY created_at ASC`,
      sql`SELECT * FROM generated_assets WHERE request_id = ${id} ORDER BY stage ASC, created_at ASC`,
      sql`SELECT * FROM compute_jobs WHERE request_id = ${id} ORDER BY created_at DESC LIMIT 1`,
    ]);

    const request = requestRows[0];
    if (!request) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const brief = briefRows[0] || null;
    const actors = actorRows || [];
    const assets = assetRows || [];
    const job = jobRows[0] || null;

    // Extract progressive sections from brief_data
    const briefData = safeJsonParse(brief?.brief_data);
    const personas = (Array.isArray((briefData as Record<string, unknown>)?.personas)
      ? (briefData as Record<string, unknown>).personas
      : []) as unknown[];
    const culturalResearch = (briefData as Record<string, unknown>)?.cultural_research || brief?.cultural_research || null;
    const designDirection = safeJsonParse(brief?.design_direction);

    // Categorize assets for the 4-tab display
    const characters = assets.filter((a: Record<string, unknown>) => a.asset_type === 'base_image');
    const composed = assets.filter((a: Record<string, unknown>) =>
      a.asset_type === 'composed_creative' || a.asset_type === 'carousel_panel'
    );
    const copyAssets = assets.filter((a: Record<string, unknown>) => a.asset_type === 'copy');

    // Determine what's "ready" for progressive rendering
    const sections = {
      research: culturalResearch ? 'ready' : 'pending',
      personas: personas.length > 0 ? 'ready' : 'pending',
      brief: briefData ? 'ready' : 'pending',
      design_direction: designDirection ? 'ready' : 'pending',
      characters: characters.length > 0 ? 'ready' : 'pending',
      copy: copyAssets.length > 0 ? 'ready' : 'pending',
      composed: composed.length > 0 ? 'ready' : 'pending',
    };

    return Response.json({
      request,
      brief: briefData,
      personas,
      cultural_research: culturalResearch,
      design_direction: designDirection,
      evaluation: brief?.evaluation_data || null,
      actors,
      assets,
      characters,
      composed,
      copy_assets: copyAssets,
      job,
      sections,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[api/intake/progress] Error:', error);
    return Response.json({ error: 'Failed to fetch progress' }, { status: 500 });
  }
}
