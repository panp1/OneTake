/**
 * Send Microsoft Teams notification via incoming webhook.
 * Uses Adaptive Card format for rich notifications.
 * Centific/OneForma uses Microsoft ecosystem — Teams is primary, not Slack.
 */
export async function sendTeamsNotification(data: {
  title: string;
  subtitle: string;
  facts: Array<{ title: string; value: string }>;
  actionUrl?: string;
  actionLabel?: string;
}): Promise<boolean> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('[Teams] No webhook URL configured, skipping notification');
    return false;
  }

  try {
    const card = {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              text: data.title,
              weight: 'Bolder',
              size: 'Medium',
            },
            {
              type: 'TextBlock',
              text: data.subtitle,
              isSubtle: true,
              wrap: true,
            },
            {
              type: 'FactSet',
              facts: data.facts,
            },
          ],
          actions: data.actionUrl ? [{
            type: 'Action.OpenUrl',
            title: data.actionLabel ?? 'Open',
            url: data.actionUrl,
          }] : [],
        },
      }],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });

    if (!response.ok) {
      console.error('[Teams] Webhook returned', response.status, await response.text().catch(() => ''));
    }

    return response.ok;
  } catch (error) {
    console.error('[Teams] Notification failed:', error);
    return false;
  }
}

/**
 * Notify Teams when the compute pipeline completes and a package is ready for review.
 */
export async function notifyNewPackageReady(
  request: { id: string; title: string; urgency: string; task_type: string },
  assetCount: number,
  approvalUrl: string
): Promise<boolean> {
  return sendTeamsNotification({
    title: 'New Package Ready for Review',
    subtitle: `The pipeline has finished generating assets for "${request.title}".`,
    facts: [
      { title: 'Request', value: request.title },
      { title: 'Task Type', value: request.task_type.replace(/_/g, ' ') },
      { title: 'Urgency', value: request.urgency },
      { title: 'Assets Generated', value: String(assetCount) },
    ],
    actionUrl: approvalUrl,
    actionLabel: 'Review & Approve',
  });
}

/**
 * Notify Teams when an admin approves a request and assigns it to a designer.
 */
export async function notifyDesignerAssigned(
  request: { id: string; title: string; task_type: string },
  designerUrl: string
): Promise<boolean> {
  return sendTeamsNotification({
    title: 'Designer Assigned',
    subtitle: `Request "${request.title}" has been approved and is ready for the designer.`,
    facts: [
      { title: 'Request', value: request.title },
      { title: 'Task Type', value: request.task_type.replace(/_/g, ' ') },
      { title: 'Status', value: 'Approved' },
    ],
    actionUrl: designerUrl,
    actionLabel: 'Open Designer Portal',
  });
}

/**
 * Notify Teams when a designer uploads final deliverables.
 */
export async function notifyDesignerUploaded(
  request: { id: string; title: string; task_type: string }
): Promise<boolean> {
  return sendTeamsNotification({
    title: 'Designer Upload Complete',
    subtitle: `Final deliverables for "${request.title}" have been uploaded by the designer.`,
    facts: [
      { title: 'Request', value: request.title },
      { title: 'Task Type', value: request.task_type.replace(/_/g, ' ') },
      { title: 'Status', value: 'Finals Uploaded' },
    ],
  });
}
