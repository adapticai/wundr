/**
 * Validate Action Tool
 *
 * Validate an action against charter constraints for a specific orchestrator.
 * POST /api/orchestrators/[orchestratorId]/charter/validate
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const validateActionInputSchema = z.object({
  orchestratorId: z.string().describe('The orchestrator ID to validate against'),
  action: z.object({
    type: z.string().describe('The type of action to validate'),
    target: z.string().optional().describe('The target resource or entity'),
    context: z.record(z.unknown()).optional().describe('Additional context for validation'),
  }).describe('The action to validate'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Minimum severity level to check'),
});

export type ValidateActionInput = z.infer<typeof validateActionInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface ValidationViolation {
  constraintType: 'allowed' | 'forbidden' | 'required';
  category: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  warnings: ValidationViolation[];
  checkedAt: string;
  charterVersion: number;
}

export interface ValidateActionResponse {
  data: ValidationResult;
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

export async function validateAction(
  apiClient: NeolithAPIClient,
  input: ValidateActionInput
): Promise<McpToolResult> {
  try {
    // Build request body
    const body = {
      action: input.action,
      severity: input.severity,
    };

    // Make API request
    const path = `/api/orchestrators/${input.orchestratorId}/charter/validate`;
    const response = await apiClient.post<ValidateActionResponse>(path, body);

    const result = response.data;
    const violationCount = result.violations.length;
    const warningCount = result.warnings.length;

    let message = `Action validation complete for orchestrator ${input.orchestratorId}. `;
    if (result.isValid) {
      message += `Action is valid.`;
      if (warningCount > 0) {
        message += ` Found ${warningCount} warning(s).`;
      }
    } else {
      message += `Action is invalid. Found ${violationCount} violation(s).`;
    }

    return {
      success: true,
      message,
      data: result,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to validate action: ${errorMessage}`,
      error: {
        code: 'VALIDATE_ACTION_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
