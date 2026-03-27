import { auth } from '@clerk/nextjs/server';
import { getIntakeRequest } from '@/lib/db/intake';
import { generateExportZip } from '@/lib/export';

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
    const intake = await getIntakeRequest(id);

    if (!intake) {
      return Response.json(
        { error: 'Intake request not found' },
        { status: 404 }
      );
    }

    // Only allow export for approved or sent requests
    if (intake.status !== 'approved' && intake.status !== 'sent') {
      return Response.json(
        { error: 'Export is only available for approved or sent requests' },
        { status: 400 }
      );
    }

    const zip = await generateExportZip(id);
    const filename = `oneforma-package-${intake.title
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}.zip`;

    return new Response(new Uint8Array(zip), {
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
