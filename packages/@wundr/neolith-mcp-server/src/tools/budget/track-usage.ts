/**
 * Track Usage Tool
 *
 * Records token usage after an LLM call for budget tracking.
 * POST /api/orchestrators/[orchestratorId]/budget/track-usage
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const trackUsageInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to track usage for'),
  model: z.string().describe('The LLM model that was used'),
  inputTokens: z.number().int().min(0).describe('Number of input tokens consumed'),
  outputTokens: z.number().int().min(0).describe('Number of output tokens generated'),
  taskId: z.string().optional().describe('Associated task ID for tracking'),
  taskType: z.string().optional().describe('Type of task performed'),
  sessionId: z.string().optional().describe('Session ID for grouping related calls'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata for tracking'),
  timestamp: z.string().optional().describe('Timestamp of usage (ISO 8601) - defaults to server time'),
});

export type TrackUsageInput = z.infer<typeof trackUsageInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface UsageRecord {
  id: string;
  orchestratorId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  taskId?: string;
  taskType?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
}

export interface BudgetAfterUsage {
  tokenLimit: number;
  tokensUsed: number;
  tokensRemaining: number;
  utilizationPercentage: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

export interface TrackUsageResult {
  record: UsageRecord;
  budgetStatus: BudgetAfterUsage;
  warnings?: string[];
}

export interface TrackUsageResponse {
  data: TrackUsageResult;
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
  warnings?: string[];
}

// ============================================================================
// Tool Handler
// ============================================================================

export async function trackUsage(
  apiClient: NeolithAPIClient,
  input: TrackUsageInput
): Promise<McpToolResult> {
  try {
    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}/budget/track-usage`;
    const payload = {
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      taskId: input.taskId,
      taskType: input.taskType,
      sessionId: input.sessionId,
      metadata: input.metadata,
      timestamp: input.timestamp,
    };

    const response = await apiClient.post<TrackUsageResponse>(path, payload);

    const result = response.data;
    const totalTokens = input.inputTokens + input.outputTokens;
    const budgetMsg = `${result.budgetStatus.utilizationPercentage.toFixed(1)}% budget used (${result.budgetStatus.tokensRemaining.toLocaleString()} remaining)`;

    return {
      success: true,
      message: `Tracked ${totalTokens.toLocaleString()} tokens (${input.model}). ${budgetMsg}`,
      data: result,
      warnings: result.warnings,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to track usage: ${errorMessage}`,
      error: {
        code: 'TRACK_USAGE_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
