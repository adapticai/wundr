/**
 * Get System Health Tool
 *
 * Get overall system health status including active orchestrators,
 * total sessions, and error rates.
 * GET /api/observability/health
 */

import { z } from 'zod';
import type { NeolithAPIClient } from '../../types/index';

// ============================================================================
// Input Schema
// ============================================================================

export const getSystemHealthInputSchema = z.object({
  // No input parameters required
});

export type GetSystemHealthInput = z.infer<typeof getSystemHealthInputSchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface SystemHealthData {
  status: 'healthy' | 'degraded' | 'critical';
  activeOrchestrators: number;
  totalSessions: number;
  errorRate: number; // Percentage
  timestamp: string;
  uptime: number; // Milliseconds
  version: string;
}

export interface GetSystemHealthResponse {
  data: SystemHealthData;
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

export async function getSystemHealth(
  apiClient: NeolithAPIClient,
  input: GetSystemHealthInput
): Promise<McpToolResult<SystemHealthData>> {
  try {
    // Make API request
    const path = '/api/observability/health';
    const response = await apiClient.get<GetSystemHealthResponse>(path);

    return {
      success: true,
      message: `System health: ${response.data.status}`,
      data: response.data,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to get system health: ${errorMessage}`,
      errorDetails: {
        code: 'GET_SYSTEM_HEALTH_ERROR',
        message: errorMessage,
        details: error,
      },
    };
  }
}
