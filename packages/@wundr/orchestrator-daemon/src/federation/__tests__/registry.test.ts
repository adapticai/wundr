/**
 * Federation Registry Tests
 */

import { FederationRegistry } from '../registry';
import { RegistryOrchestratorMetadata, FederationRegistryConfig } from '../registry-types';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    sAdd: jest.fn().mockResolvedValue(1),
    sRem: jest.fn().mockResolvedValue(1),
    sMembers: jest.fn().mockResolvedValue([]),
    sInter: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('PONG'),
    keys: jest.fn().mockResolvedValue([]),
  })),
}));

describe('FederationRegistry', () => {
  let registry: FederationRegistry;
  let config: FederationRegistryConfig;

  beforeEach(() => {
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
        'Redis not connected'
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
        lastHeartbeat: new Date(), // Fresh heartbeat
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
        lastHeartbeat: new Date(Date.now() - 60000), // 1 minute ago (stale)
        registeredAt: new Date(),
      };

      await registry.registerOrchestrator(healthyMetadata);
      await registry.registerOrchestrator(unhealthyMetadata);

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
        tier: 'production',
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
