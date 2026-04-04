import { auth } from '@clerk/nextjs/server';
import { getAuthContext } from '@/lib/permissions';
import { deleteAsset } from '@/lib/db/assets';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admin and designer can delete assets
  if (ctx.role !== 'admin' && ctx.role !== 'designer') {
    return Response.json({ error: 'Forbidden — only admin and designer can delete assets' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await deleteAsset(id);
    return Response.json({ success: true, deleted: id });
  } catch (error) {
    console.error('[api/assets/[id]] DELETE failed:', error);
    return Response.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    );
  }
}
