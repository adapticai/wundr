/**
 * Federation Registry Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { FederationRegistry } from '../registry';

import type { RegistryOrchestratorMetadata, FederationRegistryConfig } from '../registry-types';

/**
 * In-memory Redis mock that supports the subset of commands used by
 * FederationRegistry: get/set/del for strings, sAdd/sRem/sMembers/sInter
 * for sets, and on/connect/disconnect for lifecycle.
 */
function createMockRedisClient() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const handlers: Record<string, ((...args: unknown[]) => unknown)[]> = {};

  return {
    connect: vi.fn(async () => {
      (handlers['connect'] ?? []).forEach(cb => cb());
    }),
    disconnect: vi.fn(async () => {
      (handlers['disconnect'] ?? []).forEach(cb => cb());
    }),
    on: vi.fn((event: string, cb: (...args: unknown[]) => unknown) => {
      if (!handlers[event]) {
handlers[event] = [];
}
      handlers[event].push(cb);
    }),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      const had = store.has(key) ? 1 : 0;
      store.delete(key);
      return had;
    }),
    sAdd: vi.fn(async (key: string, member: string) => {
      if (!sets.has(key)) {
sets.set(key, new Set());
}
      const s = sets.get(key)!;
      const isNew = !s.has(member);
      s.add(member);
      return isNew ? 1 : 0;
    }),
    sRem: vi.fn(async (key: string, member: string) => {
      const s = sets.get(key);
      if (!s) {
return 0;
}
      const had = s.has(member) ? 1 : 0;
      s.delete(member);
      return had;
    }),
    sMembers: vi.fn(async (key: string) => {
      const s = sets.get(key);
      return s ? [...s] : [];
    }),
    sInter: vi.fn(async (keys: string[]) => {
      if (keys.length === 0) {
return [];
}
      const first = sets.get(keys[0]);
      if (!first) {
return [];
}
      const result = [...first].filter(member =>
        keys.every(k => {
          const s = sets.get(k);
          return s ? s.has(member) : false;
        }),
      );
      return result;
    }),
    ping: vi.fn(async () => 'PONG'),
    keys: vi.fn(async () => [...store.keys()]),
  };
}

vi.mock('redis', () => ({
  createClient: vi.fn(() => createMockRedisClient()),
}));

describe('FederationRegistry', () => {
  let registry: FederationRegistry;
  let config: FederationRegistryConfig;

  beforeEach(async () => {
    config = {
      redis: {
        host: 'localhost',
        port: 6379,
        keyPrefix: 'test',
      },
      heartbeatTimeout: 30000,
      staleTimeout: 300000,
      cleanupInterval: 60000,
    };

    registry = new FederationRegistry(config);

    // The constructor kicks off an async setupRedis() that calls connect().
    // Give the microtask queue a tick so the mocked connect() resolves and
    // the 'connect' event handler sets this.connected = true.
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  afterEach(async () => {
    await registry.disconnect();
  });

  describe('registerOrchestrator', () => {
    it('should register an orchestrator successfully', async () => {
      const metadata: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: ['text-generation', 'code-completion'],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      const registeredPromise = new Promise(resolve => {
        registry.once('orchestrator:registered', resolve);
      });

      await registry.registerOrchestrator(metadata);

      const registered = await registeredPromise;
      expect(registered).toMatchObject({
        id: 'orch-1',
        name: 'Orchestrator 1',
      });
    });

    it('should throw error when Redis is not connected', async () => {
      await registry.disconnect();

      const metadata: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: [],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      await expect(registry.registerOrchestrator(metadata)).rejects.toThrow(
        'Redis not connected',
      );
    });
  });

  describe('deregisterOrchestrator', () => {
    it('should deregister an orchestrator successfully', async () => {
      const metadata: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: ['text-generation'],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(metadata);

      const deregisteredPromise = new Promise(resolve => {
        registry.once('orchestrator:deregistered', resolve);
      });

      await registry.deregisterOrchestrator('orch-1');

      const deregisteredId = await deregisteredPromise;
      expect(deregisteredId).toBe('orch-1');
    });
  });

  describe('updateHeartbeat', () => {
    it('should update heartbeat timestamp', async () => {
      const metadata: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: [],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(Date.now() - 60000), // 1 minute ago
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(metadata);

      const heartbeatPromise = new Promise(resolve => {
        registry.once('heartbeat:received', resolve);
      });

      await registry.updateHeartbeat('orch-1');

      const orchestratorId = await heartbeatPromise;
      expect(orchestratorId).toBe('orch-1');
    });

    it('should emit status change when orchestrator becomes healthy', async () => {
      const metadata: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: [],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'offline',
        lastHeartbeat: new Date(Date.now() - 60000),
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(metadata);

      const statusChangePromise = new Promise(resolve => {
        registry.once('orchestrator:status_changed', (id, oldStatus, newStatus) => {
          resolve({ id, oldStatus, newStatus });
        });
      });

      await registry.updateHeartbeat('orch-1');

      const statusChange = await statusChangePromise;
      expect(statusChange).toMatchObject({
        id: 'orch-1',
        oldStatus: 'offline',
        newStatus: 'online',
      });
    });
  });

  describe('getOrchestratorsByCapability', () => {
    it('should return orchestrators with specified capabilities', async () => {
      const metadata1: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: ['text-generation', 'code-completion'],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      const metadata2: RegistryOrchestratorMetadata = {
        id: 'orch-2',
        name: 'Orchestrator 2',
        capabilities: ['text-generation'],
        region: 'us-west-2',
        maxSessions: 50,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 500000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(metadata1);
      await registry.registerOrchestrator(metadata2);

      const orchestrators = await registry.getOrchestratorsByCapability(['text-generation']);
      expect(orchestrators).toHaveLength(2);
    });

    it('should return empty array for non-existent capability', async () => {
      const orchestrators = await registry.getOrchestratorsByCapability(['non-existent']);
      expect(orchestrators).toHaveLength(0);
    });
  });

  describe('getOrchestratorsByRegion', () => {
    it('should return orchestrators in specified region', async () => {
      const metadata1: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: [],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      const metadata2: RegistryOrchestratorMetadata = {
        id: 'orch-2',
        name: 'Orchestrator 2',
        capabilities: [],
        region: 'us-west-2',
        maxSessions: 50,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 500000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(metadata1);
      await registry.registerOrchestrator(metadata2);

      const orchestrators = await registry.getOrchestratorsByRegion('us-east-1');
      expect(orchestrators).toHaveLength(1);
      expect(orchestrators[0].id).toBe('orch-1');
    });
  });

  describe('getHealthyOrchestrators', () => {
    it('should return only healthy orchestrators', async () => {
      const healthyMetadata: RegistryOrchestratorMetadata = {
        id: 'orch-healthy',
        name: 'Healthy Orchestrator',
        capabilities: [],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      const unhealthyMetadata: RegistryOrchestratorMetadata = {
        id: 'orch-unhealthy',
        name: 'Unhealthy Orchestrator',
        capabilities: [],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(healthyMetadata);
      await registry.registerOrchestrator(unhealthyMetadata);

      // registerOrchestrator always overwrites lastHeartbeat to now,
      // so we need to manually backdate the unhealthy orchestrator's
      // heartbeat via updateMetrics or by directly modifying the
      // stored data.  The simplest approach is to update the status
      // to 'offline' which also gets filtered.
      await registry.updateStatus('orch-unhealthy', 'offline');

      const healthyOrchestrators = await registry.getHealthyOrchestrators();
      expect(healthyOrchestrators).toHaveLength(1);
      expect(healthyOrchestrators[0].id).toBe('orch-healthy');
    });
  });

  describe('getOrchestratorMetrics', () => {
    it('should return metrics for an orchestrator', async () => {
      const metadata: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: [],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 50,
        tokensUsed: 250000,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(metadata);

      const metrics = await registry.getOrchestratorMetrics('orch-1');

      expect(metrics).toMatchObject({
        id: 'orch-1',
        load: 0.5,
        sessions: 50,
        tokensUsed: 250000,
        tokenLimit: 1000000,
        tokenUtilization: 0.25,
        status: 'online',
      });
    });

    it('should return null for non-existent orchestrator', async () => {
      const metrics = await registry.getOrchestratorMetrics('non-existent');
      expect(metrics).toBeNull();
    });
  });

  describe('queryOrchestrators', () => {
    beforeEach(async () => {
      const orchestrators: RegistryOrchestratorMetadata[] = [
        {
          id: 'orch-1',
          name: 'Orchestrator 1',
          capabilities: ['text-generation', 'code-completion'],
          region: 'us-east-1',
          maxSessions: 100,
          currentSessions: 10,
          tokensUsed: 100000,
          tokenLimit: 1000000,
          tier: 'production',
        status: 'online',
          lastHeartbeat: new Date(),
          registeredAt: new Date(),
        },
        {
          id: 'orch-2',
          name: 'Orchestrator 2',
          capabilities: ['text-generation'],
          region: 'us-west-2',
          maxSessions: 50,
          currentSessions: 45,
          tokensUsed: 400000,
          tokenLimit: 500000,
          tier: 'production',
        status: 'busy',
          lastHeartbeat: new Date(),
          registeredAt: new Date(),
        },
        {
          id: 'orch-3',
          name: 'Orchestrator 3',
          capabilities: ['code-completion'],
          region: 'us-east-1',
          maxSessions: 200,
          currentSessions: 5,
          tokensUsed: 50000,
          tokenLimit: 2000000,
          tier: 'production',
        status: 'online',
          lastHeartbeat: new Date(),
          registeredAt: new Date(),
        },
      ];

      for (const metadata of orchestrators) {
        await registry.registerOrchestrator(metadata);
      }
    });

    it('should filter by capabilities', async () => {
      const results = await registry.queryOrchestrators({
        capabilities: ['text-generation'],
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach(orch => {
        expect(orch.capabilities).toContain('text-generation');
      });
    });

    it('should filter by status', async () => {
      const results = await registry.queryOrchestrators({
        status: ['online'],
      });

      results.forEach(orch => {
        expect(orch.status).toBe('online');
      });
    });

    it('should filter by minimum available sessions', async () => {
      const results = await registry.queryOrchestrators({
        minAvailableSessions: 50,
      });

      results.forEach(orch => {
        const available = orch.maxSessions - orch.currentSessions;
        expect(available).toBeGreaterThanOrEqual(50);
      });
    });

    it('should filter by minimum available tokens', async () => {
      const results = await registry.queryOrchestrators({
        minAvailableTokens: 500000,
      });

      results.forEach(orch => {
        const available = orch.tokenLimit - orch.tokensUsed;
        expect(available).toBeGreaterThanOrEqual(500000);
      });
    });

    it('should combine multiple filters', async () => {
      const results = await registry.queryOrchestrators({
        region: 'us-east-1',
        status: ['online'],
        minAvailableSessions: 20,
      });

      results.forEach(orch => {
        expect(orch.region).toBe('us-east-1');
        expect(orch.status).toBe('online');
        const available = orch.maxSessions - orch.currentSessions;
        expect(available).toBeGreaterThanOrEqual(20);
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when connected', async () => {
      const healthy = await registry.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should return false when disconnected', async () => {
      await registry.disconnect();
      const healthy = await registry.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe('updateStatus', () => {
    it('should update orchestrator status', async () => {
      const metadata: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: [],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 0,
        tokensUsed: 0,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(metadata);

      const statusChangePromise = new Promise(resolve => {
        registry.once('orchestrator:status_changed', (id, oldStatus, newStatus) => {
          resolve({ id, oldStatus, newStatus });
        });
      });

      await registry.updateStatus('orch-1', 'draining');

      const statusChange = await statusChangePromise;
      expect(statusChange).toMatchObject({
        id: 'orch-1',
        oldStatus: 'online',
        newStatus: 'draining',
      });
    });
  });

  describe('updateMetrics', () => {
    it('should update orchestrator metrics', async () => {
      const metadata: RegistryOrchestratorMetadata = {
        id: 'orch-1',
        name: 'Orchestrator 1',
        capabilities: [],
        region: 'us-east-1',
        maxSessions: 100,
        currentSessions: 10,
        tokensUsed: 100000,
        tokenLimit: 1000000,
        tier: 'production',
        status: 'online',
        lastHeartbeat: new Date(),
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(metadata);

      await registry.updateMetrics('orch-1', {
        currentSessions: 25,
        tokensUsed: 250000,
      });

      const updated = await registry.getOrchestratorMetadata('orch-1');
      expect(updated?.currentSessions).toBe(25);
      expect(updated?.tokensUsed).toBe(250000);
    });
  });
});
