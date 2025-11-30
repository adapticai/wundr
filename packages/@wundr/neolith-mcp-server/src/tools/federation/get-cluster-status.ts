/**
 * Get Cluster Status Tool
 *
 * Retrieves health and status information for the distributed cluster.
 * Provides metrics on nodes, sessions, and overall system health.
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getClusterStatusInputSchema = z.object({
  includeMetrics: z.boolean().optional().default(true).describe('Include detailed performance metrics'),
  includeNodes: z.boolean().optional().default(true).describe('Include individual node status'),
  includeSessions: z.boolean().optional().default(true).describe('Include active session information'),
});

export type GetClusterStatusInput = z.infer<typeof getClusterStatusInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface ClusterNodeStatus {
  id: string;
  name: string;
  region: string;
  endpoint: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE';
  role: 'PRIMARY' | 'REPLICA' | 'WORKER';
  load: {
    cpu: number;
    memory: number;
    network: number;
  };
  capacity: {
    maxSessions: number;
    activeSessions: number;
    availableSessions: number;
  };
  metrics: {
    requestsPerSecond: number;
    averageLatency: number;
    errorRate: number;
    uptime: number;
  };
  lastHeartbeat: string;
  version: string;
}

export interface SessionInfo {
  id: string;
  nodeId: string;
  orchestratorId: string;
  status: 'ACTIVE' | 'IDLE' | 'MIGRATING' | 'TERMINATING';
  startedAt: string;
  lastActivityAt: string;
  resourceUsage: {
    cpu: number;
    memory: number;
    tokens: number;
  };
}

export interface ClusterMetrics {
  totalRequests: number;
  requestsPerSecond: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  throughput: {
    tasksPerMinute: number;
    tokensPerMinute: number;
  };
  resourceUtilization: {
    cpu: {
      used: number;
      available: number;
      percentage: number;
    };
    memory: {
      used: number;
      available: number;
      percentage: number;
    };
    storage: {
      used: number;
      available: number;
      percentage: number;
    };
  };
}

export interface GetClusterStatusResponse {
  cluster: {
    id: string;
    name: string;
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'CRITICAL';
    version: string;
    uptime: number;
  };
  nodes: ClusterNodeStatus[];
  sessions: SessionInfo[];
  metrics: ClusterMetrics;
  summary: {
    totalNodes: number;
    healthyNodes: number;
    degradedNodes: number;
    offlineNodes: number;
    totalSessions: number;
    activeSessions: number;
    migratingeSessions: number;
  };
  timestamp: string;
}

// ============================================================================
// Tool Result Type
// ============================================================================

export interface McpToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================================================
// Tool Handler
// ============================================================================

export async function getClusterStatus(
  apiClient: NeolithAPIClient,
  input: GetClusterStatusInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params: Record<string, string> = {
      includeMetrics: input.includeMetrics.toString(),
      includeNodes: input.includeNodes.toString(),
      includeSessions: input.includeSessions.toString(),
    };

    // Make API request to cluster status endpoint
    const path = '/api/federation/cluster/status';
    const response = await apiClient.get<GetClusterStatusResponse>(path, params);

    // Build comprehensive status message
    const statusParts = [
      `Cluster "${response.cluster.name}" is ${response.cluster.status}`,
      `${response.summary.healthyNodes}/${response.summary.totalNodes} nodes healthy`,
      `${response.summary.activeSessions} active sessions`,
    ];

    if (response.metrics) {
      statusParts.push(`${response.metrics.requestsPerSecond.toFixed(2)} req/s`);
      statusParts.push(`${response.metrics.averageLatency.toFixed(2)}ms avg latency`);
    }

    if (response.summary.degradedNodes > 0) {
      statusParts.push(`⚠️ ${response.summary.degradedNodes} degraded nodes`);
    }

    if (response.summary.offlineNodes > 0) {
      statusParts.push(`❌ ${response.summary.offlineNodes} offline nodes`);
    }

    return {
      success: true,
      message: statusParts.join(' | '),
      data: response,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get cluster status: ${errorMessage}`,
      error: {
        code: 'GET_CLUSTER_STATUS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
