/**
 * Webhook Delivery Retry API Route
 *
 * Retries a failed webhook delivery.
 *
 * Routes:
 * - POST /api/workspaces/:workspaceId/webhooks/:webhookId/deliveries/:deliveryId/retry - Retry delivery
 *
 * @module app/api/workspaces/[workspaceId]/webhooks/[webhookId]/deliveries/[deliveryId]/retry/route
 */

import crypto from 'crypto';

import { prisma } from '@neolith/database';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Route context with parameters
 */
interface RouteContext {
  params: Promise<{
    workspaceSlug: string;
    webhookId: string;
    deliveryId: string;
  }>;
}

/**
 * POST /api/workspaces/:workspaceId/webhooks/:webhookId/deliveries/:deliveryId/retry
 *
 * Retry a failed webhook delivery.
 *
 * @param request - Next.js request object
 * @param context - Route context containing IDs
 * @returns Retry result
 */
export async function POST(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceSlug, webhookId, deliveryId } = await context.params;

    // Resolve workspace by slug or ID
    const workspace = await prisma.workspace.findFirst({
      where: {
        OR: [{ id: workspaceSlug }, { slug: workspaceSlug }],
      },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 },
      );
    }

    const workspaceId = workspace.id;

    // Verify admin access
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id },
    });

    if (
      !membership ||
      !['admin', 'owner', 'ADMIN', 'OWNER'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 },
      );
    }

    // Get the delivery with webhook info
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        webhook: true,
      },
    });

    if (!delivery || delivery.webhook.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
    }

    if (delivery.webhookId !== webhookId) {
      return NextResponse.json(
        { error: 'Delivery does not belong to this webhook' },
        { status: 400 },
      );
    }

    // Check if webhook is active
    if (delivery.webhook.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Webhook is not active' },
        { status: 400 },
      );
    }

    // Update delivery to retrying status
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'RETRYING',
        attemptCount: { increment: 1 },
      },
    });

    // Attempt to deliver webhook
    const { webhook } = delivery;
    const payloadString = JSON.stringify(delivery.payload);

    try {
      // Generate signature if secret exists
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Neolith-Webhook/1.0',
        'X-Webhook-Event': delivery.event,
        'X-Webhook-Delivery': delivery.id,
        ...(webhook.headers as Record<string, string>),
      };

      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(payloadString)
          .digest('hex');
        headers['X-Webhook-Signature'] = signature;
      }

      // Make HTTP request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeout);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text();

      // Update delivery with result
      const updatedDelivery = await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: response.ok ? 'SUCCESS' : 'FAILED',
          responseStatus: response.status,
          responseBody: responseBody.substring(0, 10000), // Limit response size
          error: response.ok ? null : `HTTP ${response.status}`,
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        delivery: updatedDelivery,
        success: response.ok,
        message: response.ok
          ? 'Delivery retried successfully'
          : 'Delivery retry failed',
      });
    } catch (error) {
      // Update delivery with error
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      const updatedDelivery = await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'FAILED',
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        delivery: updatedDelivery,
        success: false,
        message: `Delivery retry failed: ${errorMessage}`,
      });
    }
  } catch (error) {
    console.error('Failed to retry webhook delivery:', error);
    return NextResponse.json(
      { error: 'Failed to retry delivery' },
      { status: 500 },
    );
  }
}
