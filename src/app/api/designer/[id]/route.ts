import { getDb } from '@/lib/db';
import { getIntakeRequest } from '@/lib/db/intake';
import { getAssetsByRequestId } from '@/lib/db/assets';
import { getActorsByRequestId } from '@/lib/db/actors';
import { getBriefByRequestId } from '@/lib/db/briefs';
import { validateMagicLink } from '@/lib/db/magic-links';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return Response.json(
        { error: 'Magic link token is required' },
        { status: 401 }
      );
    }

    // Validate magic link
    const magicLink = await validateMagicLink(token);

    if (!magicLink) {
      return Response.json(
        { error: 'Invalid or expired magic link' },
        { status: 401 }
      );
    }

    // Ensure the magic link matches this request
    if (magicLink.request_id !== id) {
      return Response.json(
        { error: 'Token does not match this request' },
        { status: 401 }
      );
    }

    // Get request, assets, brief, actors
    const intakeRequest = await getIntakeRequest(id);

    if (!intakeRequest) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    const [assets, brief, actors] = await Promise.all([
      getAssetsByRequestId(id),
      getBriefByRequestId(id),
      getActorsByRequestId(id),
    ]);

    // Fetch uploads and notes (tables may not exist yet)
    const sql = getDb();
    let uploads: unknown[] = [];
    let notes: unknown[] = [];

    try {
      uploads = await sql`
        SELECT * FROM designer_uploads
        WHERE request_id = ${id}
        ORDER BY created_at DESC
      `;
    } catch {
      // Table may not exist yet — that's fine
    }

    try {
      notes = await sql`
        SELECT * FROM designer_notes
        WHERE request_id = ${id}
        ORDER BY created_at ASC
      `;
    } catch {
      // Table may not exist yet — that's fine
    }

    return Response.json({
      request: intakeRequest,
      assets,
      brief,
      actors,
      uploads,
      notes,
    });
  } catch (error) {
    console.error('[api/designer/[id]] Failed to get designer data:', error);
    return Response.json(
      { error: 'Failed to get designer data' },
      { status: 500 }
    );
  }
}
