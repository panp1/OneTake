import { NextRequest } from "next/server";
import { getAuthContext, canEditRequest } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { getIntakeRequest } from "@/lib/db/intake";
import { createFigmaClient, extractFileKey } from "@/lib/figma-client";

/**
 * POST /api/figma/connect
 *
 * Validates a Figma personal access token + file URL, then saves the
 * sync state to intake_requests.figma_sync (JSONB column).
 *
 * Body: { request_id: string, figma_token: string, figma_url: string }
 */
export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse + validate body
  let body: { request_id?: string; figma_token?: string; figma_url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { request_id, figma_token, figma_url } = body;

  if (!request_id || typeof request_id !== "string") {
    return Response.json({ error: "request_id is required" }, { status: 400 });
  }
  if (!figma_token || typeof figma_token !== "string") {
    return Response.json({ error: "figma_token is required" }, { status: 400 });
  }
  if (!figma_url || typeof figma_url !== "string") {
    return Response.json({ error: "figma_url is required" }, { status: 400 });
  }

  // Verify user can edit this request
  const intakeRequest = await getIntakeRequest(request_id);
  if (!intakeRequest) {
    return Response.json({ error: "Intake request not found" }, { status: 404 });
  }
  if (!canEditRequest(ctx, intakeRequest.created_by, intakeRequest.status)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Extract file key from the URL
  const file_key = extractFileKey(figma_url);
  if (!file_key) {
    return Response.json(
      {
        error:
          "Invalid Figma file URL. Expected format: https://www.figma.com/file/KEY/Name or https://www.figma.com/design/KEY/Name",
      },
      { status: 400 },
    );
  }

  // Validate token + file access by calling Figma API
  let file_name: string;
  try {
    const api = createFigmaClient(figma_token);
    // getFile takes pathParams and queryParams separately
    const fileData = await api.getFile({ file_key }, { depth: 1 });
    file_name = (fileData as { name?: string }).name ?? file_key;
  } catch {
    return Response.json(
      { error: "Invalid Figma token or file URL. Check your token has read access to this file." },
      { status: 401 },
    );
  }

  // Build the sync state JSONB payload
  const figmaSyncState = {
    file_key,
    file_url: figma_url,
    token: figma_token,
    last_modified: null,
    last_synced: null,
    frame_hashes: {},
    sync_enabled: true,
  };

  // Save to DB — try UPDATE first, add column if it doesn't exist
  const sql = getDb();

  try {
    await sql`
      UPDATE intake_requests
      SET figma_sync = ${JSON.stringify(figmaSyncState)},
          updated_at = NOW()
      WHERE id = ${request_id}
    `;
  } catch (err: unknown) {
    // If the column doesn't exist, create it and retry
    const errMsg = err instanceof Error ? err.message : String(err);
    const isColumnMissing =
      errMsg.includes("column") && errMsg.includes("figma_sync");

    if (isColumnMissing) {
      try {
        await sql`
          ALTER TABLE intake_requests
          ADD COLUMN IF NOT EXISTS figma_sync JSONB DEFAULT NULL
        `;
        await sql`
          UPDATE intake_requests
          SET figma_sync = ${JSON.stringify(figmaSyncState)},
              updated_at = NOW()
          WHERE id = ${request_id}
        `;
      } catch (altErr: unknown) {
        console.error("[api/figma/connect] ALTER TABLE failed:", altErr);
        return Response.json(
          { error: "Failed to save Figma sync state" },
          { status: 500 },
        );
      }
    } else {
      console.error("[api/figma/connect] DB UPDATE failed:", err);
      return Response.json(
        { error: "Failed to save Figma sync state" },
        { status: 500 },
      );
    }
  }

  return Response.json({
    success: true,
    file_key,
    file_name,
  });
}
