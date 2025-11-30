/**
 * Get Budget Status Tool
 *
 * Returns current token budget status for an orchestrator.
 * GET /api/orchestrators/[orchestratorId]/budget/status
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getBudgetStatusInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to fetch budget status for'),
  includeProjections: z.boolean().optional().default(true).describe('Include projected exhaustion time'),
  includeBreakdown: z.boolean().optional().default(false).describe('Include token usage breakdown by task type'),
});

export type GetBudgetStatusInput = z.infer<typeof getBudgetStatusInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface TokenUsageBreakdown {
  taskType: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  percentage: number;
}

export interface BudgetProjection {
  hoursUntilExhaustion: number | null;
  projectedExhaustionTime: string | null;
  averageTokensPerHour: number;
  isAtRisk: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface BudgetStatus {
  orchestratorId: string;
  tokenLimit: number;
  tokensUsed: number;
  tokensRemaining: number;
  utilizationPercentage: number;
  resetDate: string | null;
  isUnlimited: boolean;
  breakdown?: TokenUsageBreakdown[];
  projection?: BudgetProjection;
  updatedAt: string;
}

export interface GetBudgetStatusResponse {
  data: BudgetStatus;
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

export async function getBudgetStatus(
  apiClient: NeolithAPIClient,
  input: GetBudgetStatusInput
): Promise<McpToolResult> {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (input.includeProjections !== undefined) {
      params.append('includeProjections', String(input.includeProjections));
    }
    if (input.includeBreakdown !== undefined) {
      params.append('includeBreakdown', String(input.includeBreakdown));
    }

    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}/budget/status${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get<GetBudgetStatusResponse>(path);

    const status = response.data;
    const utilizationMsg = status.isUnlimited
      ? 'unlimited budget'
      : `${status.utilizationPercentage.toFixed(1)}% utilized (${status.tokensRemaining.toLocaleString()} tokens remaining)`;

    return {
      success: true,
      message: `Budget status for orchestrator ${input.orchestratorId}: ${utilizationMsg}`,
      data: status,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to get budget status: ${errorMessage}`,
      error: {
        code: 'GET_BUDGET_STATUS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
