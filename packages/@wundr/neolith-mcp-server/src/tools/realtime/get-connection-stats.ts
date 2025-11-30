/**
 * Get Connection Stats Tool
 *
 * Returns WebSocket connection statistics for monitoring and debugging.
 * Provides insights into connection health, message throughput, latency, and errors.
 *
 * @module tools/realtime/get-connection-stats
 */

import { z } from 'zod';
import type { McpToolResult } from '../types';

/**
 * Input schema for getting connection stats
 */
export const GetConnectionStatsSchema = z.object({
  workspaceSlug: z.string().optional().describe('Workspace slug to get stats for (if not provided, returns global stats)'),
  channelId: z.string().optional().describe('Channel ID to get stats for (if not provided, returns workspace-level stats)'),
  timeRange: z.enum(['1m', '5m', '15m', '1h', '24h', 'all']).optional().default('5m').describe('Time range for statistics'),
  includeHistogram: z.boolean().optional().default(false).describe('Include latency histogram data'),
  includeErrors: z.boolean().optional().default(true).describe('Include error details'),
  includePerUser: z.boolean().optional().default(false).describe('Include per-user breakdown'),
});

export type GetConnectionStatsInput = z.infer<typeof GetConnectionStatsSchema>;

/**
 * Connection statistics data
 */
export interface ConnectionStats {
  /** Scope of the statistics */
  scope: {
    type: 'global' | 'workspace' | 'channel';
    workspaceSlug?: string;
    channelId?: string;
  };
  /** Time range of the statistics */
  timeRange: string;
  /** Timestamp of stats collection */
  timestamp: string;
  /** Connection metrics */
  connections: {
    /** Total active connections */
    active: number;
    /** Total connections in time range */
    total: number;
    /** New connections */
    new: number;
    /** Closed connections */
    closed: number;
    /** Average connection duration (seconds) */
    avgDuration: number;
  };
  /** Message throughput metrics */
  messages: {
    /** Total messages sent */
    sent: number;
    /** Total messages received */
    received: number;
    /** Total messages (sent + received) */
    total: number;
    /** Messages per second (average) */
    throughput: number;
    /** Peak messages per second */
    peakThroughput: number;
    /** Breakdown by message type */
    byType: Record<string, number>;
  };
  /** Latency metrics */
  latency: {
    /** Average latency in milliseconds */
    avg: number;
    /** Median latency (p50) */
    p50: number;
    /** 95th percentile latency */
    p95: number;
    /** 99th percentile latency */
    p99: number;
    /** Maximum latency */
    max: number;
    /** Latency histogram (if includeHistogram: true) */
    histogram?: Array<{
      bucket: string;
      count: number;
    }>;
  };
  /** Error metrics */
  errors?: {
    /** Total errors */
    total: number;
    /** Errors by type */
    byType: Record<string, number>;
    /** Recent errors (last 10) */
    recent: Array<{
      timestamp: string;
      type: string;
      message: string;
      userId?: string;
    }>;
  };
  /** Per-user breakdown (if includePerUser: true) */
  perUser?: Array<{
    userId: string;
    displayName: string;
    connectionCount: number;
    messagesSent: number;
    messagesReceived: number;
    avgLatency: number;
    errorCount: number;
  }>;
  /** Health status */
  health: {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
  };
}

/**
 * Get WebSocket connection statistics
 *
 * @param input - Stats query parameters
 * @param apiClient - Neolith API client instance
 * @returns MCP tool result with connection statistics
 *
 * @example
 * ```typescript
 * const result = await getConnectionStatsHandler({
 *   workspaceSlug: 'acme-corp',
 *   timeRange: '15m',
 *   includeHistogram: true,
 *   includeErrors: true
 * }, apiClient);
 * ```
 */
export async function getConnectionStatsHandler(
  input: GetConnectionStatsInput,
  apiClient: { get: (path: string, params?: Record<string, unknown>) => Promise<unknown> }
): Promise<McpToolResult> {
  try {
    // Validate input
    const validatedInput = GetConnectionStatsSchema.parse(input);

    // Prepare query parameters
    const params: Record<string, unknown> = {
      timeRange: validatedInput.timeRange,
      includeHistogram: validatedInput.includeHistogram,
      includeErrors: validatedInput.includeErrors,
      includePerUser: validatedInput.includePerUser,
    };

    // Build path based on scope
    let path = '/api/realtime/stats';

    if (validatedInput.channelId) {
      path = `/api/realtime/stats/channels/${validatedInput.channelId}`;
    } else if (validatedInput.workspaceSlug) {
      path = `/api/realtime/stats/workspaces/${validatedInput.workspaceSlug}`;
    }

    // Fetch connection stats via API
    const response = await apiClient.get(path, params) as ConnectionStats;

    // Determine health status based on metrics
    const healthIssues: string[] = [];
    let healthStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';

    // Check latency
    if (response.latency.p95 > 1000) {
      healthIssues.push('High latency detected (p95 > 1s)');
      healthStatus = 'degraded';
    }
    if (response.latency.p99 > 5000) {
      healthIssues.push('Critical latency detected (p99 > 5s)');
      healthStatus = 'critical';
    }

    // Check error rate
    if (response.errors && response.messages.total > 0) {
      const errorRate = response.errors.total / response.messages.total;
      if (errorRate > 0.05) {
        healthIssues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
        healthStatus = healthStatus === 'critical' ? 'critical' : 'degraded';
      }
    }

    const enrichedResponse: ConnectionStats = {
      ...response,
      health: {
        status: healthStatus,
        issues: healthIssues,
      },
    };

    return {
      success: true,
      data: enrichedResponse,
      message: `Connection stats retrieved (${response.connections.active} active connections, ${response.messages.throughput.toFixed(2)} msg/s)`,
      warnings: healthIssues.length > 0 ? healthIssues : undefined,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get connection stats';

    return {
      success: false,
      error: errorMessage,
      errorDetails: {
        code: 'STATS_ERROR',
        message: errorMessage,
        context: {
          workspaceSlug: input.workspaceSlug,
          channelId: input.channelId,
          timeRange: input.timeRange,
        },
      },
    };
  }
}
