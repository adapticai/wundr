/**
 * Simplified tests for DaemonNode class
 */

import {
  DaemonNode,
  NodeCapabilities,
  SessionSpawnRequest,
} from '../../src/distributed/daemon-node';

describe('DaemonNode', () => {
  let node: DaemonNode;
  const nodeId = 'test-node-1';
  const host = 'localhost';
  const port = 8787;
  const capabilities: NodeCapabilities = {
    canSpawnSessions: true,
    maxConcurrentSessions: 10,
    supportedSessionTypes: ['claude-code', 'claude-flow'],
    hasGPUAccess: false,
    hasHighMemory: true,
  };

  beforeEach(() => {
    node = new DaemonNode(nodeId, host, port, capabilities);
  });

  afterEach(async () => {
    await node.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(node.getId()).toBe(nodeId);
      expect(node.getCapabilities()).toEqual(capabilities);
      expect(node.getConnectionState()).toBe('disconnected');
    });

    it('should return copy of capabilities', () => {
      const caps1 = node.getCapabilities();
      const caps2 = node.getCapabilities();
      expect(caps1).toEqual(caps2);
      expect(caps1).not.toBe(caps2);
    });
  });

  describe('Connection State', () => {
    it('should start disconnected', () => {
      expect(node.getConnectionState()).toBe('disconnected');
    });

    it('should not be healthy when disconnected', () => {
      expect(node.isHealthy()).toBe(false);
    });
  });

  describe('Health Metrics', () => {
    it('should return offline status when disconnected', async () => {
      const health = await node.getHealth();
      expect(health.status).toBe('offline');
    });

    it('should get cached health synchronously', () => {
      const health = node.getCachedHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('cpuUsage');
      expect(health).toHaveProperty('memoryUsage');
      expect(health).toHaveProperty('activeSessions');
      expect(health).toHaveProperty('responseTime');
      expect(health).toHaveProperty('lastHeartbeat');
      expect(health).toHaveProperty('uptime');
    });
  });

  describe('Session Spawning Capabilities', () => {
    it('should throw error if node cannot spawn sessions', async () => {
      const nodeCaps: NodeCapabilities = {
        ...capabilities,
        canSpawnSessions: false,
      };
      const restrictedNode = new DaemonNode(nodeId, host, port, nodeCaps);

      const request: SessionSpawnRequest = {
        orchestratorId: 'orch-1',
        task: {
          id: 'task-1',
          type: 'code',
          description: 'Test task',
          priority: 'high',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        sessionType: 'claude-code',
      };

      await expect(restrictedNode.spawnSession(request)).rejects.toThrow(
        'does not support session spawning',
      );

      await restrictedNode.cleanup();
    });

    it('should throw error for unsupported session type', async () => {
      const nodeCaps: NodeCapabilities = {
        ...capabilities,
        supportedSessionTypes: ['claude-code'],
      };
      const restrictedNode = new DaemonNode(nodeId, host, port, nodeCaps);

      const request: SessionSpawnRequest = {
        orchestratorId: 'orch-1',
        task: {
          id: 'task-1',
          type: 'code',
          description: 'Test task',
          priority: 'high',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        sessionType: 'claude-flow',
      };

      await expect(restrictedNode.spawnSession(request)).rejects.toThrow(
        'does not support session type',
      );

      await restrictedNode.cleanup();
    });
  });

  describe('Event Handling', () => {
    it('should emit events through EventEmitter', (done) => {
      node.on('test-event', (data: any) => {
        expect(data).toBe('test-data');
        done();
      });

      node.emit('test-event', 'test-data');
    });
  });
});
