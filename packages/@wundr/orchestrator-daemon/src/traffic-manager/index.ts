/**
 * Traffic Manager - Public API Coordinator
 *
 * Wires together the AgentRegistry, ContentAnalyzer, RoutingEngine, and
 * MetricsCollector into a single cohesive entry-point.
 *
 * @packageDocumentation
 */

import { EventEmitter } from 'eventemitter3';
import type {
  InboundMessageEnvelope,
  RoutingDecision,
  TrafficManagerConfig,
  TrafficMetrics,
} from './types.js';
import type { NormalizedMessage } from '../channels/types.js';
import { AgentRegistry, createAgentRegistry } from './agent-registry.js';
import { ContentAnalyzer, createContentAnalyzer } from './content-analyzer.js';
import { RoutingEngine, createRoutingEngine } from './routing-engine.js';
import { MetricsCollector, createMetricsCollector } from './metrics.js';
import { Logger } from '../utils/logger.js';

// Re-export sub-module types and factories for consumers of this package.
export type {
  AgentCapabilityProfile,
  AgentSeniority,
  AgentStatus,
  ContentAnalysis,
  InboundMessageEnvelope,
  MessagePriority,
  RoutingDecision,
  RoutingRule,
  TrafficManagerConfig,
  TrafficManagerEventMap,
  TrafficMetrics,
} from './types.js';
export { MessagePriority } from './types.js';
export { AgentRegistry, createAgentRegistry } from './agent-registry.js';
export { ContentAnalyzer, createContentAnalyzer } from './content-analyzer.js';
export { RoutingEngine, createRoutingEngine } from './routing-engine.js';
export { MetricsCollector, createMetricsCollector } from './metrics.js';

// ---------------------------------------------------------------------------
// TrafficManager
// ---------------------------------------------------------------------------

export class TrafficManager extends EventEmitter {
  private readonly registry: AgentRegistry;
  private readonly analyzer: ContentAnalyzer;
  private readonly engine: RoutingEngine;
  private readonly metrics: MetricsCollector;
  private readonly config: TrafficManagerConfig;
  private readonly logger: Logger;
  private running = false;

  constructor(config: TrafficManagerConfig) {
    super();
    this.config = config;
    this.logger = new Logger('TrafficManager');
    this.registry = createAgentRegistry();
    this.analyzer = createContentAnalyzer();
    this.engine = createRoutingEngine(this.registry, this.analyzer, config);
    this.metrics = createMetricsCollector();
  }

  /** Route an inbound message and record metrics. */
  handleInboundMessage(message: NormalizedMessage): RoutingDecision {
    const startMs = Date.now();

    const envelope: InboundMessageEnvelope = {
      message,
      receivedAt: new Date(),
      channelId: message.channelId,
      organizationId: this.config.organizationId,
    };

    const envelopeWithAnalysis: InboundMessageEnvelope = this.config.enableContentAnalysis
      ? { ...envelope, analysis: this.analyzer.analyze(message) }
      : envelope;

    const decision = this.engine.route(envelopeWithAnalysis);
    const durationMs = Date.now() - startMs;

    this.metrics.recordRouting(decision, durationMs);

    this.emit('message:routed', decision);
    if (decision.escalated) this.emit('message:escalated', decision);
    if (decision.matchedBy === 'fallback') this.emit('message:fallback', decision);

    return decision;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  start(): void {
    this.running = true;
    this.logger.info('Traffic manager started');
  }

  stop(): void {
    this.running = false;
    this.logger.info('Traffic manager stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  getRegistry(): AgentRegistry {
    return this.registry;
  }

  getMetrics(windowMs?: number): TrafficMetrics {
    return this.metrics.getMetrics(windowMs) as unknown as TrafficMetrics;
  }

  getConfig(): TrafficManagerConfig {
    return { ...this.config };
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

export function createTrafficManager(config: TrafficManagerConfig): TrafficManager {
  return new TrafficManager(config);
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let instance: TrafficManager | null = null;

export function getTrafficManager(): TrafficManager | null {
  return instance;
}

export function initTrafficManager(config: TrafficManagerConfig): TrafficManager {
  instance = createTrafficManager(config);
  return instance;
}
