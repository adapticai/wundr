/**
 * Tests for OrchestratorConnection class
 */

import { EventEmitter } from 'events';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';

import { OrchestratorConnection } from '../connection';

import type {
  DelegationRequest,
  FederationMessage,
  OrchestratorCapability,
} from '../types';

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  public readyState: number = WebSocket.OPEN;
  public sentMessages: string[] = [];

  send(data: string, callback?: (error?: Error) => void): void {
    this.sentMessages.push(data);
    if (callback) {
      callback();
    }
  }

  ping(): void {
    // Mock ping
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSED;
    this.emit('close', code || 1000, Buffer.from(reason || ''));
  }
}

describe('OrchestratorConnection', () => {
  let mockSocket: MockWebSocket;
  let connection: OrchestratorConnection;
  const capabilities: OrchestratorCapability[] = [
    'code-generation',
    'testing',
    'analysis',
  ];

  beforeEach(() => {
    mockSocket = new MockWebSocket();
    connection = new OrchestratorConnection({
      id: 'test-orchestrator-1',
      socket: mockSocket as unknown as WebSocket,
      capabilities,
      heartbeatTimeout: 5000,
      maxQueueSize: 100,
    });
  });

  afterEach(async () => {
    await connection.disconnect();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(connection.id).toBe('test-orchestrator-1');
      expect(connection.capabilities).toEqual(capabilities);
      expect(connection.status).toBe('connecting');
      expect(connection.messageQueue).toEqual([]);
    });
  });

  describe('checkCapability', () => {
    it('should return true if orchestrator has all required capabilities', () => {
      const result = connection.checkCapability(['code-generation', 'testing']);
      expect(result).toBe(true);
    });

    it('should return false if orchestrator is missing required capabilities', () => {
      const result = connection.checkCapability([
        'code-generation',
        'deployment',
      ]);
      expect(result).toBe(false);
    });

    it('should return true for empty capability array', () => {
      const result = connection.checkCapability([]);
      expect(result).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should send message via WebSocket when connection is open', async () => {
      const message: FederationMessage = {
        type: 'heartbeat',
        payload: { orchestratorId: 'test', timestamp: new Date() },
        from: 'test-1',
        to: 'test-2',
        timestamp: new Date(),
      };

      await connection.sendMessage(message);

      expect(mockSocket.sentMessages).toHaveLength(1);
      const sent = JSON.parse(mockSocket.sentMessages[0]);
      expect(sent.type).toBe('heartbeat');
      expect(sent.from).toBe('test-1');
    });

    it('should queue message if connection is not open', async () => {
      mockSocket.readyState = WebSocket.CONNECTING;

      const message: FederationMessage = {
        type: 'status',
        payload: {},
        from: 'test-1',
        to: 'test-2',
        timestamp: new Date(),
      };

      await connection.sendMessage(message);

      expect(mockSocket.sentMessages).toHaveLength(0);
      expect(connection.messageQueue).toHaveLength(1);
    });
  });

  describe('acceptDelegation', () => {
    it('should accept delegation if connection is healthy', async () => {
      // Trigger open event
      mockSocket.emit('open');

      const request: DelegationRequest = {
        fromOrchestratorId: 'orchestrator-1',
        toOrchestratorId: 'test-orchestrator-1',
        task: {
          id: 'task-1',
          type: 'code',
          description: 'Test task',
          priority: 'high',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        priority: 'high',
      };

      const response = await connection.acceptDelegation(request);

      expect(response.accepted).toBe(true);
      expect(response.taskId).toBe('task-1');
      expect(mockSocket.sentMessages).toHaveLength(1);
    });

    it('should reject delegation if connection is unhealthy', async () => {
      mockSocket.readyState = WebSocket.CLOSED;

      const request: DelegationRequest = {
        fromOrchestratorId: 'orchestrator-1',
        toOrchestratorId: 'test-orchestrator-1',
        task: {
          id: 'task-1',
          type: 'code',
          description: 'Test task',
          priority: 'high',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        priority: 'high',
      };

      const response = await connection.acceptDelegation(request);

      expect(response.accepted).toBe(false);
      expect(response.reason).toBe('Connection unhealthy');
    });
  });

  describe('isHealthy', () => {
    it('should return false if socket is not open', () => {
      mockSocket.readyState = WebSocket.CLOSED;
      expect(connection.isHealthy()).toBe(false);
    });

    it('should return false if heartbeat timeout exceeded', () => {
      mockSocket.emit('open');

      // Mock old heartbeat
      connection.handleHeartbeat();

      // Use fake timers to simulate timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(6000);

      expect(connection.isHealthy()).toBe(false);

      vi.useRealTimers();
    });

    it('should return true if connection is open and heartbeat recent', () => {
      mockSocket.emit('open');
      connection.handleHeartbeat();

      expect(connection.isHealthy()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return connection health info', () => {
      mockSocket.emit('open');

      const status = connection.getStatus();

      expect(status.status).toBe('connected');
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.messagesSent).toBe(0);
      expect(status.messagesReceived).toBe(0);
      expect(status.errors).toBe(0);
    });
  });

  describe('handleHeartbeat', () => {
    it('should update lastHeartbeat timestamp', async () => {
      const before = connection.lastHeartbeat;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      connection.handleHeartbeat();
      const after = connection.lastHeartbeat;

      expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should emit heartbeat event', async () => {
      const heartbeatPromise = new Promise<Date>(resolve => {
        connection.on('heartbeat', (timestamp: Date) => {
          resolve(timestamp);
        });
      });

      connection.handleHeartbeat();

      const timestamp = await heartbeatPromise;
      expect(timestamp).toBeInstanceOf(Date);
    });
  });

  describe('disconnect', () => {
    it('should gracefully close connection', async () => {
      mockSocket.emit('open');

      await connection.disconnect();

      expect(mockSocket.readyState).toBe(WebSocket.CLOSED);
      expect(connection.status).toBe('disconnected');
    });

    it('should send queued messages before disconnecting', async () => {
      // Queue some messages
      mockSocket.readyState = WebSocket.CONNECTING;

      const message: FederationMessage = {
        type: 'status',
        payload: {},
        from: 'test-1',
        to: 'test-2',
        timestamp: new Date(),
      };

      await connection.sendMessage(message);

      // Now open and disconnect
      mockSocket.readyState = WebSocket.OPEN;
      mockSocket.emit('open');

      await connection.disconnect();

      // Should have attempted to send queued message
      expect(connection.messageQueue).toHaveLength(0);
    });
  });

  describe('message handling', () => {
    it('should handle delegation messages', async () => {
      const delegationPromise = new Promise<any>(resolve => {
        connection.on('delegation', (request: any) => {
          resolve(request);
        });
      });

      const message = {
        type: 'delegation',
        payload: JSON.stringify({
          fromOrchestratorId: 'orch-1',
          toOrchestratorId: 'orch-2',
          task: {
            id: 'task-1',
            type: 'code',
            description: 'Test',
            priority: 'high',
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          priority: 'high',
        }),
        from: 'orch-1',
        to: 'orch-2',
        timestamp: new Date().toISOString(),
      };

      mockSocket.emit('message', JSON.stringify(message));

      const request = await delegationPromise;
      expect(request.task.id).toBe('task-1');
    });

    it('should handle callback messages', async () => {
      const callbackPromise = new Promise<any>(resolve => {
        connection.on('callback', (callback: any) => {
          resolve(callback);
        });
      });

      const message = {
        type: 'callback',
        payload: JSON.stringify({
          taskId: 'task-1',
          status: 'completed',
          result: { success: true },
        }),
        from: 'orch-1',
        to: 'orch-2',
        timestamp: new Date().toISOString(),
      };

      mockSocket.emit('message', JSON.stringify(message));

      const callback = await callbackPromise;
      expect(callback.taskId).toBe('task-1');
      expect(callback.status).toBe('completed');
    });

    it('should handle broadcast messages', async () => {
      const broadcastPromise = new Promise<any>(resolve => {
        connection.on('broadcast', (payload: any) => {
          resolve(payload);
        });
      });

      const message = {
        type: 'broadcast',
        payload: JSON.stringify({
          topic: 'test-topic',
          data: { message: 'Hello' },
        }),
        from: 'orch-1',
        to: 'all',
        timestamp: new Date().toISOString(),
      };

      mockSocket.emit('message', JSON.stringify(message));

      const payload = await broadcastPromise;
      expect(payload.topic).toBe('test-topic');
    });

    it('should emit error on malformed message', async () => {
      const errorPromise = new Promise<Error>(resolve => {
        connection.on('error', (error: Error) => {
          resolve(error);
        });
      });

      mockSocket.emit('message', 'invalid json');

      const error = await errorPromise;
      expect(error).toBeInstanceOf(Error);
    });
  });
});
