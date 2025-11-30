/**
 * Get Active Alerts Tool
 *
 * List all active health alerts in the system.
 * Can be filtered by severity and orchestrator ID.
 * GET /api/observability/alerts
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getActiveAlertsInputSchema = z.object({
  severity: z.enum(['critical', 'warning', 'info']).optional().describe('Filter by alert severity'),
  orchestratorId: z.string().optional().describe('Filter by orchestrator ID'),
});

export type GetActiveAlertsInput = z.infer<typeof getActiveAlertsInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface Alert {
  id: string;
  type: 'high_error_rate' | 'high_latency' | 'resource_exhaustion' | 'orchestrator_failure' | 'session_timeout' | 'memory_leak';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  orchestratorId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface GetActiveAlertsResponse {
  data: {
    alerts: Alert[];
    total: number;
  };
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

export async function getActiveAlerts(
  apiClient: NeolithAPIClient,
  input: GetActiveAlertsInput
): Promise<McpToolResult<{ alerts: Alert[]; total: number }>> {
  try {
    // Build query parameters
    const params: Record<string, unknown> = {};
    if (input.severity) {
      params.severity = input.severity;
    }
    if (input.orchestratorId) {
      params.orchestratorId = input.orchestratorId;
    }

    // Make API request
    const path = '/api/observability/alerts';
    const response = await apiClient.get<GetActiveAlertsResponse>(path, params);

    const filterDesc = [];
    if (input.severity) filterDesc.push(`severity: ${input.severity}`);
    if (input.orchestratorId) filterDesc.push(`orchestrator: ${input.orchestratorId}`);
    const filterText = filterDesc.length > 0 ? ` (${filterDesc.join(', ')})` : '';

    return {
      success: true,
      message: `Found ${response.data.total} active alert(s)${filterText}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to get active alerts: ${errorMessage}`,
      errorDetails: {
        code: 'GET_ACTIVE_ALERTS_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
