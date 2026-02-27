/**
 * Webhook Service
 * Manages webhook registration, delivery, and monitoring
 * @module lib/services/webhook-service
 */

import { prisma } from '@neolith/database';
import crypto from 'crypto';

/**
 * Register a new webhook
 */
export async function registerWebhook(webhookConfig: any): Promise<any> {
  return (prisma as any).webhook.create({ data: webhookConfig });
}

/**
 * Unregister webhook
 */
export async function unregisterWebhook(webhookId: string): Promise<void> {
  await (prisma as any).webhook.delete({ where: { id: webhookId } });
}

/**
 * Trigger webhook
 */
export async function triggerWebhook(
  webhookId: string,
  payload: any
): Promise<any> {
  const webhook = await (prisma as any).webhook.findUnique({
    where: { id: webhookId },
  });

  if (!webhook) {
    throw new Error(`Webhook not found: ${webhookId}`);
  }

  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  const delivery = await (prisma as any).webhookDelivery.create({
    data: {
      webhookId,
      payload,
      status: 'pending',
    },
  });

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let deliveryStatus = 'failed';

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-ID': webhookId,
        'X-Delivery-ID': delivery.id,
        ...(webhook.headers ?? {}),
      },
      body: JSON.stringify(payload),
    });

    responseStatus = response.status;
    responseBody = await response.text();
    deliveryStatus = response.ok ? 'success' : 'failed';
  } catch (err: any) {
    responseBody = err?.message ?? 'Unknown error';
  }

  return (prisma as any).webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: deliveryStatus,
      responseStatus,
      responseBody,
      deliveredAt: new Date(),
    },
  });
}

/**
 * Get webhook details
 */
export async function getWebhook(webhookId: string): Promise<any> {
  return (prisma as any).webhook.findUnique({ where: { id: webhookId } });
}

/**
 * List all webhooks
 */
export async function listWebhooks(
  workspaceId: string,
  filters?: any
): Promise<{ webhooks: any[]; total: number }> {
  try {
    const where = { workspaceId, ...filters };

    const [webhooks, total] = await Promise.all([
      (prisma as any).webhook.findMany({ where }),
      (prisma as any).webhook.count({ where }),
    ]);

    return { webhooks, total };
  } catch {
    // Webhook table may not exist yet — return empty results
    return { webhooks: [], total: 0 };
  }
}

/**
 * Update webhook configuration
 */
export async function updateWebhook(
  webhookId: string,
  updates: any
): Promise<any> {
  return (prisma as any).webhook.update({
    where: { id: webhookId },
    data: updates,
  });
}

/**
 * Get webhook delivery history
 */
export async function getWebhookHistory(
  webhookId: string,
  limit?: number
): Promise<any[]> {
  return (prisma as any).webhookDelivery.findMany({
    where: { webhookId },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Retry failed webhook delivery
 */
export async function retryWebhookDelivery(
  webhookId: string,
  deliveryId: string
): Promise<any> {
  const delivery = await (prisma as any).webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    throw new Error(`Delivery not found: ${deliveryId}`);
  }

  const webhook = await (prisma as any).webhook.findUnique({
    where: { id: webhookId },
  });

  if (!webhook) {
    throw new Error(`Webhook not found: ${webhookId}`);
  }

  const payload = delivery.payload;

  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let deliveryStatus = 'failed';

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-ID': webhookId,
        'X-Delivery-ID': deliveryId,
        ...(webhook.headers ?? {}),
      },
      body: JSON.stringify(payload),
    });

    responseStatus = response.status;
    responseBody = await response.text();
    deliveryStatus = response.ok ? 'success' : 'failed';
  } catch (err: any) {
    responseBody = err?.message ?? 'Unknown error';
  }

  return (prisma as any).webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: deliveryStatus,
      responseStatus,
      responseBody,
      deliveredAt: new Date(),
    },
  });
}

/**
 * Validate webhook signature
 */
export async function validateWebhookSignature(
  payload: any,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'hex');
  const signatureBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

/**
 * Create a new webhook
 */
export async function createWebhook(
  workspaceId: string,
  webhookData: {
    name: string;
    url: string;
    events: string[];
    secret?: string;
    active?: boolean;
    headers?: Record<string, string>;
  },
  userId: string
): Promise<{ webhook: any; secret: string }> {
  const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

  const webhook = await (prisma as any).webhook.create({
    data: {
      workspaceId,
      createdById: userId,
      name: webhookData.name,
      url: webhookData.url,
      events: webhookData.events,
      secret,
      active: webhookData.active ?? true,
      headers: webhookData.headers ?? {},
    },
  });

  return { webhook, secret };
}
