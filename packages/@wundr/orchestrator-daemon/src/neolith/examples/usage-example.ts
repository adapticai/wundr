/**
 * Neolith API Client Usage Examples
 *
 * Demonstrates how to use the NeolithApiClient to communicate with the Neolith web app.
 *
 * @module neolith/examples/usage-example
 */

import { NeolithApiClient } from '../api-client';

/**
 * Example 1: Basic Authentication and Configuration
 */
async function basicAuthenticationExample() {
  console.log('=== Basic Authentication Example ===\n');

  // Create the client
  const client = new NeolithApiClient({
    baseUrl: 'https://neolith.wundr.io',
    apiKey: 'vp_abc123_xyz',
    apiSecret: 'secret_key',
    retryAttempts: 3,
    retryDelay: 1000,
  });

  // Authenticate with the API
  const authResponse = await client.authenticate([
    'messages:read',
    'messages:write',
  ]);

  console.log('Authenticated successfully!');
  console.log('Orchestrator ID:', authResponse.orchestrator.id);
  console.log('User:', authResponse.orchestrator.user.name);
  console.log('Organization:', authResponse.orchestrator.organization.name);
  console.log('Session ID:', authResponse.sessionId);
  console.log('Token expires at:', authResponse.expiresAt);
  console.log();

  // Get configuration
  const config = await client.getConfig();
  console.log('Configuration loaded:');
  console.log('- Role:', config.orchestrator.role);
  console.log('- Discipline:', config.orchestrator.discipline);
  console.log('- Heartbeat interval:', config.operationalConfig.heartbeatIntervalMs, 'ms');
  console.log('- Scopes:', config.scopes.join(', '));
  console.log();
}

/**
 * Example 2: Sending Heartbeats with Metrics
 */
async function heartbeatExample() {
  console.log('=== Heartbeat Example ===\n');

  const client = new NeolithApiClient({
    baseUrl: process.env.NEOLITH_URL || 'http://localhost:3000',
    apiKey: process.env.NEOLITH_API_KEY!,
    apiSecret: process.env.NEOLITH_API_SECRET!,
  });

  await client.authenticate();

  // Send heartbeat with metrics
  const heartbeat = await client.sendHeartbeat({
    status: 'active',
    metrics: {
      memoryUsageMB: 256,
      cpuUsagePercent: 15.5,
      activeConnections: 5,
      messagesProcessed: 42,
      uptimeSeconds: 3600,
    },
  });

  console.log('Heartbeat sent successfully');
  console.log('Server time:', heartbeat.serverTime);
  console.log('Next heartbeat expected at:', heartbeat.nextHeartbeat);
  console.log('Heartbeat interval:', heartbeat.heartbeatIntervalMs, 'ms');
  console.log();
}

/**
 * Example 3: Periodic Heartbeat Loop
 */
async function periodicHeartbeatExample() {
  console.log('=== Periodic Heartbeat Example ===\n');

  const client = new NeolithApiClient({
    baseUrl: process.env.NEOLITH_URL || 'http://localhost:3000',
    apiKey: process.env.NEOLITH_API_KEY!,
    apiSecret: process.env.NEOLITH_API_SECRET!,
  });

  await client.authenticate();

  // Get the heartbeat interval from config
  const config = await client.getConfig();
  const intervalMs = config.operationalConfig.heartbeatIntervalMs;

  console.log(`Starting heartbeat loop (every ${intervalMs}ms)...`);
  console.log('Press Ctrl+C to stop\n');

  // Heartbeat loop
  let messagesProcessed = 0;
  const startTime = Date.now();

  setInterval(async () => {
    try {
      const uptime = Math.floor((Date.now() - startTime) / 1000);

      await client.sendHeartbeat({
        status: 'active',
        metrics: {
          memoryUsageMB: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
          cpuUsagePercent: Math.random() * 20, // Simulated
          activeConnections: 3,
          messagesProcessed: messagesProcessed++,
          uptimeSeconds: uptime,
        },
      });

      console.log(`Heartbeat sent (uptime: ${uptime}s, messages: ${messagesProcessed})`);
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, intervalMs);
}

/**
 * Example 4: Messaging - Reading and Sending
 */
async function messagingExample() {
  console.log('=== Messaging Example ===\n');

  const client = new NeolithApiClient({
    baseUrl: process.env.NEOLITH_URL || 'http://localhost:3000',
    apiKey: process.env.NEOLITH_API_KEY!,
    apiSecret: process.env.NEOLITH_API_SECRET!,
  });

  await client.authenticate(['messages:read', 'messages:write']);

  const channelId = 'chan_example_123';

  // Get recent messages
  console.log('Fetching recent messages...');
  const { messages } = await client.getMessages(channelId, { limit: 10 });

  console.log(`Found ${messages.length} messages:`);
  messages.forEach(msg => {
    console.log(`- [${msg.createdAt.toISOString()}] ${msg.author.name}: ${msg.content}`);
  });
  console.log();

  // Send a message
  console.log('Sending a message...');
  const { messageId } = await client.sendMessage(
    channelId,
    'Hello from the orchestrator daemon!',
    {
      metadata: {
        source: 'automated',
        timestamp: new Date().toISOString(),
      },
    }
  );
  console.log('Message sent with ID:', messageId);
  console.log();

  // Send a threaded reply
  if (messages.length > 0) {
    console.log('Sending a threaded reply...');
    const { messageId: replyId } = await client.sendMessage(
      channelId,
      'This is a reply to the first message',
      {
        threadId: messages[0].id,
      }
    );
    console.log('Reply sent with ID:', replyId);
  }
  console.log();
}

/**
 * Example 5: Status Updates
 */
async function statusUpdateExample() {
  console.log('=== Status Update Example ===\n');

  const client = new NeolithApiClient({
    baseUrl: process.env.NEOLITH_URL || 'http://localhost:3000',
    apiKey: process.env.NEOLITH_API_KEY!,
    apiSecret: process.env.NEOLITH_API_SECRET!,
  });

  await client.authenticate();

  // Set status to active
  console.log('Setting status to active...');
  await client.updateStatus('active', {
    message: 'Processing incoming requests',
  });
  console.log('Status updated to: active');

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Set status to busy
  console.log('Setting status to busy...');
  await client.updateStatus('paused', {
    message: 'Performing maintenance',
  });
  console.log('Status updated to: paused');

  // Simulate maintenance
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Back to active
  console.log('Setting status back to active...');
  await client.updateStatus('active', {
    message: 'Ready for requests',
  });
  console.log('Status updated to: active');
  console.log();
}

/**
 * Example 6: Automatic Token Refresh
 */
async function tokenRefreshExample() {
  console.log('=== Token Refresh Example ===\n');

  const client = new NeolithApiClient({
    baseUrl: process.env.NEOLITH_URL || 'http://localhost:3000',
    apiKey: process.env.NEOLITH_API_KEY!,
    apiSecret: process.env.NEOLITH_API_SECRET!,
    // Refresh token 5 minutes before expiry
    tokenRefreshBuffer: 5 * 60 * 1000,
  });

  // Initial authentication
  const authResponse = await client.authenticate();
  console.log('Initial authentication successful');
  console.log('Token expires at:', authResponse.expiresAt);
  console.log();

  // Make requests over time - tokens will be automatically refreshed
  for (let i = 0; i < 5; i++) {
    console.log(`Request ${i + 1}:`);

    // Make a request (token will be refreshed automatically if needed)
    await client.sendHeartbeat({ status: 'active' });
    console.log('- Heartbeat sent successfully');

    // Wait a while before next request
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\nAll requests completed with automatic token management');
}

/**
 * Example 7: Error Handling and Retry Logic
 */
async function errorHandlingExample() {
  console.log('=== Error Handling Example ===\n');

  const client = new NeolithApiClient({
    baseUrl: 'http://localhost:3000',
    apiKey: 'invalid_key',
    apiSecret: 'invalid_secret',
    retryAttempts: 3,
    retryDelay: 1000,
  });

  try {
    await client.authenticate();
  } catch (error) {
    console.log('Authentication failed (expected):');
    console.log('-', (error as Error).message);
  }
  console.log();

  // Example with valid credentials but network issues
  const validClient = new NeolithApiClient({
    baseUrl: process.env.NEOLITH_URL || 'http://localhost:3000',
    apiKey: process.env.NEOLITH_API_KEY!,
    apiSecret: process.env.NEOLITH_API_SECRET!,
    retryAttempts: 3,
    retryDelay: 500,
  });

  try {
    await validClient.authenticate();
    console.log('Authentication successful');

    // Try to send message to non-existent channel
    await validClient.sendMessage('invalid_channel', 'Test message');
  } catch (error) {
    console.log('Message send failed (expected):');
    console.log('-', (error as Error).message);
  }
  console.log();
}

/**
 * Example 8: Full Daemon Integration
 */
async function fullDaemonExample() {
  console.log('=== Full Daemon Integration Example ===\n');

  const client = new NeolithApiClient({
    baseUrl: process.env.NEOLITH_URL || 'http://localhost:3000',
    apiKey: process.env.NEOLITH_API_KEY!,
    apiSecret: process.env.NEOLITH_API_SECRET!,
  });

  // Authenticate
  console.log('Step 1: Authenticating...');
  const auth = await client.authenticate(['messages:read', 'messages:write']);
  console.log(`✓ Authenticated as ${auth.orchestrator.user.name}`);

  // Get configuration
  console.log('\nStep 2: Loading configuration...');
  const config = await client.getConfig();
  console.log(`✓ Configuration loaded for ${config.orchestrator.role}`);

  // Update status to active
  console.log('\nStep 3: Setting status to active...');
  await client.updateStatus('active', { message: 'Daemon started' });
  console.log('✓ Status updated');

  // Send initial heartbeat
  console.log('\nStep 4: Sending initial heartbeat...');
  await client.sendHeartbeat({
    status: 'active',
    metrics: {
      memoryUsageMB: 128,
      cpuUsagePercent: 5,
      activeConnections: 0,
      messagesProcessed: 0,
      uptimeSeconds: 0,
    },
  });
  console.log('✓ Heartbeat sent');

  // Monitor a channel
  console.log('\nStep 5: Monitoring channel for new messages...');
  const channelId = process.env.CHANNEL_ID || 'chan_default';
  const { messages } = await client.getMessages(channelId, { limit: 5 });
  console.log(`✓ Found ${messages.length} recent messages`);

  // Send a status message
  console.log('\nStep 6: Sending status message...');
  await client.sendMessage(
    channelId,
    'Orchestrator daemon is now online and monitoring this channel.',
    {
      metadata: {
        type: 'system',
        timestamp: new Date().toISOString(),
      },
    }
  );
  console.log('✓ Status message sent');

  console.log('\n✅ Full daemon integration complete!');
}

// Main execution
async function main() {
  const examples = {
    basic: basicAuthenticationExample,
    heartbeat: heartbeatExample,
    periodic: periodicHeartbeatExample,
    messaging: messagingExample,
    status: statusUpdateExample,
    refresh: tokenRefreshExample,
    errors: errorHandlingExample,
    full: fullDaemonExample,
  };

  const exampleName = process.argv[2] as keyof typeof examples;

  if (!exampleName || !examples[exampleName]) {
    console.log('Usage: ts-node usage-example.ts <example-name>\n');
    console.log('Available examples:');
    Object.keys(examples).forEach(name => {
      console.log(`  - ${name}`);
    });
    process.exit(1);
  }

  try {
    await examples[exampleName]();
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  basicAuthenticationExample,
  heartbeatExample,
  periodicHeartbeatExample,
  messagingExample,
  statusUpdateExample,
  tokenRefreshExample,
  errorHandlingExample,
  fullDaemonExample,
};
