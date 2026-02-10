/**
 * Budget Alert System
 *
 * Monitors budget usage and sends alerts via multiple channels when thresholds
 * are exceeded. Supports alert escalation, rate limiting, and auto-pause.
 */

import {
  AlertChannel,
  AlertLevel,
} from './alert-types';

import type {
  Alert,
  AlertConfig,
  AlertDeliveryResult,
  AlertHistoryFilter,
  AlertStats,
  BudgetThreshold,
  ChannelConfig,
  EmailPayload,
  InAppPayload,
  SlackPayload,
  SMSPayload,
  WebhookPayload} from './alert-types';

/**
 * Usage statistics for budget monitoring
 */
export interface UsageStats {
  tokensUsed: number;
  tokensLimit: number;
  costUsed: number;
  costLimit: number;
  percentageUsed: number;
}

/**
 * Alert rate limiting tracker
 */
interface RateLimitEntry {
  threshold: number;
  lastAlertTime: number;
  alertCount: number;
}

/**
 * Budget Alert System
 *
 * Monitors budget usage and sends configurable alerts across multiple channels
 * when usage thresholds are exceeded.
 */
export class BudgetAlertSystem {
  private configs: Map<string, AlertConfig> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private rateLimits: Map<string, Map<number, RateLimitEntry>> = new Map();
  private autoPauseEnabled: Map<string, boolean> = new Map();
  private alertCounter = 0;

  /**
   * Configure alerts for an orchestrator
   */
  async configureAlerts(config: AlertConfig): Promise<void> {
    // Validate configuration
    this.validateConfig(config);

    // Sort thresholds in ascending order
    config.thresholds.sort((a, b) => a.percentage - b.percentage);

    // Store configuration
    this.configs.set(config.orchestratorId, config);

    // Initialize rate limiting
    if (!this.rateLimits.has(config.orchestratorId)) {
      this.rateLimits.set(config.orchestratorId, new Map());
    }
  }

  /**
   * Check budget usage and send alerts if thresholds exceeded
   */
  async checkAndAlert(
    orchestratorId: string,
    usage: UsageStats,
  ): Promise<Alert[]> {
    const config = this.configs.get(orchestratorId);
    if (!config || !config.enabled) {
      return [];
    }

    const triggeredAlerts: Alert[] = [];

    // Check each threshold
    for (const threshold of config.thresholds) {
      if (usage.percentageUsed >= threshold.percentage) {
        // Check rate limiting
        if (this.isRateLimited(orchestratorId, threshold, config)) {
          continue;
        }

        // Create alert
        const alert = await this.createAlert(
          orchestratorId,
          threshold,
          usage,
          config,
        );

        // Send alert through configured channels
        await this.deliverAlert(alert, config);

        // Update rate limiting
        this.updateRateLimit(orchestratorId, threshold);

        // Handle auto-pause if configured
        if (threshold.autoPause && this.isAutoPauseEnabled(orchestratorId)) {
          alert.autoPauseTriggered = true;
          await this.triggerAutoPause(orchestratorId);
        }

        triggeredAlerts.push(alert);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.acknowledged) {
      throw new Error(`Alert already acknowledged: ${alertId}`);
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    this.alerts.set(alertId, alert);
  }

  /**
   * Get alert history for an orchestrator
   */
  async getAlertHistory(
    orchestratorId: string,
    limit = 100,
  ): Promise<Alert[]> {
    const allAlerts = Array.from(this.alerts.values()).filter(
      (alert) => alert.orchestratorId === orchestratorId,
    );

    // Sort by creation time, newest first
    allAlerts.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return allAlerts.slice(0, limit);
  }

  /**
   * Get alert history with advanced filtering
   */
  async getFilteredAlertHistory(
    filter: AlertHistoryFilter,
  ): Promise<Alert[]> {
    let results = Array.from(this.alerts.values());

    // Apply filters
    if (filter.orchestratorId) {
      results = results.filter(
        (a) => a.orchestratorId === filter.orchestratorId,
      );
    }

    if (filter.level) {
      results = results.filter((a) => a.level === filter.level);
    }

    if (filter.acknowledged !== undefined) {
      results = results.filter((a) => a.acknowledged === filter.acknowledged);
    }

    if (filter.dateRange) {
      results = results.filter(
        (a) =>
          a.createdAt >= filter.dateRange!.start &&
          a.createdAt <= filter.dateRange!.end,
      );
    }

    // Sort
    const sortBy = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'desc';

    results.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortBy) {
        case 'createdAt':
          aVal = a.createdAt.getTime();
          bVal = b.createdAt.getTime();
          break;
        case 'level':
          aVal = this.getLevelPriority(a.level);
          bVal = this.getLevelPriority(b.level);
          break;
        case 'percentageUsed':
          aVal = a.currentUsage.percentageUsed;
          bVal = b.currentUsage.percentageUsed;
          break;
        default:
          aVal = a.createdAt.getTime();
          bVal = b.createdAt.getTime();
      }

      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    // Pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * Enable or disable auto-pause for an orchestrator
   */
  async setAutoPause(
    orchestratorId: string,
    enabled: boolean,
  ): Promise<void> {
    this.autoPauseEnabled.set(orchestratorId, enabled);
  }

  /**
   * Get alert statistics for an orchestrator
   */
  async getAlertStats(
    orchestratorId: string,
    timeRange?: { start: Date; end: Date },
  ): Promise<AlertStats> {
    let alerts = Array.from(this.alerts.values()).filter(
      (a) => a.orchestratorId === orchestratorId,
    );

    // Apply time range filter
    if (timeRange) {
      alerts = alerts.filter(
        (a) => a.createdAt >= timeRange.start && a.createdAt <= timeRange.end,
      );
    }

    // Calculate statistics
    const byLevel: Record<AlertLevel, number> = {
      [AlertLevel.INFO]: 0,
      [AlertLevel.WARNING]: 0,
      [AlertLevel.CRITICAL]: 0,
      [AlertLevel.EMERGENCY]: 0,
    };

    const byChannel: Record<AlertChannel, number> = {
      [AlertChannel.WEBHOOK]: 0,
      [AlertChannel.EMAIL]: 0,
      [AlertChannel.SLACK]: 0,
      [AlertChannel.IN_APP]: 0,
      [AlertChannel.SMS]: 0,
    };

    let acknowledged = 0;
    let autoPauseCount = 0;
    let totalAckTimeMs = 0;
    let ackCount = 0;

    for (const alert of alerts) {
      byLevel[alert.level]++;

      for (const channel of alert.channels) {
        byChannel[channel]++;
      }

      if (alert.acknowledged) {
        acknowledged++;
        if (alert.acknowledgedAt) {
          totalAckTimeMs +=
            alert.acknowledgedAt.getTime() - alert.createdAt.getTime();
          ackCount++;
        }
      }

      if (alert.autoPauseTriggered) {
        autoPauseCount++;
      }
    }

    return {
      orchestratorId,
      totalAlerts: alerts.length,
      byLevel,
      byChannel,
      acknowledged,
      unacknowledged: alerts.length - acknowledged,
      autoPauseCount,
      avgAckTimeMs: ackCount > 0 ? totalAckTimeMs / ackCount : undefined,
      timeRange: timeRange || {
        start: new Date(0),
        end: new Date(),
      },
    };
  }

  /**
   * Clear old alerts (cleanup)
   */
  async clearOldAlerts(orchestratorId: string, olderThan: Date): Promise<number> {
    const alertsToDelete = Array.from(this.alerts.values()).filter(
      (a) => a.orchestratorId === orchestratorId && a.createdAt < olderThan,
    );

    for (const alert of alertsToDelete) {
      this.alerts.delete(alert.id);
    }

    return alertsToDelete.length;
  }

  // Private helper methods

  private validateConfig(config: AlertConfig): void {
    if (!config.orchestratorId) {
      throw new Error('orchestratorId is required');
    }

    if (!config.thresholds || config.thresholds.length === 0) {
      throw new Error('At least one threshold is required');
    }

    for (const threshold of config.thresholds) {
      if (threshold.percentage < 0 || threshold.percentage > 100) {
        throw new Error('Threshold percentage must be between 0 and 100');
      }
    }

    if (!config.channels || config.channels.length === 0) {
      throw new Error('At least one alert channel is required');
    }

    if (!config.rateLimit) {
      throw new Error('Rate limit configuration is required');
    }
  }

  private async createAlert(
    orchestratorId: string,
    threshold: BudgetThreshold,
    usage: UsageStats,
    config: AlertConfig,
  ): Promise<Alert> {
    const alertId = `alert-${orchestratorId}-${++this.alertCounter}-${Date.now()}`;

    const alert: Alert = {
      id: alertId,
      orchestratorId,
      level: threshold.level,
      title: this.generateAlertTitle(threshold, usage),
      message: this.generateAlertMessage(threshold, usage, config),
      threshold,
      currentUsage: {
        tokensUsed: usage.tokensUsed,
        tokensLimit: usage.tokensLimit,
        percentageUsed: usage.percentageUsed,
        costUsed: usage.costUsed,
        costLimit: usage.costLimit,
      },
      channels: [],
      createdAt: new Date(),
      acknowledged: false,
    };

    this.alerts.set(alertId, alert);
    return alert;
  }

  private generateAlertTitle(
    threshold: BudgetThreshold,
    usage: UsageStats,
  ): string {
    const level = threshold.level.toUpperCase();
    return `[${level}] Budget Alert: ${usage.percentageUsed.toFixed(1)}% Used`;
  }

  private generateAlertMessage(
    threshold: BudgetThreshold,
    usage: UsageStats,
    _config: AlertConfig,
  ): string {
    if (threshold.messageTemplate) {
      return this.interpolateTemplate(threshold.messageTemplate, {
        percentage: usage.percentageUsed,
        tokensUsed: usage.tokensUsed,
        tokensLimit: usage.tokensLimit,
        costUsed: usage.costUsed,
        costLimit: usage.costLimit,
        threshold: threshold.percentage,
      });
    }

    return `Budget usage has reached ${usage.percentageUsed.toFixed(1)}% (${usage.tokensUsed.toLocaleString()} / ${usage.tokensLimit.toLocaleString()} tokens). Cost: $${usage.costUsed.toFixed(2)} / $${usage.costLimit.toFixed(2)}`;
  }

  private interpolateTemplate(
    template: string,
    vars: Record<string, number>,
  ): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      return vars[key]?.toString() || '';
    });
  }

  private async deliverAlert(
    alert: Alert,
    config: AlertConfig,
  ): Promise<AlertDeliveryResult> {
    const results: AlertDeliveryResult['results'] = [];

    for (const channelConfig of config.channels) {
      if (!channelConfig.enabled) {
        continue;
      }

      // Check minimum level
      if (
        channelConfig.minLevel &&
        this.getLevelPriority(alert.level) <
          this.getLevelPriority(channelConfig.minLevel)
      ) {
        continue;
      }

      try {
        await this.sendToChannel(alert, channelConfig, config);
        alert.channels.push(channelConfig.type);
        results.push({
          channel: channelConfig.type,
          success: true,
          deliveredAt: new Date(),
        });
      } catch (error) {
        results.push({
          channel: channelConfig.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      alertId: alert.id,
      results,
      status: succeeded === 0 ? 'failed' : failed === 0 ? 'success' : 'partial',
      attempted: results.length,
      succeeded,
      failed,
    };
  }

  private async sendToChannel(
    alert: Alert,
    channelConfig: ChannelConfig,
    config: AlertConfig,
  ): Promise<void> {
    switch (channelConfig.type) {
      case AlertChannel.WEBHOOK:
        await this.sendWebhook(alert, channelConfig, config);
        break;
      case AlertChannel.EMAIL:
        await this.sendEmail(alert, channelConfig, config);
        break;
      case AlertChannel.SLACK:
        await this.sendSlack(alert, channelConfig, config);
        break;
      case AlertChannel.IN_APP:
        await this.sendInApp(alert, channelConfig, config);
        break;
      case AlertChannel.SMS:
        await this.sendSMS(alert, channelConfig, config);
        break;
      default:
        throw new Error(`Unsupported channel type: ${channelConfig.type}`);
    }
  }

  private async sendWebhook(
    alert: Alert,
    channelConfig: ChannelConfig,
    config: AlertConfig,
  ): Promise<void> {
    const webhookConfig = channelConfig.config as any;
    const payload: WebhookPayload = {
      event: 'budget.alert',
      alert,
      orchestrator: {
        id: config.orchestratorId,
      },
      timestamp: new Date().toISOString(),
    };

    // In production, this would make an actual HTTP request
    // For now, we'll just log it
    console.log(`[WEBHOOK] Sending to ${webhookConfig.url}:`, payload);
  }

  private async sendEmail(
    alert: Alert,
    channelConfig: ChannelConfig,
    config: AlertConfig,
  ): Promise<void> {
    const emailConfig = channelConfig.config as any;
    const payload: EmailPayload = {
      subject: `Budget Alert: ${alert.title}`,
      html: this.generateEmailHTML(alert, config),
      text: this.generateEmailText(alert, config),
      alert,
    };

    console.log(`[EMAIL] Sending to ${emailConfig.recipients.join(', ')}:`, payload);
  }

  private async sendSlack(
    alert: Alert,
    channelConfig: ChannelConfig,
    _config: AlertConfig,
  ): Promise<void> {
    const slackConfig = channelConfig.config as any;
    const payload: SlackPayload = {
      text: alert.title,
      attachments: [
        {
          color: this.getAlertColor(alert.level),
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: 'Tokens Used',
              value: `${alert.currentUsage.tokensUsed.toLocaleString()} / ${alert.currentUsage.tokensLimit.toLocaleString()}`,
              short: true,
            },
            {
              title: 'Cost',
              value: `$${alert.currentUsage.costUsed.toFixed(2)} / $${alert.currentUsage.costLimit.toFixed(2)}`,
              short: true,
            },
            {
              title: 'Percentage',
              value: `${alert.currentUsage.percentageUsed.toFixed(1)}%`,
              short: true,
            },
            {
              title: 'Level',
              value: alert.level.toUpperCase(),
              short: true,
            },
          ],
          footer: 'Budget Alert System',
          ts: Math.floor(alert.createdAt.getTime() / 1000),
        },
      ],
    };

    console.log(`[SLACK] Sending to ${slackConfig.webhookUrl}:`, payload);
  }

  private async sendInApp(
    alert: Alert,
    channelConfig: ChannelConfig,
    _config: AlertConfig,
  ): Promise<void> {
    const inAppConfig = channelConfig.config as any;
    const payload: InAppPayload = {
      id: alert.id,
      userIds: inAppConfig.userIds,
      title: alert.title,
      message: alert.message,
      level: alert.level,
      actions: [
        {
          label: 'Acknowledge',
          action: 'acknowledge',
        },
        {
          label: 'View Details',
          action: 'view',
          url: `/alerts/${alert.id}`,
        },
      ],
      desktop: inAppConfig.desktopNotification || false,
    };

    console.log(`[IN-APP] Sending to users ${inAppConfig.userIds.join(', ')}:`, payload);
  }

  private async sendSMS(
    alert: Alert,
    channelConfig: ChannelConfig,
    _config: AlertConfig,
  ): Promise<void> {
    const smsConfig = channelConfig.config as any;
    const payload: SMSPayload = {
      to: smsConfig.phoneNumbers,
      body: `Budget Alert: ${alert.currentUsage.percentageUsed.toFixed(1)}% used. Level: ${alert.level.toUpperCase()}`,
    };

    console.log(`[SMS] Sending to ${smsConfig.phoneNumbers.join(', ')}:`, payload);
  }

  private generateEmailHTML(alert: Alert, _config: AlertConfig): string {
    const color = this.getAlertColor(alert.level);
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="background-color: ${color}; color: white; padding: 20px;">
            <h1>${alert.title}</h1>
          </div>
          <div style="padding: 20px;">
            <p>${alert.message}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Tokens Used</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${alert.currentUsage.tokensUsed.toLocaleString()} / ${alert.currentUsage.tokensLimit.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Cost</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">$${alert.currentUsage.costUsed.toFixed(2)} / $${alert.currentUsage.costLimit.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd;"><strong>Percentage</strong></td>
                <td style="padding: 10px; border: 1px solid #ddd;">${alert.currentUsage.percentageUsed.toFixed(1)}%</td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;
  }

  private generateEmailText(alert: Alert, _config: AlertConfig): string {
    return `
${alert.title}

${alert.message}

Tokens Used: ${alert.currentUsage.tokensUsed.toLocaleString()} / ${alert.currentUsage.tokensLimit.toLocaleString()}
Cost: $${alert.currentUsage.costUsed.toFixed(2)} / $${alert.currentUsage.costLimit.toFixed(2)}
Percentage: ${alert.currentUsage.percentageUsed.toFixed(1)}%
Level: ${alert.level.toUpperCase()}
    `.trim();
  }

  private getAlertColor(level: AlertLevel): string {
    switch (level) {
      case AlertLevel.INFO:
        return '#0066cc';
      case AlertLevel.WARNING:
        return '#ff9900';
      case AlertLevel.CRITICAL:
        return '#ff6600';
      case AlertLevel.EMERGENCY:
        return '#cc0000';
      default:
        return '#666666';
    }
  }

  private getLevelPriority(level: AlertLevel): number {
    switch (level) {
      case AlertLevel.INFO:
        return 1;
      case AlertLevel.WARNING:
        return 2;
      case AlertLevel.CRITICAL:
        return 3;
      case AlertLevel.EMERGENCY:
        return 4;
      default:
        return 0;
    }
  }

  private isRateLimited(
    orchestratorId: string,
    threshold: BudgetThreshold,
    config: AlertConfig,
  ): boolean {
    const rateLimitMap = this.rateLimits.get(orchestratorId);
    if (!rateLimitMap) {
      return false;
    }

    const entry = rateLimitMap.get(threshold.percentage);
    if (!entry) {
      return false;
    }

    const now = Date.now();
    const windowElapsed = now - entry.lastAlertTime;

    if (windowElapsed < config.rateLimit.windowMs) {
      if (entry.alertCount >= config.rateLimit.maxAlertsPerThreshold) {
        return true;
      }
    }

    return false;
  }

  private updateRateLimit(
    orchestratorId: string,
    threshold: BudgetThreshold,
  ): void {
    let rateLimitMap = this.rateLimits.get(orchestratorId);
    if (!rateLimitMap) {
      rateLimitMap = new Map();
      this.rateLimits.set(orchestratorId, rateLimitMap);
    }

    const now = Date.now();
    const entry = rateLimitMap.get(threshold.percentage);

    if (!entry) {
      rateLimitMap.set(threshold.percentage, {
        threshold: threshold.percentage,
        lastAlertTime: now,
        alertCount: 1,
      });
    } else {
      const config = this.configs.get(orchestratorId);
      if (!config) {
return;
}

      const windowElapsed = now - entry.lastAlertTime;

      if (windowElapsed >= config.rateLimit.windowMs) {
        // Reset window
        entry.lastAlertTime = now;
        entry.alertCount = 1;
      } else {
        // Increment counter
        entry.alertCount++;
      }
    }
  }

  private isAutoPauseEnabled(orchestratorId: string): boolean {
    return this.autoPauseEnabled.get(orchestratorId) ?? true;
  }

  private async triggerAutoPause(orchestratorId: string): Promise<void> {
    // In production, this would call the orchestrator service to pause execution
    console.log(`[AUTO-PAUSE] Pausing orchestrator: ${orchestratorId}`);
  }
}
