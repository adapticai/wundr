import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  resourceType: 'user' | 'file' | 'system' | 'database' | 'api' | 'configuration';
  outcome: 'success' | 'failure' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: {
    ip?: string;
    userAgent?: string;
    application?: string;
    service?: string;
  };
  details: Record<string, any>;
  metadata?: {
    correlationId?: string;
    tags?: string[];
    customFields?: Record<string, any>;
  };
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  resourceType?: AuditEvent['resourceType'];
  outcome?: AuditEvent['outcome'];
  severity?: AuditEvent['severity'];
  limit?: number;
  offset?: number;
}

export interface AuditReport {
  period: { start: Date; end: Date };
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByUser: Record<string, number>;
  eventsByOutcome: Record<string, number>;
  criticalEvents: AuditEvent[];
  anomalies: AuditAnomaly[];
  summary: string;
}

export interface AuditAnomaly {
  type: 'unusual_activity' | 'failed_attempts' | 'privilege_escalation' | 'data_access';
  description: string;
  events: AuditEvent[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export interface AuditStorage {
  store(event: AuditEvent): Promise<void>;
  query(query: AuditQuery): Promise<AuditEvent[]>;
  count(query: AuditQuery): Promise<number>;
  purge(olderThan: Date): Promise<number>;
}

export class FileAuditStorage implements AuditStorage {
  private storageDir: string;
  
  constructor(storageDir: string) {
    this.storageDir = storageDir;
  }

  async store(event: AuditEvent): Promise<void> {
    const dateStr = event.timestamp.toISOString().split('T')[0];
    const filePath = path.join(this.storageDir, `audit-${dateStr}.jsonl`);
    
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, JSON.stringify(event) + '\n');
  }

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    const events: AuditEvent[] = [];
    const files = await this.getRelevantFiles(query.startDate, query.endDate);
    
    for (const file of files) {
      const fileEvents = await this.readEventsFromFile(file, query);
      events.push(...fileEvents);
    }
    
    // Apply sorting and pagination
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (query.offset) {
      events.splice(0, query.offset);
    }
    
    if (query.limit) {
      events.splice(query.limit);
    }
    
    return events;
  }

  async count(query: AuditQuery): Promise<number> {
    const events = await this.query({ ...query, limit: undefined, offset: undefined });
    return events.length;
  }

  async purge(olderThan: Date): Promise<number> {
    const files = await fs.readdir(this.storageDir);
    let purgedCount = 0;
    
    for (const file of files) {
      if (file.startsWith('audit-') && file.endsWith('.jsonl')) {
        const dateMatch = file.match(/audit-(\d{4}-\d{2}-\d{2})\.jsonl/);
        if (dateMatch) {
          const fileDate = new Date(dateMatch[1]);
          if (fileDate < olderThan) {
            const filePath = path.join(this.storageDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const eventCount = content.split('\n').filter(line => line.trim()).length;
            await fs.unlink(filePath);
            purgedCount += eventCount;
          }
        }
      }
    }
    
    return purgedCount;
  }

  private async getRelevantFiles(startDate?: Date, endDate?: Date): Promise<string[]> {
    const files = await fs.readdir(this.storageDir);
    const auditFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.jsonl'));
    
    if (!startDate && !endDate) {
      return auditFiles.map(file => path.join(this.storageDir, file));
    }
    
    return auditFiles
      .filter(file => {
        const dateMatch = file.match(/audit-(\d{4}-\d{2}-\d{2})\.jsonl/);
        if (!dateMatch) return false;
        
        const fileDate = new Date(dateMatch[1]);
        if (startDate && fileDate < startDate) return false;
        if (endDate && fileDate > endDate) return false;
        
        return true;
      })
      .map(file => path.join(this.storageDir, file));
  }

  private async readEventsFromFile(filePath: string, query: AuditQuery): Promise<AuditEvent[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      const events: AuditEvent[] = [];
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          event.timestamp = new Date(event.timestamp);
          
          if (this.matchesQuery(event, query)) {
            events.push(event);
          }
        } catch (parseError) {
          logger.warn(`Failed to parse audit event from ${filePath}:`, parseError);
        }
      }
      
      return events;
    } catch (error) {
      logger.warn(`Failed to read audit file ${filePath}:`, error);
      return [];
    }
  }

  private matchesQuery(event: AuditEvent, query: AuditQuery): boolean {
    if (query.startDate && event.timestamp < query.startDate) return false;
    if (query.endDate && event.timestamp > query.endDate) return false;
    if (query.userId && event.userId !== query.userId) return false;
    if (query.action && !event.action.includes(query.action)) return false;
    if (query.resourceType && event.resourceType !== query.resourceType) return false;
    if (query.outcome && event.outcome !== query.outcome) return false;
    if (query.severity && event.severity !== query.severity) return false;
    
    return true;
  }
}

export class AuditLogger extends EventEmitter {
  private storage: AuditStorage;
  private eventBuffer: AuditEvent[] = [];
  private bufferSize: number = 100;
  private flushInterval: ReturnType<typeof setInterval>;
  private anomalyDetector: AnomalyDetector;

  constructor(storage: AuditStorage, options: { bufferSize?: number; flushIntervalMs?: number } = {}) {
    super();
    this.storage = storage;
    this.bufferSize = options.bufferSize || 100;
    this.anomalyDetector = new AnomalyDetector();
    
    // Setup periodic flushing
    const flushIntervalMs = options.flushIntervalMs || 5000; // 5 seconds
    this.flushInterval = setInterval(() => {
      this.flush().catch(error => {
        logger.error('Failed to flush audit events:', error);
      });
    }, flushIntervalMs);
  }

  /**
   * Log an audit event
   */
  async logEvent(eventData: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...eventData
    };

    // Add to buffer
    this.eventBuffer.push(event);

    // Check for anomalies
    const anomalies = await this.anomalyDetector.detectAnomalies([event]);
    if (anomalies.length > 0) {
      this.emit('anomaly:detected', anomalies);
    }

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.bufferSize) {
      await this.flush();
    }

    this.emit('event:logged', event);
  }

  /**
   * Convenience methods for common events
   */
  async logLogin(userId: string, success: boolean, source: AuditEvent['source'], details: Record<string, any> = {}): Promise<void> {
    await this.logEvent({
      userId,
      action: 'user.login',
      resource: `user:${userId}`,
      resourceType: 'user',
      outcome: success ? 'success' : 'failure',
      severity: success ? 'low' : 'medium',
      source,
      details
    });
  }

  async logLogout(userId: string, source: AuditEvent['source']): Promise<void> {
    await this.logEvent({
      userId,
      action: 'user.logout',
      resource: `user:${userId}`,
      resourceType: 'user',
      outcome: 'success',
      severity: 'low',
      source,
      details: {}
    });
  }

  async logFileAccess(userId: string, filePath: string, action: string, success: boolean, source: AuditEvent['source']): Promise<void> {
    await this.logEvent({
      userId,
      action: `file.${action}`,
      resource: filePath,
      resourceType: 'file',
      outcome: success ? 'success' : 'failure',
      severity: success ? 'low' : 'medium',
      source,
      details: { filePath, action }
    });
  }

  async logPrivilegeChange(userId: string, targetUserId: string, oldRoles: string[], newRoles: string[], source: AuditEvent['source']): Promise<void> {
    await this.logEvent({
      userId,
      action: 'user.privilege_change',
      resource: `user:${targetUserId}`,
      resourceType: 'user',
      outcome: 'success',
      severity: 'high',
      source,
      details: {
        targetUserId,
        oldRoles,
        newRoles,
        rolesAdded: newRoles.filter(role => !oldRoles.includes(role)),
        rolesRemoved: oldRoles.filter(role => !newRoles.includes(role))
      }
    });
  }

  async logDataAccess(userId: string, resource: string, action: string, success: boolean, source: AuditEvent['source'], sensitiveData?: boolean): Promise<void> {
    await this.logEvent({
      userId,
      action: `data.${action}`,
      resource,
      resourceType: 'database',
      outcome: success ? 'success' : 'failure',
      severity: sensitiveData ? 'high' : 'medium',
      source,
      details: { sensitiveData, action }
    });
  }

  async logSecurityEvent(action: string, resource: string, severity: AuditEvent['severity'], source: AuditEvent['source'], details: Record<string, any>): Promise<void> {
    await this.logEvent({
      action: `security.${action}`,
      resource,
      resourceType: 'system',
      outcome: 'unknown',
      severity,
      source,
      details
    });
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery): Promise<AuditEvent[]> {
    // Ensure buffered events are stored first
    await this.flush();
    return this.storage.query(query);
  }

  /**
   * Generate audit report
   */
  async generateReport(startDate: Date, endDate: Date): Promise<AuditReport> {
    const events = await this.queryEvents({ startDate, endDate });
    
    const eventsByType = this.groupBy(events, 'action');
    const eventsByUser = this.groupBy(events.filter(e => e.userId), 'userId');
    const eventsByOutcome = this.groupBy(events, 'outcome');
    
    const criticalEvents = events.filter(e => e.severity === 'critical');
    const anomalies = await this.anomalyDetector.detectAnomalies(events);

    return {
      period: { start: startDate, end: endDate },
      totalEvents: events.length,
      eventsByType,
      eventsByUser,
      eventsByOutcome,
      criticalEvents,
      anomalies,
      summary: this.generateSummary(events, anomalies)
    };
  }

  /**
   * Export audit trail
   */
  async exportAuditTrail(startDate: Date, endDate: Date, format: 'json' | 'csv' | 'html'): Promise<string> {
    const events = await this.queryEvents({ startDate, endDate });
    
    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);
      case 'csv':
        return this.exportToCsv(events);
      case 'html':
        return this.exportToHtml(events);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Purge old audit logs
   */
  async purgeOldLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    return this.storage.purge(cutoffDate);
  }

  /**
   * Flush buffered events to storage
   */
  private async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const eventsToFlush = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      await Promise.all(eventsToFlush.map(event => this.storage.store(event)));
      this.emit('events:flushed', eventsToFlush.length);
    } catch (error) {
      // Return events to buffer if storage fails
      this.eventBuffer.unshift(...eventsToFlush);
      throw error;
    }
  }

  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(6).toString('hex');
    return `${timestamp}-${random}`;
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    const result: Record<string, number> = {};
    
    for (const item of array) {
      const value = String(item[key]);
      result[value] = (result[value] || 0) + 1;
    }
    
    return result;
  }

  private generateSummary(events: AuditEvent[], anomalies: AuditAnomaly[]): string {
    const totalEvents = events.length;
    const criticalEvents = events.filter(e => e.severity === 'critical').length;
    const failedEvents = events.filter(e => e.outcome === 'failure').length;
    const uniqueUsers = new Set(events.filter(e => e.userId).map(e => e.userId)).size;

    let summary = `Audit report covering ${totalEvents} events from ${uniqueUsers} unique users. `;
    
    if (criticalEvents > 0) {
      summary += `${criticalEvents} critical events detected. `;
    }
    
    if (failedEvents > 0) {
      summary += `${failedEvents} failed operations recorded. `;
    }
    
    if (anomalies.length > 0) {
      summary += `${anomalies.length} security anomalies identified requiring attention.`;
    }

    return summary;
  }

  private exportToCsv(events: AuditEvent[]): string {
    const headers = ['ID', 'Timestamp', 'User ID', 'Action', 'Resource', 'Resource Type', 'Outcome', 'Severity', 'Source IP'];
    const rows = [headers.join(',')];

    for (const event of events) {
      const row = [
        event.id,
        event.timestamp.toISOString(),
        event.userId || '',
        event.action,
        `"${event.resource}"`,
        event.resourceType,
        event.outcome,
        event.severity,
        event.source.ip || ''
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  private exportToHtml(events: AuditEvent[]): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Audit Trail Export</title>
    <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .critical { background-color: #ffebee; }
        .high { background-color: #fff3e0; }
    </style>
</head>
<body>
    <h1>Audit Trail Export</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Total Events: ${events.length}</p>
    
    <table>
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Outcome</th>
                <th>Severity</th>
            </tr>
        </thead>
        <tbody>
            ${events.map(event => `
                <tr class="${event.severity}">
                    <td>${event.timestamp.toISOString()}</td>
                    <td>${event.userId || 'System'}</td>
                    <td>${event.action}</td>
                    <td>${event.resource}</td>
                    <td>${event.outcome}</td>
                    <td>${event.severity}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    await this.flush();
    this.removeAllListeners();
  }
}

class AnomalyDetector {
  async detectAnomalies(events: AuditEvent[]): Promise<AuditAnomaly[]> {
    const anomalies: AuditAnomaly[] = [];
    
    // Detect unusual login patterns
    const loginAnomalies = this.detectLoginAnomalies(events);
    anomalies.push(...loginAnomalies);
    
    // Detect privilege escalation attempts
    const privilegeAnomalies = this.detectPrivilegeAnomalies(events);
    anomalies.push(...privilegeAnomalies);
    
    // Detect unusual data access patterns
    const dataAccessAnomalies = this.detectDataAccessAnomalies(events);
    anomalies.push(...dataAccessAnomalies);
    
    return anomalies;
  }

  private detectLoginAnomalies(events: AuditEvent[]): AuditAnomaly[] {
    const anomalies: AuditAnomaly[] = [];
    const loginEvents = events.filter(e => e.action === 'user.login');
    
    // Group by user and check for excessive failed attempts
    const userFailures = new Map<string, AuditEvent[]>();
    
    for (const event of loginEvents) {
      if (event.outcome === 'failure' && event.userId) {
        const failures = userFailures.get(event.userId) || [];
        failures.push(event);
        userFailures.set(event.userId, failures);
      }
    }
    
    for (const [userId, failures] of userFailures) {
      if (failures.length >= 5) { // 5+ failed attempts
        anomalies.push({
          type: 'failed_attempts',
          description: `User ${userId} had ${failures.length} failed login attempts`,
          events: failures,
          riskLevel: failures.length >= 10 ? 'critical' : 'high',
          recommendation: 'Investigate potential brute force attack and consider account lockout'
        });
      }
    }
    
    return anomalies;
  }

  private detectPrivilegeAnomalies(events: AuditEvent[]): AuditAnomaly[] {
    const anomalies: AuditAnomaly[] = [];
    const privilegeEvents = events.filter(e => e.action === 'user.privilege_change');
    
    // Check for rapid privilege escalations
    const recentEscalations = privilegeEvents.filter(e => {
      const details = e.details as any;
      return details.rolesAdded && details.rolesAdded.length > 0;
    });
    
    if (recentEscalations.length > 0) {
      anomalies.push({
        type: 'privilege_escalation',
        description: `${recentEscalations.length} privilege escalation events detected`,
        events: recentEscalations,
        riskLevel: 'high',
        recommendation: 'Review privilege changes and ensure they follow approval processes'
      });
    }
    
    return anomalies;
  }

  private detectDataAccessAnomalies(events: AuditEvent[]): AuditAnomaly[] {
    const anomalies: AuditAnomaly[] = [];
    const dataEvents = events.filter(e => e.action.startsWith('data.'));
    
    // Group by user and detect high volume access
    const userAccess = new Map<string, AuditEvent[]>();
    
    for (const event of dataEvents) {
      if (event.userId) {
        const accesses = userAccess.get(event.userId) || [];
        accesses.push(event);
        userAccess.set(event.userId, accesses);
      }
    }
    
    for (const [userId, accesses] of userAccess) {
      if (accesses.length > 100) { // High volume threshold
        anomalies.push({
          type: 'data_access',
          description: `User ${userId} performed ${accesses.length} data access operations`,
          events: accesses.slice(0, 10), // Include first 10 for review
          riskLevel: 'medium',
          recommendation: 'Review data access patterns for potential data exfiltration'
        });
      }
    }
    
    return anomalies;
  }
}