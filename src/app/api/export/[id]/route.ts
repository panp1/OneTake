import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { validateMagicLink } from '@/lib/db/magic-links';
import { generateExportZip } from '@/lib/export';
import { generateFilteredExportZip } from '@/lib/export-filtered';

export type ExportType = 'all' | 'characters' | 'cutouts' | 'raw' | 'composed' | 'brand_kit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const exportType = (url.searchParams.get('type') || 'all') as ExportType;

  // Auth: either Clerk session or magic link token
  let authorized = false;

  if (token) {
    const magicLink = await validateMagicLink(token);
    if (magicLink && magicLink.request_id === id) {
      authorized = true;
    }
  }

  if (!authorized) {
    const { userId } = await auth();
    if (userId) {
      authorized = true;
    }
  }

  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const intake = await getIntakeRequest(id);

    if (!intake) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    // For designer access (token), allow export regardless of status.
    // For Clerk users, require approved/sent.
    if (!token && intake.status !== 'approved' && intake.status !== 'sent') {
      return Response.json(
        { error: 'Export is only available for approved or sent requests' },
        { status: 400 }
      );
    }

    let zipBuffer: Buffer;

    if (exportType === 'all') {
      zipBuffer = await generateExportZip(id);
    } else {
      zipBuffer = await generateFilteredExportZip(id, exportType);
    }

    const typeLabel = exportType === 'all' ? '' : `-${exportType}`;
    const filename = `oneforma${typeLabel}-${intake.title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}.zip`;

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[api/export/[id]] Failed to generate export:', error);
    return Response.json(
      { error: 'Failed to generate export package' },
      { status: 500 }
    );
  }
}
