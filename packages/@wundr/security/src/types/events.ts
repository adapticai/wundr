/**
 * Security Events Type Definitions
 * Event types specifically designed for SecurityMonitor and AuditLogger integration
 *
 * @fileoverview Minimal event types focusing on SecurityMonitor functionality
 * @author Security Events Specialist
 * @version 1.0.0
 */

// Only import what we absolutely need to avoid conflicts
export type SecurityEventId = string;
export type SecurityEventTimestamp = string; // ISO 8601 format

/**
 * Security Monitor Event Types
 * These match the exact string values used in SecurityMonitor.recordSecurityEvent()
 */
export enum SecurityMonitorEvent {
  // Authentication events
  LOGIN_SUCCESS = 'login:success',
  LOGIN_FAILED = 'login:failed',
  USER_LOGOUT = 'user:logout',

  // Security events
  PRIVILEGE_ESCALATION = 'privilege:escalation',
  SUSPICIOUS_ACTIVITY = 'suspicious:activity',
  REQUEST_BLOCKED = 'request:blocked',
  VULNERABILITY_DETECTED = 'vulnerability:detected',
  SECRET_FOUND = 'secret:found',

  // System events
  MONITORING_STARTED = 'monitoring:started',
  MONITORING_STOPPED = 'monitoring:stopped',
  METRICS_COLLECTED = 'metrics:collected',
  EVENTS_FLUSHED = 'events:flushed',

  // Alert events
  ALERT_TRIGGERED = 'alert:triggered',
  ALERT_ACKNOWLEDGED = 'alert:acknowledged',
  ALERT_RESOLVED = 'alert:resolved',
  ALERT_RULE_ADDED = 'alert:rule-added',
  ALERT_RULE_REMOVED = 'alert:rule-removed',
  ALERT_RULE_UPDATED = 'alert:rule-updated',

  // Performance events
  PERFORMANCE_DATA = 'performance:data',
  SECURITY_EVENT = 'security:event'
}

/**
 * Performance Metric Types
 * These match the exact string values used in SecurityMonitor.recordPerformanceData()
 */
export enum PerformanceMetricType {
  RESPONSE_TIME = 'response_time',
  REQUEST = 'request',
  ERROR = 'error',
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss'
}

/**
 * Event severity levels (simplified)
 */
export enum EventSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Event outcome types
 */
export enum EventOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  BLOCKED = 'blocked',
  DETECTED = 'detected',
  UNKNOWN = 'unknown'
}

/**
 * Basic security event payload for SecurityMonitor
 */
export interface SecurityEventPayload {
  readonly event: SecurityMonitorEvent;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: SecurityEventTimestamp;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly severity?: EventSeverity;
}

/**
 * Performance event payload for SecurityMonitor
 */
export interface PerformanceEventPayload {
  readonly type: PerformanceMetricType;
  readonly value: number;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: SecurityEventTimestamp;
}

/**
 * Enhanced security event with additional context
 */
export interface EnhancedSecurityEvent {
  readonly id: SecurityEventId;
  readonly type: SecurityMonitorEvent;
  readonly severity: EventSeverity;
  readonly outcome: EventOutcome;
  readonly timestamp: SecurityEventTimestamp;
  readonly description: string;
  readonly source: EventSource;
  readonly actor?: EventActor;
  readonly target?: EventTarget;
  readonly context?: EventContext;
  readonly details?: EventDetails;
}

/**
 * Event source information
 */
export interface EventSource {
  readonly application: string;
  readonly version: string;
  readonly component?: string;
  readonly instance?: string;
}

/**
 * Event actor (who performed the action)
 */
export interface EventActor {
  readonly type: 'user' | 'system' | 'service' | 'admin' | 'unknown';
  readonly id?: string;
  readonly name?: string;
  readonly session?: string;
  readonly roles?: readonly string[];
}

/**
 * Event target (what was acted upon)
 */
export interface EventTarget {
  readonly type: 'file' | 'database' | 'user' | 'system' | 'resource' | 'unknown';
  readonly id?: string;
  readonly name?: string;
  readonly path?: string;
}

/**
 * Event context for additional information
 */
export interface EventContext {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly userAgent?: string;
  readonly ipAddress?: string;
  readonly location?: string;
  readonly custom?: Record<string, unknown>;
}

/**
 * Event details for investigation
 */
export interface EventDetails {
  readonly message: string;
  readonly reason?: string;
  readonly riskScore?: number; // 0-1
  readonly confidence?: number; // 0-1
  readonly indicators?: readonly string[];
  readonly recommendations?: readonly string[];
  readonly custom?: Record<string, unknown>;
}

/**
 * Alert rule information for SecurityMonitor alerts
 */
export interface AlertRuleInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly condition: string;
  readonly threshold: number;
  readonly severity: EventSeverity;
  readonly enabled: boolean;
  readonly cooldownMs: number;
}

/**
 * Security alert event extending the basic event
 */
export interface SecurityAlertEvent extends EnhancedSecurityEvent {
  readonly type: SecurityMonitorEvent.ALERT_TRIGGERED;
  readonly alertRule: AlertRuleInfo;
  readonly currentValue: number;
  readonly threshold: number;
  readonly trend?: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Incident information for tracking security incidents
 */
export interface SecurityIncident {
  readonly id: SecurityEventId;
  readonly title: string;
  readonly status: 'open' | 'investigating' | 'resolved' | 'closed';
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
  readonly createdAt: SecurityEventTimestamp;
  readonly updatedAt: SecurityEventTimestamp;
  readonly events: readonly EnhancedSecurityEvent[];
  readonly assignedTo?: string;
  readonly description?: string;
  readonly resolution?: string;
}

/**
 * Event filter for querying events
 */
export interface EventFilter {
  readonly startTime?: SecurityEventTimestamp;
  readonly endTime?: SecurityEventTimestamp;
  readonly eventTypes?: readonly SecurityMonitorEvent[];
  readonly severities?: readonly EventSeverity[];
  readonly outcomes?: readonly EventOutcome[];
  readonly actorIds?: readonly string[];
  readonly targetIds?: readonly string[];
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Event aggregation for analytics
 */
export interface EventAggregation {
  readonly period: { start: SecurityEventTimestamp; end: SecurityEventTimestamp };
  readonly totalEvents: number;
  readonly eventsByType: Record<string, number>;
  readonly eventsBySeverity: Record<string, number>;
  readonly eventsByOutcome: Record<string, number>;
  readonly eventsByActor: Record<string, number>;
  readonly topTargets: readonly { target: string; count: number }[];
  readonly timeline: readonly { timestamp: SecurityEventTimestamp; count: number }[];
}

/**
 * Event correlation for detecting related events
 */
export interface EventCorrelation {
  readonly primaryEvent: EnhancedSecurityEvent;
  readonly relatedEvents: readonly EnhancedSecurityEvent[];
  readonly correlationScore: number; // 0-1
  readonly correlationFactors: readonly string[];
  readonly timeWindow: number; // milliseconds
}

/**
 * Type guards for event types
 */
export const isSecurityEventPayload = (value: unknown): value is SecurityEventPayload => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'event' in value &&
    'timestamp' in value &&
    Object.values(SecurityMonitorEvent).includes((value as SecurityEventPayload).event)
  );
};

export const isPerformanceEventPayload = (value: unknown): value is PerformanceEventPayload => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'value' in value &&
    'timestamp' in value &&
    Object.values(PerformanceMetricType).includes((value as PerformanceEventPayload).type)
  );
};

export const isEnhancedSecurityEvent = (value: unknown): value is EnhancedSecurityEvent => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'type' in value &&
    'severity' in value &&
    'timestamp' in value &&
    Object.values(SecurityMonitorEvent).includes((value as EnhancedSecurityEvent).type)
  );
};

export const isSecurityAlertEvent = (value: unknown): value is SecurityAlertEvent => {
  return (
    isEnhancedSecurityEvent(value) &&
    'alertRule' in value &&
    'currentValue' in value &&
    'threshold' in value &&
    (value as SecurityAlertEvent).type === SecurityMonitorEvent.ALERT_TRIGGERED
  );
};

/**
 * Utility functions for event creation
 */
export const createSecurityEventPayload = (
  event: SecurityMonitorEvent,
  metadata?: Record<string, unknown>,
  severity: EventSeverity = EventSeverity.INFO,
  userId?: string,
  sessionId?: string
): SecurityEventPayload => ({
  event,
  metadata,
  timestamp: new Date().toISOString(),
  severity,
  userId,
  sessionId
});

export const createPerformanceEventPayload = (
  type: PerformanceMetricType,
  value: number,
  metadata?: Record<string, unknown>
): PerformanceEventPayload => ({
  type,
  value,
  metadata,
  timestamp: new Date().toISOString()
});

export const createEnhancedSecurityEvent = (
  type: SecurityMonitorEvent,
  severity: EventSeverity,
  outcome: EventOutcome,
  description: string,
  source: EventSource,
  options?: {
    actor?: EventActor;
    target?: EventTarget;
    context?: EventContext;
    details?: EventDetails;
  }
): EnhancedSecurityEvent => ({
  id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
  type,
  severity,
  outcome,
  timestamp: new Date().toISOString(),
  description,
  source,
  ...options
});

/**
 * Event processing utilities
 */
export const filterEvents = (
  events: readonly EnhancedSecurityEvent[],
  filter: EventFilter
): readonly EnhancedSecurityEvent[] => {
  return events.filter(event => {
    // Time range filter
    if (filter.startTime && event.timestamp < filter.startTime) return false;
    if (filter.endTime && event.timestamp > filter.endTime) return false;

    // Event type filter
    if (filter.eventTypes && !filter.eventTypes.includes(event.type)) return false;

    // Severity filter
    if (filter.severities && !filter.severities.includes(event.severity)) return false;

    // Outcome filter
    if (filter.outcomes && !filter.outcomes.includes(event.outcome)) return false;

    // Actor filter
    if (filter.actorIds && event.actor && !filter.actorIds.includes(event.actor.id || '')) return false;

    // Target filter
    if (filter.targetIds && event.target && !filter.targetIds.includes(event.target.id || '')) return false;

    return true;
  }).slice(filter.offset || 0, (filter.offset || 0) + (filter.limit || Number.MAX_SAFE_INTEGER));
};

export const aggregateEvents = (
  events: readonly EnhancedSecurityEvent[],
  startTime: SecurityEventTimestamp,
  endTime: SecurityEventTimestamp
): EventAggregation => {
  const eventsByType: Record<string, number> = {};
  const eventsBySeverity: Record<string, number> = {};
  const eventsByOutcome: Record<string, number> = {};
  const eventsByActor: Record<string, number> = {};
  const targetCounts: Record<string, number> = {};

  for (const event of events) {
    // Count by type
    eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

    // Count by severity
    eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

    // Count by outcome
    eventsByOutcome[event.outcome] = (eventsByOutcome[event.outcome] || 0) + 1;

    // Count by actor
    const actorId = event.actor?.id || 'unknown';
    eventsByActor[actorId] = (eventsByActor[actorId] || 0) + 1;

    // Count by target
    const targetId = event.target?.id || event.target?.name || 'unknown';
    targetCounts[targetId] = (targetCounts[targetId] || 0) + 1;
  }

  // Get top targets
  const topTargets = Object.entries(targetCounts)
    .map(([target, count]) => ({ target, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Create simple timeline (hourly buckets)
  const timeline: { timestamp: SecurityEventTimestamp; count: number }[] = [];
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const hourMs = 60 * 60 * 1000;

  for (let time = startMs; time <= endMs; time += hourMs) {
    const bucketStart = new Date(time).toISOString();
    const bucketEnd = new Date(time + hourMs).toISOString();

    const count = events.filter(event =>
      event.timestamp >= bucketStart && event.timestamp < bucketEnd
    ).length;

    timeline.push({ timestamp: bucketStart, count });
  }

  return {
    period: { start: startTime, end: endTime },
    totalEvents: events.length,
    eventsByType,
    eventsBySeverity,
    eventsByOutcome,
    eventsByActor,
    topTargets,
    timeline
  };
};

export const correlateEvents = (
  events: readonly EnhancedSecurityEvent[],
  timeWindowMs: number = 300000 // 5 minutes
): readonly EventCorrelation[] => {
  const correlations: EventCorrelation[] = [];
  const processed = new Set<string>();

  for (const primaryEvent of events) {
    if (processed.has(primaryEvent.id)) continue;

    const eventTime = new Date(primaryEvent.timestamp).getTime();
    const relatedEvents: EnhancedSecurityEvent[] = [];

    for (const otherEvent of events) {
      if (otherEvent.id === primaryEvent.id || processed.has(otherEvent.id)) continue;

      const otherTime = new Date(otherEvent.timestamp).getTime();
      const timeDiff = Math.abs(eventTime - otherTime);

      if (timeDiff <= timeWindowMs) {
        // Simple correlation based on shared attributes
        const correlationScore = calculateCorrelationScore(primaryEvent, otherEvent);
        if (correlationScore > 0.3) { // Threshold for correlation
          relatedEvents.push(otherEvent);
          processed.add(otherEvent.id);
        }
      }
    }

    if (relatedEvents.length > 0) {
      correlations.push({
        primaryEvent,
        relatedEvents,
        correlationScore: relatedEvents.length > 0 ? 0.8 : 0, // Simplified scoring
        correlationFactors: getCorrelationFactors(primaryEvent, relatedEvents),
        timeWindow: timeWindowMs
      });
    }

    processed.add(primaryEvent.id);
  }

  return correlations;
};

const calculateCorrelationScore = (event1: EnhancedSecurityEvent, event2: EnhancedSecurityEvent): number => {
  let score = 0;

  // Same actor
  if (event1.actor?.id && event1.actor.id === event2.actor?.id) score += 0.4;

  // Same target
  if (event1.target?.id && event1.target.id === event2.target?.id) score += 0.3;

  // Same session
  if (event1.actor?.session && event1.actor.session === event2.actor?.session) score += 0.3;

  // Same IP address
  if (event1.context?.ipAddress && event1.context.ipAddress === event2.context?.ipAddress) score += 0.2;

  // Similar severity
  if (event1.severity === event2.severity) score += 0.1;

  return Math.min(score, 1.0);
};

const getCorrelationFactors = (primaryEvent: EnhancedSecurityEvent, relatedEvents: readonly EnhancedSecurityEvent[]): readonly string[] => {
  const factors: string[] = [];

  if (relatedEvents.some(e => e.actor?.id === primaryEvent.actor?.id)) {
    factors.push('same_actor');
  }

  if (relatedEvents.some(e => e.target?.id === primaryEvent.target?.id)) {
    factors.push('same_target');
  }

  if (relatedEvents.some(e => e.actor?.session === primaryEvent.actor?.session)) {
    factors.push('same_session');
  }

  if (relatedEvents.some(e => e.context?.ipAddress === primaryEvent.context?.ipAddress)) {
    factors.push('same_ip');
  }

  if (relatedEvents.some(e => e.severity === primaryEvent.severity)) {
    factors.push('similar_severity');
  }

  return factors;
};

/**
 * Constants for event processing
 */
export const EVENT_CONSTANTS = {
  DEFAULT_CORRELATION_WINDOW_MS: 300000, // 5 minutes
  DEFAULT_RETENTION_PERIOD_MS: 365 * 24 * 60 * 60 * 1000, // 1 year
  MAX_EVENTS_PER_BATCH: 1000,
  MAX_EVENT_SIZE_BYTES: 1024 * 1024, // 1MB
  HIGH_FREQUENCY_THRESHOLD: 100, // events per minute
  ANOMALY_DETECTION_WINDOW_MS: 3600000 // 1 hour
} as const;