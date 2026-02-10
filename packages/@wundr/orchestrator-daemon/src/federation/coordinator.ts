/**
 * Multi-Orchestrator Federation Coordinator
 *
 * Manages coordination between multiple orchestrator instances for
 * distributed task delegation and resource sharing.
 */

import { EventEmitter } from 'eventemitter3';
import { WebSocket } from 'ws';

import { Logger, LogLevel } from '../utils/logger';

import type {
  OrchestratorConnection,
  OrchestratorCapabilities,
  OrchestratorStatus,
  DelegationRequest,
  DelegationResult,
  SharedContext,
  FederationConfig,
  FederationEvent,
  FederationBroadcast,
  FederationMetrics,
} from './types';
import type { Task } from '../types';

/**
 * Default federation configuration
 */
const DEFAULT_FEDERATION_CONFIG: FederationConfig = {
  enabled: true,
  maxOrchestrators: 10,
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 60000, // 60 seconds
  autoDiscovery: true,
  autoDelegation: false,
  topology: 'mesh',
  loadBalancing: 'least-loaded',
};

/**
 * OrchestratorFederation manages coordination between multiple orchestrator instances
 */
export class OrchestratorFederation extends EventEmitter<Record<string, unknown>> {
  private logger: Logger;
  private config: FederationConfig;
  private orchestrators: Map<string, OrchestratorConnection>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metrics: FederationMetrics;
  private delegationLatencies: number[] = [];

  constructor(config: Partial<FederationConfig> = {}, verbose = false) {
    super();

    this.config = { ...DEFAULT_FEDERATION_CONFIG, ...config };
    this.logger = new Logger('OrchestratorFederation', verbose ? LogLevel.DEBUG : LogLevel.INFO);
    this.orchestrators = new Map();

    // Initialize metrics
    this.metrics = {
      totalOrchestrators: 0,
      activeOrchestrators: 0,
      totalDelegations: 0,
      successfulDelegations: 0,
      failedDelegations: 0,
      averageDelegationLatency: 0,
      totalContextTransfers: 0,
      totalBroadcasts: 0,
      lastUpdated: new Date(),
    };

    if (this.config.enabled) {
      this.startHeartbeatMonitoring();
    }
  }

  /**
   * Register a new orchestrator in the federation
   */
  registerOrchestrator(
    id: string,
    connection: Omit<OrchestratorConnection, 'id'>,
  ): void {
    if (this.orchestrators.has(id)) {
      this.logger.warn(`Orchestrator ${id} is already registered, updating connection`);
    }

    if (this.orchestrators.size >= this.config.maxOrchestrators && !this.orchestrators.has(id)) {
      throw new Error(
        `Federation capacity reached (${this.config.maxOrchestrators} orchestrators)`,
      );
    }

    const orchestratorConnection: OrchestratorConnection = {
      id,
      ...connection,
    };

    this.orchestrators.set(id, orchestratorConnection);
    this.metrics.totalOrchestrators = this.orchestrators.size;
    this.updateActiveOrchestrators();

    this.logger.info(`Orchestrator ${id} registered in federation`);

    const event: FederationEvent = {
      type: 'orchestrator:registered',
      orchestrator: orchestratorConnection,
    };
    this.emit('orchestrator:registered', event);

    // Setup WebSocket event handlers for the orchestrator
    this.setupOrchestratorHandlers(orchestratorConnection);
  }

  /**
   * Unregister an orchestrator from the federation
   */
  unregisterOrchestrator(id: string): boolean {
    const orchestrator = this.orchestrators.get(id);
    if (!orchestrator) {
      this.logger.warn(`Attempted to unregister unknown orchestrator: ${id}`);
      return false;
    }

    // Close the WebSocket connection gracefully
    if (orchestrator.socket.readyState === WebSocket.OPEN) {
      orchestrator.socket.close(1000, 'Unregistered from federation');
    }

    this.orchestrators.delete(id);
    this.metrics.totalOrchestrators = this.orchestrators.size;
    this.updateActiveOrchestrators();

    this.logger.info(`Orchestrator ${id} unregistered from federation`);

    const event: FederationEvent = {
      type: 'orchestrator:unregistered',
      orchestratorId: id,
    };
    this.emit('orchestrator:unregistered', event);

    return true;
  }

  /**
   * Get an orchestrator by ID
   */
  getOrchestrator(id: string): OrchestratorConnection | undefined {
    return this.orchestrators.get(id);
  }

  /**
   * List all registered orchestrators
   */
  listOrchestrators(): OrchestratorConnection[] {
    return Array.from(this.orchestrators.values());
  }

  /**
   * Delegate a task from one orchestrator to another
   */
  async delegateTask(
    fromOrchestratorId: string,
    toOrchestratorId: string,
    task: Task,
    options: Partial<DelegationRequest> = {},
  ): Promise<DelegationResult> {
    const startTime = Date.now();

    this.logger.info(`Delegating task ${task.id} from ${fromOrchestratorId} to ${toOrchestratorId}`);

    // Validate source orchestrator
    const fromOrchestrator = this.orchestrators.get(fromOrchestratorId);
    if (!fromOrchestrator) {
      return this.createDelegationFailure(
        'Source orchestrator not found',
        'unreachable',
        startTime,
      );
    }

    // Validate target orchestrator
    const toOrchestrator = this.orchestrators.get(toOrchestratorId);
    if (!toOrchestrator) {
      return this.createDelegationFailure(
        'Target orchestrator not found',
        'unreachable',
        startTime,
      );
    }

    // Check target orchestrator status
    if (toOrchestrator.status !== 'connected') {
      return this.createDelegationFailure(
        `Target orchestrator is ${toOrchestrator.status}`,
        'unreachable',
        startTime,
      );
    }

    // Check capability requirements if specified
    if (options.requiredCapabilities) {
      const hasCapabilities = this.checkCapabilities(
        toOrchestrator.capabilities,
        options.requiredCapabilities,
      );
      if (!hasCapabilities) {
        return this.createDelegationFailure(
          'Target orchestrator lacks required capabilities',
          'capability_mismatch',
          startTime,
        );
      }
    }

    // Check if target is overloaded
    if (toOrchestrator.activeSessions >= toOrchestrator.capabilities.maxSessions) {
      return this.createDelegationFailure(
        'Target orchestrator is overloaded',
        'overloaded',
        startTime,
      );
    }

    // Create delegation request
    const delegationRequest: DelegationRequest = {
      fromOrchestratorId,
      toOrchestratorId,
      task,
      priority: options.priority || 'medium',
      requiredCapabilities: options.requiredCapabilities,
      context: options.context,
      timeout: options.timeout || 300000, // 5 minutes default
      callbackId: options.callbackId,
    };

    // Send delegation request via WebSocket
    try {
      const result = await this.sendDelegationRequest(toOrchestrator, delegationRequest);

      // Update metrics
      this.metrics.totalDelegations++;
      if (result.success) {
        this.metrics.successfulDelegations++;
      } else {
        this.metrics.failedDelegations++;
      }

      const latency = Date.now() - startTime;
      this.delegationLatencies.push(latency);
      this.updateAverageDelegationLatency();

      // Emit delegation event
      const event: FederationEvent = {
        type: 'task:delegated',
        delegation: delegationRequest,
        result,
      };
      this.emit('task:delegated', event);

      return result;
    } catch (error) {
      this.metrics.totalDelegations++;
      this.metrics.failedDelegations++;

      return this.createDelegationFailure(
        error instanceof Error ? error.message : 'Unknown error',
        'rejected',
        startTime,
      );
    }
  }

  /**
   * Get shared context between two orchestrators
   */
  async getSharedContext(
    fromOrchestratorId: string,
    toOrchestratorId: string,
  ): Promise<SharedContext | null> {
    this.logger.debug(`Getting shared context from ${fromOrchestratorId} to ${toOrchestratorId}`);

    const fromOrchestrator = this.orchestrators.get(fromOrchestratorId);
    const toOrchestrator = this.orchestrators.get(toOrchestratorId);

    if (!fromOrchestrator || !toOrchestrator) {
      this.logger.warn('Cannot get shared context: orchestrator not found');
      return null;
    }

    try {
      // Request context from source orchestrator
      const context = await this.requestContext(fromOrchestrator);

      this.metrics.totalContextTransfers++;

      const event: FederationEvent = {
        type: 'context:shared',
        fromOrchestrator: fromOrchestratorId,
        toOrchestrator: toOrchestratorId,
        size: JSON.stringify(context).length,
      };
      this.emit('context:shared', event);

      return context;
    } catch (error) {
      this.logger.error('Failed to get shared context:', error);
      return null;
    }
  }

  /**
   * Broadcast a message to all orchestrators
   */
  broadcastToAll(message: Omit<FederationBroadcast, 'timestamp'>): void {
    const broadcast: FederationBroadcast = {
      ...message,
      timestamp: new Date(),
    };

    this.logger.info(`Broadcasting message from ${broadcast.sourceId}: ${broadcast.messageType}`);

    const payload = JSON.stringify({
      type: 'federation:broadcast',
      broadcast,
    });

    let successCount = 0;
    for (const [id, orchestrator] of Array.from(this.orchestrators.entries())) {
      // Don't send back to source
      if (id === broadcast.sourceId) {
        continue;
      }

      if (orchestrator.socket.readyState === WebSocket.OPEN) {
        try {
          orchestrator.socket.send(payload);
          successCount++;
        } catch (error) {
          this.logger.error(`Failed to broadcast to orchestrator ${id}:`, error);
        }
      }
    }

    this.metrics.totalBroadcasts++;
    this.logger.debug(`Broadcast sent to ${successCount}/${this.orchestrators.size - 1} orchestrators`);

    const event: FederationEvent = {
      type: 'federation:broadcast',
      message: broadcast,
    };
    this.emit('federation:broadcast', event);
  }

  /**
   * Get current federation metrics
   */
  getMetrics(): FederationMetrics {
    this.metrics.lastUpdated = new Date();
    return { ...this.metrics };
  }

  /**
   * Shutdown the federation coordinator
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down federation coordinator');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Notify all orchestrators
    this.broadcastToAll({
      sourceId: 'federation-coordinator',
      messageType: 'shutdown_notice',
      payload: {},
      priority: 'high',
    });

    // Close all connections
    for (const [id, orchestrator] of Array.from(this.orchestrators.entries())) {
      if (orchestrator.socket.readyState === WebSocket.OPEN) {
        orchestrator.socket.close(1000, 'Federation shutdown');
      }
      this.orchestrators.delete(id);
    }

    this.metrics.totalOrchestrators = 0;
    this.metrics.activeOrchestrators = 0;

    this.logger.info('Federation coordinator shutdown complete');
  }

  /**
   * Setup WebSocket event handlers for an orchestrator
   */
  private setupOrchestratorHandlers(orchestrator: OrchestratorConnection): void {
    orchestrator.socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleOrchestratorMessage(orchestrator.id, message);
      } catch (error) {
        this.logger.error(`Failed to parse message from ${orchestrator.id}:`, error);
      }
    });

    orchestrator.socket.on('close', () => {
      this.logger.info(`WebSocket closed for orchestrator ${orchestrator.id}`);
      this.updateOrchestratorStatus(orchestrator.id, 'disconnected');
    });

    orchestrator.socket.on('error', (error: Error) => {
      this.logger.error(`WebSocket error for orchestrator ${orchestrator.id}:`, error);
      this.updateOrchestratorStatus(orchestrator.id, 'degraded');
    });

    orchestrator.socket.on('ping', () => {
      this.updateHeartbeat(orchestrator.id);
    });
  }

  /**
   * Handle incoming message from an orchestrator
   */
  private handleOrchestratorMessage(orchestratorId: string, message: unknown): void {
    const msg = message as { type: string; payload?: unknown };

    switch (msg.type) {
      case 'heartbeat':
        this.updateHeartbeat(orchestratorId);
        break;

      case 'status_update':
        this.handleStatusUpdate(orchestratorId, msg.payload as { status: OrchestratorStatus });
        break;

      case 'task:completed':
        this.handleTaskCompleted(orchestratorId, msg.payload as { sessionId: string });
        break;

      case 'task:failed':
        this.handleTaskFailed(orchestratorId, msg.payload as { sessionId: string; error: string });
        break;

      default:
        this.logger.debug(`Unknown message type from ${orchestratorId}: ${msg.type}`);
    }
  }

  /**
   * Update orchestrator heartbeat
   */
  private updateHeartbeat(orchestratorId: string): void {
    const orchestrator = this.orchestrators.get(orchestratorId);
    if (orchestrator) {
      orchestrator.lastHeartbeat = new Date();

      const event: FederationEvent = {
        type: 'orchestrator:heartbeat',
        orchestratorId,
        timestamp: orchestrator.lastHeartbeat,
      };
      this.emit('orchestrator:heartbeat', event);
    }
  }

  /**
   * Update orchestrator status
   */
  private updateOrchestratorStatus(orchestratorId: string, status: OrchestratorStatus): void {
    const orchestrator = this.orchestrators.get(orchestratorId);
    if (orchestrator && orchestrator.status !== status) {
      const oldStatus = orchestrator.status;
      orchestrator.status = status;

      this.updateActiveOrchestrators();

      this.logger.info(`Orchestrator ${orchestratorId} status changed: ${oldStatus} -> ${status}`);

      const event: FederationEvent = {
        type: 'orchestrator:status_changed',
        orchestratorId,
        status,
      };
      this.emit('orchestrator:status_changed', event);
    }
  }

  /**
   * Handle status update from orchestrator
   */
  private handleStatusUpdate(orchestratorId: string, payload: { status: OrchestratorStatus }): void {
    this.updateOrchestratorStatus(orchestratorId, payload.status);
  }

  /**
   * Handle task completed event
   */
  private handleTaskCompleted(orchestratorId: string, payload: { sessionId: string }): void {
    const event: FederationEvent = {
      type: 'task:completed',
      sessionId: payload.sessionId,
      orchestratorId,
    };
    this.emit('task:completed', event);
  }

  /**
   * Handle task failed event
   */
  private handleTaskFailed(orchestratorId: string, payload: { sessionId: string; error: string }): void {
    const event: FederationEvent = {
      type: 'task:failed',
      sessionId: payload.sessionId,
      orchestratorId,
      error: payload.error,
    };
    this.emit('task:failed', event);
  }

  /**
   * Send delegation request to target orchestrator
   */
  private async sendDelegationRequest(
    orchestrator: OrchestratorConnection,
    request: DelegationRequest,
  ): Promise<DelegationResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Delegation request timeout'));
      }, request.timeout || 300000);

      const payload = JSON.stringify({
        type: 'delegation:request',
        request,
      });

      // Setup one-time response handler
      const responseHandler = (data: Buffer): void => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === 'delegation:result' && response.requestId === request.task.id) {
            clearTimeout(timeout);
            orchestrator.socket.off('message', responseHandler);
            resolve(response.result as DelegationResult);
          }
        } catch {
          // Ignore parse errors, wait for correct message
        }
      };

      orchestrator.socket.on('message', responseHandler);

      orchestrator.socket.send(payload, (error) => {
        if (error) {
          clearTimeout(timeout);
          orchestrator.socket.off('message', responseHandler);
          reject(error);
        }
      });
    });
  }

  /**
   * Request context from an orchestrator
   */
  private async requestContext(orchestrator: OrchestratorConnection): Promise<SharedContext> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Context request timeout'));
      }, 30000); // 30 second timeout

      const payload = JSON.stringify({
        type: 'context:request',
      });

      const responseHandler = (data: Buffer): void => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === 'context:response') {
            clearTimeout(timeout);
            orchestrator.socket.off('message', responseHandler);
            resolve(response.context as SharedContext);
          }
        } catch {
          // Ignore parse errors
        }
      };

      orchestrator.socket.on('message', responseHandler);

      orchestrator.socket.send(payload, (error) => {
        if (error) {
          clearTimeout(timeout);
          orchestrator.socket.off('message', responseHandler);
          reject(error);
        }
      });
    });
  }

  /**
   * Check if orchestrator has required capabilities
   */
  private checkCapabilities(
    available: OrchestratorCapabilities,
    required: Partial<OrchestratorCapabilities>,
  ): boolean {
    // Check max sessions
    if (required.maxSessions !== undefined && available.maxSessions < required.maxSessions) {
      return false;
    }

    // Check supported task types
    if (required.supportedTaskTypes) {
      const hasAllTypes = required.supportedTaskTypes.every((type) =>
        available.supportedTaskTypes.includes(type),
      );
      if (!hasAllTypes) {
        return false;
      }
    }

    // Check memory tiers
    if (required.memoryTiers) {
      const hasAllTiers = required.memoryTiers.every((tier) =>
        available.memoryTiers.includes(tier),
      );
      if (!hasAllTiers) {
        return false;
      }
    }

    // Check specializations
    if (required.specializations) {
      const availableSpecs = available.specializations || [];
      const hasAllSpecs = required.specializations.every((spec) =>
        availableSpecs.includes(spec),
      );
      if (!hasAllSpecs) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create a delegation failure result
   */
  private createDelegationFailure(
    error: string,
    reason: DelegationResult['reason'],
    startTime: number,
  ): DelegationResult {
    return {
      success: false,
      error,
      reason,
      timestamp: new Date(),
      metadata: {
        latency: Date.now() - startTime,
      },
    };
  }

  /**
   * Update active orchestrators count
   */
  private updateActiveOrchestrators(): void {
    this.metrics.activeOrchestrators = Array.from(this.orchestrators.values()).filter(
      (o) => o.status === 'connected',
    ).length;
  }

  /**
   * Update average delegation latency
   */
  private updateAverageDelegationLatency(): void {
    // Keep only last 100 latencies
    if (this.delegationLatencies.length > 100) {
      this.delegationLatencies = this.delegationLatencies.slice(-100);
    }

    if (this.delegationLatencies.length > 0) {
      const sum = this.delegationLatencies.reduce((a, b) => a + b, 0);
      this.metrics.averageDelegationLatency = sum / this.delegationLatencies.length;
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const [id, orchestrator] of Array.from(this.orchestrators.entries())) {
        const timeSinceHeartbeat = now - orchestrator.lastHeartbeat.getTime();

        // Mark as disconnected if timeout exceeded
        if (timeSinceHeartbeat > this.config.heartbeatTimeout) {
          this.logger.warn(`Orchestrator ${id} heartbeat timeout (${timeSinceHeartbeat}ms)`);
          this.updateOrchestratorStatus(id, 'disconnected');
        }
      }
    }, this.config.heartbeatInterval);
  }
}
