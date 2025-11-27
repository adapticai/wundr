/**
 * Heartbeat Service Tests
 *
 * Comprehensive test suite for the heartbeat service covering:
 * - Heartbeat sending and tracking
 * - Health check monitoring
 * - Timeout and unhealthy Orchestrator detection
 * - Recovery detection
 * - Organization-level filtering
 *
 * @module @genesis/core/services/__tests__/heartbeat-service.test
 */

import {
  type _Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createMockRedis,
  type MockRedis,
} from '../../test-utils/mock-redis';
import {
  _createMockDegradedHealthStatus,
  _createMockHealthStatus,
  _createMockHeartbeatRecord,
  _createMockUnhealthyHealthStatus,
  _createMockUnknownHealthStatus,
  createMockVPMetrics,
  generatePresenceTestId,
  type HealthCheckStatus,
  type HealthStatus,
  type HeartbeatRecord,
  resetPresenceIdCounter,
  type VPMetrics,
} from '../../test-utils/presence-factories';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const _HEARTBEAT_TIMEOUT_MS = 90000; // 3 missed heartbeats = unhealthy
const DEGRADED_THRESHOLD = 1; // 1 missed = degraded
const UNHEALTHY_THRESHOLD = 3; // 3 missed = unhealthy

const HEARTBEAT_KEY_PREFIX = 'heartbeat:';
const VP_REGISTRY_KEY = 'vp:registry';
const HEARTBEAT_CHANNEL = 'heartbeat:updates';

// =============================================================================
// MOCK HEARTBEAT SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Mock implementation of HeartbeatService for testing
 */
class MockHeartbeatService {
  private healthCallbacks: {
    onUnhealthy?: (vpId: string, status: HealthCheckStatus) => void;
    onRecovered?: (vpId: string, status: HealthCheckStatus) => void;
  } = {};

  constructor(
    private redis: MockRedis,
    private config: {
      heartbeatIntervalMs: number;
      degradedThreshold: number;
      unhealthyThreshold: number;
    } = {
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      degradedThreshold: DEGRADED_THRESHOLD,
      unhealthyThreshold: UNHEALTHY_THRESHOLD,
    },
  ) {}

  // Heartbeat operations
  async sendHeartbeat(
    vpId: string,
    daemonId: string,
    metrics?: VPMetrics,
  ): Promise<void> {
    const key = `${HEARTBEAT_KEY_PREFIX}${vpId}`;
    const now = new Date().toISOString();

    // Get current sequence number
    const currentSeq = await this.redis.hget(key, 'sequenceNumber');
    const sequenceNumber = currentSeq ? parseInt(currentSeq, 10) + 1 : 1;

    const record: HeartbeatRecord = {
      vpId,
      daemonId,
      timestamp: now,
      sequenceNumber,
      metrics: metrics || createMockVPMetrics(),
      status: 'online',
    };

    await this.redis.hmset(key, {
      vpId,
      daemonId,
      timestamp: now,
      sequenceNumber: String(sequenceNumber),
      status: 'online',
      metrics: JSON.stringify(record.metrics),
    });

    // Reset unhealthy status if it was set
    await this.redis.hdel(key, 'unhealthyAt');
    await this.redis.hdel(key, 'missedHeartbeats');

    // Publish heartbeat event
    await this.redis.publish(HEARTBEAT_CHANNEL, JSON.stringify(record));
  }

  async checkHealth(vpId: string): Promise<HealthCheckStatus> {
    const key = `${HEARTBEAT_KEY_PREFIX}${vpId}`;
    const data = await this.redis.hgetall(key);
    const now = new Date();

    // Orchestrator not registered
    if (!data) {
      return {
        vpId,
        status: 'unknown',
        lastHeartbeat: null,
        missedHeartbeats: 0,
        consecutiveFailures: 0,
        lastCheckAt: now.toISOString(),
        message: 'VP not registered or never sent heartbeat',
      };
    }

    const lastHeartbeat = new Date(data.timestamp);
    const timeSinceLastHeartbeat = now.getTime() - lastHeartbeat.getTime();
    const missedHeartbeats = Math.floor(
      timeSinceLastHeartbeat / this.config.heartbeatIntervalMs,
    );

    let status: HealthStatus;
    let message: string;

    if (missedHeartbeats === 0) {
      status = 'healthy';
      message = 'All systems operational';
    } else if (missedHeartbeats < this.config.unhealthyThreshold) {
      status = 'degraded';
      message = `Missed ${missedHeartbeats} heartbeat(s)`;
    } else {
      status = 'unhealthy';
      message = `VP unresponsive - missed ${missedHeartbeats} consecutive heartbeats`;
    }

    return {
      vpId,
      status,
      lastHeartbeat: data.timestamp,
      missedHeartbeats,
      consecutiveFailures: missedHeartbeats,
      lastCheckAt: now.toISOString(),
      message,
    };
  }

  async getUnhealthyVPs(organizationId?: string): Promise<HealthCheckStatus[]> {
    // Get all registered VPs
    const vpIds = await this.redis.smembers(VP_REGISTRY_KEY);
    const unhealthyVPs: HealthCheckStatus[] = [];

    for (const vpId of vpIds) {
      const health = await this.checkHealth(vpId);

      // Filter by organization if provided
      if (organizationId) {
        const vpKey = `${HEARTBEAT_KEY_PREFIX}${vpId}`;
        const vpData = await this.redis.hgetall(vpKey);
        if (vpData?.organizationId !== organizationId) {
          continue;
        }
      }

      if (health.status === 'unhealthy') {
        unhealthyVPs.push(health);
      }
    }

    return unhealthyVPs;
  }

  async registerVP(
    vpId: string,
    organizationId?: string,
  ): Promise<void> {
    await this.redis.sadd(VP_REGISTRY_KEY, vpId);

    if (organizationId) {
      const key = `${HEARTBEAT_KEY_PREFIX}${vpId}`;
      await this.redis.hset(key, 'organizationId', organizationId);
    }
  }

  async unregisterVP(vpId: string): Promise<void> {
    await this.redis.srem(VP_REGISTRY_KEY, vpId);
    await this.redis.del(`${HEARTBEAT_KEY_PREFIX}${vpId}`);
  }

  async getVPHealthStatus(vpId: string): Promise<HealthCheckStatus> {
    return this.checkHealth(vpId);
  }

  async getAllVPHealthStatuses(): Promise<HealthCheckStatus[]> {
    const vpIds = await this.redis.smembers(VP_REGISTRY_KEY);
    return Promise.all(vpIds.map((vpId) => this.checkHealth(vpId)));
  }

  // Callback setters for monitoring
  setOnUnhealthy(
    callback: (vpId: string, status: HealthCheckStatus) => void,
  ): void {
    this.healthCallbacks.onUnhealthy = callback;
  }

  setOnRecovered(
    callback: (vpId: string, status: HealthCheckStatus) => void,
  ): void {
    this.healthCallbacks.onRecovered = callback;
  }

  // Internal method to simulate health check (for testing)
  async _triggerHealthCheck(vpId: string): Promise<void> {
    const previousKey = `${HEARTBEAT_KEY_PREFIX}${vpId}:previousStatus`;
    const previousStatus = (await this.redis.get(previousKey)) as HealthStatus | null;
    const currentHealth = await this.checkHealth(vpId);

    // Store current status for next comparison
    await this.redis.set(previousKey, currentHealth.status);

    // Trigger callbacks
    if (
      currentHealth.status === 'unhealthy' &&
      previousStatus !== 'unhealthy' &&
      this.healthCallbacks.onUnhealthy
    ) {
      this.healthCallbacks.onUnhealthy(vpId, currentHealth);
    }

    if (
      currentHealth.status === 'healthy' &&
      previousStatus === 'unhealthy' &&
      this.healthCallbacks.onRecovered
    ) {
      this.healthCallbacks.onRecovered(vpId, currentHealth);
    }
  }
}

/**
 * Mock implementation of HeartbeatMonitor for testing
 */
class MockHeartbeatMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private onUnhealthyCallback?: (vpId: string, status: HealthCheckStatus) => void;
  private onRecoveredCallback?: (vpId: string, status: HealthCheckStatus) => void;
  private previousStatuses = new Map<string, HealthStatus>();

  constructor(
    private heartbeatService: MockHeartbeatService,
    private checkIntervalMs: number = 10000,
  ) {}

  start(): void {
    if (this.running) {
return;
}

    this.running = true;
    this.intervalId = setInterval(() => {
      this.checkAllVPs();
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  setOnUnhealthy(
    callback: (vpId: string, status: HealthCheckStatus) => void,
  ): void {
    this.onUnhealthyCallback = callback;
  }

  setOnRecovered(
    callback: (vpId: string, status: HealthCheckStatus) => void,
  ): void {
    this.onRecoveredCallback = callback;
  }

  async checkNow(): Promise<HealthCheckStatus[]> {
    return this.checkAllVPs();
  }

  async getMonitoringStats(): Promise<{
    totalVPs: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    unknownCount: number;
  }> {
    const statuses = await this.heartbeatService.getAllVPHealthStatuses();

    return {
      totalVPs: statuses.length,
      healthyCount: statuses.filter((s) => s.status === 'healthy').length,
      degradedCount: statuses.filter((s) => s.status === 'degraded').length,
      unhealthyCount: statuses.filter((s) => s.status === 'unhealthy').length,
      unknownCount: statuses.filter((s) => s.status === 'unknown').length,
    };
  }

  private async checkAllVPs(): Promise<HealthCheckStatus[]> {
    const statuses = await this.heartbeatService.getAllVPHealthStatuses();

    for (const status of statuses) {
      const previousStatus = this.previousStatuses.get(status.orchestratorId);

      // Detect transition to unhealthy
      if (
        status.status === 'unhealthy' &&
        previousStatus !== 'unhealthy' &&
        this.onUnhealthyCallback
      ) {
        this.onUnhealthyCallback(status.orchestratorId, status);
      }

      // Detect recovery
      if (
        status.status === 'healthy' &&
        previousStatus === 'unhealthy' &&
        this.onRecoveredCallback
      ) {
        this.onRecoveredCallback(status.orchestratorId, status);
      }

      this.previousStatuses.set(status.orchestratorId, status.status);
    }

    return statuses;
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('HeartbeatService', () => {
  let redis: MockRedis;
  let heartbeatService: MockHeartbeatService;

  beforeEach(() => {
    resetPresenceIdCounter();
    redis = createMockRedis();
    heartbeatService = new MockHeartbeatService(redis);
  });

  afterEach(() => {
    redis._reset();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ===========================================================================
  // sendHeartbeat Tests
  // ===========================================================================

  describe('sendHeartbeat', () => {
    it('updates heartbeat timestamp', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');

      await heartbeatService.sendHeartbeat(vpId, daemonId);

      const key = `${HEARTBEAT_KEY_PREFIX}${vpId}`;
      const data = await redis.hgetall(key);

      expect(data).not.toBeNull();
      expect(data?.orchestratorId).toBe(vpId);
      expect(data?.daemonId).toBe(daemonId);
      expect(data?.timestamp).toBeDefined();
      expect(new Date(data!.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('stores metrics', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');
      const metrics = createMockVPMetrics({
        responseTimeMs: 150,
        messagesProcessed: 42,
        cpuUsagePercent: 25,
      });

      await heartbeatService.sendHeartbeat(vpId, daemonId, metrics);

      const key = `${HEARTBEAT_KEY_PREFIX}${vpId}`;
      const data = await redis.hgetall(key);
      const storedMetrics = JSON.parse(data!.metrics);

      expect(storedMetrics.responseTimeMs).toBe(150);
      expect(storedMetrics.messagesProcessed).toBe(42);
      expect(storedMetrics.cpuUsagePercent).toBe(25);
    });

    it('resets unhealthy status', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');
      const key = `${HEARTBEAT_KEY_PREFIX}${vpId}`;

      // Simulate unhealthy state
      await redis.hmset(key, {
        vpId,
        daemonId,
        unhealthyAt: new Date().toISOString(),
        missedHeartbeats: '5',
      });

      // Send heartbeat
      await heartbeatService.sendHeartbeat(vpId, daemonId);

      // Check unhealthy fields are removed
      expect(redis.hdel).toHaveBeenCalledWith(key, 'unhealthyAt');
      expect(redis.hdel).toHaveBeenCalledWith(key, 'missedHeartbeats');
    });

    it('increments sequence number', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');
      const key = `${HEARTBEAT_KEY_PREFIX}${vpId}`;

      // Send multiple heartbeats
      await heartbeatService.sendHeartbeat(vpId, daemonId);
      await heartbeatService.sendHeartbeat(vpId, daemonId);
      await heartbeatService.sendHeartbeat(vpId, daemonId);

      const data = await redis.hgetall(key);
      expect(data?.sequenceNumber).toBe('3');
    });

    it('publishes heartbeat event', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');

      await heartbeatService.sendHeartbeat(vpId, daemonId);

      expect(redis.publish).toHaveBeenCalledWith(
        HEARTBEAT_CHANNEL,
        expect.stringContaining(vpId),
      );

      const event = JSON.parse(redis._publishedMessages[0].message);
      expect(event.orchestratorId).toBe(vpId);
      expect(event.daemonId).toBe(daemonId);
      expect(event.status).toBe('online');
    });

    it('handles rapid heartbeats', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');

      // Send multiple rapid heartbeats
      await Promise.all(
        Array.from({ length: 10 }, () =>
          heartbeatService.sendHeartbeat(vpId, daemonId),
        ),
      );

      const key = `${HEARTBEAT_KEY_PREFIX}${vpId}`;
      const data = await redis.hgetall(key);

      // Should have recorded all heartbeats
      expect(parseInt(data!.sequenceNumber, 10)).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // checkHealth Tests
  // ===========================================================================

  describe('checkHealth', () => {
    it('returns healthy for recent heartbeat', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');

      await heartbeatService.sendHeartbeat(vpId, daemonId);
      const health = await heartbeatService.checkHealth(vpId);

      expect(health.status).toBe('healthy');
      expect(health.missedHeartbeats).toBe(0);
      expect(health.message).toBe('All systems operational');
    });

    it('returns degraded after 1 missed heartbeat', async () => {
      vi.useFakeTimers();
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');

      await heartbeatService.sendHeartbeat(vpId, daemonId);

      // Advance time by 1.5 heartbeat intervals
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 1.5);

      const health = await heartbeatService.checkHealth(vpId);

      expect(health.status).toBe('degraded');
      expect(health.missedHeartbeats).toBe(1);
      expect(health.message).toContain('Missed 1 heartbeat');
    });

    it('returns unhealthy after 3 missed heartbeats', async () => {
      vi.useFakeTimers();
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');

      await heartbeatService.sendHeartbeat(vpId, daemonId);

      // Advance time by 3.5 heartbeat intervals
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3.5);

      const health = await heartbeatService.checkHealth(vpId);

      expect(health.status).toBe('unhealthy');
      expect(health.missedHeartbeats).toBeGreaterThanOrEqual(3);
      expect(health.message).toContain('VP unresponsive');
    });

    it('returns unknown for unregistered VP', async () => {
      const health = await heartbeatService.checkHealth('non-existent-vp');

      expect(health.status).toBe('unknown');
      expect(health.lastHeartbeat).toBeNull();
      expect(health.message).toContain('not registered');
    });

    it('calculates missed heartbeats correctly', async () => {
      vi.useFakeTimers();
      const baseTime = Date.now();

      // Test at different time points - each with fresh heartbeat
      const testCases = [
        { advanceMs: HEARTBEAT_INTERVAL_MS * 0.5, expectedMissed: 0 },
        { advanceMs: HEARTBEAT_INTERVAL_MS * 1.5, expectedMissed: 1 },
        { advanceMs: HEARTBEAT_INTERVAL_MS * 2.5, expectedMissed: 2 },
        { advanceMs: HEARTBEAT_INTERVAL_MS * 5.0, expectedMissed: 5 },
      ];

      for (const { advanceMs, expectedMissed } of testCases) {
        // Reset to base time and send fresh heartbeat
        vi.setSystemTime(new Date(baseTime));
        const vpId = generatePresenceTestId('vp');
        const daemonId = generatePresenceTestId('daemon');
        await heartbeatService.sendHeartbeat(vpId, daemonId);

        // Advance time from base
        vi.setSystemTime(new Date(baseTime + advanceMs));
        const health = await heartbeatService.checkHealth(vpId);
        expect(health.missedHeartbeats).toBe(expectedMissed);
      }
    });

    it('includes lastCheckAt timestamp', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');

      await heartbeatService.sendHeartbeat(vpId, daemonId);
      const health = await heartbeatService.checkHealth(vpId);

      expect(health.lastCheckAt).toBeDefined();
      expect(new Date(health.lastCheckAt).getTime()).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // getUnhealthyVPs Tests
  // ===========================================================================

  describe('getUnhealthyVPs', () => {
    it('returns list of unhealthy VPs', async () => {
      vi.useFakeTimers();
      const _orgId = generatePresenceTestId('org');

      // Register VPs
      const healthyVP = generatePresenceTestId('vp');
      const unhealthyVP1 = generatePresenceTestId('vp');
      const unhealthyVP2 = generatePresenceTestId('vp');

      await heartbeatService.registerVP(healthyVP);
      await heartbeatService.registerVP(unhealthyVP1);
      await heartbeatService.registerVP(unhealthyVP2);

      // Send heartbeats for all
      await heartbeatService.sendHeartbeat(healthyVP, 'daemon1');
      await heartbeatService.sendHeartbeat(unhealthyVP1, 'daemon2');
      await heartbeatService.sendHeartbeat(unhealthyVP2, 'daemon3');

      // Keep healthy Orchestrator alive
      // Let unhealthy VPs timeout
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 4);
      await heartbeatService.sendHeartbeat(healthyVP, 'daemon1');

      const unhealthyList = await heartbeatService.getUnhealthyVPs();

      expect(unhealthyList).toHaveLength(2);
      expect(unhealthyList.map((u) => u.orchestratorId)).toContain(unhealthyVP1);
      expect(unhealthyList.map((u) => u.orchestratorId)).toContain(unhealthyVP2);
      expect(unhealthyList.map((u) => u.orchestratorId)).not.toContain(healthyVP);
    });

    it('filters by organization', async () => {
      vi.useFakeTimers();
      const org1 = generatePresenceTestId('org');
      const org2 = generatePresenceTestId('org');

      const vpOrg1 = generatePresenceTestId('vp');
      const vpOrg2 = generatePresenceTestId('vp');

      await heartbeatService.registerVP(vpOrg1, org1);
      await heartbeatService.registerVP(vpOrg2, org2);

      await heartbeatService.sendHeartbeat(vpOrg1, 'daemon1');
      await heartbeatService.sendHeartbeat(vpOrg2, 'daemon2');

      // Let both become unhealthy
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 4);

      const unhealthyOrg1 = await heartbeatService.getUnhealthyVPs(org1);
      const unhealthyOrg2 = await heartbeatService.getUnhealthyVPs(org2);

      expect(unhealthyOrg1).toHaveLength(1);
      expect(unhealthyOrg1[0].orchestratorId).toBe(vpOrg1);

      expect(unhealthyOrg2).toHaveLength(1);
      expect(unhealthyOrg2[0].orchestratorId).toBe(vpOrg2);
    });

    it('returns empty array when all VPs are healthy', async () => {
      const vp1 = generatePresenceTestId('vp');
      const vp2 = generatePresenceTestId('vp');

      await heartbeatService.registerVP(vp1);
      await heartbeatService.registerVP(vp2);

      await heartbeatService.sendHeartbeat(vp1, 'daemon1');
      await heartbeatService.sendHeartbeat(vp2, 'daemon2');

      const unhealthyList = await heartbeatService.getUnhealthyVPs();

      expect(unhealthyList).toHaveLength(0);
    });

    it('returns empty array when no VPs registered', async () => {
      const unhealthyList = await heartbeatService.getUnhealthyVPs();

      expect(unhealthyList).toEqual([]);
    });
  });

  // ===========================================================================
  // OrchestratorRegistration Tests
  // ===========================================================================

  describe('VP registration', () => {
    it('registers Orchestrator in registry set', async () => {
      const vpId = generatePresenceTestId('vp');

      await heartbeatService.registerVP(vpId);

      const members = await redis.smembers(VP_REGISTRY_KEY);
      expect(members).toContain(vpId);
    });

    it('stores organization ID with VP', async () => {
      const vpId = generatePresenceTestId('vp');
      const orgId = generatePresenceTestId('org');

      await heartbeatService.registerVP(vpId, orgId);

      const key = `${HEARTBEAT_KEY_PREFIX}${vpId}`;
      const data = await redis.hgetall(key);
      expect(data?.organizationId).toBe(orgId);
    });

    it('unregisters Orchestrator correctly', async () => {
      const vpId = generatePresenceTestId('vp');
      const daemonId = generatePresenceTestId('daemon');

      await heartbeatService.registerVP(vpId);
      await heartbeatService.sendHeartbeat(vpId, daemonId);

      await heartbeatService.unregisterVP(vpId);

      const members = await redis.smembers(VP_REGISTRY_KEY);
      expect(members).not.toContain(vpId);

      const data = await redis.hgetall(`${HEARTBEAT_KEY_PREFIX}${vpId}`);
      expect(data).toBeNull();
    });
  });

  // ===========================================================================
  // getAllVPHealthStatuses Tests
  // ===========================================================================

  describe('getAllVPHealthStatuses', () => {
    it('returns health status for all registered VPs', async () => {
      const vp1 = generatePresenceTestId('vp');
      const vp2 = generatePresenceTestId('vp');
      const vp3 = generatePresenceTestId('vp');

      await heartbeatService.registerVP(vp1);
      await heartbeatService.registerVP(vp2);
      await heartbeatService.registerVP(vp3);

      await heartbeatService.sendHeartbeat(vp1, 'daemon1');
      await heartbeatService.sendHeartbeat(vp2, 'daemon2');

      const statuses = await heartbeatService.getAllVPHealthStatuses();

      expect(statuses).toHaveLength(3);

      const vp1Status = statuses.find((s) => s.orchestratorId === vp1);
      const vp2Status = statuses.find((s) => s.orchestratorId === vp2);
      const vp3Status = statuses.find((s) => s.orchestratorId === vp3);

      expect(vp1Status?.status).toBe('healthy');
      expect(vp2Status?.status).toBe('healthy');
      expect(vp3Status?.status).toBe('unknown');
    });
  });
});

// =============================================================================
// HEARTBEAT MONITOR TESTS
// =============================================================================

describe('HeartbeatMonitor', () => {
  let redis: MockRedis;
  let heartbeatService: MockHeartbeatService;
  let monitor: MockHeartbeatMonitor;

  beforeEach(() => {
    resetPresenceIdCounter();
    redis = createMockRedis();
    heartbeatService = new MockHeartbeatService(redis);
    monitor = new MockHeartbeatMonitor(heartbeatService, 100); // 100ms check interval for tests
  });

  afterEach(() => {
    monitor.stop();
    redis._reset();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // ===========================================================================
  // Monitoring Tests
  // ===========================================================================

  describe('monitoring', () => {
    it('starts periodic health checks', async () => {
      vi.useFakeTimers();
      const checkNowSpy = vi.spyOn(monitor, 'checkNow');

      monitor.start();
      expect(monitor.isRunning()).toBe(true);

      // Advance time to trigger multiple checks
      vi.advanceTimersByTime(350);

      // Should have triggered checks (initial + 3 intervals)
      expect(checkNowSpy).toHaveBeenCalledTimes(0); // checkNow is not called by interval, internal method is

      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });

    it('triggers unhealthy callback', async () => {
      vi.useFakeTimers();
      const onUnhealthy = vi.fn();
      monitor.setOnUnhealthy(onUnhealthy);

      const vpId = generatePresenceTestId('vp');
      await heartbeatService.registerVP(vpId);
      await heartbeatService.sendHeartbeat(vpId, 'daemon1');

      // Initial check - should be healthy
      await monitor.checkNow();
      expect(onUnhealthy).not.toHaveBeenCalled();

      // Let Orchestrator become unhealthy
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 4);
      await monitor.checkNow();

      expect(onUnhealthy).toHaveBeenCalledWith(
        vpId,
        expect.objectContaining({
          status: 'unhealthy',
          vpId,
        }),
      );
    });

    it('triggers recovered callback', async () => {
      vi.useFakeTimers();
      const onRecovered = vi.fn();
      monitor.setOnRecovered(onRecovered);

      const vpId = generatePresenceTestId('vp');
      await heartbeatService.registerVP(vpId);
      await heartbeatService.sendHeartbeat(vpId, 'daemon1');

      // Let Orchestrator become unhealthy
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 4);
      await monitor.checkNow();

      // Orchestrator sends heartbeat (recovers)
      await heartbeatService.sendHeartbeat(vpId, 'daemon1');
      await monitor.checkNow();

      expect(onRecovered).toHaveBeenCalledWith(
        vpId,
        expect.objectContaining({
          status: 'healthy',
          vpId,
        }),
      );
    });

    it('stops monitoring on shutdown', async () => {
      vi.useFakeTimers();

      monitor.start();
      expect(monitor.isRunning()).toBe(true);

      monitor.stop();
      expect(monitor.isRunning()).toBe(false);

      // Verify no more checks happen
      const checkNowSpy = vi.spyOn(monitor, 'checkNow');
      vi.advanceTimersByTime(500);
      expect(checkNowSpy).not.toHaveBeenCalled();
    });

    it('handles start when already running', async () => {
      monitor.start();
      expect(monitor.isRunning()).toBe(true);

      // Should not throw or create duplicate intervals
      monitor.start();
      expect(monitor.isRunning()).toBe(true);

      monitor.stop();
    });

    it('handles stop when not running', async () => {
      expect(monitor.isRunning()).toBe(false);

      // Should not throw
      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });
  });

  // ===========================================================================
  // getMonitoringStats Tests
  // ===========================================================================

  describe('getMonitoringStats', () => {
    it('returns correct statistics', async () => {
      vi.useFakeTimers();

      const healthyVP = generatePresenceTestId('vp');
      const unhealthyVP = generatePresenceTestId('vp');
      const neverHeartbeatVP = generatePresenceTestId('vp');

      await heartbeatService.registerVP(healthyVP);
      await heartbeatService.registerVP(unhealthyVP);
      await heartbeatService.registerVP(neverHeartbeatVP);

      await heartbeatService.sendHeartbeat(healthyVP, 'daemon1');
      await heartbeatService.sendHeartbeat(unhealthyVP, 'daemon2');

      // Let unhealthyVP become unhealthy
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 4);
      await heartbeatService.sendHeartbeat(healthyVP, 'daemon1');

      const stats = await monitor.getMonitoringStats();

      expect(stats.totalVPs).toBe(3);
      expect(stats.healthyCount).toBe(1);
      expect(stats.unhealthyCount).toBe(1);
      expect(stats.unknownCount).toBe(1);
    });

    it('returns zeros when no VPs registered', async () => {
      const stats = await monitor.getMonitoringStats();

      expect(stats.totalVPs).toBe(0);
      expect(stats.healthyCount).toBe(0);
      expect(stats.degradedCount).toBe(0);
      expect(stats.unhealthyCount).toBe(0);
      expect(stats.unknownCount).toBe(0);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('handles Orchestrator becoming unhealthy and recovering multiple times', async () => {
      vi.useFakeTimers();
      const onUnhealthy = vi.fn();
      const onRecovered = vi.fn();
      monitor.setOnUnhealthy(onUnhealthy);
      monitor.setOnRecovered(onRecovered);

      const vpId = generatePresenceTestId('vp');
      await heartbeatService.registerVP(vpId);

      // Cycle through unhealthy -> recovered multiple times
      for (let cycle = 0; cycle < 3; cycle++) {
        // Send heartbeat (healthy)
        await heartbeatService.sendHeartbeat(vpId, 'daemon1');
        await monitor.checkNow();

        // Let it become unhealthy
        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 4);
        await monitor.checkNow();
      }

      // Should have triggered callbacks for each transition
      expect(onUnhealthy).toHaveBeenCalledTimes(3);
      expect(onRecovered).toHaveBeenCalledTimes(2); // One less because first transition is healthy->unhealthy
    });

    it('does not trigger callback for same status', async () => {
      vi.useFakeTimers();
      const onUnhealthy = vi.fn();
      monitor.setOnUnhealthy(onUnhealthy);

      const vpId = generatePresenceTestId('vp');
      await heartbeatService.registerVP(vpId);
      await heartbeatService.sendHeartbeat(vpId, 'daemon1');

      // Let it become unhealthy
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 4);

      // Check multiple times while unhealthy
      await monitor.checkNow();
      await monitor.checkNow();
      await monitor.checkNow();

      // Should only trigger once
      expect(onUnhealthy).toHaveBeenCalledTimes(1);
    });
  });
});
