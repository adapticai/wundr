import { EventEmitter } from 'events';
import * as os from 'os';
import { logger } from '../utils/logger';

export interface SecurityMetrics {
  timestamp: Date;
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkConnections: number;
    uptime: number;
  };
  security: {
    activeUsers: number;
    failedLogins: number;
    successfulLogins: number;
    privilegeEscalations: number;
    suspiciousActivities: number;
    blockedRequests: number;
    vulnerabilitiesDetected: number;
    secretsFound: number;
  };
  performance: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    cacheHitRate: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMs: number;
  actions: AlertAction[];
  metadata?: Record<string, unknown>;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty' | 'custom';
  configuration: Record<string, unknown>;
  enabled: boolean;
}

export interface SecurityAlert {
  id: string;
  ruleId: string;
  timestamp: Date;
  severity: AlertRule['severity'];
  title: string;
  description: string;
  metrics: Partial<SecurityMetrics>;
  status: 'open' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface MonitoringOptions {
  metricsCollectionIntervalMs?: number;
  alertEvaluationIntervalMs?: number;
  metricsRetentionMs?: number;
  enableSystemMetrics?: boolean;
  enableSecurityMetrics?: boolean;
  enablePerformanceMetrics?: boolean;
}

export class SecurityMonitor extends EventEmitter {
  private metrics: SecurityMetrics[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, SecurityAlert> = new Map();
  private alertCooldowns: Map<string, number> = new Map();
  private metricsCollectionTimer?: ReturnType<typeof setInterval>;
  private alertEvaluationTimer?: ReturnType<typeof setInterval>;
  private options: Required<MonitoringOptions>;
  
  // Counters for security metrics
  private securityCounters = {
    activeUsers: new Set<string>(),
    failedLogins: 0,
    successfulLogins: 0,
    privilegeEscalations: 0,
    suspiciousActivities: 0,
    blockedRequests: 0,
    vulnerabilitiesDetected: 0,
    secretsFound: 0
  };

  // Performance tracking
  private performanceData = {
    responseTimesMs: [] as number[],
    requestCount: 0,
    errorCount: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(options: MonitoringOptions = {}) {
    super();
    this.options = {
      metricsCollectionIntervalMs: options.metricsCollectionIntervalMs || 60000, // 1 minute
      alertEvaluationIntervalMs: options.alertEvaluationIntervalMs || 30000, // 30 seconds
      metricsRetentionMs: options.metricsRetentionMs || 24 * 60 * 60 * 1000, // 24 hours
      enableSystemMetrics: options.enableSystemMetrics ?? true,
      enableSecurityMetrics: options.enableSecurityMetrics ?? true,
      enablePerformanceMetrics: options.enablePerformanceMetrics ?? true
    };

    this.initializeDefaultAlertRules();
    this.startMonitoring();
  }

  /**
   * Start monitoring and metric collection
   */
  startMonitoring(): void {
    // Start metrics collection
    this.metricsCollectionTimer = setInterval(() => {
      this.collectMetrics();
    }, this.options.metricsCollectionIntervalMs);

    // Start alert evaluation
    this.alertEvaluationTimer = setInterval(() => {
      this.evaluateAlerts();
    }, this.options.alertEvaluationIntervalMs);

    logger.info('Security monitoring started');
    this.emit('monitoring:started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.metricsCollectionTimer) {
      clearInterval(this.metricsCollectionTimer);
      this.metricsCollectionTimer = undefined;
    }

    if (this.alertEvaluationTimer) {
      clearInterval(this.alertEvaluationTimer);
      this.alertEvaluationTimer = undefined;
    }

    logger.info('Security monitoring stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Record security event
   */
  recordSecurityEvent(event: string, metadata?: Record<string, unknown>): void {
    switch (event) {
      case 'login:success':
        this.securityCounters.successfulLogins++;
        if (metadata?.userId) {
          this.securityCounters.activeUsers.add(metadata.userId);
        }
        break;
      case 'login:failed':
        this.securityCounters.failedLogins++;
        break;
      case 'privilege:escalation':
        this.securityCounters.privilegeEscalations++;
        break;
      case 'suspicious:activity':
        this.securityCounters.suspiciousActivities++;
        break;
      case 'request:blocked':
        this.securityCounters.blockedRequests++;
        break;
      case 'vulnerability:detected':
        this.securityCounters.vulnerabilitiesDetected++;
        break;
      case 'secret:found':
        this.securityCounters.secretsFound++;
        break;
      case 'user:logout':
        if (metadata?.userId) {
          this.securityCounters.activeUsers.delete(metadata.userId);
        }
        break;
    }

    this.emit('security:event', { event, metadata, timestamp: new Date() });
  }

  /**
   * Record performance data
   */
  recordPerformanceData(type: string, value: number, metadata?: Record<string, unknown>): void {
    switch (type) {
      case 'response_time':
        this.performanceData.responseTimesMs.push(value);
        // Keep only last 1000 measurements
        if (this.performanceData.responseTimesMs.length > 1000) {
          this.performanceData.responseTimesMs = this.performanceData.responseTimesMs.slice(-1000);
        }
        break;
      case 'request':
        this.performanceData.requestCount++;
        break;
      case 'error':
        this.performanceData.errorCount++;
        break;
      case 'cache_hit':
        this.performanceData.cacheHits++;
        break;
      case 'cache_miss':
        this.performanceData.cacheMisses++;
        break;
    }

    this.emit('performance:data', { type, value, metadata, timestamp: new Date() });
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): SecurityMetrics {
    return this.buildCurrentMetrics();
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(startTime: Date, endTime: Date): SecurityMetrics[] {
    return this.metrics.filter(metric => 
      metric.timestamp >= startTime && metric.timestamp <= endTime
    );
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.emit('alert:rule-added', rule);
    logger.info(`Added alert rule: ${rule.name}`);
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      this.alertRules.delete(ruleId);
      this.emit('alert:rule-removed', rule);
      logger.info(`Removed alert rule: ${rule.name}`);
    }
  }

  /**
   * Update alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      const updatedRule = { ...rule, ...updates };
      this.alertRules.set(ruleId, updatedRule);
      this.emit('alert:rule-updated', updatedRule);
      logger.info(`Updated alert rule: ${updatedRule.name}`);
    }
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert && alert.status === 'open') {
      alert.status = 'acknowledged';
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      
      this.emit('alert:acknowledged', alert);
      logger.info(`Alert acknowledged: ${alert.title} by ${acknowledgedBy}`);
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolvedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date();
      
      this.activeAlerts.delete(alertId);
      this.emit('alert:resolved', alert);
      logger.info(`Alert resolved: ${alert.title} by ${resolvedBy}`);
    }
  }

  /**
   * Generate monitoring report
   */
  generateMonitoringReport(startTime: Date, endTime: Date): {
    period: { start: Date; end: Date };
    metrics: {
      summary: SecurityMetrics;
      history: SecurityMetrics[];
      trends: Record<string, number>;
    };
    alerts: {
      total: number;
      byCategory: Record<string, number>;
      bySeverity: Record<string, number>;
      resolved: number;
      open: number;
    };
    recommendations: string[];
  } {
    const history = this.getMetricsHistory(startTime, endTime);
    const summary = history.length > 0 ? history[history.length - 1] : this.getCurrentMetrics();
    
    // Calculate trends (simplified)
    const trends = this.calculateTrends(history);
    
    // Alert statistics
    const allAlerts = this.getAllAlerts(startTime, endTime);
    const alertStats = this.calculateAlertStatistics(allAlerts);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, allAlerts);

    return {
      period: { start: startTime, end: endTime },
      metrics: {
        summary,
        history,
        trends
      },
      alerts: alertStats,
      recommendations
    };
  }

  /**
   * Export monitoring data
   */
  exportMonitoringData(format: 'json' | 'csv', startTime: Date, endTime: Date): string {
    const data = this.generateMonitoringReport(startTime, endTime);
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data.metrics.history);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private collectMetrics(): void {
    try {
      const metrics = this.buildCurrentMetrics();
      this.metrics.push(metrics);
      
      // Clean up old metrics
      const cutoff = new Date(Date.now() - this.options.metricsRetentionMs);
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
      
      this.emit('metrics:collected', metrics);
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
    }
  }

  private buildCurrentMetrics(): SecurityMetrics {
    const now = new Date();
    
    // System metrics
    let systemMetrics = {
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      networkConnections: 0,
      uptime: 0
    };
    
    if (this.options.enableSystemMetrics) {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      
      systemMetrics = {
        cpuUsage: os.loadavg()[0], // 1-minute load average as proxy
        memoryUsage: ((totalMem - freeMem) / totalMem) * 100,
        diskUsage: 0, // Would need additional disk space check
        networkConnections: 0, // Would need netstat or similar
        uptime: os.uptime()
      };
    }
    
    // Security metrics
    let securityMetrics = {
      activeUsers: 0,
      failedLogins: 0,
      successfulLogins: 0,
      privilegeEscalations: 0,
      suspiciousActivities: 0,
      blockedRequests: 0,
      vulnerabilitiesDetected: 0,
      secretsFound: 0
    };
    
    if (this.options.enableSecurityMetrics) {
      securityMetrics = {
        activeUsers: this.securityCounters.activeUsers.size,
        failedLogins: this.securityCounters.failedLogins,
        successfulLogins: this.securityCounters.successfulLogins,
        privilegeEscalations: this.securityCounters.privilegeEscalations,
        suspiciousActivities: this.securityCounters.suspiciousActivities,
        blockedRequests: this.securityCounters.blockedRequests,
        vulnerabilitiesDetected: this.securityCounters.vulnerabilitiesDetected,
        secretsFound: this.securityCounters.secretsFound
      };
    }
    
    // Performance metrics
    let performanceMetrics = {
      responseTime: 0,
      throughput: 0,
      errorRate: 0,
      cacheHitRate: 0
    };
    
    if (this.options.enablePerformanceMetrics) {
      const avgResponseTime = this.performanceData.responseTimesMs.length > 0
        ? this.performanceData.responseTimesMs.reduce((a, b) => a + b, 0) / this.performanceData.responseTimesMs.length
        : 0;
        
      const totalRequests = this.performanceData.requestCount;
      const totalCacheRequests = this.performanceData.cacheHits + this.performanceData.cacheMisses;
      
      performanceMetrics = {
        responseTime: avgResponseTime,
        throughput: totalRequests,
        errorRate: totalRequests > 0 ? (this.performanceData.errorCount / totalRequests) * 100 : 0,
        cacheHitRate: totalCacheRequests > 0 ? (this.performanceData.cacheHits / totalCacheRequests) * 100 : 0
      };
    }
    
    return {
      timestamp: now,
      system: systemMetrics,
      security: securityMetrics,
      performance: performanceMetrics
    };
  }

  private evaluateAlerts(): void {
    const currentMetrics = this.getCurrentMetrics();
    
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      // Check cooldown
      const lastAlert = this.alertCooldowns.get(rule.id);
      if (lastAlert && (Date.now() - lastAlert) < rule.cooldownMs) {
        continue;
      }
      
      if (this.evaluateAlertCondition(rule, currentMetrics)) {
        this.triggerAlert(rule, currentMetrics);
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, metrics: SecurityMetrics): boolean {
    try {
      // Simple condition evaluation (in production, use a proper expression parser)
      const condition = rule.condition.toLowerCase();
      
      if (condition.includes('failed_logins >')) {
        const threshold = parseInt(condition.split('>')[1].trim());
        return metrics.security.failedLogins > threshold;
      }
      
      if (condition.includes('privilege_escalation >')) {
        const threshold = parseInt(condition.split('>')[1].trim());
        return metrics.security.privilegeEscalations > threshold;
      }
      
      if (condition.includes('suspicious_activities >')) {
        const threshold = parseInt(condition.split('>')[1].trim());
        return metrics.security.suspiciousActivities > threshold;
      }
      
      if (condition.includes('response_time >')) {
        const threshold = parseInt(condition.split('>')[1].trim());
        return metrics.performance.responseTime > threshold;
      }
      
      if (condition.includes('error_rate >')) {
        const threshold = parseInt(condition.split('>')[1].trim());
        return metrics.performance.errorRate > threshold;
      }
      
      if (condition.includes('cpu_usage >')) {
        const threshold = parseInt(condition.split('>')[1].trim());
        return metrics.system.cpuUsage > threshold;
      }
      
      if (condition.includes('memory_usage >')) {
        const threshold = parseInt(condition.split('>')[1].trim());
        return metrics.system.memoryUsage > threshold;
      }
      
      return false;
    } catch (error) {
      logger.warn(`Failed to evaluate alert condition for rule ${rule.id}:`, error);
      return false;
    }
  }

  private triggerAlert(rule: AlertRule, metrics: SecurityMetrics): void {
    const alertId = `${rule.id}_${Date.now()}`;
    
    const alert: SecurityAlert = {
      id: alertId,
      ruleId: rule.id,
      timestamp: new Date(),
      severity: rule.severity,
      title: rule.name,
      description: rule.description,
      metrics: metrics,
      status: 'open'
    };
    
    this.activeAlerts.set(alertId, alert);
    this.alertCooldowns.set(rule.id, Date.now());
    
    // Execute alert actions
    this.executeAlertActions(rule, alert);
    
    this.emit('alert:triggered', alert);
    logger.warn(`Security alert triggered: ${alert.title}`, { 
      alertId,
      severity: alert.severity,
      ruleId: rule.id 
    });
  }

  private async executeAlertActions(rule: AlertRule, alert: SecurityAlert): Promise<void> {
    for (const action of rule.actions) {
      if (!action.enabled) continue;
      
      try {
        switch (action.type) {
          case 'email':
            await this.sendEmailAlert(action.configuration, alert);
            break;
          case 'webhook':
            await this.sendWebhookAlert(action.configuration, alert);
            break;
          case 'slack':
            await this.sendSlackAlert(action.configuration, alert);
            break;
          case 'custom':
            await this.executeCustomAction(action.configuration, alert);
            break;
        }
      } catch (error) {
        logger.error(`Failed to execute alert action ${action.type}:`, error);
      }
    }
  }

  private async sendEmailAlert(config: Record<string, unknown>, alert: SecurityAlert): Promise<void> {
    // Mock email implementation
    logger.info(`Would send email alert to ${config.recipients}:`, {
      subject: `Security Alert: ${alert.title}`,
      body: alert.description
    });
  }

  private async sendWebhookAlert(config: Record<string, unknown>, alert: SecurityAlert): Promise<void> {
    // Mock webhook implementation
    logger.info(`Would send webhook to ${config.url}:`, alert);
  }

  private async sendSlackAlert(config: Record<string, unknown>, alert: SecurityAlert): Promise<void> {
    // Mock Slack implementation
    logger.info(`Would send Slack message to ${config.channel}:`, alert.title);
  }

  private async executeCustomAction(config: Record<string, unknown>, _alert: SecurityAlert): Promise<void> {
    // Execute custom action based on configuration
    logger.info('Executing custom alert action:', config);
  }

  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-failed-logins',
        name: 'High Failed Login Attempts',
        description: 'Detected unusually high number of failed login attempts',
        condition: 'failed_logins > 10',
        threshold: 10,
        severity: 'high',
        enabled: true,
        cooldownMs: 300000, // 5 minutes
        actions: [
          {
            type: 'webhook',
            configuration: { url: '/security/alerts/failed-logins' },
            enabled: true
          }
        ]
      },
      {
        id: 'privilege-escalation',
        name: 'Privilege Escalation Detected',
        description: 'Detected privilege escalation attempt',
        condition: 'privilege_escalation > 0',
        threshold: 1,
        severity: 'critical',
        enabled: true,
        cooldownMs: 0, // No cooldown for critical alerts
        actions: [
          {
            type: 'email',
            configuration: { recipients: ['security@company.com'] },
            enabled: true
          },
          {
            type: 'webhook',
            configuration: { url: '/security/alerts/privilege-escalation' },
            enabled: true
          }
        ]
      },
      {
        id: 'high-cpu-usage',
        name: 'High CPU Usage',
        description: 'System CPU usage is above threshold',
        condition: 'cpu_usage > 80',
        threshold: 80,
        severity: 'medium',
        enabled: true,
        cooldownMs: 600000, // 10 minutes
        actions: [
          {
            type: 'webhook',
            configuration: { url: '/system/alerts/high-cpu' },
            enabled: true
          }
        ]
      },
      {
        id: 'high-response-time',
        name: 'High Response Time',
        description: 'Application response time is above threshold',
        condition: 'response_time > 5000',
        threshold: 5000,
        severity: 'medium',
        enabled: true,
        cooldownMs: 300000, // 5 minutes
        actions: [
          {
            type: 'webhook',
            configuration: { url: '/performance/alerts/slow-response' },
            enabled: true
          }
        ]
      }
    ];

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule);
    }
  }

  private calculateTrends(history: SecurityMetrics[]): Record<string, number> {
    if (history.length < 2) return {};
    
    const latest = history[history.length - 1];
    const previous = history[history.length - 2];
    
    return {
      failedLoginsChange: latest.security.failedLogins - previous.security.failedLogins,
      responseTimeChange: latest.performance.responseTime - previous.performance.responseTime,
      cpuUsageChange: latest.system.cpuUsage - previous.system.cpuUsage,
      memoryUsageChange: latest.system.memoryUsage - previous.system.memoryUsage
    };
  }

  private getAllAlerts(startTime: Date, endTime: Date): SecurityAlert[] {
    // In a real implementation, this would query stored alerts
    // For now, return current active alerts within the time range
    return Array.from(this.activeAlerts.values()).filter(
      alert => alert.timestamp >= startTime && alert.timestamp <= endTime
    );
  }

  private calculateAlertStatistics(alerts: SecurityAlert[]) {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let resolved = 0;
    let open = 0;
    
    for (const alert of alerts) {
      // Group by rule name as category
      const category = alert.title.split(' ')[0].toLowerCase();
      byCategory[category] = (byCategory[category] || 0) + 1;
      
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      
      if (alert.status === 'resolved') {
        resolved++;
      } else {
        open++;
      }
    }
    
    return {
      total: alerts.length,
      byCategory,
      bySeverity,
      resolved,
      open
    };
  }

  private generateRecommendations(metrics: SecurityMetrics, alerts: SecurityAlert[]): string[] {
    const recommendations: string[] = [];
    
    // Security recommendations
    if (metrics.security.failedLogins > 5) {
      recommendations.push('Consider implementing account lockout policies to prevent brute force attacks');
    }
    
    if (metrics.security.privilegeEscalations > 0) {
      recommendations.push('Review and audit privilege escalation events immediately');
    }
    
    if (metrics.security.vulnerabilitiesDetected > 0) {
      recommendations.push('Address detected vulnerabilities by updating dependencies');
    }
    
    // Performance recommendations
    if (metrics.performance.responseTime > 1000) {
      recommendations.push('Investigate slow response times and optimize application performance');
    }
    
    if (metrics.performance.errorRate > 5) {
      recommendations.push('High error rate detected - review application logs and fix issues');
    }
    
    // System recommendations
    if (metrics.system.memoryUsage > 80) {
      recommendations.push('High memory usage detected - consider scaling resources');
    }
    
    if (metrics.system.cpuUsage > 80) {
      recommendations.push('High CPU usage detected - optimize code or scale resources');
    }
    
    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('Address critical security alerts immediately');
    }
    
    return recommendations;
  }

  private convertToCSV(metrics: SecurityMetrics[]): string {
    if (metrics.length === 0) return '';
    
    const headers = [
      'timestamp',
      'cpu_usage',
      'memory_usage',
      'active_users',
      'failed_logins',
      'successful_logins',
      'response_time',
      'error_rate'
    ];
    
    const rows = metrics.map(m => [
      m.timestamp.toISOString(),
      m.system.cpuUsage,
      m.system.memoryUsage,
      m.security.activeUsers,
      m.security.failedLogins,
      m.security.successfulLogins,
      m.performance.responseTime,
      m.performance.errorRate
    ]);
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopMonitoring();
    this.removeAllListeners();
    
    // Clear data structures
    this.metrics = [];
    this.alertRules.clear();
    this.activeAlerts.clear();
    this.alertCooldowns.clear();
    
    logger.info('Security monitor cleanup completed');
  }
}