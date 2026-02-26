import { NextResponse } from 'next/server';
import { prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * POST /api/webhooks/sendgrid
 *
 * Handles inbound SendGrid Inbound Parse webhook events.
 * Parses multipart form data containing email fields and routes
 * the message through the traffic manager.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // SendGrid Inbound Parse delivers application/x-www-form-urlencoded or multipart/form-data
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries());

    const from = body.from as string;
    const to = body.to as string;
    const subject = body.subject as string || '';
    const text = body.text as string || '';
    const html = body.html as string || '';
    const attachmentCount = parseInt(body['attachment-info'] ? '1' : '0', 10);

    // Parse the "to" field — SendGrid may include display names, e.g. "Name <email@domain>"
    const toEmailMatch = to?.match(/<([^>]+)>/) || null;
    const toEmail = toEmailMatch ? toEmailMatch[1] : to?.trim();

    const fromEmailMatch = from?.match(/<([^>]+)>/) || null;
    const fromEmail = fromEmailMatch ? fromEmailMatch[1] : from?.trim();

    if (!toEmail) {
      console.warn('[SendGrid Webhook] Could not parse recipient email');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Find the orchestrator that owns this email address
    const agentIdentity = await (prisma as any).agentIdentity.findFirst({
      where: { email: toEmail },
      include: { user: { include: { orchestratorConfig: true } } },
    });

    if (!agentIdentity) {
      console.warn(`[SendGrid Webhook] No agent found for email: ${toEmail}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Prefer plain text; fall back to html
    const content = text || html;

    // Log the inbound communication
    await (prisma as any).communicationLog.create({
      data: {
        orchestratorId: agentIdentity.user?.orchestratorConfig?.id || agentIdentity.userId,
        channel: 'email',
        direction: 'inbound',
        externalId: `sendgrid-${Date.now()}`,
        recipientAddress: toEmail,
        senderAddress: fromEmail || from,
        content,
        status: 'delivered',
        deliveredAt: new Date(),
        metadata: { subject, attachmentCount },
      },
    });

    // Route through traffic manager (non-blocking)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/traffic-manager/route-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: 'email',
        messageContent: content,
        senderId: fromEmail || from,
        metadata: { subject, attachmentCount, channel: 'email' },
      }),
    }).catch(err => console.error('[SendGrid Webhook] Failed to route message:', err));

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[SendGrid Webhook] Error:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
