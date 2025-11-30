/**
 * Check Budget Tool
 *
 * Pre-flight check to determine if estimated token usage is within budget.
 * POST /api/orchestrators/[orchestratorId]/budget/check
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const checkBudgetInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to check budget for'),
  estimatedTokens: z.number().int().positive().describe('Estimated number of tokens for the operation'),
  model: z.string().optional().describe('LLM model to be used (for more accurate estimation)'),
  taskType: z.string().optional().describe('Type of task (for tracking purposes)'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Task priority (affects budget allocation)'),
  allowOverage: z.boolean().optional().default(false).describe('Allow operation if it would exceed budget by small amount'),
  overagePercentage: z.number().min(0).max(50).optional().default(10).describe('Maximum overage percentage allowed if allowOverage is true'),
});

export type CheckBudgetInput = z.infer<typeof checkBudgetInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface BudgetCheckResult {
  allowed: boolean;
  reason: string;
  currentUsage: {
    tokensUsed: number;
    tokenLimit: number;
    tokensRemaining: number;
    utilizationPercentage: number;
  };
  requestedOperation: {
    estimatedTokens: number;
    model?: string;
    taskType?: string;
    priority?: string;
  };
  afterOperation?: {
    projectedUsage: number;
    projectedRemaining: number;
    projectedUtilization: number;
    wouldExceedLimit: boolean;
    overageAmount?: number;
    overagePercentage?: number;
  };
  recommendations?: string[];
  warnings?: string[];
}

export interface CheckBudgetResponse {
  data: BudgetCheckResult;
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

export async function checkBudget(
  apiClient: NeolithAPIClient,
  input: CheckBudgetInput
): Promise<McpToolResult> {
  try {
    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}/budget/check`;
    const payload = {
      estimatedTokens: input.estimatedTokens,
      model: input.model,
      taskType: input.taskType,
      priority: input.priority,
      allowOverage: input.allowOverage,
      overagePercentage: input.overagePercentage,
    };

    const response = await apiClient.post<CheckBudgetResponse>(path, payload);

    const result = response.data;
    const statusMsg = result.allowed
      ? `ALLOWED - ${result.reason}`
      : `DENIED - ${result.reason}`;

    return {
      success: true,
      message: `Budget check for ${input.estimatedTokens.toLocaleString()} tokens: ${statusMsg}`,
      data: result,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to check budget: ${errorMessage}`,
      error: {
        code: 'CHECK_BUDGET_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
