/**
 * Federation Registry
 *
 * Manages registration and discovery of orchestrators in a distributed system.
 * Backed by Redis for distributed state and coordination.
 */

import { EventEmitter } from 'eventemitter3';
import { createClient } from 'redis';

import type {
  RegistryOrchestratorMetadata,
  RegistryOrchestratorMetrics,
  RegistryOrchestratorStatus,
  FederationRegistryConfig,
  FederationRegistryEvents,
  OrchestratorQuery,
} from './registry-types';
import type { RedisClientType } from 'redis';

export class FederationRegistry extends EventEmitter<FederationRegistryEvents> {
  private redis: RedisClientType;
  private config: FederationRegistryConfig;
  private connected: boolean = false;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: FederationRegistryConfig) {
    super();
    this.config = config;

    // Initialize Redis client
    this.redis = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password,
      database: config.redis.db || 0,
    });

    this.setupRedis();
  }

  /**
   * Setup Redis connection and error handlers
   */
  private async setupRedis(): Promise<void> {
    this.redis.on('error', (err: Error) => {
      console.error('Redis Error:', err);
      this.connected = false;
    });

    this.redis.on('connect', () => {
      console.log('Redis connected (FederationRegistry)');
      this.connected = true;
    });

    this.redis.on('disconnect', () => {
      console.log('Redis disconnected (FederationRegistry)');
      this.connected = false;
    });

    try {
      await this.redis.connect();
      this.startCleanupTask();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Register an orchestrator with the federation
   */
  async registerOrchestrator(
    metadata: RegistryOrchestratorMetadata
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const key = this.getOrchestratorKey(metadata.id);
    const now = new Date();

    // Update metadata with current timestamp if not provided
    const fullMetadata: RegistryOrchestratorMetadata = {
      ...metadata,
      lastHeartbeat: now,
      registeredAt: metadata.registeredAt || now,
    };

    // Store orchestrator metadata
    await this.redis.set(key, JSON.stringify(fullMetadata));

    // Index by capabilities
    for (const capability of metadata.capabilities) {
      const capabilityKey = this.getCapabilityIndexKey(capability);
      await this.redis.sAdd(capabilityKey, metadata.id);
    }

    // Index by region
    const regionKey = this.getRegionIndexKey(metadata.region);
    await this.redis.sAdd(regionKey, metadata.id);

    // Add to global orchestrators set
    await this.redis.sAdd(this.getOrchestratorSetKey(), metadata.id);

    this.emit('orchestrator:registered', fullMetadata);
  }

  /**
   * Deregister an orchestrator from the federation
   */
  async deregisterOrchestrator(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    // Get metadata before deleting
    const metadata = await this.getOrchestratorMetadata(id);
    if (!metadata) {
      return; // Already deregistered
    }

    const key = this.getOrchestratorKey(id);

    // Remove from capability indexes
    for (const capability of metadata.capabilities) {
      const capabilityKey = this.getCapabilityIndexKey(capability);
      await this.redis.sRem(capabilityKey, id);
    }

    // Remove from region index
    const regionKey = this.getRegionIndexKey(metadata.region);
    await this.redis.sRem(regionKey, id);

    // Remove from global set
    await this.redis.sRem(this.getOrchestratorSetKey(), id);

    // Delete metadata
    await this.redis.del(key);

    this.emit('orchestrator:deregistered', id);
  }

  /**
   * Update heartbeat for an orchestrator
   */
  async updateHeartbeat(id: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const metadata = await this.getOrchestratorMetadata(id);
    if (!metadata) {
      throw new Error(`Orchestrator not found: ${id}`);
    }

    const now = new Date();
    const oldStatus = metadata.status;

    // Update heartbeat and potentially status
    metadata.lastHeartbeat = now;

    // If orchestrator was unhealthy but heartbeat is now fresh, mark as online
    if (metadata.status === 'offline' || metadata.status === 'busy') {
      metadata.status = 'online';
    }

    const key = this.getOrchestratorKey(id);
    await this.redis.set(key, JSON.stringify(metadata));

    this.emit('heartbeat:received', id, now);

    // Emit status change if it changed
    if (oldStatus !== metadata.status) {
      this.emit('orchestrator:status_changed', id, oldStatus, metadata.status);
    }
  }

  /**
   * Get orchestrators by capability
   */
  async getOrchestratorsByCapability(
    capabilities: string[]
  ): Promise<RegistryOrchestratorMetadata[]> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    if (capabilities.length === 0) {
      return [];
    }

    // Get intersection of all capability sets
    const capabilityKeys = capabilities.map(cap =>
      this.getCapabilityIndexKey(cap)
    );
    const orchestratorIds = await this.redis.sInter(capabilityKeys);

    // Fetch metadata for all matching orchestrators
    const metadataPromises = orchestratorIds.map(id =>
      this.getOrchestratorMetadata(id)
    );
    const metadataList = await Promise.all(metadataPromises);

    // Filter out null values
    return metadataList.filter(
      (m): m is RegistryOrchestratorMetadata => m !== null
    );
  }

  /**
   * Get orchestrators by region
   */
  async getOrchestratorsByRegion(
    region: string
  ): Promise<RegistryOrchestratorMetadata[]> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const regionKey = this.getRegionIndexKey(region);
    const orchestratorIds = await this.redis.sMembers(regionKey);

    // Fetch metadata for all orchestrators in region
    const metadataPromises = orchestratorIds.map(id =>
      this.getOrchestratorMetadata(id)
    );
    const metadataList = await Promise.all(metadataPromises);

    // Filter out null values
    return metadataList.filter(
      (m): m is RegistryOrchestratorMetadata => m !== null
    );
  }

  /**
   * Get healthy orchestrators
   */
  async getHealthyOrchestrators(): Promise<RegistryOrchestratorMetadata[]> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const allOrchestrators = await this.getAllOrchestrators();
    const now = Date.now();
    const healthyThreshold = now - this.config.heartbeatTimeout;

    return allOrchestrators.filter(orchestrator => {
      const lastHeartbeat = orchestrator.lastHeartbeat.getTime();
      const isHealthy = lastHeartbeat > healthyThreshold;
      return isHealthy && orchestrator.status !== 'offline';
    });
  }

  /**
   * Get orchestrator metrics
   */
  async getOrchestratorMetrics(
    id: string
  ): Promise<RegistryOrchestratorMetrics | null> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const metadata = await this.getOrchestratorMetadata(id);
    if (!metadata) {
      return null;
    }

    const load =
      metadata.maxSessions > 0
        ? metadata.currentSessions / metadata.maxSessions
        : 0;

    const tokenUtilization =
      metadata.tokenLimit > 0 ? metadata.tokensUsed / metadata.tokenLimit : 0;

    const uptime = Date.now() - metadata.registeredAt.getTime();

    return {
      id: metadata.id,
      load,
      sessions: metadata.currentSessions,
      tokensUsed: metadata.tokensUsed,
      tokenLimit: metadata.tokenLimit,
      tokenUtilization,
      status: metadata.status,
      lastHeartbeat: metadata.lastHeartbeat,
      uptime,
    };
  }

  /**
   * Query orchestrators with complex filters
   */
  async queryOrchestrators(
    query: OrchestratorQuery
  ): Promise<RegistryOrchestratorMetadata[]> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    let candidates: RegistryOrchestratorMetadata[];

    // Start with capability or region filter if provided
    if (query.capabilities && query.capabilities.length > 0) {
      candidates = await this.getOrchestratorsByCapability(query.capabilities);
    } else if (query.region) {
      candidates = await this.getOrchestratorsByRegion(query.region);
    } else {
      candidates = await this.getAllOrchestrators();
    }

    // Apply additional filters
    return candidates.filter(orchestrator => {
      // Filter by region (if not already filtered)
      if (query.region && orchestrator.region !== query.region) {
        return false;
      }

      // Filter by status
      if (query.status && !query.status.includes(orchestrator.status)) {
        return false;
      }

      // Filter by available sessions
      if (query.minAvailableSessions !== undefined) {
        const availableSessions =
          orchestrator.maxSessions - orchestrator.currentSessions;
        if (availableSessions < query.minAvailableSessions) {
          return false;
        }
      }

      // Filter by available tokens
      if (query.minAvailableTokens !== undefined) {
        const availableTokens =
          orchestrator.tokenLimit - orchestrator.tokensUsed;
        if (availableTokens < query.minAvailableTokens) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get metadata for a specific orchestrator
   */
  async getOrchestratorMetadata(
    id: string
  ): Promise<RegistryOrchestratorMetadata | null> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const key = this.getOrchestratorKey(id);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    const metadata = JSON.parse(data);

    // Convert date strings back to Date objects
    metadata.lastHeartbeat = new Date(metadata.lastHeartbeat);
    metadata.registeredAt = new Date(metadata.registeredAt);

    return metadata;
  }

  /**
   * Get all registered orchestrators
   */
  async getAllOrchestrators(): Promise<RegistryOrchestratorMetadata[]> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const orchestratorIds = await this.redis.sMembers(
      this.getOrchestratorSetKey()
    );
    const metadataPromises = orchestratorIds.map(id =>
      this.getOrchestratorMetadata(id)
    );
    const metadataList = await Promise.all(metadataPromises);

    return metadataList.filter(
      (m): m is RegistryOrchestratorMetadata => m !== null
    );
  }

  /**
   * Update orchestrator status
   */
  async updateStatus(
    id: string,
    status: RegistryOrchestratorStatus
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const metadata = await this.getOrchestratorMetadata(id);
    if (!metadata) {
      throw new Error(`Orchestrator not found: ${id}`);
    }

    const oldStatus = metadata.status;
    metadata.status = status;

    const key = this.getOrchestratorKey(id);
    await this.redis.set(key, JSON.stringify(metadata));

    if (oldStatus !== status) {
      this.emit('orchestrator:status_changed', id, oldStatus, status);
    }
  }

  /**
   * Update orchestrator metrics (sessions, tokens)
   */
  async updateMetrics(
    id: string,
    updates: {
      currentSessions?: number;
      tokensUsed?: number;
    }
  ): Promise<void> {
    if (!this.connected) {
      throw new Error('Redis not connected');
    }

    const metadata = await this.getOrchestratorMetadata(id);
    if (!metadata) {
      throw new Error(`Orchestrator not found: ${id}`);
    }

    if (updates.currentSessions !== undefined) {
      metadata.currentSessions = updates.currentSessions;
    }

    if (updates.tokensUsed !== undefined) {
      metadata.tokensUsed = updates.tokensUsed;
    }

    const key = this.getOrchestratorKey(id);
    await this.redis.set(key, JSON.stringify(metadata));
  }

  /**
   * Start background cleanup task for stale orchestrators
   */
  private startCleanupTask(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupStaleOrchestrators();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up stale orchestrators
   */
  private async cleanupStaleOrchestrators(): Promise<void> {
    if (!this.connected) {
      return;
    }

    const allOrchestrators = await this.getAllOrchestrators();
    const now = Date.now();
    const staleThreshold = now - this.config.staleTimeout;
    const unhealthyThreshold = now - this.config.heartbeatTimeout;

    for (const orchestrator of allOrchestrators) {
      const lastHeartbeat = orchestrator.lastHeartbeat.getTime();

      // Check if stale (>5 min) - auto-deregister
      if (lastHeartbeat < staleThreshold) {
        this.emit(
          'orchestrator:stale',
          orchestrator.id,
          orchestrator.lastHeartbeat
        );
        await this.deregisterOrchestrator(orchestrator.id);
        continue;
      }

      // Check if unhealthy (>30s) - mark as offline
      if (
        lastHeartbeat < unhealthyThreshold &&
        orchestrator.status !== 'offline'
      ) {
        this.emit(
          'orchestrator:unhealthy',
          orchestrator.id,
          orchestrator.lastHeartbeat
        );
        await this.updateStatus(orchestrator.id, 'offline');
      }
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disconnect from Redis and stop cleanup task
   */
  async disconnect(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    if (this.connected) {
      await this.redis.disconnect();
      this.connected = false;
    }
  }

  /**
   * Get Redis key for orchestrator metadata
   */
  private getOrchestratorKey(id: string): string {
    return `${this.config.redis.keyPrefix}:federation:orchestrator:${id}`;
  }

  /**
   * Get Redis key for capability index
   */
  private getCapabilityIndexKey(capability: string): string {
    return `${this.config.redis.keyPrefix}:federation:capability:${capability}`;
  }

  /**
   * Get Redis key for region index
   */
  private getRegionIndexKey(region: string): string {
    return `${this.config.redis.keyPrefix}:federation:region:${region}`;
  }

  /**
   * Get Redis key for global orchestrators set
   */
  private getOrchestratorSetKey(): string {
    return `${this.config.redis.keyPrefix}:federation:orchestrators`;
  }
}
