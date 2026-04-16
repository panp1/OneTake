import { getAuthContext, canAccessRequest } from '@/lib/permissions';
import { getIntakeRequest, updateIntakeRequest } from '@/lib/db/intake';
import { createApproval } from '@/lib/db/approvals';
import { createMagicLink } from '@/lib/db/magic-links';
import { notifyDesignerAssigned } from '@/lib/notifications/teams';
import { getDb } from '@/lib/db';

/**
 * 3-Stage Approval Flow:
 *
 * Stage 1: Marketing approves (status: generating → review)
 *   → Notifies designer (Miguel) via Teams
 *   → Designer magic link generated
 *
 * Stage 2: Designer approves (status: review → approved)
 *   → Notifies marketing manager (Steven) via Teams
 *   → "Designer approved — ready for your final review"
 *
 * Stage 3: Final approval (status: approved → sent)
 *   → Agency magic link generated
 *   → Recruiters can now see the creatives
 *   → Agency package link returned
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const intakeRequest = await getIntakeRequest(id);

    if (!intakeRequest) {
      return Response.json({ error: 'Intake request not found' }, { status: 404 });
    }

    // Verify the user can access this request
    if (!canAccessRequest(ctx, intakeRequest.created_by)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Determine which role is approving based on request body
    const body = await request.json().catch(() => ({}));
    const approvalType: string = body.approval_type || 'marketing'; // 'marketing' | 'designer' | 'final'

    // Role gates per approval stage
    const ALLOWED_ROLES: Record<string, string[]> = {
      marketing: ['admin'],
      designer: ['admin', 'designer'],
      final: ['admin'],
    };

    const allowed = ALLOWED_ROLES[approvalType];
    if (!allowed) {
      return Response.json({ error: 'Invalid approval_type' }, { status: 400 });
    }
    if (!allowed.includes(ctx.role)) {
      return Response.json({ error: 'Forbidden: insufficient role for this approval stage' }, { status: 403 });
    }

    const sql = getDb();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // ── Stage 1: Marketing Approval ──────────────────────────────
    // Marketing manager approves the generated creatives
    // Status: generating/review → review (sends to designer)
    if (approvalType === 'marketing') {
      await createApproval({
        request_id: id,
        approved_by: ctx.userId,
        status: 'approved',
      });

      // Update status to "review" — awaiting designer approval
      await updateIntakeRequest(id, { status: 'review' });

      // Generate designer magic link (7-day expiry)
      const designerToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await createMagicLink({
        request_id: id,
        token: designerToken,
        expires_at: expiresAt.toISOString(),
      });

      const designerUrl = `${appUrl}/designer/${id}?token=${designerToken}`;

      // Notify designer via Teams
      await notifyDesignerAssigned(
        { id, title: intakeRequest.title, task_type: intakeRequest.task_type },
        designerUrl
      ).catch((err) => console.error('[approve] Designer notification failed:', err));

      return Response.json({
        stage: 'marketing_approved',
        status: 'review',
        message: 'Sent to designer for review',
        designer_link: designerUrl,
      });
    }

    // ── Stage 2: Designer Approval ───────────────────────────────
    // Designer approves after reviewing/refining creatives
    // Status: review → approved (sends back to marketing for final)
    if (approvalType === 'designer') {
      await createApproval({
        request_id: id,
        approved_by: ctx.userId,
        status: 'approved',
      });

      // Update status to "approved" — awaiting final marketing approval
      await updateIntakeRequest(id, { status: 'approved' });

      // Notify marketing manager via Teams
      try {
        const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;
        if (teamsWebhookUrl) {
          await fetch(teamsWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "@type": "MessageCard",
              "summary": `Designer approved: ${intakeRequest.title}`,
              "themeColor": "22c55e",
              "title": "✅ Designer Approved Creatives",
              "sections": [{
                "facts": [
                  { "name": "Campaign", "value": intakeRequest.title },
                  { "name": "Status", "value": "Ready for your final review" },
                ],
                "text": "The designer has reviewed and approved the creatives. Please do a final review and approve to release to recruiters.",
              }],
              "potentialAction": [{
                "@type": "OpenUri",
                "name": "Review & Approve",
                "targets": [{ "os": "default", "uri": `${appUrl}/intake/${id}` }],
              }],
            }),
          });
        }
      } catch (err) {
        console.error('[approve] Marketing notification failed:', err);
      }

      return Response.json({
        stage: 'designer_approved',
        status: 'approved',
        message: 'Designer approved — awaiting your final review',
      });
    }

    // ── Stage 3: Final Approval ──────────────────────────────────
    // Marketing manager does final approval
    // Status: approved → sent (releases to recruiters + agency)
    if (approvalType === 'final') {
      await createApproval({
        request_id: id,
        approved_by: ctx.userId,
        status: 'approved',
      });

      // Update status to "sent" — recruiters can now see creatives
      await updateIntakeRequest(id, { status: 'sent' });

      // Generate agency magic link (7-day expiry)
      const agencyToken = crypto.randomUUID();
      const agencyExpiry = new Date();
      agencyExpiry.setDate(agencyExpiry.getDate() + 7);

      await createMagicLink({
        request_id: id,
        token: agencyToken,
        expires_at: agencyExpiry.toISOString(),
      });

      const agencyUrl = `${appUrl}/agency/${id}?token=${agencyToken}`;

      // Notify Teams — campaign is live
      try {
        const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL;
        if (teamsWebhookUrl) {
          await fetch(teamsWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "@type": "MessageCard",
              "summary": `Campaign live: ${intakeRequest.title}`,
              "themeColor": "0693e3",
              "title": "🚀 Campaign Package Ready",
              "sections": [{
                "facts": [
                  { "name": "Campaign", "value": intakeRequest.title },
                  { "name": "Status", "value": "Sent to recruiters & agency" },
                ],
                "text": "Creatives are now visible to recruiters and the agency package is ready.",
              }],
              "potentialAction": [
                {
                  "@type": "OpenUri",
                  "name": "View Agency Package",
                  "targets": [{ "os": "default", "uri": agencyUrl }],
                },
                {
                  "@type": "OpenUri",
                  "name": "View in Nova",
                  "targets": [{ "os": "default", "uri": `${appUrl}/intake/${id}` }],
                },
              ],
            }),
          });
        }
      } catch (err) {
        console.error('[approve] Campaign live notification failed:', err);
      }

      return Response.json({
        stage: 'final_approved',
        status: 'sent',
        message: 'Campaign is live — recruiters can see creatives, agency package ready',
        agency_link: agencyUrl,
      });
    }

    return Response.json({ error: 'Invalid approval_type — must be marketing, designer, or final' }, { status: 400 });

  } catch (error) {
    console.error('[api/approve/[id]] Failed to approve request:', error);
    return Response.json({ error: 'Failed to approve request' }, { status: 500 });
  }
}
