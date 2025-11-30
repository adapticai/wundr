/**
 * Get Usage History Tool
 *
 * Returns token usage history for an orchestrator with time range and granularity.
 * GET /api/orchestrators/[orchestratorId]/budget/usage-history
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getUsageHistoryInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to fetch usage history for'),
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d', 'all']).optional().default('24h').describe('Time range for usage history'),
  granularity: z.enum(['hourly', 'daily', 'weekly']).optional().default('hourly').describe('Aggregation granularity'),
  startTime: z.string().optional().describe('Custom start time (ISO 8601) - overrides timeRange'),
  endTime: z.string().optional().describe('Custom end time (ISO 8601) - defaults to now'),
  includeTaskBreakdown: z.boolean().optional().default(false).describe('Include breakdown by task type'),
  includeModelBreakdown: z.boolean().optional().default(false).describe('Include breakdown by model'),
  limit: z.number().int().positive().optional().default(100).describe('Maximum number of data points'),
});

export type GetUsageHistoryInput = z.infer<typeof getUsageHistoryInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface UsageDataPoint {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  taskCount: number;
  averageTokensPerTask: number;
  taskBreakdown?: Record<string, number>;
  modelBreakdown?: Record<string, number>;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalTasks: number;
  averageTokensPerTask: number;
  peakUsageTimestamp: string | null;
  peakUsageTokens: number;
}

export interface UsageHistory {
  orchestratorId: string;
  timeRange: string;
  granularity: string;
  startTime: string;
  endTime: string;
  dataPoints: UsageDataPoint[];
  summary: UsageSummary;
  hasMore: boolean;
  nextCursor?: string;
}

export interface GetUsageHistoryResponse {
  data: UsageHistory;
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

export async function getUsageHistory(
  apiClient: NeolithAPIClient,
  input: GetUsageHistoryInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params = new URLSearchParams();

    if (input.startTime) {
      params.append('startTime', input.startTime);
    } else {
      params.append('timeRange', input.timeRange || '24h');
    }

    if (input.endTime) {
      params.append('endTime', input.endTime);
    }

    params.append('granularity', input.granularity || 'hourly');

    if (input.includeTaskBreakdown !== undefined) {
      params.append('includeTaskBreakdown', String(input.includeTaskBreakdown));
    }

    if (input.includeModelBreakdown !== undefined) {
      params.append('includeModelBreakdown', String(input.includeModelBreakdown));
    }

    if (input.limit !== undefined) {
      params.append('limit', String(input.limit));
    }

    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}/budget/usage-history?${params.toString()}`;
    const response = await apiClient.get<GetUsageHistoryResponse>(path);

    const history = response.data;
    const summary = history.summary;
    const summaryMsg = `${history.dataPoints.length} data points, ${summary.totalTokens.toLocaleString()} total tokens (${summary.totalTasks} tasks)`;

    return {
      success: true,
      message: `Usage history for orchestrator ${input.orchestratorId}: ${summaryMsg}`,
      data: history,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get usage history: ${errorMessage}`,
      error: {
        code: 'GET_USAGE_HISTORY_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
