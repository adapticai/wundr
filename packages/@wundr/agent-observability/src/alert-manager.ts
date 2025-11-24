/**
 * @wundr.io/agent-observability - Alert Manager
 *
 * Manages alerting based on configurable thresholds and anomaly detection.
 * Supports multiple alert conditions with cooldown periods and
 * notification channel integration.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  AlertConfig,
  AlertCondition,
  AlertSeverity,
  AlertOperator,
  TriggeredAlert,
  ObservabilityEvent,
  AlertHandler,
  AlertNotification,
} from './types';

/**
 * Configuration for the Alert Manager
 */
export interface AlertManagerConfig {
  /** Default cooldown period in milliseconds */
  defaultCooldownMs: number;
  /** Maximum alerts to retain in history */
  maxAlertHistory: number;
  /** Enable automatic alert resolution */
  autoResolveEnabled: boolean;
  /** Auto-resolve timeout in milliseconds */
  autoResolveTimeoutMs: number;
  /** Maximum events to evaluate per condition */
  maxEventsPerEvaluation: number;
}

/**
 * Internal alert state for tracking cooldowns and occurrences
 */
interface AlertState {
  lastTriggered: Date | null;
  occurrenceCount: number;
  matchingEvents: ObservabilityEvent[];
}

/**
 * Alert Manager
 *
 * Evaluates incoming events against configured alert rules and
 * triggers notifications when conditions are met. Supports
 * threshold-based and pattern-based alerting with cooldown periods.
 *
 * @example
 * ```typescript
 * const alertManager = new AlertManager();
 *
 * // Define an alert
 * alertManager.addAlert({
 *   id: 'high-error-rate',
 *   name: 'High Error Rate',
 *   severity: 'critical',
 *   categories: ['agent'],
 *   levels: ['error', 'fatal'],
 *   conditions: [
 *     { field: 'count', operator: 'gte', threshold: 10, windowMs: 60000 }
 *   ],
 *   cooldownMs: 300000
 * });
 *
 * // Register handler
 * alertManager.onAlert((notification) => {
 *   console.log('Alert triggered:', notification.alert.message);
 * });
 *
 * // Evaluate events
 * alertManager.evaluate(event);
 * ```
 */
export class AlertManager {
  private config: AlertManagerConfig;
  private alerts: Map<string, AlertConfig> = new Map();
  private alertStates: Map<string, AlertState> = new Map();
  private triggeredAlerts: Map<string, TriggeredAlert> = new Map();
  private alertHistory: TriggeredAlert[] = [];
  private handlers: Set<AlertHandler> = new Set();
  private channelHandlers: Map<string, AlertHandler> = new Map();

  /**
   * Creates a new AlertManager instance
   *
   * @param config - Alert manager configuration
   */
  constructor(config: Partial<AlertManagerConfig> = {}) {
    this.config = {
      defaultCooldownMs: config.defaultCooldownMs ?? 300000, // 5 minutes
      maxAlertHistory: config.maxAlertHistory ?? 1000,
      autoResolveEnabled: config.autoResolveEnabled ?? true,
      autoResolveTimeoutMs: config.autoResolveTimeoutMs ?? 3600000, // 1 hour
      maxEventsPerEvaluation: config.maxEventsPerEvaluation ?? 1000,
    };
  }

  /**
   * Add a new alert configuration
   *
   * @param alertConfig - Alert configuration to add
   */
  addAlert(alertConfig: AlertConfig): void {
    this.alerts.set(alertConfig.id, alertConfig);
    this.alertStates.set(alertConfig.id, {
      lastTriggered: null,
      occurrenceCount: 0,
      matchingEvents: [],
    });
  }

  /**
   * Remove an alert configuration
   *
   * @param alertId - ID of alert to remove
   * @returns True if alert was removed
   */
  removeAlert(alertId: string): boolean {
    this.alertStates.delete(alertId);
    return this.alerts.delete(alertId);
  }

  /**
   * Get an alert configuration
   *
   * @param alertId - Alert ID
   * @returns Alert configuration or undefined
   */
  getAlert(alertId: string): AlertConfig | undefined {
    return this.alerts.get(alertId);
  }

  /**
   * Get all alert configurations
   *
   * @returns Array of all alert configurations
   */
  getAllAlerts(): AlertConfig[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Enable or disable an alert
   *
   * @param alertId - Alert ID
   * @param enabled - Whether to enable or disable
   * @returns True if alert was found and updated
   */
  setAlertEnabled(alertId: string, enabled: boolean): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.enabled = enabled;
    return true;
  }

  /**
   * Update an alert configuration
   *
   * @param alertId - Alert ID
   * @param updates - Partial updates to apply
   * @returns True if alert was found and updated
   */
  updateAlert(alertId: string, updates: Partial<AlertConfig>): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return false;
    }

    Object.assign(alert, updates);
    return true;
  }

  /**
   * Register a global alert handler
   *
   * @param handler - Handler function to call on alerts
   */
  onAlert(handler: AlertHandler): void {
    this.handlers.add(handler);
  }

  /**
   * Remove a global alert handler
   *
   * @param handler - Handler to remove
   */
  offAlert(handler: AlertHandler): void {
    this.handlers.delete(handler);
  }

  /**
   * Register a channel-specific handler
   *
   * @param channel - Channel name
   * @param handler - Handler function
   */
  registerChannel(channel: string, handler: AlertHandler): void {
    this.channelHandlers.set(channel, handler);
  }

  /**
   * Unregister a channel handler
   *
   * @param channel - Channel name
   */
  unregisterChannel(channel: string): void {
    this.channelHandlers.delete(channel);
  }

  /**
   * Evaluate an event against all alert configurations
   *
   * @param event - Event to evaluate
   * @returns Array of triggered alerts
   */
  evaluate(event: ObservabilityEvent): TriggeredAlert[] {
    const triggered: TriggeredAlert[] = [];

    for (const [alertId, alertConfig] of this.alerts) {
      if (!alertConfig.enabled) {
        continue;
      }

      // Check category filter
      if (
        alertConfig.categories &&
        alertConfig.categories.length > 0 &&
        !alertConfig.categories.includes(event.category)
      ) {
        continue;
      }

      // Check level filter
      if (
        alertConfig.levels &&
        alertConfig.levels.length > 0 &&
        !alertConfig.levels.includes(event.level)
      ) {
        continue;
      }

      // Get or initialize state
      const state = this.alertStates.get(alertId)!;

      // Add event to matching events
      state.matchingEvents.push(event);

      // Trim old events outside the evaluation window
      const maxWindow = Math.max(
        ...alertConfig.conditions.map(c => c.windowMs),
      );
      const windowCutoff = new Date(Date.now() - maxWindow);
      state.matchingEvents = state.matchingEvents.filter(
        e => e.timestamp >= windowCutoff,
      );

      // Limit events per evaluation
      if (state.matchingEvents.length > this.config.maxEventsPerEvaluation) {
        state.matchingEvents = state.matchingEvents.slice(
          -this.config.maxEventsPerEvaluation,
        );
      }

      // Check if in cooldown
      if (state.lastTriggered) {
        const cooldownMs =
          alertConfig.cooldownMs ?? this.config.defaultCooldownMs;
        const cooldownEnd = new Date(
          state.lastTriggered.getTime() + cooldownMs,
        );
        if (new Date() < cooldownEnd) {
          continue;
        }
      }

      // Evaluate all conditions
      const allConditionsMet = alertConfig.conditions.every(condition =>
        this.evaluateCondition(condition, state.matchingEvents),
      );

      if (allConditionsMet) {
        const triggeredAlert = this.triggerAlert(alertConfig, state);
        triggered.push(triggeredAlert);
      }
    }

    return triggered;
  }

  /**
   * Evaluate multiple events in batch
   *
   * @param events - Events to evaluate
   * @returns Array of all triggered alerts
   */
  evaluateBatch(events: ObservabilityEvent[]): TriggeredAlert[] {
    const allTriggered: TriggeredAlert[] = [];

    for (const event of events) {
      const triggered = this.evaluate(event);
      allTriggered.push(...triggered);
    }

    return allTriggered;
  }

  /**
   * Acknowledge an active alert
   *
   * @param alertInstanceId - ID of the triggered alert instance
   * @param acknowledgedBy - Who acknowledged the alert
   * @returns True if alert was found and acknowledged
   */
  acknowledge(alertInstanceId: string, acknowledgedBy: string): boolean {
    const alert = this.triggeredAlerts.get(alertInstanceId);
    if (!alert || alert.state !== 'active') {
      return false;
    }

    alert.state = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    return true;
  }

  /**
   * Resolve an alert
   *
   * @param alertInstanceId - ID of the triggered alert instance
   * @param resolutionNotes - Optional resolution notes
   * @returns True if alert was found and resolved
   */
  resolve(alertInstanceId: string, resolutionNotes?: string): boolean {
    const alert = this.triggeredAlerts.get(alertInstanceId);
    if (!alert) {
      return false;
    }

    alert.state = 'resolved';
    alert.resolvedAt = new Date();
    if (resolutionNotes) {
      alert.resolutionNotes = resolutionNotes;
    }

    // Move to history
    this.alertHistory.push(alert);
    this.triggeredAlerts.delete(alertInstanceId);

    // Trim history
    if (this.alertHistory.length > this.config.maxAlertHistory) {
      this.alertHistory = this.alertHistory.slice(-this.config.maxAlertHistory);
    }

    return true;
  }

  /**
   * Get all active triggered alerts
   *
   * @returns Array of active alerts
   */
  getActiveAlerts(): TriggeredAlert[] {
    return Array.from(this.triggeredAlerts.values()).filter(
      a => a.state === 'active',
    );
  }

  /**
   * Get all acknowledged alerts
   *
   * @returns Array of acknowledged alerts
   */
  getAcknowledgedAlerts(): TriggeredAlert[] {
    return Array.from(this.triggeredAlerts.values()).filter(
      a => a.state === 'acknowledged',
    );
  }

  /**
   * Get triggered alerts by severity
   *
   * @param severity - Severity level to filter
   * @returns Array of matching alerts
   */
  getAlertsBySeverity(severity: AlertSeverity): TriggeredAlert[] {
    return Array.from(this.triggeredAlerts.values()).filter(
      a => a.severity === severity,
    );
  }

  /**
   * Get alert history
   *
   * @param limit - Maximum number of alerts to return
   * @returns Array of resolved alerts
   */
  getAlertHistory(limit?: number): TriggeredAlert[] {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get statistics about alerts
   *
   * @returns Alert statistics
   */
  getStatistics(): {
    totalConfigurations: number;
    enabledConfigurations: number;
    activeAlerts: number;
    acknowledgedAlerts: number;
    alertsBySeverity: Record<AlertSeverity, number>;
    alertsLast24h: number;
    alertsLastHour: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    const allTriggered = [
      ...this.triggeredAlerts.values(),
      ...this.alertHistory,
    ];

    const alertsBySeverity: Record<AlertSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let alertsLastHour = 0;
    let alertsLast24h = 0;

    for (const alert of allTriggered) {
      alertsBySeverity[alert.severity]++;
      if (alert.triggeredAt.getTime() >= oneHourAgo) {
        alertsLastHour++;
      }
      if (alert.triggeredAt.getTime() >= oneDayAgo) {
        alertsLast24h++;
      }
    }

    return {
      totalConfigurations: this.alerts.size,
      enabledConfigurations: Array.from(this.alerts.values()).filter(
        a => a.enabled,
      ).length,
      activeAlerts: this.getActiveAlerts().length,
      acknowledgedAlerts: this.getAcknowledgedAlerts().length,
      alertsBySeverity,
      alertsLast24h,
      alertsLastHour,
    };
  }

  /**
   * Clear all alert state (configurations remain)
   */
  clearState(): void {
    this.triggeredAlerts.clear();
    this.alertHistory = [];
    for (const state of this.alertStates.values()) {
      state.lastTriggered = null;
      state.occurrenceCount = 0;
      state.matchingEvents = [];
    }
  }

  /**
   * Clear all alerts and configurations
   */
  clearAll(): void {
    this.alerts.clear();
    this.alertStates.clear();
    this.triggeredAlerts.clear();
    this.alertHistory = [];
  }

  /**
   * Check for auto-resolvable alerts
   */
  checkAutoResolve(): number {
    if (!this.config.autoResolveEnabled) {
      return 0;
    }

    const now = Date.now();
    let resolved = 0;

    for (const [id, alert] of this.triggeredAlerts) {
      if (
        alert.state === 'acknowledged' &&
        alert.acknowledgedAt &&
        now - alert.acknowledgedAt.getTime() >= this.config.autoResolveTimeoutMs
      ) {
        this.resolve(id, 'Auto-resolved after timeout');
        resolved++;
      }
    }

    return resolved;
  }

  /**
   * Evaluate a single condition against events
   */
  private evaluateCondition(
    condition: AlertCondition,
    events: ObservabilityEvent[],
  ): boolean {
    // Filter events within the condition's window
    const windowStart = new Date(Date.now() - condition.windowMs);
    const windowEvents = events.filter(e => e.timestamp >= windowStart);

    // Get the value to compare
    let value: number | string;

    if (condition.field === 'count') {
      value = windowEvents.length;
    } else {
      // Extract field from events (use the latest event's value)
      const latestEvent = windowEvents[windowEvents.length - 1];
      if (!latestEvent) {
        return false;
      }

      value = this.extractFieldValue(latestEvent, condition.field);
      if (value === undefined) {
        return false;
      }
    }

    // Check minimum occurrences
    if (windowEvents.length < condition.minOccurrences) {
      return false;
    }

    // Evaluate the condition
    return this.compareValues(value, condition.operator, condition.threshold);
  }

  /**
   * Extract a field value from an event using dot notation
   */
  private extractFieldValue(
    event: ObservabilityEvent,
    field: string,
  ): number | string | undefined {
    const parts = field.split('.');
    let value: unknown = event;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }

    return undefined;
  }

  /**
   * Compare values using the specified operator
   */
  private compareValues(
    value: number | string,
    operator: AlertOperator,
    threshold: number | string,
  ): boolean {
    switch (operator) {
      case 'gt':
        return Number(value) > Number(threshold);
      case 'gte':
        return Number(value) >= Number(threshold);
      case 'lt':
        return Number(value) < Number(threshold);
      case 'lte':
        return Number(value) <= Number(threshold);
      case 'eq':
        return value === threshold;
      case 'neq':
        return value !== threshold;
      case 'contains':
        return String(value).includes(String(threshold));
      case 'matches':
        try {
          return new RegExp(String(threshold)).test(String(value));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Trigger an alert and notify handlers
   */
  private triggerAlert(
    alertConfig: AlertConfig,
    state: AlertState,
  ): TriggeredAlert {
    const triggeredAlert: TriggeredAlert = {
      id: uuidv4(),
      alertId: alertConfig.id,
      triggeredAt: new Date(),
      severity: alertConfig.severity,
      message: `Alert "${alertConfig.name}" triggered: ${alertConfig.description || 'No description'}`,
      triggeringEventIds: state.matchingEvents.map(e => e.id),
      state: 'active',
      metadata: { ...alertConfig.metadata },
    };

    // Update state
    state.lastTriggered = new Date();
    state.occurrenceCount++;

    // Store triggered alert
    this.triggeredAlerts.set(triggeredAlert.id, triggeredAlert);

    // Create notification
    const notification: AlertNotification = {
      alert: triggeredAlert,
      config: alertConfig,
      events: [...state.matchingEvents],
    };

    // Clear matching events for next evaluation cycle
    state.matchingEvents = [];

    // Notify global handlers
    for (const handler of this.handlers) {
      try {
        handler(notification);
      } catch (error) {
        console.error('Error in alert handler:', error);
      }
    }

    // Notify channel-specific handlers
    for (const channel of alertConfig.notificationChannels) {
      const channelHandler = this.channelHandlers.get(channel);
      if (channelHandler) {
        try {
          channelHandler(notification);
        } catch (error) {
          console.error(`Error in channel handler "${channel}":`, error);
        }
      }
    }

    return triggeredAlert;
  }
}

/**
 * Create a pre-configured alert manager
 *
 * @param config - Additional configuration
 * @returns Configured AlertManager instance
 */
export function createAlertManager(
  config: Partial<AlertManagerConfig> = {},
): AlertManager {
  return new AlertManager(config);
}

/**
 * Create common alert configurations
 */
export const CommonAlerts = {
  /**
   * High error rate alert
   */
  highErrorRate(
    options: {
      threshold?: number;
      windowMs?: number;
      cooldownMs?: number;
    } = {},
  ): AlertConfig {
    return {
      id: 'high-error-rate',
      name: 'High Error Rate',
      description: 'Error rate exceeds threshold',
      severity: 'high',
      enabled: true,
      levels: ['error', 'fatal'],
      conditions: [
        {
          field: 'count',
          operator: 'gte',
          threshold: options.threshold ?? 10,
          windowMs: options.windowMs ?? 60000,
          minOccurrences: 1,
        },
      ],
      cooldownMs: options.cooldownMs ?? 300000,
      notificationChannels: [],
      metadata: {},
    };
  },

  /**
   * Agent failure alert
   */
  agentFailure(options: { cooldownMs?: number } = {}): AlertConfig {
    return {
      id: 'agent-failure',
      name: 'Agent Failure',
      description: 'Agent encountered a fatal error',
      severity: 'critical',
      enabled: true,
      categories: ['agent'],
      levels: ['fatal'],
      conditions: [
        {
          field: 'count',
          operator: 'gte',
          threshold: 1,
          windowMs: 60000,
          minOccurrences: 1,
        },
      ],
      cooldownMs: options.cooldownMs ?? 60000,
      notificationChannels: [],
      metadata: {},
    };
  },

  /**
   * Slow response time alert
   */
  slowResponseTime(
    options: {
      thresholdMs?: number;
      windowMs?: number;
      minOccurrences?: number;
    } = {},
  ): AlertConfig {
    return {
      id: 'slow-response-time',
      name: 'Slow Response Time',
      description: 'Response time exceeds threshold',
      severity: 'medium',
      enabled: true,
      categories: ['performance'],
      conditions: [
        {
          field: 'durationMs',
          operator: 'gte',
          threshold: options.thresholdMs ?? 5000,
          windowMs: options.windowMs ?? 300000,
          minOccurrences: options.minOccurrences ?? 5,
        },
      ],
      cooldownMs: 600000,
      notificationChannels: [],
      metadata: {},
    };
  },

  /**
   * Memory pressure alert
   */
  memoryPressure(
    options: {
      thresholdPercent?: number;
      windowMs?: number;
    } = {},
  ): AlertConfig {
    return {
      id: 'memory-pressure',
      name: 'Memory Pressure',
      description: 'Memory usage exceeds threshold',
      severity: 'high',
      enabled: true,
      categories: ['system'],
      conditions: [
        {
          field: 'data.memoryUsagePercent',
          operator: 'gte',
          threshold: options.thresholdPercent ?? 90,
          windowMs: options.windowMs ?? 60000,
          minOccurrences: 3,
        },
      ],
      cooldownMs: 300000,
      notificationChannels: [],
      metadata: {},
    };
  },

  /**
   * Security event alert
   */
  securityEvent(options: { cooldownMs?: number } = {}): AlertConfig {
    return {
      id: 'security-event',
      name: 'Security Event',
      description: 'Security-related event detected',
      severity: 'critical',
      enabled: true,
      categories: ['security'],
      conditions: [
        {
          field: 'count',
          operator: 'gte',
          threshold: 1,
          windowMs: 60000,
          minOccurrences: 1,
        },
      ],
      cooldownMs: options.cooldownMs ?? 0,
      notificationChannels: [],
      metadata: {},
    };
  },
};
