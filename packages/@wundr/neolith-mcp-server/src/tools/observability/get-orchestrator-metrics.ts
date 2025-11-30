/**
 * Get Orchestrator Metrics Tool
 *
 * Get detailed metrics for a specific orchestrator over a time range.
 * Includes sessions, tokens, latency, and errors over time.
 * GET /api/observability/orchestrators/[orchestratorId]/metrics
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getOrchestratorMetricsInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to get metrics for'),
  timeRange: z.enum(['1h', '24h', '7d']).optional().default('24h').describe('Time range for metrics'),
});

export type GetOrchestratorMetricsInput = z.infer<typeof getOrchestratorMetricsInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface OrchestratorMetricsData {
  orchestratorId: string;
  timeRange: string;
  sessions: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    timeseries: MetricDataPoint[];
  };
  tokens: {
    total: number;
    average: number;
    timeseries: MetricDataPoint[];
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
    timeseries: MetricDataPoint[];
  };
  errors: {
    total: number;
    rate: number; // Percentage
    byType: Record<string, number>;
    timeseries: MetricDataPoint[];
  };
}

export interface GetOrchestratorMetricsResponse {
  data: OrchestratorMetricsData;
}

// ============================================================================
// Tool Result Type
// ============================================================================

export interface McpToolResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errorDetails?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================================================
// Tool Handler
// ============================================================================

export async function getOrchestratorMetrics(
  apiClient: NeolithAPIClient,
  input: GetOrchestratorMetricsInput
): Promise<McpToolResult<OrchestratorMetricsData>> {
  try {
    // Make API request
    const path = `/api/observability/orchestrators/${input.orchestratorId}/metrics`;
    const params = { timeRange: input.timeRange };
    const response = await apiClient.get<GetOrchestratorMetricsResponse>(path, params);

    return {
      success: true,
      message: `Retrieved metrics for orchestrator ${input.orchestratorId} (${input.timeRange})`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to get orchestrator metrics: ${errorMessage}`,
      errorDetails: {
        code: 'GET_ORCHESTRATOR_METRICS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
