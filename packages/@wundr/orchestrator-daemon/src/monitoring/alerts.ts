/**
 * Alert Threshold Configuration for Orchestrator Daemon
 *
 * Provides configurable alert thresholds that evaluate metric values against
 * user-defined rules. Supports counter-rate, gauge-value, and histogram-percentile
 * triggers. Fires events when thresholds are breached or recovered.
 *
 * Designed to work alongside Prometheus alerting rules for in-process
 * fast-path alerting (before scrape intervals catch up).
 */

import { EventEmitter } from 'eventemitter3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertState = 'ok' | 'pending' | 'firing' | 'resolved';
export type ComparisonOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

/**
 * Definition of a single alert threshold.
 */
export interface AlertThreshold {
  /** Unique identifier for this alert rule. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** The metric name to evaluate. */
  metric: string;
  /** Label matchers (all must match for the rule to apply). */
  labels?: Record<string, string>;
  /** Comparison operator. */
  operator: ComparisonOp;
  /** Threshold value. */
  value: number;
  /** How long the condition must hold before firing (ms). 0 = immediate. */
  forDurationMs: number;
  /** Severity level. */
  severity: AlertSeverity;
  /** Additional annotations attached to fired alerts. */
  annotations?: Record<string, string>;
  /** Whether this rule is enabled. */
  enabled: boolean;
}

/**
 * A fired alert instance.
 */
export interface Alert {
  /** The threshold rule that generated this alert. */
  thresholdId: string;
  /** Current state. */
  state: AlertState;
  /** When the condition was first observed. */
  startsAt: number;
  /** When the alert last changed state. */
  updatedAt: number;
  /** When the alert was resolved (if applicable). */
  endsAt?: number;
  /** The observed value at firing time. */
  value: number;
  /** Severity from the threshold. */
  severity: AlertSeverity;
  /** Labels from the threshold. */
  labels: Record<string, string>;
  /** Annotations from the threshold. */
  annotations: Record<string, string>;
}

/**
 * Configuration for the alert manager.
 */
export interface AlertManagerConfig {
  /** Evaluation interval in milliseconds. */
  evaluationIntervalMs?: number;
  /** Maximum number of active/resolved alerts to retain. */
  maxAlerts?: number;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

interface AlertManagerEvents {
  'alert:firing': (alert: Alert) => void;
  'alert:resolved': (alert: Alert) => void;
  'alert:pending': (alert: Alert) => void;
}

// ---------------------------------------------------------------------------
// AlertManager
// ---------------------------------------------------------------------------

/**
 * Manages alert thresholds and evaluates metric values against them.
 *
 * @example
 * ```ts
 * const alertManager = new AlertManager();
 *
 * alertManager.addThreshold({
 *   id: 'high_error_rate',
 *   name: 'High Error Rate',
 *   metric: 'wundr_model_errors_total',
 *   operator: 'gt',
 *   value: 100,
 *   forDurationMs: 60000,
 *   severity: 'critical',
 *   enabled: true,
 * });
 *
 * alertManager.on('alert:firing', (alert) => {
 *   notifyOpsTeam(alert);
 * });
 *
 * // Push metric values for evaluation
 * alertManager.evaluate('wundr_model_errors_total', 150, {});
 * ```
 */
export class AlertManager extends EventEmitter<AlertManagerEvents> {
  private readonly config: Required<AlertManagerConfig>;
  private readonly thresholds: Map<string, AlertThreshold> = new Map();
  private readonly activeAlerts: Map<string, Alert> = new Map();
  private readonly resolvedAlerts: Alert[] = [];

  /** Tracks when a condition was first observed (for `forDurationMs`). */
  private readonly pendingSince: Map<string, number> = new Map();

  constructor(config?: AlertManagerConfig) {
    super();
    this.config = {
      evaluationIntervalMs: config?.evaluationIntervalMs ?? 15000,
      maxAlerts: config?.maxAlerts ?? 1000,
    };
  }

  // -----------------------------------------------------------------------
  // Threshold Management
  // -----------------------------------------------------------------------

  addThreshold(threshold: AlertThreshold): void {
    this.thresholds.set(threshold.id, threshold);
  }

  removeThreshold(id: string): boolean {
    this.pendingSince.delete(id);
    this.activeAlerts.delete(id);
    return this.thresholds.delete(id);
  }

  updateThreshold(id: string, updates: Partial<AlertThreshold>): boolean {
    const existing = this.thresholds.get(id);
    if (!existing) {
return false;
}
    this.thresholds.set(id, { ...existing, ...updates });
    return true;
  }

  getThreshold(id: string): AlertThreshold | undefined {
    return this.thresholds.get(id);
  }

  getThresholds(): AlertThreshold[] {
    return Array.from(this.thresholds.values());
  }

  // -----------------------------------------------------------------------
  // Evaluation
  // -----------------------------------------------------------------------

  /**
   * Evaluate a metric value against all matching thresholds.
   *
   * @param metricName - The Prometheus metric name.
   * @param value - The observed value.
   * @param labels - The label set for this observation.
   */
  evaluate(
    metricName: string,
    value: number,
    labels: Record<string, string>,
  ): void {
    for (const threshold of this.thresholds.values()) {
      if (!threshold.enabled) {
continue;
}
      if (threshold.metric !== metricName) {
continue;
}
      if (!this.labelsMatch(threshold.labels, labels)) {
continue;
}

      const conditionMet = this.compareValue(value, threshold.operator, threshold.value);

      if (conditionMet) {
        this.handleConditionMet(threshold, value, labels);
      } else {
        this.handleConditionCleared(threshold);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Alert Queries
  // -----------------------------------------------------------------------

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  getResolvedAlerts(limit: number = 50): Alert[] {
    return this.resolvedAlerts.slice(-limit);
  }

  getAlertsByState(state: AlertState): Alert[] {
    if (state === 'resolved') {
return this.getResolvedAlerts();
}
    return this.getActiveAlerts().filter((a) => a.state === state);
  }

  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.getActiveAlerts().filter((a) => a.severity === severity);
  }

  /**
   * Return a summary suitable for dashboard display.
   */
  getSummary(): {
    total: number;
    firing: number;
    pending: number;
    resolved: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const active = this.getActiveAlerts();
    const bySeverity: Record<AlertSeverity, number> = { info: 0, warning: 0, critical: 0 };

    let firing = 0;
    let pending = 0;

    for (const alert of active) {
      bySeverity[alert.severity]++;
      if (alert.state === 'firing') {
firing++;
}
      if (alert.state === 'pending') {
pending++;
}
    }

    return {
      total: active.length,
      firing,
      pending,
      resolved: this.resolvedAlerts.length,
      bySeverity,
    };
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /**
   * Clear all alerts and pending states.
   */
  clear(): void {
    this.activeAlerts.clear();
    this.resolvedAlerts.length = 0;
    this.pendingSince.clear();
  }

  destroy(): void {
    this.clear();
    this.removeAllListeners();
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private labelsMatch(
    required: Record<string, string> | undefined,
    actual: Record<string, string>,
  ): boolean {
    if (!required) {
return true;
}
    for (const [key, val] of Object.entries(required)) {
      if (actual[key] !== val) {
return false;
}
    }
    return true;
  }

  private compareValue(observed: number, op: ComparisonOp, threshold: number): boolean {
    switch (op) {
      case 'gt':  return observed > threshold;
      case 'gte': return observed >= threshold;
      case 'lt':  return observed < threshold;
      case 'lte': return observed <= threshold;
      case 'eq':  return observed === threshold;
      case 'neq': return observed !== threshold;
    }
  }

  private handleConditionMet(
    threshold: AlertThreshold,
    value: number,
    labels: Record<string, string>,
  ): void {
    const now = Date.now();
    const existingAlert = this.activeAlerts.get(threshold.id);

    if (existingAlert && existingAlert.state === 'firing') {
      // Already firing -- update value.
      existingAlert.value = value;
      existingAlert.updatedAt = now;
      return;
    }

    // Track pending state.
    if (!this.pendingSince.has(threshold.id)) {
      this.pendingSince.set(threshold.id, now);
    }

    const pendingStart = this.pendingSince.get(threshold.id)!;
    const elapsed = now - pendingStart;

    if (elapsed >= threshold.forDurationMs) {
      // Transition to firing.
      const alert: Alert = {
        thresholdId: threshold.id,
        state: 'firing',
        startsAt: pendingStart,
        updatedAt: now,
        value,
        severity: threshold.severity,
        labels: { ...labels, ...(threshold.labels ?? {}) },
        annotations: { ...(threshold.annotations ?? {}) },
      };

      this.activeAlerts.set(threshold.id, alert);
      this.pendingSince.delete(threshold.id);
      this.emit('alert:firing', alert);
    } else {
      // Still pending.
      const alert: Alert = {
        thresholdId: threshold.id,
        state: 'pending',
        startsAt: pendingStart,
        updatedAt: now,
        value,
        severity: threshold.severity,
        labels: { ...labels, ...(threshold.labels ?? {}) },
        annotations: { ...(threshold.annotations ?? {}) },
      };

      this.activeAlerts.set(threshold.id, alert);
      this.emit('alert:pending', alert);
    }
  }

  private handleConditionCleared(threshold: AlertThreshold): void {
    this.pendingSince.delete(threshold.id);

    const existingAlert = this.activeAlerts.get(threshold.id);
    if (!existingAlert) {
return;
}

    const now = Date.now();
    existingAlert.state = 'resolved';
    existingAlert.endsAt = now;
    existingAlert.updatedAt = now;

    this.activeAlerts.delete(threshold.id);
    this.resolvedAlerts.push(existingAlert);

    // Trim resolved history.
    while (this.resolvedAlerts.length > this.config.maxAlerts) {
      this.resolvedAlerts.shift();
    }

    this.emit('alert:resolved', existingAlert);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAlertManager(config?: AlertManagerConfig): AlertManager {
  return new AlertManager(config);
}
