/**
 * Tests for OrchestratorConnection class
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { OrchestratorConnection } from '../connection';
import type { DelegationRequest, FederationMessage, OrchestratorCapability } from '../types';

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
  const capabilities: OrchestratorCapability[] = ['code-generation', 'testing', 'analysis'];

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
      const result = connection.checkCapability(['code-generation', 'deployment']);
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
      const oldDate = new Date();
      oldDate.setTime(oldDate.getTime() - 10000); // 10 seconds ago
      connection.handleHeartbeat();

      // Wait for timeout check
      jest.useFakeTimers();
      jest.advanceTimersByTime(6000);

      expect(connection.isHealthy()).toBe(false);

      jest.useRealTimers();
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
    it('should update lastHeartbeat timestamp', () => {
      const before = connection.lastHeartbeat;

      // Wait a bit
      setTimeout(() => {
        connection.handleHeartbeat();
        const after = connection.lastHeartbeat;

        expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
      }, 10);
    });

    it('should emit heartbeat event', (done) => {
      connection.on('heartbeat', (timestamp) => {
        expect(timestamp).toBeInstanceOf(Date);
        done();
      });

      connection.handleHeartbeat();
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
    it('should handle delegation messages', (done) => {
      connection.on('delegation', (request) => {
        expect(request.task.id).toBe('task-1');
        done();
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
    });

    it('should handle callback messages', (done) => {
      connection.on('callback', (callback) => {
        expect(callback.taskId).toBe('task-1');
        expect(callback.status).toBe('completed');
        done();
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
    });

    it('should handle broadcast messages', (done) => {
      connection.on('broadcast', (payload) => {
        expect(payload.topic).toBe('test-topic');
        done();
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
    });

    it('should emit error on malformed message', (done) => {
      connection.on('error', (error) => {
        expect(error).toBeInstanceOf(Error);
        done();
      });

      mockSocket.emit('message', 'invalid json');
    });
  });
});
