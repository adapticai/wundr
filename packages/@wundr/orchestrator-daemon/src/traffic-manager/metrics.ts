import type { RoutingDecision, TrafficMetrics } from './types.js';

const MAX_RECORDS = 10_000;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

interface RoutingRecord {
  decision: RoutingDecision;
  durationMs: number;
  timestamp: Date;
}

export class MetricsCollector {
  private records: RoutingRecord[] = [];

  recordRouting(decision: RoutingDecision, durationMs: number): void {
    this.records.push({ decision, durationMs, timestamp: new Date() });
    if (this.records.length > MAX_RECORDS) {
      this.records.splice(0, this.records.length - MAX_RECORDS);
    }
  }

  getMetrics(windowMs: number = DEFAULT_WINDOW_MS): TrafficMetrics {
    const window = this.getWindow(windowMs);
    const total = window.length;
    const windowMinutes = windowMs / 60_000;

    const messagesPerMinute = total / windowMinutes;
    const averageRoutingLatencyMs = total > 0
      ? window.reduce((sum, r) => sum + r.durationMs, 0) / total
      : 0;
    const escalationRate = total > 0
      ? window.filter(r => r.decision.escalated).length / total
      : 0;
    const fallbackRate = total > 0
      ? window.filter(r => r.decision.matchedBy === 'fallback').length / total
      : 0;

    const agentCounts: Record<string, number> = {};
    for (const r of window) {
      if (r.decision.agentId) {
        agentCounts[r.decision.agentId] = (agentCounts[r.decision.agentId] ?? 0) + 1;
      }
    }
    const agentUtilization: Record<string, number> = {};
    for (const [agentId, count] of Object.entries(agentCounts)) {
      agentUtilization[agentId] = total > 0 ? count / total : 0;
    }

    return {
      messagesPerMinute,
      averageRoutingLatencyMs,
      escalationRate,
      fallbackRate,
      agentUtilization,
      totalMessages: total,
      windowMs,
    };
  }

  getAgentMetrics(
    agentId: string,
    windowMs: number = DEFAULT_WINDOW_MS,
  ): { messagesHandled: number; avgRoutingLatencyMs: number; utilizationRatio: number } {
    const window = this.getWindow(windowMs);
    const agentRecords = window.filter(r => r.decision.agentId === agentId);
    const messagesHandled = agentRecords.length;
    const avgRoutingLatencyMs = messagesHandled > 0
      ? agentRecords.reduce((sum, r) => sum + r.durationMs, 0) / messagesHandled
      : 0;
    const utilizationRatio = window.length > 0 ? messagesHandled / window.length : 0;

    return { messagesHandled, avgRoutingLatencyMs, utilizationRatio };
  }

  getChannelMetrics(
    channelId: string,
    windowMs: number = DEFAULT_WINDOW_MS,
  ): { volume: number; avgLatency: number } {
    const window = this.getWindow(windowMs);
    const channelRecords = window.filter(r => r.decision.channelId === channelId);
    const volume = channelRecords.length;
    const avgLatency = volume > 0
      ? channelRecords.reduce((sum, r) => sum + r.durationMs, 0) / volume
      : 0;

    return { volume, avgLatency };
  }

  getMethodDistribution(windowMs: number = DEFAULT_WINDOW_MS): Record<string, number> {
    const window = this.getWindow(windowMs);
    const distribution: Record<string, number> = {};
    for (const r of window) {
      const method = r.decision.matchedBy ?? 'unknown';
      distribution[method] = (distribution[method] ?? 0) + 1;
    }
    return distribution;
  }

  reset(): void {
    this.records = [];
  }

  private getWindow(windowMs: number): RoutingRecord[] {
    const cutoff = new Date(Date.now() - windowMs);
    return this.records.filter(r => r.timestamp >= cutoff);
  }
}

let singleton: MetricsCollector | undefined;

export function createMetricsCollector(): MetricsCollector {
  return new MetricsCollector();
}

export function getMetricsCollector(): MetricsCollector {
  singleton ??= new MetricsCollector();
  return singleton;
}
