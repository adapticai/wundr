/**
 * Acknowledge Alert Tool
 *
 * Acknowledge a specific health alert to mark it as seen/handled.
 * POST /api/observability/alerts/[alertId]/acknowledge
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const acknowledgeAlertInputSchema = z.object({
  alertId: z.string().describe('The alert ID to acknowledge'),
});

export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface AcknowledgeAlertData {
  alertId: string;
  acknowledged: boolean;
  acknowledgedBy: string;
  acknowledgedAt: string;
}

export interface AcknowledgeAlertResponse {
  data: AcknowledgeAlertData;
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

export async function acknowledgeAlert(
  apiClient: NeolithAPIClient,
  input: AcknowledgeAlertInput
): Promise<McpToolResult<AcknowledgeAlertData>> {
  try {
    // Make API request
    const path = `/api/observability/alerts/${input.alertId}/acknowledge`;
    const response = await apiClient.post<AcknowledgeAlertResponse>(path);

    return {
      success: true,
      message: `Alert ${input.alertId} acknowledged successfully`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to acknowledge alert: ${errorMessage}`,
      errorDetails: {
        code: 'ACKNOWLEDGE_ALERT_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
