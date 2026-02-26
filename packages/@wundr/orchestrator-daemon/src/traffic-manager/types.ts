/**
 * Messaging Traffic Manager - Core Types
 *
 * Defines the type system for the intelligent routing layer that decides which
 * orchestrator agent should handle each inbound message.
 *
 * @packageDocumentation
 */

import type { ChannelId, NormalizedMessage, ChatType } from '../channels/types.js';

/** Priority levels for inbound messages. Higher values indicate more urgency. */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
  CRITICAL = 4,
}

/** Organizational seniority level of an orchestrator agent. */
export type AgentSeniority = 'ic' | 'manager' | 'director' | 'vp' | 'ceo';

/** Operational status of an orchestrator agent. */
export type AgentStatus = 'available' | 'busy' | 'offline' | 'maintenance';

/** Capability and availability profile for a single orchestrator agent. */
export interface AgentCapabilityProfile {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  /** Primary discipline area (e.g., "engineering", "finance", "legal"). */
  readonly discipline: string;
  readonly seniority: AgentSeniority;
  /** Free-form capability tags (e.g., ["typescript", "compliance"]). */
  readonly capabilities: readonly string[];
  readonly status: AgentStatus;
  /** Current workload as a fraction between 0 (idle) and 1 (fully loaded). */
  readonly currentLoad: number;
  readonly maxConcurrentTasks: number;
  readonly preferredChannels: readonly ChannelId[];
  readonly lastActiveAt: Date;
}

/** NLP/LLM pre-processing results used to inform the routing decision. */
export interface ContentAnalysis {
  readonly topics: readonly string[];
  readonly sentiment: 'positive' | 'negative' | 'neutral';
  readonly urgency: MessagePriority;
  readonly intent: string;
  readonly requiredDisciplines: readonly string[];
  readonly suggestedAgentIds: readonly string[];
  /** BCP-47 language code (e.g., "en", "fr-CA"). */
  readonly language: string;
  readonly complexity: 'simple' | 'moderate' | 'complex';
  readonly mentionedAgentNames: readonly string[];
  readonly isThreadContinuation: boolean;
  readonly threadAgentId?: string;
}

/** Output of a single routing evaluation for one inbound message. */
export interface RoutingDecision {
  readonly selectedAgentId: string;
  /** Confidence in the routing decision, between 0 and 1. */
  readonly confidence: number;
  readonly reasoning: string;
  readonly matchedBy:
    | 'direct_mention'
    | 'thread_continuity'
    | 'binding_rule'
    | 'discipline_match'
    | 'seniority_escalation'
    | 'load_balance'
    | 'fallback';
  readonly fallbackChain: readonly string[];
  readonly routingLatencyMs: number;
  readonly escalated: boolean;
  readonly originalPriority: MessagePriority;
  readonly effectivePriority: MessagePriority;
}

/**
 * Declarative rule that binds a set of message conditions to a target agent.
 * Rules are evaluated in ascending priority order (lower number = first).
 */
export interface RoutingRule {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly conditions: {
    readonly channelPattern?: string;
    readonly senderPattern?: string;
    readonly contentKeywords?: readonly string[];
    readonly messageTypes?: readonly ChatType[];
    readonly minPriority?: MessagePriority;
  };
  readonly targetAgentId: string;
  readonly fallbackAgentId?: string;
}

/** Wraps a NormalizedMessage with routing metadata as it enters the traffic manager. */
export interface InboundMessageEnvelope {
  readonly message: NormalizedMessage;
  readonly receivedAt: Date;
  readonly channelId: ChannelId;
  readonly organizationId: string;
  readonly workspaceId?: string;
  readonly analysis?: ContentAnalysis;
}

/** Top-level configuration for a TrafficManager instance. */
export interface TrafficManagerConfig {
  readonly organizationId: string;
  readonly defaultAgentId: string;
  readonly routingRules: readonly RoutingRule[];
  readonly seniorityWeights: Readonly<Record<AgentSeniority, number>>;
  readonly escalationThreshold: MessagePriority;
  readonly enableContentAnalysis: boolean;
  readonly enableLoadBalancing: boolean;
  readonly maxRoutingLatencyMs: number;
  readonly fallbackBehavior: 'default_agent' | 'round_robin' | 'queue';
}

/** Rolling-window metrics snapshot produced by the traffic manager. */
export interface TrafficMetrics {
  readonly totalMessagesRouted: number;
  readonly averageRoutingLatencyMs: number;
  readonly routingMethodDistribution: Readonly<
    Record<RoutingDecision['matchedBy'], number>
  >;
  readonly escalationRate: number;
  readonly fallbackRate: number;
  readonly agentUtilization: Readonly<Record<string, number>>;
  readonly messagesPerMinute: number;
  readonly windowStartedAt: Date;
}

/** Type-safe event map for TrafficManager event emitters. */
export interface TrafficManagerEventMap {
  'message:routed': { envelope: InboundMessageEnvelope; decision: RoutingDecision };
  'message:escalated': {
    envelope: InboundMessageEnvelope;
    fromAgentId: string;
    toAgentId: string;
    reason: string;
  };
  'message:fallback': { envelope: InboundMessageEnvelope; reason: string };
  'agent:overloaded': { agentId: string; currentLoad: number };
  'metrics:updated': TrafficMetrics;
}
