import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

/**
 * Figma sync state as stored in intake_requests.figma_sync (JSONB).
 */
interface FigmaSyncState {
  file_key: string;
  file_url: string;
  token: string;
  last_modified: string | null;
  last_synced: string | null;
  frame_hashes: Record<string, string>;
  sync_enabled: boolean;
}

/**
 * GET /api/figma/status/[requestId]
 *
 * Returns the current Figma sync state for a campaign.
 * Reads from intake_requests.figma_sync JSONB column.
 *
 * Response when connected:
 *   { connected: true, file_url, file_key, last_synced, sync_enabled }
 *
 * Response when not connected:
 *   { connected: false }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;

  const sql = getDb();

  let figmaSync: FigmaSyncState | null = null;
  try {
    const rows = await sql`
      SELECT figma_sync
      FROM intake_requests
      WHERE id = ${requestId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }

    figmaSync = (rows[0]?.figma_sync as FigmaSyncState) ?? null;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // If the column doesn't exist yet, the campaign has never been connected
    if (errMsg.includes("figma_sync") && errMsg.includes("column")) {
      return Response.json({ connected: false });
    }

    console.error("[api/figma/status] DB query failed:", err);
    return Response.json({ error: "Failed to fetch sync status" }, { status: 500 });
  }

  if (!figmaSync || !figmaSync.file_key) {
    return Response.json({ connected: false });
  }

  return Response.json({
    connected: true,
    file_url: figmaSync.file_url,
    file_key: figmaSync.file_key,
    last_synced: figmaSync.last_synced,
    sync_enabled: figmaSync.sync_enabled,
  });
}
