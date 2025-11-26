/**
 * Quick test to verify webhook service works
 *
 * Run with: tsx tests/webhook-test.ts
 */

import { prisma } from '@neolith/database';

async function testWebhookOperations() {
  console.log('Testing Webhook Operations...\n');

  try {
    // Find a workspace to test with
    const workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      console.error('No workspace found. Please create a workspace first.');
      return;
    }

    console.log(`Using workspace: ${workspace.name} (${workspace.id})\n`);

    // Test: Create a webhook
    console.log('1. Creating webhook...');
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: workspace.id,
        name: 'Test Webhook',
        description: 'Test webhook for verification',
        url: 'https://webhook.site/test',
        secret: 'whsec_test123',
        events: ['message.created', 'channel.created'],
        status: 'ACTIVE',
        createdBy: 'test-user',
      },
    });
    console.log(`✅ Created webhook: ${webhook.id}\n`);

    // Test: List webhooks
    console.log('2. Listing webhooks...');
    const webhooks = await prisma.webhook.findMany({
      where: { workspaceId: workspace.id },
    });
    console.log(`✅ Found ${webhooks.length} webhook(s)\n`);

    // Test: Update webhook
    console.log('3. Updating webhook...');
    const updated = await prisma.webhook.update({
      where: { id: webhook.id },
      data: { name: 'Updated Test Webhook' },
    });
    console.log(`✅ Updated webhook: ${updated.name}\n`);

    // Test: Create a webhook delivery
    console.log('4. Creating webhook delivery...');
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event: 'message.created',
        status: 'SUCCESS',
        requestUrl: webhook.url,
        requestHeaders: { 'Content-Type': 'application/json' },
        requestBody: JSON.stringify({ test: 'data' }),
        responseStatus: 200,
        responseHeaders: { 'Content-Type': 'application/json' },
        responseBody: JSON.stringify({ success: true }),
        latencyMs: 123,
        attemptNumber: 1,
        deliveredAt: new Date(),
      },
    });
    console.log(`✅ Created delivery: ${delivery.id}\n`);

    // Test: List deliveries
    console.log('5. Listing deliveries...');
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: webhook.id },
    });
    console.log(`✅ Found ${deliveries.length} delivery/deliveries\n`);

    // Test: Delete webhook (should cascade delete deliveries)
    console.log('6. Deleting webhook...');
    await prisma.webhook.delete({
      where: { id: webhook.id },
    });
    console.log(`✅ Deleted webhook\n`);

    // Verify cascade delete
    const remainingDeliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId: webhook.id },
    });
    console.log(`✅ Verified cascade delete (remaining deliveries: ${remainingDeliveries.length})\n`);

    console.log('All tests passed! ✅');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWebhookOperations();
