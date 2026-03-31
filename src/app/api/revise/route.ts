import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

/**
 * Smart Revision API — routes revision requests to the correct model:
 *
 * - Copy/messaging changes → Gemma 3 27B via NIM
 * - Image edits → Seedream 4.5 Edit via AtlasCloud API
 * - Creative overlay edits → Phase 1 (Gemma copy) + Phase 2 (GLM-5 design)
 *
 * POST /api/revise
 * {
 *   asset_id: string,
 *   revision_type: "copy" | "image" | "creative",
 *   prompt: string,
 *   field?: string  // for copy: which field to update
 * }
 */

const ATLASCLOUD_API_KEY = process.env.ATLASCLOUD_API_KEY || process.env.OPENROUTER_API_KEY || '';
const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY || '';
const NVIDIA_NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1';

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { asset_id, revision_type, prompt, field } = body;

  if (!asset_id || !revision_type || !prompt) {
    return Response.json({ error: 'Missing asset_id, revision_type, or prompt' }, { status: 400 });
  }

  const sql = getDb();

  // Fetch the asset
  const assets = await sql`SELECT * FROM generated_assets WHERE id = ${asset_id}::uuid`;
  if (!assets || assets.length === 0) {
    return Response.json({ error: 'Asset not found' }, { status: 404 });
  }
  const asset = assets[0];
  const content = (asset.content || {}) as Record<string, any>;
  const copyData = (asset.copy_data || {}) as Record<string, any>;

  try {
    switch (revision_type) {

      // ── COPY REVISION — Gemma 3 27B via NIM ──────────────
      case 'copy': {
        const systemPrompt = `You are an elite recruitment copywriter for OneForma.
Revise the following ad copy based on the user's feedback.
Keep it punchy, short, and scroll-stopping.
Return ONLY the revised text, nothing else.`;

        const currentCopy = field
          ? (copyData[field] || content[field] || '')
          : JSON.stringify({ ...copyData, ...content }, null, 2);

        const userPrompt = `Current copy:\n${currentCopy}\n\nRevision request: ${prompt}\n\nReturn only the revised text.`;

        const nimRes = await fetch(`${NVIDIA_NIM_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NVIDIA_NIM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemma-3-27b-it',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 1024,
            temperature: 0.7,
          }),
        });

        if (!nimRes.ok) {
          const err = await nimRes.text();
          return Response.json({ error: 'Gemma API failed', details: err }, { status: 502 });
        }

        const nimData = await nimRes.json();
        const revisedCopy = nimData.choices?.[0]?.message?.content?.trim() || '';

        // Update the asset in Neon
        if (field) {
          // Update specific field in copy_data
          await sql`
            UPDATE generated_assets
            SET copy_data = jsonb_set(COALESCE(copy_data, '{}'::jsonb), ${`{${field}}`}::text[], to_jsonb(${revisedCopy}::text))
            WHERE id = ${asset_id}::uuid
          `;
        }

        // Create notification
        await sql`
          INSERT INTO notifications (user_id, request_id, type, title, body)
          SELECT created_by, ${asset.request_id}, 'designer_update',
            'Copy revised', ${`"${field || 'copy'}" updated: ${revisedCopy.slice(0, 60)}...`}
          FROM intake_requests WHERE id = ${asset.request_id}::uuid
        `;

        return Response.json({
          success: true,
          revision_type: 'copy',
          field,
          original: currentCopy,
          revised: revisedCopy,
          asset_id,
        });
      }

      // ── IMAGE REVISION — Seedream 4.5 Edit via AtlasCloud ─
      case 'image': {
        if (!asset.blob_url) {
          return Response.json({ error: 'Asset has no image URL' }, { status: 400 });
        }

        // Call Seedream 4.5 Edit API
        const editRes = await fetch('https://api.atlascloud.ai/api/v1/model/generateImage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ATLASCLOUD_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'bytedance/seedream-v4.5/edit',
            prompt: prompt,
            images: [asset.blob_url],
            size: '2048*2048',
          }),
        });

        if (!editRes.ok) {
          const err = await editRes.text();
          return Response.json({ error: 'Seedream Edit API failed', details: err }, { status: 502 });
        }

        const editData = await editRes.json();

        // If async (status: "processing"), return the prediction ID for polling
        if (editData.status === 'processing' || editData.status === 'created') {
          return Response.json({
            success: true,
            revision_type: 'image',
            status: 'processing',
            prediction_id: editData.id,
            asset_id,
          });
        }

        // If complete, get the output URL
        const editedUrl = editData.outputs?.[0];
        if (!editedUrl) {
          return Response.json({ error: 'No output from Seedream' }, { status: 502 });
        }

        // Update the asset blob_url in Neon
        await sql`
          UPDATE generated_assets
          SET blob_url = ${editedUrl},
              content = jsonb_set(
                COALESCE(content, '{}'::jsonb),
                '{edit_history}',
                COALESCE(content->'edit_history', '[]'::jsonb) || ${JSON.stringify([{
                  type: 'seedream_edit',
                  prompt,
                  edited_by: userId,
                  timestamp: new Date().toISOString(),
                }])}::jsonb
              )
          WHERE id = ${asset_id}::uuid
        `;

        // Create notification
        await sql`
          INSERT INTO notifications (user_id, request_id, type, title, body)
          SELECT created_by, ${asset.request_id}, 'designer_update',
            'Image revised via Seedream', ${`Edit: ${prompt.slice(0, 80)}...`}
          FROM intake_requests WHERE id = ${asset.request_id}::uuid
        `;

        return Response.json({
          success: true,
          revision_type: 'image',
          status: 'completed',
          original_url: asset.blob_url,
          edited_url: editedUrl,
          asset_id,
        });
      }

      // ── CREATIVE REVISION — Gemma (copy) + GLM-5 (design) ─
      case 'creative': {
        // For creative revisions, we first revise the copy, then regenerate the design
        // This is a more complex flow — for now, treat as copy revision
        // and let the pipeline re-render with updated copy

        const currentHeadline = content.overlay_headline || copyData.headline || '';
        const currentSub = content.overlay_sub || copyData.description || '';
        const currentCta = content.overlay_cta || copyData.cta || '';

        const systemPrompt = `You are an elite ad creative director for OneForma.
Revise the creative overlay copy based on the user's feedback.
Return ONLY valid JSON with these fields: headline, sub, cta
Keep the headline to 3-7 words, sub to 0-6 words, CTA to 2-3 words.`;

        const userPrompt = `Current creative copy:
Headline: "${currentHeadline}"
Subheadline: "${currentSub}"
CTA: "${currentCta}"
Platform: ${asset.platform}

Revision request: ${prompt}

Return JSON: {"headline": "...", "sub": "...", "cta": "..."}`;

        const nimRes = await fetch(`${NVIDIA_NIM_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NVIDIA_NIM_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemma-3-27b-it',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 256,
            temperature: 0.7,
          }),
        });

        if (!nimRes.ok) {
          return Response.json({ error: 'Gemma API failed' }, { status: 502 });
        }

        const nimData = await nimRes.json();
        const rawResponse = nimData.choices?.[0]?.message?.content?.trim() || '';

        // Parse JSON from response
        let revisedCopy = { headline: '', sub: '', cta: '' };
        try {
          const cleaned = rawResponse.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
          revisedCopy = JSON.parse(cleaned);
        } catch {
          revisedCopy = { headline: rawResponse.slice(0, 50), sub: '', cta: currentCta };
        }

        // Update the asset
        await sql`
          UPDATE generated_assets
          SET content = jsonb_set(
                jsonb_set(
                  jsonb_set(COALESCE(content, '{}'::jsonb), '{overlay_headline}', to_jsonb(${revisedCopy.headline}::text)),
                  '{overlay_sub}', to_jsonb(${revisedCopy.sub}::text)
                ),
                '{overlay_cta}', to_jsonb(${revisedCopy.cta}::text)
              )
          WHERE id = ${asset_id}::uuid
        `;

        return Response.json({
          success: true,
          revision_type: 'creative',
          original: { headline: currentHeadline, sub: currentSub, cta: currentCta },
          revised: revisedCopy,
          asset_id,
        });
      }

      default:
        return Response.json({ error: `Unknown revision_type: ${revision_type}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[api/revise] Error:', error);
    return Response.json({
      error: 'Revision failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
