/**
 * Tests for LoadBalancer
 */

import {
  LoadBalancer,
  LoadBalancerNode,
  NodeSelectionOptions,
} from '../../src/distributed/load-balancer';

describe('LoadBalancer', () => {
  let loadBalancer: LoadBalancer;

  const createTestNode = (
    id: string,
    overrides?: Partial<LoadBalancerNode>,
  ): LoadBalancerNode => ({
    id,
    endpoint: `http://node-${id}.example.com`,
    region: 'us-east-1',
    capabilities: ['session-management', 'task-execution'],
    capacity: 1.0,
    ...overrides,
  });

  beforeEach(() => {
    loadBalancer = new LoadBalancer('round-robin');
  });

  describe('Node Management', () => {
    it('should add nodes to the pool', () => {
      const node = createTestNode('node1');
      loadBalancer.addNode(node);

      expect(loadBalancer.getAllNodes()).toHaveLength(1);
      expect(loadBalancer.getNode('node1')).toEqual(node);
    });

    it('should remove nodes from the pool', () => {
      const node = createTestNode('node1');
      loadBalancer.addNode(node);
      loadBalancer.removeNode('node1');

      expect(loadBalancer.getAllNodes()).toHaveLength(0);
      expect(loadBalancer.getNode('node1')).toBeUndefined();
    });

    it('should initialize node load and health when adding', () => {
      const node = createTestNode('node1');
      loadBalancer.addNode(node);

      const load = loadBalancer.getNodeLoad('node1');
      const health = loadBalancer.getNodeHealth('node1');

      expect(load).toBeDefined();
      expect(load?.currentLoad).toBe(0);
      expect(load?.activeConnections).toBe(0);
      expect(load?.healthy).toBe(true);

      expect(health).toBeDefined();
      expect(health?.healthy).toBe(true);
      expect(health?.errorRate).toBe(0);
    });

    it('should emit node:added event', () => {
      const listener = jest.fn();
      loadBalancer.on('node:added', listener);

      const node = createTestNode('node1');
      loadBalancer.addNode(node);

      expect(listener).toHaveBeenCalledWith(node);
    });

    it('should emit node:removed event', () => {
      const listener = jest.fn();
      const node = createTestNode('node1');
      loadBalancer.addNode(node);

      loadBalancer.on('node:removed', listener);
      loadBalancer.removeNode('node1');

      expect(listener).toHaveBeenCalledWith('node1');
    });
  });

  describe('Load Management', () => {
    it('should update node load', () => {
      const node = createTestNode('node1');
      loadBalancer.addNode(node);

      loadBalancer.updateNodeLoad('node1', 0.5);

      const load = loadBalancer.getNodeLoad('node1');
      expect(load?.currentLoad).toBe(0.5);
    });

    it('should clamp load values between 0 and 1', () => {
      const node = createTestNode('node1');
      loadBalancer.addNode(node);

      loadBalancer.updateNodeLoad('node1', 1.5);
      expect(loadBalancer.getNodeLoad('node1')?.currentLoad).toBe(1);

      loadBalancer.updateNodeLoad('node1', -0.5);
      expect(loadBalancer.getNodeLoad('node1')?.currentLoad).toBe(0);
    });

    it('should update active connections', () => {
      const node = createTestNode('node1');
      loadBalancer.addNode(node);

      loadBalancer.updateActiveConnections('node1', 10);

      const load = loadBalancer.getNodeLoad('node1');
      expect(load?.activeConnections).toBe(10);
    });

    it('should emit node:overloaded when load exceeds 90%', () => {
      const listener = jest.fn();
      loadBalancer.on('node:overloaded', listener);

      const node = createTestNode('node1');
      loadBalancer.addNode(node);
      loadBalancer.updateNodeLoad('node1', 0.95);

      expect(listener).toHaveBeenCalledWith('node1', 0.95);
    });

    it('should emit node:load_updated event', () => {
      const listener = jest.fn();
      loadBalancer.on('node:load_updated', listener);

      const node = createTestNode('node1');
      loadBalancer.addNode(node);
      loadBalancer.updateNodeLoad('node1', 0.3);

      expect(listener).toHaveBeenCalled();
      const emittedLoad = listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(emittedLoad.currentLoad).toBe(0.3);
    });
  });

  describe('Health Management', () => {
    it('should update node health', () => {
      const node = createTestNode('node1');
      loadBalancer.addNode(node);

      loadBalancer.updateNodeHealth('node1', {
        healthy: false,
        errorRate: 0.1,
        responseTime: 500,
      });

      const health = loadBalancer.getNodeHealth('node1');
      expect(health?.healthy).toBe(false);
      expect(health?.errorRate).toBe(0.1);
      expect(health?.responseTime).toBe(500);
    });

    it('should sync health status to load', () => {
      const node = createTestNode('node1');
      loadBalancer.addNode(node);

      loadBalancer.updateNodeHealth('node1', { healthy: false });

      const load = loadBalancer.getNodeLoad('node1');
      expect(load?.healthy).toBe(false);
    });

    it('should emit node:health_changed event', () => {
      const listener = jest.fn();
      loadBalancer.on('node:health_changed', listener);

      const node = createTestNode('node1');
      loadBalancer.addNode(node);
      loadBalancer.updateNodeHealth('node1', { healthy: false });

      expect(listener).toHaveBeenCalled();
      const emittedHealth = listener.mock.calls[0][0];
      expect(emittedHealth.healthy).toBe(false);
    });
  });

  describe('Round-Robin Strategy', () => {
    beforeEach(() => {
      loadBalancer.setStrategy('round-robin');
    });

    it('should rotate through nodes', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));
      loadBalancer.addNode(createTestNode('node3'));

      const selected1 = loadBalancer.selectNode();
      const selected2 = loadBalancer.selectNode();
      const selected3 = loadBalancer.selectNode();
      const selected4 = loadBalancer.selectNode();

      expect(selected1?.id).toBe('node1');
      expect(selected2?.id).toBe('node2');
      expect(selected3?.id).toBe('node3');
      expect(selected4?.id).toBe('node1'); // Back to first
    });

    it('should skip unhealthy nodes', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));
      loadBalancer.addNode(createTestNode('node3'));

      loadBalancer.updateNodeHealth('node2', { healthy: false });

      const selected1 = loadBalancer.selectNode();
      const selected2 = loadBalancer.selectNode();

      expect(selected1?.id).toBe('node1');
      expect(selected2?.id).toBe('node3');
    });

    it('should skip overloaded nodes', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));

      loadBalancer.updateNodeLoad('node1', 0.9);

      const selected = loadBalancer.selectNode({ loadThreshold: 0.8 });
      expect(selected?.id).toBe('node2');
    });
  });

  describe('Least-Connections Strategy', () => {
    beforeEach(() => {
      loadBalancer.setStrategy('least-connections');
    });

    it('should select node with fewest connections', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));
      loadBalancer.addNode(createTestNode('node3'));

      loadBalancer.updateActiveConnections('node1', 10);
      loadBalancer.updateActiveConnections('node2', 5);
      loadBalancer.updateActiveConnections('node3', 15);

      const selected = loadBalancer.selectNode();
      expect(selected?.id).toBe('node2');
    });

    it('should handle nodes with equal connections', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));

      loadBalancer.updateActiveConnections('node1', 5);
      loadBalancer.updateActiveConnections('node2', 5);

      const selected = loadBalancer.selectNode();
      expect(['node1', 'node2']).toContain(selected?.id);
    });
  });

  describe('Weighted Strategy', () => {
    beforeEach(() => {
      loadBalancer.setStrategy('weighted');
    });

    it('should prefer nodes with lower load', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));

      loadBalancer.updateNodeLoad('node1', 0.8);
      loadBalancer.updateNodeLoad('node2', 0.2);

      const selected = loadBalancer.selectNode();
      expect(selected?.id).toBe('node2');
    });

    it('should consider node weights', () => {
      loadBalancer.addNode(createTestNode('node1', { weight: 2 }));
      loadBalancer.addNode(createTestNode('node2', { weight: 1 }));

      const selected = loadBalancer.selectNode();
      expect(selected?.id).toBe('node1'); // Higher weight
    });

    it('should penalize high error rates', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));

      loadBalancer.updateNodeHealth('node1', { errorRate: 0.5 });
      loadBalancer.updateNodeHealth('node2', { errorRate: 0.0 });

      const selected = loadBalancer.selectNode();
      expect(selected?.id).toBe('node2');
    });
  });

  describe('Capability-Aware Strategy', () => {
    beforeEach(() => {
      loadBalancer.setStrategy('capability-aware');
    });

    it('should select nodes with matching capabilities', () => {
      loadBalancer.addNode(
        createTestNode('node1', { capabilities: ['session-management'] }),
      );
      loadBalancer.addNode(
        createTestNode('node2', {
          capabilities: ['session-management', 'gpu-compute'],
        }),
      );
      loadBalancer.addNode(
        createTestNode('node3', {
          capabilities: ['session-management', 'gpu-compute', 'ml-inference'],
        }),
      );

      const options: NodeSelectionOptions = {
        requiredCapabilities: ['session-management', 'gpu-compute'],
      };

      const selected = loadBalancer.selectNode(options);
      // Should prefer node2 (exact match) over node3 (extra capabilities)
      expect(selected?.id).toBe('node2');
    });

    it('should filter out nodes without required capabilities', () => {
      loadBalancer.addNode(
        createTestNode('node1', { capabilities: ['session-management'] }),
      );
      loadBalancer.addNode(
        createTestNode('node2', {
          capabilities: ['session-management', 'gpu-compute'],
        }),
      );

      const options: NodeSelectionOptions = {
        requiredCapabilities: ['gpu-compute'],
      };

      const selected = loadBalancer.selectNode(options);
      expect(selected?.id).toBe('node2');
    });
  });

  describe('Selection Options', () => {
    beforeEach(() => {
      loadBalancer.addNode(createTestNode('node1', { region: 'us-east-1' }));
      loadBalancer.addNode(createTestNode('node2', { region: 'us-west-1' }));
      loadBalancer.addNode(createTestNode('node3', { region: 'us-east-1' }));
    });

    it('should respect preferredRegion', () => {
      const options: NodeSelectionOptions = {
        preferredRegion: 'us-west-1',
      };

      const selected = loadBalancer.selectNode(options);
      expect(selected?.region).toBe('us-west-1');
    });

    it('should exclude specified nodes', () => {
      const options: NodeSelectionOptions = {
        excludeNodes: ['node1', 'node3'],
      };

      const selected = loadBalancer.selectNode(options);
      expect(selected?.id).toBe('node2');
    });

    it('should respect loadThreshold', () => {
      loadBalancer.updateNodeLoad('node1', 0.9);
      loadBalancer.updateNodeLoad('node2', 0.5);
      loadBalancer.updateNodeLoad('node3', 0.85);

      const options: NodeSelectionOptions = {
        loadThreshold: 0.8,
      };

      const selected = loadBalancer.selectNode(options);
      expect(selected?.id).toBe('node2');
    });

    it('should handle session affinity', () => {
      const options: NodeSelectionOptions = {
        sessionAffinity: 'session-123',
      };

      // First selection establishes affinity
      const selected1 = loadBalancer.selectNode(options);
      const nodeId = selected1?.id;

      // Subsequent selections should return same node
      const selected2 = loadBalancer.selectNode(options);
      const selected3 = loadBalancer.selectNode(options);

      expect(selected2?.id).toBe(nodeId);
      expect(selected3?.id).toBe(nodeId);
    });

    it('should break affinity if node becomes unhealthy', () => {
      loadBalancer.setStrategy('round-robin');

      const options: NodeSelectionOptions = {
        sessionAffinity: 'session-123',
      };

      // Establish affinity to node1
      const selected1 = loadBalancer.selectNode(options);
      expect(selected1?.id).toBe('node1');

      // Mark node1 as unhealthy
      loadBalancer.updateNodeHealth('node1', { healthy: false });

      // Should select different node
      const selected2 = loadBalancer.selectNode(options);
      expect(selected2?.id).not.toBe('node1');
    });
  });

  describe('Strategy Management', () => {
    it('should change strategy', () => {
      loadBalancer.setStrategy('least-connections');
      expect(loadBalancer.getStrategy()).toBe('least-connections');

      loadBalancer.setStrategy('weighted');
      expect(loadBalancer.getStrategy()).toBe('weighted');
    });

    it('should emit strategy:changed event', () => {
      const listener = jest.fn();
      loadBalancer.on('strategy:changed', listener);

      loadBalancer.setStrategy('weighted');

      expect(listener).toHaveBeenCalledWith('round-robin', 'weighted');
    });

    it('should reset round-robin counter when changing strategy', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));

      loadBalancer.selectNode(); // node1
      loadBalancer.selectNode(); // node2

      loadBalancer.setStrategy('weighted');
      loadBalancer.setStrategy('round-robin');

      const selected = loadBalancer.selectNode();
      expect(selected?.id).toBe('node1'); // Counter was reset
    });
  });

  describe('Statistics', () => {
    it('should return accurate statistics', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));
      loadBalancer.addNode(createTestNode('node3'));

      loadBalancer.updateNodeLoad('node1', 0.3);
      loadBalancer.updateNodeLoad('node2', 0.6);
      loadBalancer.updateNodeLoad('node3', 0.9);

      loadBalancer.updateActiveConnections('node1', 5);
      loadBalancer.updateActiveConnections('node2', 10);
      loadBalancer.updateActiveConnections('node3', 15);

      loadBalancer.updateNodeHealth('node3', { healthy: false });

      const stats = loadBalancer.getStats();

      expect(stats.totalNodes).toBe(3);
      expect(stats.healthyNodes).toBe(2);
      expect(stats.totalConnections).toBe(30);
      expect(stats.averageLoad).toBeCloseTo(0.6);
      expect(stats.strategy).toBe('round-robin');
    });
  });

  describe('Error Handling', () => {
    it('should return null when no eligible nodes', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.updateNodeHealth('node1', { healthy: false });

      const selected = loadBalancer.selectNode();
      expect(selected).toBeNull();
    });

    it('should emit selection:failed when no nodes available', () => {
      const listener = jest.fn();
      loadBalancer.on('selection:failed', listener);

      const options: NodeSelectionOptions = {
        requiredCapabilities: ['non-existent-capability'],
      };

      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.selectNode(options);

      expect(listener).toHaveBeenCalledWith(
        options,
        'No eligible nodes meet the selection criteria',
      );
    });

    it('should handle updates to non-existent nodes gracefully', () => {
      expect(() => {
        loadBalancer.updateNodeLoad('non-existent', 0.5);
      }).not.toThrow();

      expect(() => {
        loadBalancer.updateNodeHealth('non-existent', { healthy: false });
      }).not.toThrow();
    });
  });

  describe('Session Affinity Management', () => {
    it('should clear session affinity', () => {
      loadBalancer.addNode(createTestNode('node1'));

      const options: NodeSelectionOptions = {
        sessionAffinity: 'session-123',
      };

      loadBalancer.selectNode(options);
      expect(loadBalancer.getSessionAffinity('session-123')).toBeDefined();

      loadBalancer.clearSessionAffinity('session-123');
      expect(loadBalancer.getSessionAffinity('session-123')).toBeUndefined();
    });

    it('should clear affinity when node is removed', () => {
      loadBalancer.addNode(createTestNode('node1'));
      loadBalancer.addNode(createTestNode('node2'));

      const options: NodeSelectionOptions = {
        sessionAffinity: 'session-123',
      };

      const selected = loadBalancer.selectNode(options);
      expect(loadBalancer.getSessionAffinity('session-123')).toBe(selected?.id);

      loadBalancer.removeNode(selected!.id);
      expect(loadBalancer.getSessionAffinity('session-123')).toBeUndefined();
    });
  });
});
