/**
 * Example usage of OrchestratorConnection class
 * Demonstrates WebSocket-based federation between orchestrators
 */

import * as WebSocket from 'ws';

import { OrchestratorConnection } from '../connection';

import type { DelegationRequest, FederationMessage, OrchestratorCapability } from '../types';

/**
 * Example: Creating and using an OrchestratorConnection
 */
async function exampleConnection() {
  // 1. Establish WebSocket connection to remote orchestrator
  const remoteUrl = 'ws://localhost:8788/federation';
  const socket = new WebSocket.WebSocket(remoteUrl);

  // 2. Define capabilities of the remote orchestrator
  const capabilities: OrchestratorCapability[] = [
    'code-generation',
    'testing',
    'analysis',
    'deployment',
  ];

  // 3. Create OrchestratorConnection instance
  const connection = new OrchestratorConnection({
    id: 'remote-orchestrator-1',
    socket,
    capabilities,
    heartbeatTimeout: 30000, // 30 seconds
    maxQueueSize: 500,
  });

  // 4. Set up event listeners
  connection.on('message', (message: FederationMessage) => {
    console.log('Received message:', message.type, 'from', message.from);
  });

  connection.on('delegation', async (request: DelegationRequest) => {
    console.log('Delegation request received:', request.task.id);

    // Accept or reject based on capabilities
    const response = await connection.acceptDelegation(request);
    console.log('Delegation response:', response);
  });

  connection.on('callback', (callback) => {
    console.log('Task callback:', callback.taskId, callback.status);
  });

  connection.on('heartbeat', (timestamp) => {
    console.log('Heartbeat received at:', timestamp);
  });

  connection.on('error', (error) => {
    console.error('Connection error:', error.message);
  });

  connection.on('close', (code, reason) => {
    console.log('Connection closed:', code, reason);
  });

  // 5. Wait for connection to be established
  await new Promise((resolve) => {
    socket.on('open', resolve);
  });

  console.log('Connected to remote orchestrator');

  // 6. Check capabilities before delegating
  const hasRequiredCapabilities = connection.checkCapability([
    'code-generation',
    'testing',
  ]);

  if (hasRequiredCapabilities) {
    console.log('Remote orchestrator has required capabilities');

    // 7. Send a delegation request
    const delegationMessage: FederationMessage = {
      type: 'delegation',
      payload: {
        fromOrchestratorId: 'local-orchestrator',
        toOrchestratorId: 'remote-orchestrator-1',
        task: {
          id: 'task-123',
          type: 'code',
          description: 'Implement authentication system',
          priority: 'high',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        priority: 'high',
      },
      from: 'local-orchestrator',
      to: 'remote-orchestrator-1',
      timestamp: new Date(),
      correlationId: 'task-123',
    };

    await connection.sendMessage(delegationMessage);
    console.log('Delegation message sent');
  }

  // 8. Check connection health
  const status = connection.getStatus();
  console.log('Connection status:', {
    status: status.status,
    uptime: status.uptime,
    messagesSent: status.messagesSent,
    messagesReceived: status.messagesReceived,
    healthy: connection.isHealthy(),
  });

  // 9. Send a heartbeat
  connection.handleHeartbeat();

  // 10. Wait for some activity
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // 11. Gracefully disconnect
  await connection.disconnect();
  console.log('Disconnected from remote orchestrator');
}

/**
 * Example: Handling incoming delegation requests
 */
async function exampleDelegationHandler() {
  const socket = new WebSocket.WebSocket('ws://localhost:8788/federation');

  const connection = new OrchestratorConnection({
    id: 'orchestrator-handler',
    socket,
    capabilities: ['code-generation', 'research', 'analysis'],
  });

  // Listen for delegation requests
  connection.on('delegation', async (request: DelegationRequest) => {
    console.log('Received delegation request for task:', request.task.id);
    console.log('Task description:', request.task.description);
    console.log('Priority:', request.priority);

    // Accept the delegation
    const response = await connection.acceptDelegation(request);

    if (response.accepted) {
      console.log('Delegation accepted, starting task execution...');

      // Simulate task execution
      setTimeout(async () => {
        // Send progress callback
        await connection.sendMessage({
          type: 'callback',
          payload: {
            taskId: request.task.id,
            status: 'progress',
            progress: 50,
          },
          from: connection.id,
          to: request.fromOrchestratorId,
          timestamp: new Date(),
          correlationId: request.task.id,
        });
      }, 2000);

      setTimeout(async () => {
        // Send completion callback
        await connection.sendMessage({
          type: 'callback',
          payload: {
            taskId: request.task.id,
            status: 'completed',
            result: { success: true, data: 'Task completed successfully' },
          },
          from: connection.id,
          to: request.fromOrchestratorId,
          timestamp: new Date(),
          correlationId: request.task.id,
        });
      }, 5000);
    } else {
      console.log('Delegation rejected:', response.reason);
    }
  });
}

/**
 * Example: Broadcast messaging
 */
async function exampleBroadcast() {
  const socket = new WebSocket.WebSocket('ws://localhost:8788/federation');

  const connection = new OrchestratorConnection({
    id: 'broadcaster',
    socket,
    capabilities: ['monitoring'],
  });

  // Listen for broadcasts
  connection.on('broadcast', (payload) => {
    console.log('Broadcast received on topic:', payload.topic);
    console.log('Data:', payload.data);
  });

  // Send a broadcast
  await connection.sendMessage({
    type: 'broadcast',
    payload: {
      topic: 'system-status',
      data: {
        status: 'healthy',
        load: 0.45,
        activeSessions: 12,
      },
      ttl: 60000, // 1 minute
    },
    from: connection.id,
    to: 'all',
    timestamp: new Date(),
  });
}

// Export examples for documentation
export {
  exampleConnection,
  exampleDelegationHandler,
  exampleBroadcast,
};
