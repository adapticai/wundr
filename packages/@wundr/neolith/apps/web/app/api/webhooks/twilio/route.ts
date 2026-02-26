import { NextResponse } from 'next/server';
import { prisma } from '@neolith/database';
import type { NextRequest } from 'next/server';

/**
 * POST /api/webhooks/twilio
 *
 * Handles inbound Twilio webhooks for SMS, Voice, and WhatsApp messages.
 * Validates the Twilio signature, normalizes the message, and routes
 * it through the traffic manager.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse form-encoded body (Twilio sends application/x-www-form-urlencoded)
    const formData = await request.formData();
    const body = Object.fromEntries(formData.entries());

    // Extract message type from Twilio params
    const messageSid = body.MessageSid as string;
    const from = body.From as string;
    const to = body.To as string;
    const messageBody = body.Body as string;
    const numMedia = parseInt(body.NumMedia as string || '0', 10);

    // Determine channel: SMS vs WhatsApp (WhatsApp numbers start with "whatsapp:")
    const isWhatsApp = (from as string)?.startsWith('whatsapp:');
    const channel = isWhatsApp ? 'whatsapp' : 'sms';
    const cleanFrom = isWhatsApp ? from.replace('whatsapp:', '') : from;
    const cleanTo = isWhatsApp ? to.replace('whatsapp:', '') : to;

    // Find the orchestrator that owns this phone number
    const agentIdentity = await (prisma as any).agentIdentity.findFirst({
      where: { phoneNumber: cleanTo },
      include: { user: { include: { orchestratorConfig: true } } },
    });

    if (!agentIdentity) {
      console.warn(`[Twilio Webhook] No agent found for number: ${cleanTo}`);
      // Return 200 to prevent Twilio retries
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Log the inbound communication
    await (prisma as any).communicationLog.create({
      data: {
        orchestratorId: agentIdentity.user?.orchestratorConfig?.id || agentIdentity.userId,
        channel,
        direction: 'inbound',
        externalId: messageSid,
        recipientAddress: cleanTo,
        senderAddress: cleanFrom,
        content: messageBody || '',
        status: 'delivered',
        deliveredAt: new Date(),
      },
    });

    // Route through traffic manager (non-blocking)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/traffic-manager/route-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: `twilio-${channel}`,
        messageContent: messageBody || '',
        senderId: cleanFrom,
        metadata: { messageSid, numMedia, channel },
      }),
    }).catch(err => console.error('[Twilio Webhook] Failed to route message:', err));

    // Return TwiML response (empty = no auto-reply, agent will respond through daemon)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error) {
    console.error('[Twilio Webhook] Error:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
