import { NextResponse } from 'next/server';
import { prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * POST /api/webhooks/email
 *
 * Handles AWS SES delivery status notifications via SNS.
 * Processes bounce, complaint, and delivery events to update
 * communicationLog records. Also handles SNS subscription confirmation.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;

    const messageType = request.headers.get('x-amz-sns-message-type');

    // Handle SNS subscription confirmation
    if (messageType === 'SubscriptionConfirmation') {
      const subscribeUrl = body.SubscribeURL as string | undefined;
      if (subscribeUrl) {
        // Confirm the subscription by fetching the provided URL
        fetch(subscribeUrl).catch(err =>
          console.error('[Email Webhook] Failed to confirm SNS subscription:', err)
        );
        console.info('[Email Webhook] SNS subscription confirmation initiated');
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Parse the SNS message payload — the actual SES event is nested inside
    let sesEvent: Record<string, unknown>;
    try {
      const rawMessage = body.Message as string;
      sesEvent = JSON.parse(rawMessage) as Record<string, unknown>;
    } catch {
      // If Message is already an object (e.g. during local testing), use as-is
      sesEvent = body;
    }

    const notificationType = sesEvent.notificationType as string | undefined;

    if (!notificationType) {
      console.warn('[Email Webhook] Missing notificationType in SES event');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Map SES notification type to communicationLog status
    const statusMap: Record<string, string> = {
      Bounce: 'bounced',
      Complaint: 'complained',
      Delivery: 'delivered',
    };

    const newStatus = statusMap[notificationType];
    if (!newStatus) {
      console.warn(`[Email Webhook] Unhandled notificationType: ${notificationType}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Extract message IDs from the SES event to locate the log entries
    let messageIds: string[] = [];

    if (notificationType === 'Bounce') {
      const bounce = sesEvent.bounce as Record<string, unknown> | undefined;
      const bouncedRecipients = bounce?.bouncedRecipients as Array<{ emailAddress: string }> | undefined;
      messageIds = (bouncedRecipients ?? []).map(r => r.emailAddress);
    } else if (notificationType === 'Complaint') {
      const complaint = sesEvent.complaint as Record<string, unknown> | undefined;
      const complainedRecipients = complaint?.complainedRecipients as Array<{ emailAddress: string }> | undefined;
      messageIds = (complainedRecipients ?? []).map(r => r.emailAddress);
    } else if (notificationType === 'Delivery') {
      const delivery = sesEvent.delivery as Record<string, unknown> | undefined;
      const recipients = delivery?.recipients as string[] | undefined;
      messageIds = recipients ?? [];
    }

    const mail = sesEvent.mail as Record<string, unknown> | undefined;
    const sesMessageId = mail?.messageId as string | undefined;

    if (sesMessageId) {
      // Update all communicationLog entries matching the SES message ID
      await (prisma as any).communicationLog.updateMany({
        where: { externalId: sesMessageId },
        data: {
          status: newStatus,
          ...(notificationType === 'Delivery' ? { deliveredAt: new Date() } : {}),
        },
      });
    } else if (messageIds.length > 0) {
      // Fall back to matching by recipient address
      await (prisma as any).communicationLog.updateMany({
        where: { recipientAddress: { in: messageIds } },
        data: { status: newStatus },
      });
    }

    console.info(`[Email Webhook] Processed ${notificationType} for ${messageIds.join(', ')}`);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Email Webhook] Error:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
